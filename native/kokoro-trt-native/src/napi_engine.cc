/**
 * napi_engine.cc — EngineWrapper Napi 绑定实现
 */

#include "napi_engine.h"
#include "tokenizer.h"
#include "phonemizer.h"
#include "ort_inference.h"
#include "audio_decoder.h"
#include "voice_manager.h"
#include "model_cache.h"

#include <filesystem>
#include <stdexcept>
#include <thread>

namespace fs = std::filesystem;

namespace kokoro {

// ============================================================
// EngineWrapper::Impl — 内部组件持有者
// ============================================================
struct EngineWrapper::Impl {
    Tokenizer tokenizer;
    Phonemizer phonemizer;
    std::unique_ptr<ORTInference> inference;
    AudioDecoder decoder;
    VoiceManager voice_mgr;

    std::string model_dir;
    std::string cache_dir;
    std::string onnx_path;
};

// ============================================================
// Napi 类注册
// ============================================================
Napi::Function EngineWrapper::GetClass(Napi::Env env) {
    return DefineClass(env, "KokoroTRTEngine",
        {
            InstanceMethod<&EngineWrapper::Initialize>("initialize"),
            InstanceMethod<&EngineWrapper::Synthesize>("synthesize"),
            InstanceMethod<&EngineWrapper::GetVoices>("getVoices"),
            InstanceMethod<&EngineWrapper::GetStatus>("getStatus"),
            InstanceMethod<&EngineWrapper::Destroy>("destroy"),
        });
}

// ============================================================
// 构造 / 析构
// ============================================================
EngineWrapper::EngineWrapper(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<EngineWrapper>(info)
{
    impl_ = std::make_unique<Impl>();
    impl_->inference = std::make_unique<ORTInference>();

    if (info.Length() > 0 && info[0].IsObject()) {
        Napi::Object opts = info[0].As<Napi::Object>();

        if (opts.Has("modelDir"))
            config_.model_dir = opts.Get("modelDir").As<Napi::String>().Utf8Value();

        config_.cache_dir = opts.Has("cacheDir")
            ? opts.Get("cacheDir").As<Napi::String>().Utf8Value()
            : config_.model_dir + "/cache";

        if (opts.Has("deviceId"))
            config_.device_id = opts.Get("deviceId").As<Napi::Number>().Int32Value();

        if (opts.Has("maxConcurrency"))
            config_.max_concurrency = opts.Get("maxConcurrency").As<Napi::Number>().Int32Value();
    }

    impl_->model_dir = config_.model_dir;
    impl_->cache_dir = config_.cache_dir;
    impl_->onnx_path = config_.model_dir + "/model.onnx";
}

EngineWrapper::~EngineWrapper() {
    if (!destroyed_) {
        impl_.reset();
    }
}

// ============================================================
// Initialize — 加载所有模型组件
// ============================================================
Napi::Value EngineWrapper::Initialize(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (status_.initialized) {
        return Napi::Boolean::New(env, true);
    }

    try {
        // 1. Tokenizer
        std::string tokens_path = impl_->model_dir + "/tokens.txt";
        if (!impl_->tokenizer.Load(tokens_path)) {
            throw std::runtime_error("Tokenizer 加载失败: " + tokens_path);
        }

        // 2. Phonemizer
        if (!impl_->phonemizer.Load(impl_->model_dir)) {
            throw std::runtime_error("Phonemizer 加载失败");
        }

        // 3. Voice Manager
        std::string voices_path = impl_->model_dir + "/voices.bin";
        if (!impl_->voice_mgr.Load(voices_path, impl_->model_dir)) {
            throw std::runtime_error("VoiceManager 加载失败: " + voices_path);
        }

        // 4. ONNX Runtime
        bool or_ok = impl_->inference->LoadModel(
            impl_->onnx_path, config_.device_id);

        status_.trt_available = or_ok;
        status_.device_name = or_ok
            ? impl_->inference->GetDeviceName()
            : "ONNX Runtime 不可用";

        status_.initialized = true;
        status_.model_loaded = true;

        return Napi::Boolean::New(env, true);
    }
    catch (const std::exception& ex) {
        status_.initialized = false;
        Napi::Error::New(env, ex.what()).ThrowAsJavaScriptException();
        return Napi::Boolean::New(env, false);
    }
}

// ============================================================
// Synthesize — 文本 → 语音合成
// ============================================================
Napi::Value EngineWrapper::Synthesize(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (!status_.initialized) {
        Napi::Error::New(env, "引擎未初始化").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    if (info.Length() < 1 || !info[0].IsString()) {
        Napi::TypeError::New(env, "synthesize(text, options?) 需要 text 参数")
            .ThrowAsJavaScriptException();
        return env.Undefined();
    }

    std::string text = info[0].As<Napi::String>().Utf8Value();

    SynthesizeOptions opts;
    if (info.Length() > 1 && info[1].IsObject()) {
        Napi::Object o = info[1].As<Napi::Object>();
        if (o.Has("voiceId"))
            opts.voice_id = o.Get("voiceId").As<Napi::String>().Utf8Value();
        if (o.Has("speed"))
            opts.speed = o.Get("speed").As<Napi::Number>().FloatValue();
        if (o.Has("lang"))
            opts.lang = o.Get("lang").As<Napi::String>().Utf8Value();
    }

    try {
        // 1. Tokenize
        auto token_ids = impl_->tokenizer.Encode(text);

        // 2. Phonemize
        auto phoneme_ids = impl_->phonemizer.Phonemize(text, opts.lang);

        // 3. 获取语音嵌入
        const auto* embed = impl_->voice_mgr.GetEmbedding(opts.voice_id);
        if (!embed) {
            throw std::runtime_error("未知语音: " + opts.voice_id);
        }

        // 4. ONNX Runtime 推理 (用音素 ID, 模型直接输出音频)
        auto mel = impl_->inference->Run(phoneme_ids, *embed, opts.speed);

        // 5. Kokoro 模型输出的是音频波形，不需要 Griffin-Lim
        float duration = static_cast<float>(mel.mel_data.size()) / mel.sample_rate;

        Napi::Object result = Napi::Object::New(env);
        result.Set("sampleRate", Napi::Number::New(env, mel.sample_rate));
        result.Set("channels", Napi::Number::New(env, 1));
        result.Set("duration", Napi::Number::New(env, duration));

        Napi::Float32Array arr = Napi::Float32Array::New(env, mel.mel_data.size());
        std::memcpy(arr.Data(), mel.mel_data.data(), mel.mel_data.size() * sizeof(float));
        result.Set("samples", arr);

        return result;
    }
    catch (const std::exception& ex) {
        Napi::Error::New(env, ex.what()).ThrowAsJavaScriptException();
        return env.Undefined();
    }
}

// ============================================================
// GetVoices
// ============================================================
Napi::Value EngineWrapper::GetVoices(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (!status_.initialized) {
        Napi::Error::New(env, "引擎未初始化").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    std::string filter;
    if (info.Length() > 0 && info[0].IsString()) {
        filter = info[0].As<Napi::String>().Utf8Value();
    }

    auto voices = impl_->voice_mgr.ListVoices(filter);
    Napi::Array arr = Napi::Array::New(env, voices.size());

    for (size_t i = 0; i < voices.size(); ++i) {
        Napi::Object v = Napi::Object::New(env);
        v.Set("voiceId", Napi::String::New(env, voices[i].voice_id));
        v.Set("name", Napi::String::New(env, voices[i].name));
        v.Set("lang", Napi::String::New(env, voices[i].lang));
        v.Set("gender", Napi::String::New(env, voices[i].gender));
        arr.Set(i, v);
    }

    return arr;
}

// ============================================================
// GetStatus
// ============================================================
Napi::Value EngineWrapper::GetStatus(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    Napi::Object s = Napi::Object::New(env);
    s.Set("initialized", Napi::Boolean::New(env, status_.initialized));
    s.Set("modelLoaded", Napi::Boolean::New(env, status_.model_loaded));
    s.Set("trtAvailable", Napi::Boolean::New(env, status_.trt_available));
    s.Set("deviceName", Napi::String::New(env, status_.device_name));
    s.Set("vramUsed", Napi::Number::New(env, static_cast<double>(status_.vram_used_mb)));
    return s;
}

// ============================================================
// Destroy
// ============================================================
Napi::Value EngineWrapper::Destroy(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (!destroyed_) {
        impl_.reset();
        status_.initialized = false;
        destroyed_ = true;
    }
    return Napi::Boolean::New(env, true);
}

} // namespace kokoro
