#pragma once

#include "kokoro_engine.h"
#include <vector>
#include <memory>
#include <string>

namespace kokoro {

/**
 * ONNX Runtime 推理引擎
 *
 * 使用 ONNX Runtime C API + CUDA Execution Provider
 * 直接加载 .onnx 模型，无需转换
 */
class ORTInference {
public:
    struct MelResult {
        int sample_rate = 24000;
        int mel_frames = 0;
        std::vector<float> mel_data;
    };

    ORTInference();
    ~ORTInference();

    // 禁止拷贝
    ORTInference(const ORTInference&) = delete;
    ORTInference& operator=(const ORTInference&) = delete;

    /** 加载 ONNX 模型，启用 CUDA EP */
    bool LoadModel(const std::string& onnx_path, int device_id = 0);

    /** 执行推理 */
    MelResult Run(const std::vector<int32_t>& input_ids,
                  const std::vector<float>& voice_embedding,
                  float speed = 1.0f);

    bool IsReady() const;
    void Cleanup();
    std::string GetDeviceName() const;
    size_t GetVRAMUsageMB() const;

private:
    struct Impl;
    std::unique_ptr<Impl> impl_;
};

} // namespace kokoro
