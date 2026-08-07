/**
 * build-native-dist.js
 *
 * 将编译好的 .node 文件和运行时 DLL 复制到 native/kokoro-trt-native/dist/
 * 供 electron-builder 的 extraResources 打包
 */

const fs = require('fs')
const path = require('path')

// Kokoro 原生插件仅支持 Windows (CUDA/TensorRT)
if (process.platform !== 'win32') {
  console.log(`[build-native-dist] 跳过: Kokoro 原生插件仅支持 Windows (当前平台: ${process.platform})`)
  process.exit(0)
}

const SRC = path.join(__dirname, '..', 'native', 'kokoro-trt-native', 'build', 'Release')
const DST = path.join(__dirname, '..', 'native', 'kokoro-trt-native', 'dist')

const ORT_DIR = 'G:/program/onnxruntime/onnxruntime-win-x64-gpu_cuda12-1.27.0/lib'
const CUDA_BIN = 'C:/Program Files/NVIDIA GPU Computing Toolkit/CUDA/v12.8/bin'

// 需要打进去的文件
const files = [
  // C++ Addon
  { src: path.join(SRC, 'kokoro_trt_native.node') },

  // ONNX Runtime DLLs (运行时)
  { src: path.join(ORT_DIR, 'onnxruntime.dll') },
  { src: path.join(ORT_DIR, 'onnxruntime_providers_cuda.dll') },
  { src: path.join(ORT_DIR, 'onnxruntime_providers_shared.dll') },

  // cuDNN 9 DLLs (ORT CUDA EP 依赖)
  { src: path.join(CUDA_BIN, 'cudnn64_9.dll') },
  { src: path.join(CUDA_BIN, 'cudnn_ops64_9.dll') },
  { src: path.join(CUDA_BIN, 'cudnn_cnn64_9.dll') },
  { src: path.join(CUDA_BIN, 'cudnn_adv64_9.dll') },
  { src: path.join(CUDA_BIN, 'cudnn_graph64_9.dll') },
  { src: path.join(CUDA_BIN, 'cudnn_engines_precompiled64_9.dll') },
  { src: path.join(CUDA_BIN, 'cudnn_engines_runtime_compiled64_9.dll') },
  { src: path.join(CUDA_BIN, 'cudnn_heuristic64_9.dll') },

  // CUDA runtime (ORT 依赖)
  { src: path.join(CUDA_BIN, 'cudart64_12.dll') },
  { src: path.join(CUDA_BIN, 'cublas64_12.dll') },
  { src: path.join(CUDA_BIN, 'cublasLt64_12.dll') },
  { src: path.join(CUDA_BIN, 'cufft64_11.dll') },
  { src: path.join(CUDA_BIN, 'curand64_10.dll') },
  { src: path.join(CUDA_BIN, 'cusolver64_11.dll') },
  { src: path.join(CUDA_BIN, 'cusparse64_12.dll') },
]

if (!fs.existsSync(DST)) {
  fs.mkdirSync(DST, { recursive: true })
}

let totalSize = 0

for (const file of files) {
  const dest = path.join(DST, path.basename(file.src))

  if (!fs.existsSync(file.src)) {
    console.warn(`  SKIP (missing): ${path.basename(file.src)}`)
    continue
  }

  fs.copyFileSync(file.src, dest)
  const size = fs.statSync(dest).size
  totalSize += size
  console.log(`  ${path.basename(file.src)} (${(size / 1024 / 1024).toFixed(1)} MB)`)
}

console.log(`\nDone. Total: ${(totalSize / 1024 / 1024).toFixed(1)} MB`)
