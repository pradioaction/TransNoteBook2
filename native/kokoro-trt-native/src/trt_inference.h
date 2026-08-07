#pragma once

#include "kokoro_engine.h"
#include <vector>
#include <memory>
#include <string>

namespace kokoro {

/**
 * TensorRT 推理引擎封装
 *
 * 管线:
 *   input_ids (1×N) + voice_embed (1×D) → TRT Engine → mel spectrogram (80×T)
 */
class TRTInference {
public:
    struct MelResult {
        int sample_rate = 24000;
        int mel_frames = 0;              // T
        std::vector<float> mel_data;     // shape: [80 × T], row-major
    };

    TRTInference();
    ~TRTInference();

    // 禁止拷贝
    TRTInference(const TRTInference&) = delete;
    TRTInference& operator=(const TRTInference&) = delete;

    /**
     * 从 ONNX 构建 TensorRT engine, 或加载缓存的 .engine 文件
     * @param onnx_path  ONNX 模型路径
     * @param cache_path TRT engine 缓存路径
     * @param device_id  GPU 设备 ID
     */
    bool BuildOrLoad(const std::string& onnx_path,
                     const std::string& cache_path,
                     int device_id = 0);

    /**
     * 执行推理
     * @param input_ids       token ID 序列
     * @param voice_embedding 语音嵌入向量 (256 维)
     * @param speed           语速因子
     */
    MelResult Run(const std::vector<int32_t>& input_ids,
                  const std::vector<float>& voice_embedding,
                  float speed = 1.0f);

    bool IsReady() const;
    std::string GetDeviceName() const;
    size_t GetVRAMUsageMB() const;

private:
    // 使用 ONNX-TRT Parser 构建 engine
    bool BuildFromONNX(const std::string& onnx_path,
                       const std::string& cache_path);

    // 从缓存加载 engine
    bool LoadFromCache(const std::string& cache_path);

    // TRT engine 序列化到缓存
    bool SaveToCache(const std::string& cache_path);

    // PIMPL: 隐藏 TensorRT 头文件依赖
    struct Impl;
    std::unique_ptr<Impl> impl_;
};

} // namespace kokoro
