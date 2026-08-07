#include "model_cache.h"
#include <fstream>
#include <filesystem>
#include <cstdio>
#include <array>
#include <memory>

#ifdef _WIN32
#include <windows.h>
#endif

namespace fs = std::filesystem;
namespace kokoro {

std::string ModelCache::GetEnginePath(const std::string& onnx_path,
                                       const std::string& cache_dir,
                                       bool fp16) {
    // 从 ONNX 文件名 + FP16 标志生成 engine 缓存路径
    fs::path onnx_p(onnx_path);
    std::string stem = onnx_p.stem().string();
    std::string suffix = fp16 ? "_fp16.engine" : "_fp32.engine";

    // 如果 cache_dir 不存在, 创建
    std::error_code ec;
    fs::create_directories(cache_dir, ec);

    return (fs::path(cache_dir) / (stem + suffix)).string();
}

bool ModelCache::EngineExists(const std::string& engine_path) {
    return fs::exists(engine_path) && fs::file_size(engine_path) > 0;
}

bool ModelCache::ConvertWithTrtexec(const std::string& onnx_path,
                                     const std::string& engine_path,
                                     const std::string& trtexec_path,
                                     bool fp16,
                                     int device_id) {
    // 构建 trtexec 命令
    // trtexec --onnx=model.onnx --saveEngine=model.engine --fp16 --device=0
    std::string cmd = "\"" + trtexec_path + "\"";
    cmd += " --onnx=\"" + onnx_path + "\"";
    cmd += " --saveEngine=\"" + engine_path + "\"";
    cmd += " --device=" + std::to_string(device_id);

    if (fp16) {
        cmd += " --fp16";
    }

    // 内存优化: 限制工作空间
    cmd += " --workspace=2048";
    cmd += " --memPoolSize=workspace:2048";

    // 静默输出
    cmd += " --verbose=false";

#ifdef _WIN32
    // 使用 CreateProcess 执行 (避免弹窗)
    STARTUPINFOA si = { sizeof(si) };
    PROCESS_INFORMATION pi = {};

    si.dwFlags = STARTF_USESHOWWINDOW;
    si.wShowWindow = SW_HIDE;

    // 需要可写副本
    std::vector<char> cmd_buf(cmd.begin(), cmd.end());
    cmd_buf.push_back('\0');

    BOOL ok = CreateProcessA(
        nullptr, cmd_buf.data(),
        nullptr, nullptr,
        FALSE,
        CREATE_NO_WINDOW,
        nullptr, nullptr,
        &si, &pi
    );

    if (!ok) return false;

    // 等待完成, 最多 5 分钟
    WaitForSingleObject(pi.hProcess, 300000);
    CloseHandle(pi.hProcess);
    CloseHandle(pi.hThread);

#else
    int ret = std::system(cmd.c_str());
    if (ret != 0) return false;
#endif

    return EngineExists(engine_path);
}

} // namespace kokoro
