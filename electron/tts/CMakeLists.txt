cmake_minimum_required(VERSION 3.14)
project(tts-server VERSION 1.0.0 LANGUAGES C CXX)

# ============================================================
# 配置
# ============================================================

# sherpa-onnx SDK 路径（通过 -DSHERPA_ONNX_DIR= 在命令行指定）
# 默认指向 kokoro-cpp-test 中的 SDK
set(SHERPA_ONNX_DIR
    "${CMAKE_SOURCE_DIR}/../../test/kokoro-cpp-test/sherpa-onnx"
    CACHE PATH "Path to sherpa-onnx SDK directory"
)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# DLL 和 EXE 都输出到同一目录，方便运行
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin)
set(CMAKE_LIBRARY_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin)

# ============================================================
# 目标 1: TtsEngine.dll（核心 TTS 引擎）
# ============================================================

add_library(TtsEngine SHARED
    TtsEngine.cpp
)

target_include_directories(TtsEngine
    PUBLIC
        ${CMAKE_CURRENT_SOURCE_DIR}
    PRIVATE
        ${SHERPA_ONNX_DIR}/include
)

target_link_directories(TtsEngine
    PRIVATE
        ${SHERPA_ONNX_DIR}/lib
)

target_link_libraries(TtsEngine
    PRIVATE
        sherpa-onnx-c-api
        cargs
)

# 定义导出宏（让 __declspec(dllexport) 生效）
target_compile_definitions(TtsEngine
    PRIVATE
        TTS_ENGINE_BUILD_SHARED_LIBS
)

# ============================================================
# 目标 2: tts-server.exe（IPC 通信壳）
# ============================================================

add_executable(tts-server
    tts_server.cpp
)

target_include_directories(tts-server
    PRIVATE
        ${CMAKE_CURRENT_SOURCE_DIR}
)

target_link_directories(tts-server
    PRIVATE
        ${CMAKE_BINARY_DIR}/bin
)

target_link_libraries(tts-server
    PRIVATE
        TtsEngine
)

# ============================================================
# POST_BUILD: 拷贝运行时 DLL
# ============================================================

# sherpa-onnx 及其依赖
set(SDK_DLLS
    "${SHERPA_ONNX_DIR}/lib/onnxruntime.dll"
    "${SHERPA_ONNX_DIR}/lib/onnxruntime_providers_shared.dll"
    "${SHERPA_ONNX_DIR}/lib/sherpa-onnx-c-api.dll"
    "${SHERPA_ONNX_DIR}/lib/sherpa-onnx-cxx-api.dll"
    "${SHERPA_ONNX_DIR}/lib/cargs.dll"
)

foreach(_dll ${SDK_DLLS})
    add_custom_command(TARGET TtsEngine POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy_if_different
            "${_dll}" "$<TARGET_FILE_DIR:TtsEngine>"
        COMMENT "Copying ${_dll}"
    )
endforeach()

# 也拷贝到 tts-server 的输出目录
foreach(_dll ${SDK_DLLS})
    add_custom_command(TARGET tts-server POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy_if_different
            "${_dll}" "$<TARGET_FILE_DIR:tts-server>"
        COMMENT "Copying ${_dll} to tts-server dir"
    )
endforeach()
