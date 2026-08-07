#include "ort_inference.h"
#include <onnxruntime_c_api.h>
#include <cuda_runtime.h>
#include <cstring>
#include <stdexcept>
#include <algorithm>
#include <string>
#include <codecvt>

namespace kokoro {

// ============================================================
// 全局 ORT API 指针
// ============================================================
static const OrtApi* g_ort = OrtGetApiBase()->GetApi(ORT_API_VERSION);

// ============================================================
// ORTInference::Impl
// ============================================================
struct ORTInference::Impl {
    OrtEnv* env = nullptr;
    OrtSession* session = nullptr;
    OrtSessionOptions* session_options = nullptr;
    OrtMemoryInfo* memory_info = nullptr;
    OrtAllocator* allocator = nullptr;

    std::string device_name;
    size_t vram_mb = 0;

    // 模型 I/O 名称
    std::string input_name_tokens;
    std::string input_name_style;
    std::string input_name_speed;
    std::string output_name_audio;
    std::vector<std::string> output_names; // 所有输出名称

    ~Impl() {
        // 进程退出时 ORT 内部会自行清理。
        // 析构时只置空指针，不调用 Release* 避免与 ORT atexit 冲突。
        allocator = nullptr;
        memory_info = nullptr;
        session_options = nullptr;
        session = nullptr;
        env = nullptr;
    }

    void Cleanup() {
        if (allocator) { g_ort->ReleaseAllocator(allocator); allocator = nullptr; }
        if (memory_info) { g_ort->ReleaseMemoryInfo(memory_info); memory_info = nullptr; }
        if (session) { g_ort->ReleaseSession(session); session = nullptr; }
        if (session_options) { g_ort->ReleaseSessionOptions(session_options); session_options = nullptr; }
        if (env) { g_ort->ReleaseEnv(env); env = nullptr; }
    }
};

// ============================================================
// 构造 / 析构
// ============================================================
ORTInference::ORTInference()
    : impl_(std::make_unique<Impl>()) {}

ORTInference::~ORTInference() = default;

void ORTInference::Cleanup() {
    if (impl_) impl_->Cleanup();
}

// ============================================================
// LoadModel — 加载 ONNX + 配置 CUDA EP
// ============================================================
bool ORTInference::LoadModel(const std::string& onnx_path, int device_id) {
    OrtStatus* status;

    // 1. 创建 OrtEnv
    status = g_ort->CreateEnv(ORT_LOGGING_LEVEL_WARNING, "kokoro_tts", &impl_->env);
    if (status != nullptr) {
        const char* msg = g_ort->GetErrorMessage(status);
        std::string err_msg(msg);
        g_ort->ReleaseStatus(status);
        fprintf(stderr, "[ORT] CreateEnv failed: %s\n", err_msg.c_str());
        return false;
    }

    // 2. 创建 SessionOptions + CUDA EP
    g_ort->CreateSessionOptions(&impl_->session_options);

    // CUDA EP 选项 (V1 API, 结构体公开定义)
    OrtCUDAProviderOptions cuda_opts;
    cuda_opts.device_id = device_id;
    cuda_opts.arena_extend_strategy = 0; // kNextPowerOfTwo
    cuda_opts.gpu_mem_limit = SIZE_MAX;  // 不限制
    cuda_opts.cudnn_conv_algo_search = OrtCudnnConvAlgoSearchHeuristic;
    cuda_opts.do_copy_in_default_stream = 1;
    cuda_opts.has_user_compute_stream = 0;
    cuda_opts.user_compute_stream = nullptr;
    cuda_opts.default_memory_arena_cfg = nullptr;

    status = g_ort->SessionOptionsAppendExecutionProvider_CUDA(
        impl_->session_options, &cuda_opts);

    if (status != nullptr) {
        const char* msg = g_ort->GetErrorMessage(status);
        fprintf(stderr, "[ORT] CUDA EP setup failed: %s\n", msg);
        // 不致命, 可回退 CPU
        g_ort->ReleaseStatus(status);
    }

    // 设置图优化
    g_ort->SetSessionGraphOptimizationLevel(impl_->session_options, ORT_ENABLE_ALL);

    // 3. 加载模型 (Windows 需要 wchar_t*)
    std::wstring_convert<std::codecvt_utf8_utf16<wchar_t>> converter;
    std::wstring wpath = converter.from_bytes(onnx_path);

    status = g_ort->CreateSession(impl_->env, wpath.c_str(),
                                   impl_->session_options, &impl_->session);
    if (status != nullptr) {
        const char* msg = g_ort->GetErrorMessage(status);
        fprintf(stderr, "[ORT] CreateSession failed: %s\n", msg);
        g_ort->ReleaseStatus(status);
        return false;
    }

    // 4. 获取 I/O 信息
    g_ort->GetAllocatorWithDefaultOptions(&impl_->allocator);

    size_t num_inputs;
    g_ort->SessionGetInputCount(impl_->session, &num_inputs);

    for (size_t i = 0; i < num_inputs; ++i) {
        char* name = nullptr;
        g_ort->SessionGetInputName(impl_->session, i, impl_->allocator, &name);
        std::string sname(name);
        g_ort->AllocatorFree(impl_->allocator, name);

        if (sname == "tokens" || sname == "input_ids" || sname == "input") {
            impl_->input_name_tokens = sname;
        } else if (sname == "style" || sname == "voice" || sname == "ref_s") {
            impl_->input_name_style = sname;
        } else if (sname == "speed") {
            impl_->input_name_speed = sname;
        }
    }

    size_t num_outputs;
    g_ort->SessionGetOutputCount(impl_->session, &num_outputs);

    for (size_t i = 0; i < num_outputs; ++i) {
        char* name = nullptr;
        g_ort->SessionGetOutputName(impl_->session, i, impl_->allocator, &name);
        std::string sname(name);
        g_ort->AllocatorFree(impl_->allocator, name);

        impl_->output_names.push_back(sname);  // 保存全部输出名称

        if (sname == "audio" || sname == "mel" || sname == "output") {
            impl_->output_name_audio = sname;
        }
    }

    // 默认值兜底
    if (impl_->input_name_tokens.empty()) impl_->input_name_tokens = "input_ids";
    if (impl_->input_name_style.empty()) impl_->input_name_style = "style";
    if (impl_->input_name_speed.empty()) impl_->input_name_speed = "speed";
    if (impl_->output_name_audio.empty()) impl_->output_name_audio = "audio";

    // 5. 获取 GPU 信息
    cudaDeviceProp prop;
    cudaGetDeviceProperties(&prop, device_id);
    impl_->device_name = prop.name;
    size_t free_mem, total_mem;
    cudaMemGetInfo(&free_mem, &total_mem);
    impl_->vram_mb = (total_mem - free_mem) / (1024 * 1024);

    return true;
}

// ============================================================
// Run — 执行推理
// ============================================================
ORTInference::MelResult ORTInference::Run(
    const std::vector<int32_t>& input_ids,
    const std::vector<float>& voice_embedding,
    float speed) {

    MelResult result;
    if (!impl_->session) return result;

    // 模型输入要求 INT64 tokens
    std::vector<int64_t> tokens_i64(input_ids.size());
    for (size_t i = 0; i < input_ids.size(); ++i) {
        tokens_i64[i] = static_cast<int64_t>(input_ids[i]);
    }

    // 创建 MemoryInfo
    if (!impl_->memory_info) {
        OrtStatus* st = g_ort->CreateCpuMemoryInfo(
            OrtDeviceAllocator, OrtMemTypeDefault, &impl_->memory_info);
        if (st != nullptr) {
            g_ort->ReleaseStatus(st);
            return result;
        }
    }

    // --- 输入 1: tokens [1, N] INT64 ---
    int64_t shape_tokens[] = {1, static_cast<int64_t>(tokens_i64.size())};
    OrtValue* input_tokens = nullptr;
    OrtStatus* status = g_ort->CreateTensorWithDataAsOrtValue(
        impl_->memory_info,
        tokens_i64.data(),
        tokens_i64.size() * sizeof(int64_t),
        shape_tokens, 2,
        ONNX_TENSOR_ELEMENT_DATA_TYPE_INT64,
        &input_tokens);
    if (status) { g_ort->ReleaseStatus(status); return result; }

    // --- 输入 2: style [1, 256] FLOAT ---
    int64_t shape_style[] = {1, static_cast<int64_t>(voice_embedding.size())};
    OrtValue* input_style = nullptr;
    status = g_ort->CreateTensorWithDataAsOrtValue(
        impl_->memory_info,
        const_cast<float*>(voice_embedding.data()),
        voice_embedding.size() * sizeof(float),
        shape_style, 2,
        ONNX_TENSOR_ELEMENT_DATA_TYPE_FLOAT,
        &input_style);
    if (status) { g_ort->ReleaseStatus(status); g_ort->ReleaseValue(input_tokens); return result; }

    // --- 输入 3: speed [1] FLOAT ---
    float spd = speed;
    int64_t shape_speed[] = {1};
    OrtValue* input_speed = nullptr;
    status = g_ort->CreateTensorWithDataAsOrtValue(
        impl_->memory_info,
        &spd, sizeof(float),
        shape_speed, 1,
        ONNX_TENSOR_ELEMENT_DATA_TYPE_FLOAT,
        &input_speed);
    if (status) {
        g_ort->ReleaseStatus(status);
        g_ort->ReleaseValue(input_tokens);
        g_ort->ReleaseValue(input_style);
        return result;
    }

    // --- 运行 ---
    const char* input_names[] = {
        impl_->input_name_tokens.c_str(),
        impl_->input_name_style.c_str(),
        impl_->input_name_speed.c_str(),
    };
    const OrtValue* inputs[] = { input_tokens, input_style, input_speed };

    // 构建输出名称列表
    std::vector<const char*> output_name_ptrs;
    for (const auto& n : impl_->output_names) {
        output_name_ptrs.push_back(n.c_str());
    }

    std::vector<OrtValue*> output_tensors(impl_->output_names.size(), nullptr);

    status = g_ort->Run(impl_->session, nullptr,
                         input_names, inputs, 3,
                         output_name_ptrs.data(), output_name_ptrs.size(),
                         output_tensors.data());

    if (status != nullptr) {
        const char* msg = g_ort->GetErrorMessage(status);
        fprintf(stderr, "[ORT] Run failed: %s\n", msg);
        g_ort->ReleaseStatus(status);
    } else if (!output_tensors.empty() && output_tensors[0]) {
        // --- 读取第一个输出 (audio) ---
        auto* output_tensor = output_tensors[0];

        OrtTensorTypeAndShapeInfo* info = nullptr;
        g_ort->GetTensorTypeAndShape(output_tensor, &info);

        size_t ndims = 0;
        g_ort->GetDimensionsCount(info, &ndims);
        std::vector<int64_t> out_shape(ndims);
        g_ort->GetDimensions(info, out_shape.data(), ndims);

        size_t total = 1;
        for (size_t d = 0; d < ndims; ++d) total *= static_cast<size_t>(out_shape[d]);

        float* data = nullptr;
        g_ort->GetTensorMutableData(output_tensor, reinterpret_cast<void**>(&data));

        result.mel_data.assign(data, data + total);
        result.sample_rate = 24000;
        result.mel_frames = static_cast<int>(
            ndims >= 2 ? out_shape[out_shape.size() - 1] : total);

        g_ort->ReleaseTensorTypeAndShapeInfo(info);
    }

    // --- 清理 ---
    for (auto* t : output_tensors) {
        if (t) g_ort->ReleaseValue(t);
    }
    g_ort->ReleaseValue(input_tokens);
    g_ort->ReleaseValue(input_style);
    g_ort->ReleaseValue(input_speed);

    return result;
}

// ============================================================
// 状态查询
// ============================================================
bool ORTInference::IsReady() const {
    return impl_->session != nullptr;
}

std::string ORTInference::GetDeviceName() const {
    return impl_->device_name;
}

size_t ORTInference::GetVRAMUsageMB() const {
    return impl_->vram_mb;
}

} // namespace kokoro
