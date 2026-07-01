// tts-server.exe — TTS 引擎 IPC 通信壳
//
// 通过 stdin/stdout 与父进程（Node.js）通信的常驻进程。
//
// 协议：
//   stdin （每行一个 JSON 命令）：
//     {"cmd":"init","model_dir":"...","num_threads":2,"debug":1,"provider":"cpu"}
//     {"cmd":"speak","text":"hello","sid":0,"speed":1.0}
//     {"cmd":"cancel"}
//     {"cmd":"ping"}
//     {"cmd":"exit"}
//
//   stdout（JSON 控制行 + 二进制音频数据）：
//     {"type":"ready","version":"1.0.0"}
//     {"type":"init_done","sample_rate":24000,"num_speakers":53}
//     {"type":"init_error","msg":"..."}
//     {"type":"progress","pct":0.5}
//     {"type":"audio","sample_rate":24000,"num_samples":96000}   ← 下一行就是 WAV 二进制
//     <WAV binary data (num_samples * 2 bytes + 44 bytes header)>
//     {"type":"error","msg":"..."}
//     {"type":"pong"}

#include "TtsEngine.h"

#include <cstdio>
#include <cstdlib>
#include <cstdarg>
#include <cstring>
#include <cstdint>
#include <string>
#include <vector>

// Windows：stdout 切到二进制模式，防止 WAV 二进制数据被 \n → \r\n 破坏
#ifdef _WIN32
#include <io.h>
#include <fcntl.h>
#endif

// ============================================================
// 简易 JSON 解析器（仅用于本项目的固定格式）
// ============================================================

/// 从 JSON 字符串提取字符串值（不含引号），如 {"key":"value"} 中提取 value
/// @return 空字符串表示未找到
static std::string json_get_string(const char *json, const char *key) {
    std::string search = "\"";
    search += key;
    search += "\":\"";

    const char *p = strstr(json, search.c_str());
    if (!p) return "";

    p += search.length();
    const char *end = strchr(p, '"');
    if (!end) return "";

    return std::string(p, end - p);
}

/// 从 JSON 字符串提取整数值，如 {"key":42}
/// @param default_val 未找到时的默认值
static int json_get_int(const char *json, const char *key, int default_val) {
    std::string search = "\"";
    search += key;
    search += "\":";

    const char *p = strstr(json, search.c_str());
    if (!p) return default_val;

    p += search.length();

    // 跳过空白
    while (*p == ' ' || *p == '\t') p++;

    return atoi(p);
}

/// 从 JSON 字符串提取浮点数值
static float json_get_float(const char *json, const char *key, float default_val) {
    std::string search = "\"";
    search += key;
    search += "\":";

    const char *p = strstr(json, search.c_str());
    if (!p) return default_val;

    p += search.length();

    // 跳过空白
    while (*p == ' ' || *p == '\t') p++;

    return (float)atof(p);
}

// ============================================================
// JSON 输出工具
// ============================================================

static void send_json(const char *fmt, ...) {
    va_list args;
    va_start(args, fmt);

    char buf[4096];
    vsnprintf(buf, sizeof(buf), fmt, args);
    va_end(args);

    fprintf(stdout, "%s\n", buf);
    fflush(stdout);
}

// ============================================================
// WAV 编码（将 float PCM 转为 WAV 二进制）
// ============================================================

struct WavHeader {
    char     riff[4]         = {'R','I','F','F'};
    uint32_t file_size       = 0;
    char     wave[4]         = {'W','A','V','E'};
    char     fmt_[4]         = {'f','m','t',' '};
    uint32_t fmt_size        = 16;
    uint16_t audio_format    = 1;      // PCM
    uint16_t num_channels    = 1;      // 单声道
    uint32_t sample_rate     = 0;
    uint32_t byte_rate       = 0;
    uint16_t block_align     = 2;      // 16-bit = 2 bytes
    uint16_t bits_per_sample = 16;
    char     data[4]         = {'d','a','t','a'};
    uint32_t data_size       = 0;
};

/// 将 float PCM 编码为 WAV 二进制数据（16-bit 单声道）
/// @return 包含 WAV 数据的 vector
static std::vector<char> encode_wav(const float *samples, int num_samples,
                                    int sample_rate) {
    // data_size = num_samples * 2 bytes (16-bit)
    uint32_t data_size = num_samples * 2;
    uint32_t file_size = sizeof(WavHeader) + data_size;

    std::vector<char> wav(file_size);

    WavHeader hdr;
    hdr.file_size    = file_size - 8;   // RIFF 块大小（不含 riff + file_size 字段）
    hdr.sample_rate  = sample_rate;
    hdr.byte_rate    = sample_rate * 1 * 2;  // sample_rate * channels * bytes_per_sample
    hdr.data_size    = data_size;

    memcpy(wav.data(), &hdr, sizeof(WavHeader));

    // float [-1,1] -> int16
    int16_t *pcm = reinterpret_cast<int16_t*>(wav.data() + sizeof(WavHeader));
    for (int i = 0; i < num_samples; i++) {
        float s = samples[i];
        // 裁剪到 [-1, 1]
        if (s < -1.0f) s = -1.0f;
        if (s >  1.0f) s =  1.0f;
        pcm[i] = static_cast<int16_t>(s * 32767.0f);
    }

    return wav;
}

// ============================================================
// 主循环
// ============================================================

int main() {
#ifdef _WIN32
    // stdout 切到二进制模式，防止 WAV 二进制被破坏
    _setmode(_fileno(stdout), _O_BINARY);
#endif
    TtsEngine *engine = nullptr;

    // 发送就绪信号
    send_json("{\"type\":\"ready\",\"version\":\"%s\"}", TtsEngine_GetVersion());

    // 读取 stdin 行
    char line[65536];  // 64KB 缓冲区，足够包含长文本

    while (fgets(line, sizeof(line), stdin)) {
        // 去掉末尾换行符
        size_t len = strlen(line);
        while (len > 0 && (line[len-1] == '\n' || line[len-1] == '\r')) {
            line[--len] = '\0';
        }

        if (len == 0) continue;

        // --- 解析命令 ---
        std::string cmd = json_get_string(line, "cmd");

        if (cmd == "init") {
            // 如果引擎已存在，先销毁
            if (engine) {
                TtsEngine_Destroy(engine);
                engine = nullptr;
            }

            std::string model_dir = json_get_string(line, "model_dir");
            if (model_dir.empty()) {
                send_json("{\"type\":\"init_error\",\"msg\":\"model_dir is required\"}");
                continue;
            }

            int num_threads = json_get_int(line, "num_threads", 2);
            int debug       = json_get_int(line, "debug", 0);

            // 解析 provider（支持嵌套 json: {"cmd":"init","provider":"cpu",...}）
            std::string provider = json_get_string(line, "provider");
            if (provider.empty()) provider = "cpu";

            // 拼装路径
            std::string model_path  = model_dir + "/model.int8.onnx";
            std::string voices_path = model_dir + "/voices.bin";
            std::string tokens_path = model_dir + "/tokens.txt";
            std::string data_dir    = model_dir + "/espeak-ng-data";
            std::string dict_dir    = model_dir + "/dict";
            std::string lexicon     = model_dir + "/lexicon-us-en.txt," +
                                      model_dir + "/lexicon-zh.txt";

            TtsEngineConfig config;
            memset(&config, 0, sizeof(config));
            config.model_path    = model_path.c_str();
            config.voices_path   = voices_path.c_str();
            config.tokens_path   = tokens_path.c_str();
            config.data_dir      = data_dir.c_str();
            config.dict_dir      = dict_dir.c_str();
            config.lexicon       = lexicon.c_str();
            config.num_threads   = num_threads;
            config.debug         = debug;
            config.provider      = provider.c_str();

            engine = TtsEngine_Create(&config);
            if (!engine) {
                send_json("{\"type\":\"init_error\",\"msg\":\"Failed to create TTS engine\"}");
                continue;
            }

            int sr  = TtsEngine_GetSampleRate(engine);
            int ns  = TtsEngine_GetNumSpeakers(engine);
            send_json("{\"type\":\"init_done\",\"sample_rate\":%d,\"num_speakers\":%d}",
                      sr, ns);

        } else if (cmd == "speak") {
            if (!engine) {
                send_json("{\"type\":\"error\",\"msg\":\"Engine not initialized\"}");
                continue;
            }

            std::string text   = json_get_string(line, "text");
            int         sid    = json_get_int(line, "sid", 0);
            float       speed  = json_get_float(line, "speed", 1.0f);

            if (text.empty()) {
                send_json("{\"type\":\"error\",\"msg\":\"text is required\"}");
                continue;
            }

            // 生成语音
            TtsEngineAudio *audio = TtsEngine_Generate(
                engine, text.c_str(), sid, speed,
                [](float progress, void*) -> int {
                    send_json("{\"type\":\"progress\",\"pct\":%.3f}", progress);
                    return 1;
                },
                nullptr
            );

            if (!audio) {
                send_json("{\"type\":\"error\",\"msg\":\"Audio generation failed\"}");
                continue;
            }

            // 编码为 WAV
            std::vector<char> wav = encode_wav(
                audio->samples, audio->num_samples, audio->sample_rate);

            // 发送音频元数据
            send_json(
                "{\"type\":\"audio\",\"sample_rate\":%d,\"num_samples\":%d,\"bytes\":%zu}",
                audio->sample_rate, audio->num_samples, wav.size());

            // 发送原始 WAV 二进制数据
            fwrite(wav.data(), 1, wav.size(), stdout);
            fflush(stdout);

            TtsEngine_FreeAudio(audio);

        } else if (cmd == "cancel") {
            if (engine) {
                TtsEngine_Cancel(engine);
                send_json("{\"type\":\"cancelled\"}");
            }

        } else if (cmd == "ping") {
            send_json("{\"type\":\"pong\"}");

        } else if (cmd == "exit") {
            break;

        } else {
            send_json("{\"type\":\"error\",\"msg\":\"Unknown command: %s\"}", cmd.c_str());
        }
    }

    // 清理
    if (engine) {
        TtsEngine_Destroy(engine);
        engine = nullptr;
    }

    return 0;
}
