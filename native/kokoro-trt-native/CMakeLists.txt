cmake_minimum_required(VERSION 3.20)
project(kokoro_trt_native LANGUAGES CXX CUDA)

# ============================================================
# C++ 标准
# ============================================================
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CUDA_STANDARD 17)
set(CMAKE_CUDA_STANDARD_REQUIRED ON)

# ============================================================
# node-addon-api (通过 npm 安装)
# ============================================================
execute_process(
    COMMAND node -p "require('node-addon-api').include"
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
    OUTPUT_VARIABLE NODE_ADDON_API_INCLUDE
    OUTPUT_STRIP_TRAILING_WHITESPACE
)
string(REPLACE "\"" "" NODE_ADDON_API_INCLUDE ${NODE_ADDON_API_INCLUDE})

# ============================================================
# CUDA Toolkit
# ============================================================
set(CUDA_TOOLKIT_ROOT_DIR "C:/Program Files/NVIDIA GPU Computing Toolkit/CUDA/v12.8")
find_package(CUDA REQUIRED)
include_directories(${CUDA_INCLUDE_DIRS})

# ============================================================
# TensorRT (保留, 后续可用)
# ============================================================
set(TENSORRT_ROOT "G:/program/tensorrt/TensorRT-10.9.0.34")
set(TENSORRT_INCLUDE_DIR ${TENSORRT_ROOT}/include)
set(TENSORRT_LIB_DIR ${TENSORRT_ROOT}/lib)

include_directories(${TENSORRT_INCLUDE_DIR})

set(TENSORRT_LIBS
    ${TENSORRT_LIB_DIR}/nvinfer_10.lib
    ${TENSORRT_LIB_DIR}/nvinfer_plugin_10.lib
    ${TENSORRT_LIB_DIR}/nvonnxparser_10.lib
)

# ============================================================
# ONNX Runtime (当前使用的推理后端)
# ============================================================
set(ORT_ROOT "G:/program/onnxruntime/onnxruntime-win-x64-gpu_cuda12-1.27.0")
set(ORT_INCLUDE_DIR ${ORT_ROOT}/include)
set(ORT_LIB_DIR ${ORT_ROOT}/lib)

include_directories(${ORT_INCLUDE_DIR})

set(ORT_LIBS
    ${ORT_LIB_DIR}/onnxruntime.lib
)

# ============================================================
# 源文件
# ============================================================
set(SOURCES
    src/main.cc
    src/napi_engine.cc
    src/tokenizer.cc
    src/phonemizer.cc
    src/trt_inference.cc
    src/ort_inference.cc
    src/audio_decoder.cc
    src/voice_manager.cc
    src/model_cache.cc
)

# ============================================================
# 编译为 .node 动态库
# ============================================================
add_library(${PROJECT_NAME} SHARED ${SOURCES})

target_include_directories(${PROJECT_NAME} PRIVATE
    ${CMAKE_SOURCE_DIR}/src
    ${NODE_ADDON_API_INCLUDE}
    ${CMAKE_JS_INC}
)

target_link_libraries(${PROJECT_NAME} PRIVATE
    ${CMAKE_JS_LIB}
    ${ORT_LIBS}
    ${TENSORRT_LIBS}
    ${CUDA_LIBRARIES}
    cudnn
    cublas
)

# Napi 宏定义
target_compile_definitions(${PROJECT_NAME} PRIVATE
    NAPI_VERSION=8
    NAPI_DISABLE_CPP_EXCEPTIONS
)

# MSVC 编译选项
if(MSVC)
    target_compile_options(${PROJECT_NAME} PRIVATE /W3 /EHsc /utf-8)
    # 禁止 CRT 安全警告 + M_PI 定义
    target_compile_definitions(${PROJECT_NAME} PRIVATE _CRT_SECURE_NO_WARNINGS _USE_MATH_DEFINES)
endif()

# 输出文件名
set_target_properties(${PROJECT_NAME} PROPERTIES
    PREFIX ""
    SUFFIX ".node"
)
