#pragma once

#include "kokoro_engine.h"
#include <napi.h>

namespace kokoro {

/**
 * KokoroTRTEngine — Napi 可导出的 JS 类
 *
 * JS 侧用法:
 *   const engine = new KokoroTRTEngine({ modelDir: '...' })
 *   await engine.initialize()
 *   const result = await engine.synthesize('Hello', { voiceId: 'af_heart' })
 *   const voices = await engine.getVoices()
 *   engine.destroy()
 */
class EngineWrapper : public Napi::ObjectWrap<EngineWrapper> {
public:
    static Napi::Function GetClass(Napi::Env env);

    explicit EngineWrapper(const Napi::CallbackInfo& info);
    ~EngineWrapper();

    // JS 可调方法
    Napi::Value Initialize(const Napi::CallbackInfo& info);
    Napi::Value Synthesize(const Napi::CallbackInfo& info);
    Napi::Value GetVoices(const Napi::CallbackInfo& info);
    Napi::Value GetStatus(const Napi::CallbackInfo& info);
    Napi::Value Destroy(const Napi::CallbackInfo& info);

private:
    EngineConfig config_;
    EngineStatus status_;
    bool destroyed_ = false;

    // 内部组件 (前向声明, 实现在 .cc)
    struct Impl;
    std::unique_ptr<Impl> impl_;
};

} // namespace kokoro
