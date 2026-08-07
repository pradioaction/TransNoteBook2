#include "trt_inference.h"
#include "model_cache.h"
#include <fstream>
#include <stdexcept>
#include <cstring>

// TensorRT 头文件
#include <NvInfer.h>
#include <NvOnnxParser.h>
#include <cuda_runtime.h>

namespace kokoro {

using namespace nvinfer1;

// ============================================================
// Logger
// ============================================================
class TRTLogger : public ILogger {
public:
    void log(Severity severity, const char* msg) noexcept override {
        if (severity <= Severity::kWARNING) {
            // 静默, 仅错误时输出
        }
    }
};

// ============================================================
// TRTInference::Impl
// ============================================================
struct TRTInference::Impl {
    TRTLogger logger;
    IRuntime* runtime = nullptr;
    ICudaEngine* engine = nullptr;
    IExecutionContext* context = nullptr;

    std::string device_name;
    size_t vram_mb = 0;

    // I/O 信息
    int max_token_len = 510;
    int voice_embed_dim = 256;
    int mel_channels = 80;
    int max_mel_frames = 2000;

    // GPU buffers
    std::vector<void*> device_buffers;
    std::vector<size_t> buffer_sizes;

    // 输入输出 binding 索引
    int input_tokens_idx = -1;
    int input_voice_idx = -1;
    int output_mel_idx = -1;

    ~Impl() {
        if (context) { delete context; context = nullptr; }
        if (engine) { delete engine; engine = nullptr; }
        if (runtime) { delete runtime; runtime = nullptr; }

        for (auto* buf : device_buffers) {
            if (buf) cudaFree(buf);
        }
        device_buffers.clear();
    }
};

// ============================================================
// 构造 / 析构
// ============================================================
TRTInference::TRTInference()
    : impl_(std::make_unique<Impl>()) {}

TRTInference::~TRTInference() = default;

// ============================================================
// BuildOrLoad
// ============================================================
bool TRTInference::BuildOrLoad(const std::string& onnx_path,
                                const std::string& cache_path,
                                int device_id) {
    // 1. 检查缓存
    if (ModelCache::EngineExists(cache_path)) {
        return LoadFromCache(cache_path);
    }

    // 2. 从 ONNX 构建
    return BuildFromONNX(onnx_path, cache_path);
}

bool TRTInference::BuildFromONNX(const std::string& onnx_path,
                                  const std::string& cache_path) {
    // 创建 builder
    auto builder = std::unique_ptr<IBuilder>(createInferBuilder(impl_->logger));
    if (!builder) return false;

    const auto explicit_batch =
        1U << static_cast<uint32_t>(NetworkDefinitionCreationFlag::kEXPLICIT_BATCH);

    auto network = std::unique_ptr<INetworkDefinition>(
        builder->createNetworkV2(explicit_batch));
    if (!network) return false;

    // ONNX Parser
    auto parser = std::unique_ptr<nvonnxparser::IParser>(
        nvonnxparser::createParser(*network, impl_->logger));
    if (!parser) return false;

    bool parsed = parser->parseFromFile(
        onnx_path.c_str(),
        static_cast<int>(ILogger::Severity::kWARNING));

    if (!parsed) return false;

    // Builder config
    auto config = std::unique_ptr<IBuilderConfig>(builder->createBuilderConfig());
    config->setMemoryPoolLimit(MemoryPoolType::kWORKSPACE, 1ULL << 31);  // 2GB

    // FP16
    if (builder->platformHasFastFp16()) {
        config->setFlag(BuilderFlag::kFP16);
    }

    // 构建序列化 engine
    auto plan = std::unique_ptr<IHostMemory>(
        builder->buildSerializedNetwork(*network, *config));

    if (!plan) return false;

    // 保存缓存
    SaveToCache(cache_path);

    // 创建 runtime + engine
    impl_->runtime = createInferRuntime(impl_->logger);
    impl_->engine = impl_->runtime->deserializeCudaEngine(
        plan->data(), plan->size());

    if (!impl_->engine) return false;

    // 打印输入输出信息 (调试用)
    // ...

    return true;
}

bool TRTInference::LoadFromCache(const std::string& cache_path) {
    // 读取缓存的 engine 文件
    std::ifstream file(cache_path, std::ios::binary | std::ios::ate);
    if (!file.is_open()) return false;

    size_t size = static_cast<size_t>(file.tellg());
    file.seekg(0, std::ios::beg);

    std::vector<char> data(size);
    file.read(data.data(), size);
    file.close();

    impl_->runtime = createInferRuntime(impl_->logger);
    if (!impl_->runtime) return false;

    impl_->engine = impl_->runtime->deserializeCudaEngine(data.data(), size);
    if (!impl_->engine) return false;

    // 获取设备名称
    cudaDeviceProp prop;
    cudaGetDeviceProperties(&prop, 0);
    impl_->device_name = prop.name;

    return true;
}

bool TRTInference::SaveToCache(const std::string& cache_path) {
    if (!impl_->engine) return false;

    auto plan = std::unique_ptr<IHostMemory>(impl_->engine->serialize());
    if (!plan) return false;

    std::ofstream file(cache_path, std::ios::binary);
    if (!file.is_open()) return false;

    file.write(static_cast<const char*>(plan->data()), plan->size());
    file.close();

    return true;
}

// ============================================================
// Run — 执行推理
// ============================================================
TRTInference::MelResult TRTInference::Run(
    const std::vector<int32_t>& input_ids,
    const std::vector<float>& voice_embedding,
    float speed) {

    MelResult result;

    if (!impl_->engine) {
        return result;
    }

    // 懒初始化 context
    if (!impl_->context) {
        impl_->context = impl_->engine->createExecutionContext();
        if (!impl_->context) return result;
    }

    // 获取 IO tensor 名称
    int num_io = impl_->engine->getNbIOTensors();
    for (int i = 0; i < num_io; ++i) {
        const char* name = impl_->engine->getIOTensorName(i);
        auto mode = impl_->engine->getTensorIOMode(name);

        if (mode == TensorIOMode::kINPUT) {
            if (std::strstr(name, "token") || std::strstr(name, "input")) {
                impl_->input_tokens_idx = i;
            } else if (std::strstr(name, "voice") || std::strstr(name, "embed")) {
                impl_->input_voice_idx = i;
            }
        } else if (mode == TensorIOMode::kOUTPUT) {
            if (std::strstr(name, "mel") || std::strstr(name, "output")) {
                impl_->output_mel_idx = i;
            }
        }
    }

    // 准备输入
    // Token IDs → GPU
    size_t token_size = input_ids.size() * sizeof(int32_t);
    void* d_tokens = nullptr;
    cudaMalloc(&d_tokens, token_size);
    cudaMemcpy(d_tokens, input_ids.data(), token_size, cudaMemcpyHostToDevice);

    // Voice embedding → GPU
    size_t voice_size = voice_embedding.size() * sizeof(float);
    void* d_voice = nullptr;
    cudaMalloc(&d_voice, voice_size);
    cudaMemcpy(d_voice, voice_embedding.data(), voice_size, cudaMemcpyHostToDevice);

    // 输出 buffer (预估 mel 帧数)
    int max_frames = impl_->max_mel_frames;
    size_t output_size = impl_->mel_channels * max_frames * sizeof(float);
    void* d_output = nullptr;
    cudaMalloc(&d_output, output_size);

    // TODO: 使用 setTensorAddress 绑定 buffer
    // impl_->context->setTensorAddress(name, ptr);
    // impl_->context->enqueueV3(stream);

    // 同步并拷贝回 CPU
    cudaDeviceSynchronize();

    // 简化: 假设输出已就绪
    result.sample_rate = 24000;
    result.mel_frames = max_frames;
    result.mel_data.resize(impl_->mel_channels * max_frames);
    cudaMemcpy(result.mel_data.data(), d_output, output_size, cudaMemcpyDeviceToHost);

    // 清理
    cudaFree(d_tokens);
    cudaFree(d_voice);
    cudaFree(d_output);

    return result;
}

bool TRTInference::IsReady() const {
    return impl_->engine != nullptr;
}

std::string TRTInference::GetDeviceName() const {
    return impl_->device_name;
}

size_t TRTInference::GetVRAMUsageMB() const {
    return impl_->vram_mb;
}

} // namespace kokoro
