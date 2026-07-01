#ifndef TTS_ENGINE_H_
#define TTS_ENGINE_H_

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

// ============================================================
// 导出/导入宏
// ============================================================
#if defined(_WIN32)
#   if defined(TTS_ENGINE_BUILD_SHARED_LIBS)
#       define TTS_API __declspec(dllexport)
#   else
#       define TTS_API __declspec(dllimport)
#   endif
#else
#   define TTS_API __attribute__((visibility("default")))
#endif

// ============================================================
// 类型定义
// ============================================================

/// 不透明句柄 — 指向 TTS 引擎实例
typedef struct TtsEngine TtsEngine;

/// 引擎配置
typedef struct {
    const char *model_path;     // model.int8.onnx 的完整路径
    const char *voices_path;    // voices.bin 的完整路径
    const char *tokens_path;    // tokens.txt 的完整路径
    const char *data_dir;       // espeak-ng-data 目录的完整路径
    const char *dict_dir;       // dict/ 目录的完整路径（jieba 词典）
    const char *lexicon;        // 词典文件列表，逗号分隔，如 "lex1.txt,lex2.txt"
    int         num_threads;    // ONNX Runtime 推理线程数（建议 2-4）
    int         debug;          // 1 = 打印调试日志，0 = 静默
    const char *provider;       // 推理后端: "cpu" | "dml" | "cuda"
} TtsEngineConfig;

/// 生成的音频结果
typedef struct {
    const float *samples;       // PCM float32 采样点，范围 [-1, 1]
    int          num_samples;   // 采样点数量
    int          sample_rate;   // 采样率（Hz）
} TtsEngineAudio;

/// 进度回调函数指针
/// @param progress  进度值 0.0 ~ 1.0
/// @param user_data 用户自定义数据（Create 时传入）
/// @return 返回 1 继续生成，返回 0 取消生成
typedef int (*TtsEngineProgressCallback)(float progress, void *user_data);

// ============================================================
// API 函数
// ============================================================

/// 获取 DLL 版本号
/// @return 版本字符串（静态内存，无需释放）
TTS_API const char* TtsEngine_GetVersion(void);

/// 创建 TTS 引擎实例
/// @param config  引擎配置（调用者保持有效直到 Create 返回）
/// @return 引擎句柄，失败返回 NULL
TTS_API TtsEngine* TtsEngine_Create(const TtsEngineConfig *config);

/// 销毁 TTS 引擎实例，释放所有资源
/// @param engine  TtsEngine_Create 返回的句柄
TTS_API void TtsEngine_Destroy(TtsEngine *engine);

/// 获取音频采样率
/// @param engine  引擎句柄
/// @return 采样率（Hz）
TTS_API int TtsEngine_GetSampleRate(const TtsEngine *engine);

/// 获取支持的说话人数量
/// @param engine  引擎句柄
/// @return 说话人数
TTS_API int TtsEngine_GetNumSpeakers(const TtsEngine *engine);

/// 生成语音
/// @param engine     引擎句柄
/// @param text       输入文本（UTF-8）
/// @param speaker_id 说话人 ID（0 ~ GetNumSpeakers-1）
/// @param speed      语速（1.0 = 正常, >1 加快, <1 减慢）
/// @param callback   进度回调（可传 NULL）
/// @param user_data  回调用户参数
/// @return 音频结果句柄，失败返回 NULL。用完后调用 TtsEngine_FreeAudio 释放
TTS_API TtsEngineAudio* TtsEngine_Generate(
    TtsEngine *engine,
    const char *text,
    int speaker_id,
    float speed,
    TtsEngineProgressCallback callback,
    void *user_data
);

/// 释放音频结果
/// @param audio  TtsEngine_Generate 返回的结果
TTS_API void TtsEngine_FreeAudio(TtsEngineAudio *audio);

/// 取消正在进行的生成（线程安全）
/// 生成线程中的进度回调会收到 0，从而停止推理
/// @param engine  引擎句柄
TTS_API void TtsEngine_Cancel(TtsEngine *engine);

/// 将音频数据写入 WAV 文件（16-bit 单声道）
/// @param samples      PCM float32 采样点 [-1, 1]
/// @param num_samples  采样点数量
/// @param sample_rate  采样率
/// @param filename     输出文件路径
/// @return 1 成功，0 失败
TTS_API int TtsEngine_WriteWave(
    const float *samples,
    int num_samples,
    int sample_rate,
    const char *filename
);

#ifdef __cplusplus
} // extern "C"
#endif

#endif // TTS_ENGINE_H_
