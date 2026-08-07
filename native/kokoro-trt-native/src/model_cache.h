#pragma once

#include <string>

namespace kokoro {

/**
 * 模型缓存管理: ONNX → TensorRT engine 转换 + 缓存
 *
 * 流程:
 *   1. 检查 .engine 缓存是否存在
 *   2. 存在 → 直接加载
 *   3. 不存在 → 调用 trtexec / ONNX-TRT Parser 构建, 缓存到 .engine
 *
 * 缓存路径: {cache_dir}/model_int8_fp16.engine
 */
class ModelCache {
public:
    ModelCache() = default;

    /**
     * 获取 engine 缓存路径
     * @param onnx_path   ONNX 文件路径
     * @param cache_dir   缓存目录
     * @param fp16        是否 FP16 精度
     * @return engine 缓存文件完整路径
     */
    static std::string GetEnginePath(const std::string& onnx_path,
                                      const std::string& cache_dir,
                                      bool fp16 = true);

    /** 检查 engine 缓存是否存在 */
    static bool EngineExists(const std::string& engine_path);

    /**
     * 使用 trtexec.exe 将 ONNX 转为 TensorRT engine
     * @param onnx_path   ONNX 文件路径
     * @param engine_path 输出 engine 路径
     * @param fp16        FP16 精度
     * @param device_id   GPU 设备 ID
     * @return 成功/失败
     */
    static bool ConvertWithTrtexec(const std::string& onnx_path,
                                    const std::string& engine_path,
                                    const std::string& trtexec_path,
                                    bool fp16 = true,
                                    int device_id = 0);

    /**
     * 输入/输出节点名称 (Kokoro ONNX 模型固定)
     */
    static constexpr const char* kInputName  = "input_ids";
    static constexpr const char* kOutputName = "mel";
    static constexpr const char* kVoiceInput  = "voice_embedding";
};

} // namespace kokoro
