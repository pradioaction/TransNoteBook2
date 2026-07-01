import { ipcMain, app } from 'electron'
import path from 'path'
import fs from 'fs'
import { spawn, ChildProcess } from 'child_process'
import { loadSettings } from '../state'

// ============================================================
// TTS 子进程管理
// ============================================================

let ttsProcess: ChildProcess | null = null
let lineBuffer = ''        // 拼接不完整的 stdout 文本行
let binaryRemaining = 0     // 还需读取的 WAV 二进制字节数
let binaryBuffer = Buffer.alloc(0)  // 已收集的 WAV 二进制数据

interface PendingRequest {
  type: string
  resolve: (data: any) => void
  timer: NodeJS.Timeout
}

let pendingRequest: PendingRequest | null = null

function getTtsExePath(): string {
  const exePath = app.isPackaged
    ? path.join(process.resourcesPath, 'tts-server.exe')
    : path.join(__dirname, '../../electron/tts/build/bin/Release/tts-server.exe')

  console.log(`[TTS] mode=${app.isPackaged ? 'packaged' : 'dev'} exePath=${exePath}`)
  console.log(`[TTS]   resourcesPath=${process.resourcesPath}`)
  console.log(`[TTS]   exeExists=${fs.existsSync(exePath)}`)

  // 打包模式下检查 DLL 是否齐全
  if (app.isPackaged) {
    const dlls = ['TtsEngine.dll', 'onnxruntime.dll', 'sherpa-onnx-c-api.dll', 'sherpa-onnx-cxx-api.dll', 'cargs.dll']
    for (const dll of dlls) {
      const dllPath = path.join(process.resourcesPath, dll)
      console.log(`[TTS]   dll ${dll}=${fs.existsSync(dllPath)}`)
    }
  }

  return exePath
}

/** 处理 stdout 数据流 */
function onStdoutData(chunk: Buffer) {
  // 二进制模式：还在收 WAV 数据
  if (binaryRemaining > 0) {
    const take = Math.min(binaryRemaining, chunk.length)
    binaryBuffer = Buffer.concat([binaryBuffer, chunk.subarray(0, take)])
    binaryRemaining -= take

    if (binaryRemaining === 0) {
      const base64 = binaryBuffer.toString('base64')
      binaryBuffer = Buffer.alloc(0)

      if (pendingRequest && pendingRequest.type === 'audio') {
        clearTimeout(pendingRequest.timer)
        // 从 audioMeta 里拿 metadata
        const meta = pendingRequest as any
        pendingRequest.resolve({
          dataUrl: 'data:audio/wav;base64,' + base64,
          sampleRate: meta._sampleRate || 24000,
          numSamples: meta._numSamples || 0,
        })
        pendingRequest = null
      }
    }

    const rest = chunk.subarray(take)
    if (rest.length > 0) onStdoutData(rest)
    return
  }

  // 先把新数据加入 buffer（纯 Buffer，不变字符串）
  const buf = Buffer.concat([Buffer.from(lineBuffer, 'binary'), chunk])

  // 找第一个 \n
  const nlIdx = buf.indexOf(0x0a)
  if (nlIdx < 0) {
    // 还没收到完整行，存回 lineBuffer
    lineBuffer = buf.toString('binary')
    return
  }

  // 提取 JSON 行
  const jsonBuf = buf.subarray(0, nlIdx)
  const jsonLine = jsonBuf.toString('utf-8').trim()

  // ★ 把 \n 后面的数据存回 lineBuffer，等本次 JSON 处理完后继续解析
  lineBuffer = buf.subarray(nlIdx + 1).toString('binary')

  // 处理 JSON 行
  let handledAudio = false
  try {
    const msg = JSON.parse(jsonLine)
    console.log('[TTS] <=', msg.type)

    if (msg.type === 'audio') {
      handledAudio = true
      // audio 消息：\n 后面就是 WAV 二进制
      const afterNl = buf.subarray(nlIdx + 1)

      if (afterNl.length >= msg.bytes) {
        // 数据全了，直接提取
        const wavData = afterNl.subarray(0, msg.bytes)
        const base64 = wavData.toString('base64')

        if (pendingRequest && pendingRequest.type === 'audio') {
          clearTimeout(pendingRequest.timer)
          pendingRequest.resolve({
            dataUrl: 'data:audio/wav;base64,' + base64,
            sampleRate: msg.sample_rate,
            numSamples: msg.num_samples,
          })
          pendingRequest = null
        }

        // 剩余数据递归处理
        const rest = afterNl.subarray(msg.bytes)
        if (rest.length > 0) {
          // 放回 lineBuffer 等下次处理
          lineBuffer = rest.toString('binary')
          // 尝试继续解析（可能还有 JSON 行）
          const buf2 = Buffer.from(lineBuffer, 'binary')
          const nl2 = buf2.indexOf(0x0a)
          if (nl2 >= 0) {
            onStdoutData(Buffer.alloc(0)) // 触发一次处理
          }
        }
      } else {
        // 数据没到齐，切到二进制模式
        binaryRemaining = msg.bytes - afterNl.length
        binaryBuffer = afterNl
        // 把 metadata 存到 pendingRequest 上
        if (pendingRequest && pendingRequest.type === 'audio') {
          ;(pendingRequest as any)._sampleRate = msg.sample_rate
          ;(pendingRequest as any)._numSamples = msg.num_samples
        }
      }
    } else if (pendingRequest && msg.type === pendingRequest.type) {
      clearTimeout(pendingRequest.timer)
      pendingRequest.resolve(msg)
      pendingRequest = null
    }
  } catch {
    // JSON 解析失败，忽略
  }

  // 如果刚才处理的是非 audio 消息，且 lineBuffer 里还有数据，继续解析
  if (!handledAudio && lineBuffer) {
    const remaining = Buffer.from(lineBuffer, 'binary')
    if (remaining.indexOf(0x0a) >= 0) {
      onStdoutData(Buffer.alloc(0))
    }
  }
}

function waitForMessage(type: string, timeoutMs = 30000): Promise<any | null> {
  return new Promise((resolve) => {
    if (pendingRequest) {
      clearTimeout(pendingRequest.timer)
      pendingRequest.resolve(null)
    }
    const timer = setTimeout(() => {
      console.log(`[TTS] Timeout waiting for ${type}`)
      pendingRequest = null
      resolve(null)
    }, timeoutMs)
    pendingRequest = { type, resolve, timer }
  })
}

function spawnTtsProcess(): boolean {
  if (ttsProcess) return true

  const exePath = getTtsExePath()

  if (!fs.existsSync(exePath)) {
    console.error(`[TTS] tts-server.exe not found at: ${exePath}`)
    return false
  }

  console.log('[TTS] Spawning:', exePath)

  ttsProcess = spawn(exePath, [], { stdio: ['pipe', 'pipe', 'pipe'] })
  lineBuffer = ''
  binaryRemaining = 0
  binaryBuffer = Buffer.alloc(0)

  ttsProcess.stdout!.on('data', onStdoutData)

  ttsProcess.stderr!.on('data', (chunk: Buffer) => {
    console.error('[TTS] stderr:', chunk.toString('utf-8').trimEnd())
  })

  ttsProcess.on('exit', (code, signal) => {
    console.log(`[TTS] Process exited code=${code} signal=${signal}`)
    ttsProcess = null
    if (pendingRequest) {
      clearTimeout(pendingRequest.timer)
      pendingRequest.resolve(null)
      pendingRequest = null
    }
  })

  ttsProcess.on('error', (err) => {
    console.error('[TTS] Process spawn error:', err.message)
    ttsProcess = null
    if (pendingRequest) {
      clearTimeout(pendingRequest.timer)
      pendingRequest.resolve(null)
      pendingRequest = null
    }
  })

  return true
}

function sendCommand(cmd: Record<string, unknown>): void {
  if (!ttsProcess?.stdin) {
    console.error('[TTS] Process not running')
    return
  }
  const cmdType = cmd.cmd || cmd.type || 'unknown'
  const text = cmd.text as string | undefined
  const logInfo = text
    ? `${cmdType} textLen=${text.length} preview="${text.slice(0, 40)}${text.length > 40 ? '...' : ''}"`
    : cmdType
  console.log('[TTS] =>', logInfo)

  const json = JSON.stringify(cmd) + '\n'
  ttsProcess.stdin.write(json)
}

async function initEngine(modelDir: string): Promise<any | null> {
  console.log(`[TTS] initEngine modelDir=${modelDir}`)
  console.log(`[TTS]   modelDirExists=${fs.existsSync(modelDir)}`)

  // 如果模型目录不存在，尝试列出父目录内容辅助排查
  if (!fs.existsSync(modelDir)) {
    const parent = path.dirname(modelDir)
    if (fs.existsSync(parent)) {
      try {
        const entries = fs.readdirSync(parent)
        console.log(`[TTS]   parentDir(${parent}) contents:`, entries.slice(0, 20).join(', '))
      } catch { /* ignore */ }
    } else {
      console.log(`[TTS]   parentDir(${parent}) not found either`)
    }
  }

  const ready = await waitForMessage('ready')
  if (!ready) {
    console.error('[TTS] initEngine: did not receive "ready" message')
    return null
  }
  sendCommand({ cmd: 'init', model_dir: modelDir, num_threads: 2, debug: 1 })
  console.log('[TTS] initEngine: sent "init" command, waiting for "init_done"...')
  const result = await waitForMessage('init_done', 60000) // 模型加载给 60s 超时
  if (!result) {
    console.error('[TTS] initEngine: did not receive "init_done" (timeout)')
  } else {
    console.log('[TTS] initEngine: success', JSON.stringify(result))
  }
  return result
}

// ============================================================
// IPC Handlers
// ============================================================

export function registerTtsHandlers() {
  ipcMain.handle('tts:init', async () => {
    console.log('[TTS] ===== tts:init called =====')
    try {
      if (!spawnTtsProcess()) {
        console.error('[TTS] tts:init -> spawnTtsProcess failed')
        return { success: false, error: 'Failed to start TTS process' }
      }
      const settings = loadSettings()
      const modelDir = (settings.ttsModelPath as string) || ''
      console.log('[TTS] tts:init -> loaded settings, modelDir=' + modelDir)
      if (!modelDir) {
        console.error('[TTS] tts:init -> model path not configured')
        return { success: false, error: 'TTS model path not configured' }
      }
      const result = await initEngine(modelDir)
      if (!result) {
        console.error('[TTS] tts:init -> initEngine returned null')
        return { success: false, error: 'Failed to initialize TTS engine' }
      }
      console.log('[TTS] tts:init -> success', JSON.stringify({ sampleRate: result.sample_rate, numSpeakers: result.num_speakers }))
      return {
        success: true,
        sampleRate: result.sample_rate,
        numSpeakers: result.num_speakers,
      }
    } catch (err: any) {
      console.error('[TTS] tts:init -> exception:', err?.stack || err)
      return { success: false, error: String(err?.message ?? err) }
    }
  })

  ipcMain.handle(
    'tts:speak',
    async (_event, text: string, sid: number = 0, speed: number = 1.0) => {
      console.log(`[TTS] ===== tts:speak called textLen=${text.length} sid=${sid} speed=${speed}`)
      console.log(`[TTS]   textPreview="${text.slice(0, 60)}${text.length > 60 ? '...' : ''}"`)
      try {
        // 如果进程断了，尝试自动恢复
        if (!ttsProcess || ttsProcess.killed) {
          console.log('[TTS] tts:speak -> process dead, attempting auto-recovery')
          const settings = loadSettings()
          const modelDir = (settings.ttsModelPath as string) || ''
          if (modelDir) {
            if (!spawnTtsProcess()) {
              return { success: false, error: 'TTS not initialized' }
            }
            const result = await initEngine(modelDir)
            if (!result) {
              return { success: false, error: 'TTS re-init failed' }
            }
            console.log('[TTS] tts:speak -> auto-recovery succeeded')
          } else {
            console.error('[TTS] tts:speak -> process dead and no model path configured')
            return { success: false, error: 'TTS not initialized' }
          }
        }

        sendCommand({ cmd: 'speak', text, sid, speed })
        console.log('[TTS] tts:speak -> waiting for audio response...')
        const result = await waitForMessage('audio')
        if (!result) {
          console.error('[TTS] tts:speak -> audio timeout or null response')
          return { success: false, error: 'Audio generation failed or timed out' }
        }
        console.log(`[TTS] tts:speak -> audio received sampleRate=${result.sampleRate} dataUrlLen=${result.dataUrl?.length || 0}`)
        return { success: true, dataUrl: result.dataUrl, sampleRate: result.sampleRate }
      } catch (err: any) {
        console.error('[TTS] tts:speak -> exception:', err?.stack || err)
        return { success: false, error: String(err?.message ?? err) }
      }
    }
  )

  ipcMain.handle('tts:status', async () => {
    const running = ttsProcess !== null && !ttsProcess.killed
    console.log(`[TTS] tts:status -> running=${running}`)
    return { running }
  })

  ipcMain.handle('tts:stop', async () => {
    console.log('[TTS] ===== tts:stop called =====')
    if (ttsProcess) {
      sendCommand({ cmd: 'exit' })
      setTimeout(() => {
        if (ttsProcess && !ttsProcess.killed) {
          console.log('[TTS] tts:stop -> force killing process')
          ttsProcess.kill()
        }
      }, 3000)
    } else {
      console.log('[TTS] tts:stop -> no process to stop')
    }
    return { success: true }
  })
}

app.on('before-quit', () => {
  if (ttsProcess && !ttsProcess.killed) {
    console.log('[TTS] before-quit: cleaning up TTS process')
    sendCommand({ cmd: 'exit' })
    setTimeout(() => {
      if (ttsProcess && !ttsProcess.killed) {
        console.log('[TTS] before-quit: force killing TTS process')
        ttsProcess.kill()
      }
    }, 2000)
  } else {
    console.log('[TTS] before-quit: no TTS process to clean up')
  }
})
