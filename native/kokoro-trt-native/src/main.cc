/**
 * main.cc — Napi 模块入口
 *
 * 导出:
 *   - KokoroTRTEngine 类
 *   - getEngineVersion() 工具函数
 */

#include <napi.h>
#include "napi_engine.h"

// 版本信息
Napi::String GetEngineVersion(const Napi::CallbackInfo& info) {
    return Napi::String::New(info.Env(), "0.1.0");
}

// 模块注册
Napi::Object InitAll(Napi::Env env, Napi::Object exports) {
    exports.Set("KokoroTRTEngine",
                kokoro::EngineWrapper::GetClass(env));
    exports.Set("getEngineVersion",
                Napi::Function::New(env, GetEngineVersion));
    return exports;
}

NODE_API_MODULE(kokoro_trt_native, InitAll)
