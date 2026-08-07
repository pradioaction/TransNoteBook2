#pragma once

#include <napi.h>
#include <string>
#include <vector>
#include <memory>

namespace kokoro {

// ============================================================
// 结构体定义
// ============================================================

struct EngineConfig {
    std::string model_dir;      // model/kokoro-int8-multi-lang-v1_0/
    std::string cache_dir;      // TensorRT engine 缓存目录
    int device_id = 0;
    int max_concurrency = 1;
};

struct SynthesizeOptions {
    std::string voice_id = "af_heart";
    float speed = 1.0f;
    std::string lang = "en";
};

struct SynthesizeResult {
    int sample_rate = 24000;
    int channels = 1;
    std::vector<float> samples;  // PCM float32
    float duration = 0.0f;
};

struct VoiceInfo {
    std::string voice_id;
    std::string name;
    std::string lang;
    std::string gender;
};

struct EngineStatus {
    bool initialized = false;
    bool model_loaded = false;
    bool trt_available = false;
    std::string device_name;
    size_t vram_used_mb = 0;
};

} // namespace kokoro
