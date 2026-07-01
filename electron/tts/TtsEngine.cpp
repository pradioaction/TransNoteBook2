#include "TtsEngine.h"

#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <atomic>

// sherpa-onnx C API
#include "sherpa-onnx/c-api/c-api.h"

// ============================================================
// 内部实现
// ============================================================

struct TtsEngine {
    const SherpaOnnxOfflineTts *tts;   // sherpa-onnx TTS 引擎
    int   sample_rate;                 // 缓存采样率
    int   num_speakers;                // 缓存说话人数
    std::atomic<int> cancel_flag;      // 取消标志（线程安全）
    TtsEngineProgressCallback user_callback;  // 用户进度回调
    void  *user_data;                 // 回调用户参数
};

// 当前正在生成语音的引擎实例（仅用于取消功能）
// 因为进度回调是 C 函数指针，无法传 this
static std::atomic<TtsEngine*> g_current_engine{nullptr};

// ============================================================
// 进度回调包装（C -> C++）
// ============================================================

static int32_t ProgressCallback(const float *samples, int32_t n, float p) {
    (void)samples;
    (void)n;

    TtsEngine *engine = g_current_engine.load();
    if (!engine) return 1;

    // 检查取消标志
    if (engine->cancel_flag.load() != 0) {
        return 0;  // 返回 0 让 sherpa-onnx 停止生成
    }

    // 调用用户回调
    if (engine->user_callback) {
        return engine->user_callback(p, engine->user_data);
    }

    return 1;
}

// ============================================================
// API 实现
// ============================================================

TTS_API const char* TtsEngine_GetVersion(void) {
    return "1.0.0";
}

TTS_API TtsEngine* TtsEngine_Create(const TtsEngineConfig *config) {
    if (!config) {
        fprintf(stderr, "[TtsEngine] Error: config is NULL\n");
        return NULL;
    }

    // 填充 sherpa-onnx 配置
    SherpaOnnxOfflineTtsConfig onnx_config;
    memset(&onnx_config, 0, sizeof(onnx_config));

    onnx_config.model.kokoro.model     = config->model_path;
    onnx_config.model.kokoro.voices    = config->voices_path;
    onnx_config.model.kokoro.tokens    = config->tokens_path;
    onnx_config.model.kokoro.data_dir  = config->data_dir;
    onnx_config.model.kokoro.dict_dir  = config->dict_dir;
    onnx_config.model.kokoro.lexicon   = config->lexicon;
    onnx_config.model.num_threads      = (config->num_threads > 0)
                                        ? config->num_threads : 2;
    onnx_config.model.debug           = config->debug ? 1 : 0;
    onnx_config.model.provider         = config->provider
                                        ? config->provider : "cpu";

    if (config->debug) {
        fprintf(stderr, "[TtsEngine] Creating engine...\n");
        fprintf(stderr, "[TtsEngine]   model:    %s\n", config->model_path);
        fprintf(stderr, "[TtsEngine]   voices:   %s\n", config->voices_path);
        fprintf(stderr, "[TtsEngine]   tokens:   %s\n", config->tokens_path);
        fprintf(stderr, "[TtsEngine]   data_dir: %s\n", config->data_dir);
        fprintf(stderr, "[TtsEngine]   dict_dir: %s\n", config->dict_dir);
        fprintf(stderr, "[TtsEngine]   lexicon:  %s\n", config->lexicon);
        fprintf(stderr, "[TtsEngine]   threads:  %d\n", onnx_config.model.num_threads);
        fprintf(stderr, "[TtsEngine]   provider: %s\n", onnx_config.model.provider);
    }

    const SherpaOnnxOfflineTts *tts = SherpaOnnxCreateOfflineTts(&onnx_config);
    if (!tts) {
        fprintf(stderr, "[TtsEngine] Error: SherpaOnnxCreateOfflineTts failed\n");
        return NULL;
    }

    // 创建引擎实例
    TtsEngine *engine = new (std::nothrow) TtsEngine();
    if (!engine) {
        fprintf(stderr, "[TtsEngine] Error: memory allocation failed\n");
        SherpaOnnxDestroyOfflineTts(tts);
        return NULL;
    }

    engine->tts           = tts;
    engine->sample_rate   = SherpaOnnxOfflineTtsSampleRate(tts);
    engine->num_speakers  = SherpaOnnxOfflineTtsNumSpeakers(tts);
    engine->cancel_flag.store(0);
    engine->user_callback = nullptr;
    engine->user_data     = nullptr;

    if (config->debug) {
        fprintf(stderr, "[TtsEngine] Engine created successfully\n");
        fprintf(stderr, "[TtsEngine]   sample_rate:  %d Hz\n", engine->sample_rate);
        fprintf(stderr, "[TtsEngine]   num_speakers: %d\n", engine->num_speakers);
    }

    return engine;
}

TTS_API void TtsEngine_Destroy(TtsEngine *engine) {
    if (!engine) return;

    if (engine->tts) {
        SherpaOnnxDestroyOfflineTts(engine->tts);
        engine->tts = nullptr;
    }

    delete engine;
}

TTS_API int TtsEngine_GetSampleRate(const TtsEngine *engine) {
    return engine ? engine->sample_rate : 0;
}

TTS_API int TtsEngine_GetNumSpeakers(const TtsEngine *engine) {
    return engine ? engine->num_speakers : 0;
}

TTS_API TtsEngineAudio* TtsEngine_Generate(
    TtsEngine *engine,
    const char *text,
    int speaker_id,
    float speed,
    TtsEngineProgressCallback callback,
    void *user_data
) {
    if (!engine || !engine->tts || !text) {
        fprintf(stderr, "[TtsEngine] Error: invalid arguments to Generate\n");
        return NULL;
    }

    // 重置取消标志
    engine->cancel_flag.store(0);
    engine->user_callback = callback;
    engine->user_data     = user_data;

    // 注册当前引擎实例（进度回调用）
    g_current_engine.store(engine);

    // 生成语音
    const SherpaOnnxGeneratedAudio *audio =
        SherpaOnnxOfflineTtsGenerateWithProgressCallback(
            engine->tts, text, speaker_id, speed, ProgressCallback);

    // 清除当前引擎注册
    g_current_engine.store(nullptr);

    if (!audio || audio->n == 0) {
        fprintf(stderr, "[TtsEngine] Error: Generate returned empty audio\n");
        return NULL;
    }

    // 包装结果
    TtsEngineAudio *result = new (std::nothrow) TtsEngineAudio();
    if (!result) {
        fprintf(stderr, "[TtsEngine] Error: memory allocation failed\n");
        return NULL;
    }

    // 先保存原始指针，拷贝音频数据后释放 sherpa-onnx 的音频内存
    int   num_samples = audio->n;
    int   sample_rate = audio->sample_rate;
    const float *src = audio->samples;

    float *samples_copy = new (std::nothrow) float[num_samples];
    if (!samples_copy) {
        fprintf(stderr, "[TtsEngine] Error: memory allocation for audio data failed\n");
        SherpaOnnxDestroyOfflineTtsGeneratedAudio(
            const_cast<SherpaOnnxGeneratedAudio*>(audio));
        delete result;
        return NULL;
    }
    memcpy(samples_copy, src, num_samples * sizeof(float));

    SherpaOnnxDestroyOfflineTtsGeneratedAudio(
        const_cast<SherpaOnnxGeneratedAudio*>(audio));

    result->samples     = samples_copy;
    result->num_samples = num_samples;
    result->sample_rate = sample_rate;

    return result;
}

TTS_API void TtsEngine_FreeAudio(TtsEngineAudio *audio) {
    if (!audio) return;

    // 释放之前拷贝的音频数据
    if (audio->samples) {
        delete[] audio->samples;
    }

    delete audio;
}

TTS_API void TtsEngine_Cancel(TtsEngine *engine) {
    if (!engine) return;
    engine->cancel_flag.store(1);
}

TTS_API int TtsEngine_WriteWave(
    const float *samples,
    int num_samples,
    int sample_rate,
    const char *filename
) {
    if (!samples || num_samples <= 0 || !filename) {
        return 0;
    }
    return SherpaOnnxWriteWave(samples, num_samples, sample_rate, filename);
}
