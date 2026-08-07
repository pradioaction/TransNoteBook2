/**
 * edgeTtsHandlers.ts — Edge TTS 的 Electron IPC Handlers
 *
 * 在主进程中使用 ws 库直连微软 Edge 朗读服务 (speech.platform.bing.com)。
 * 浏览器原生 WebSocket 无法设置自定义 headers（微软服务器会拒绝连接），
 * 因此合成逻辑放在主进程，renderer 通过 IPC 获取 MP3 数据。
 *
 * 通道:
 *   tts:edgeSynthesize → 文本合成语音 (返回 MP3 base64)
 *   tts:edgeGetVoices  → 获取可用语音列表
 *
 * 协议参考开源项目 edge-tts (rany2/edge-tts)。
 * 注意: 非官方接口，微软可能调整协议或限流。
 */

import { ipcMain } from 'electron'
import crypto from 'crypto'
import WebSocket from 'ws'

// ============================================================
// 常量 (与 edge-tts 一致)
// ============================================================
const WSS_BASE_URL = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1'
const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4'
const VOICES_LIST_URL =
  `https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list` +
  `?trustedclienttoken=${TRUSTED_CLIENT_TOKEN}`
const OUTPUT_FORMAT = 'audio-24khz-48kbitrate-mono-mp3'

// Edge 版本号会随发布轮换，token 校验失败时需更新
const CHROMIUM_FULL_VERSION = '143.0.3650.75'
const CHROMIUM_MAJOR_VERSION = CHROMIUM_FULL_VERSION.split('.')[0]

interface EdgeSynthesizeRequest {
  text: string
  voiceId: string
  rate: number
}

interface EdgeVoiceInfo {
  ShortName: string
  FriendlyName: string
  Locale: string
}

// ============================================================
// 注册 Handlers
// ============================================================
export function registerEdgeTtsHandlers(): void {
  ipcMain.handle(
    'tts:edgeSynthesize',
    async (_event, req: EdgeSynthesizeRequest): Promise<{ audio: string }> => {
      const mp3 = await synthesizeEdge(req)
      return { audio: mp3.toString('base64') }
    },
  )

  ipcMain.handle('tts:edgeGetVoices', async (): Promise<EdgeVoiceInfo[]> => {
    const resp = await fetch(VOICES_LIST_URL)
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const list = (await resp.json()) as EdgeVoiceInfo[]
    return list.map((v) => ({ ShortName: v.ShortName, FriendlyName: v.FriendlyName, Locale: v.Locale }))
  })
}

// ============================================================
// 合成逻辑
// ============================================================
function synthesizeEdge(req: EdgeSynthesizeRequest): Promise<Buffer> {
  const url =
    `${WSS_BASE_URL}` +
    `?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}` +
    `&ConnectionId=${generateRequestId()}` +
    `&Sec-MS-GEC=${generateSecMsGec()}` +
    `&Sec-MS-GEC-Version=1-${CHROMIUM_FULL_VERSION}`

  const headers = {
    'User-Agent':
      `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ` +
      `(KHTML, like Gecko) Chrome/${CHROMIUM_MAJOR_VERSION}.0.0.0 Safari/537.36 ` +
      `Edg/${CHROMIUM_MAJOR_VERSION}.0.0.0`,
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'Accept-Language': 'en-US,en;q=0.9',
    Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
    Pragma: 'no-cache',
    'Cache-Control': 'no-cache',
    Cookie: `muid=${crypto.randomBytes(16).toString('hex').toUpperCase()};`,
  }

  return new Promise<Buffer>((resolve, reject) => {
    const ws = new WebSocket(url, { headers, perMessageDeflate: false })
    const audioChunks: Buffer[] = []
    const requestId = generateRequestId()
    let settled = false

    const fail = (err: Error) => {
      if (settled) return
      settled = true
      try {
        ws.terminate()
      } catch {
        /* ignore */
      }
      reject(err)
    }

    ws.on('open', () => {
      try {
        ws.send(buildSpeechConfig(requestId))
        ws.send(buildSsml(requestId, req.voiceId, req.text, req.rate))
      } catch (err) {
        fail(err instanceof Error ? err : new Error(String(err)))
      }
    })

    ws.on('message', (data: Buffer, isBinary: boolean) => {
      if (!isBinary) {
        if (data.toString().includes('Path:turn.end')) {
          ws.close()
        }
        return
      }
      // 二进制消息 = 文本头 + "Path:audio\r\n" + MP3 数据，剥离头部
      const marker = data.indexOf('Path:audio\r\n')
      if (marker >= 0) {
        audioChunks.push(data.subarray(marker + 12))
      }
    })

    ws.on('close', () => {
      if (settled) return
      settled = true
      if (audioChunks.length === 0) {
        reject(new Error('Edge TTS 未返回音频数据'))
        return
      }
      resolve(Buffer.concat(audioChunks))
    })

    ws.on('error', (err: Error) => {
      fail(new Error(`Edge TTS WebSocket 连接失败: ${err.message}`))
    })

    // 超时兜底
    const timer = setTimeout(() => fail(new Error('Edge TTS 合成超时')), 15000)
    ws.on('close', () => clearTimeout(timer))
    ws.on('error', () => clearTimeout(timer))
  })
}

// ============================================================
// 工具函数
// ============================================================

/** 生成随机 UUID (RFC4122 v4) */
function generateRequestId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/** 生成 Sec-MS-GEC token: sha256(取整到5分钟的.NET ticks + trusted token) 大写 hex */
function generateSecMsGec(): string {
  const ticksSec = BigInt(Math.floor(Date.now() / 1000)) + 11644473600n // Windows epoch 偏移(秒)
  const rounded = ticksSec - (ticksSec % 300n) // 向下取整到 5 分钟
  const ticks = rounded * 10_000_000n // 100ns 间隔
  const strToHash = `${ticks}${TRUSTED_CLIENT_TOKEN}`
  return crypto.createHash('sha256').update(strToHash, 'ascii').digest('hex').toUpperCase()
}

/** 生成 speech.config 消息 */
function buildSpeechConfig(requestId: string): string {
  return (
    `X-RequestId:${requestId}\r\n` +
    'Content-Type:application/json; charset=utf-8\r\n' +
    `X-Timestamp:${new Date().toString()}\r\n` +
    'Path:speech.config\r\n\r\n' +
    `{"context":{"synthesis":{"audio":{"metadataoptions":` +
    `{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},` +
    `"outputFormat":"${OUTPUT_FORMAT}"}}}}`
  )
}

/** XML 转义 (SSML 文本内容) */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** 生成 SSML 消息 */
function buildSsml(requestId: string, voiceId: string, text: string, rate: number): string {
  const ratePercent = Math.round((rate - 1) * 100)
  const rateStr = ratePercent >= 0 ? `+${ratePercent}%` : `${ratePercent}%`
  const lang = voiceId.split('-').slice(0, 2).join('-') || 'zh-CN'
  return (
    `X-RequestId:${requestId}\r\n` +
    'Content-Type:application/ssml+xml\r\n' +
    `X-Timestamp:${new Date().toString()}\r\n` +
    'Path:ssml\r\n\r\n' +
    `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${lang}'>` +
    `<voice name='${voiceId}'>` +
    `<prosody pitch='+0Hz' rate='${rateStr}' volume='+0%'>${escapeXml(text)}</prosody>` +
    `</voice></speak>`
  )
}
