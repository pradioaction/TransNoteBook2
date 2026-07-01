/**
 * Kokoro multi-lang v1.0 speaker mapping (sid 0-52)
 * Source: https://k2-fsa.github.io/sherpa/onnx/tts/pretrained_models/kokoro.html
 *
 * Prefix legend:
 *   af/am = American English female/male
 *   bf/bm = British English female/male
 *   ef/em = Spanish female/male
 *   ff/fm = French female/male
 *   hf/hm = Hindi female/male
 *   if/im = Italian female/male
 *   jf/jm = Japanese female/male
 *   kf/km = Korean female/male
 *   pf/pm = Portuguese female/male
 *   rf/rm = Russian female/male
 *   zf/zm = Chinese female/male
 */
/** 检测文本中是否包含中文字符 */
export function isChineseText(text: string): boolean {
  return /[\u4e00-\u9fff\u3400-\u4dbf]/.test(text)
}

/** 是否为中文语言说话人 */
export function isChineseSpeaker(sid: number): boolean {
  return sid >= 45 && sid <= 52
}

export const ENGLISH_SPEAKERS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27] // sid 0-27: 美式/英式英语
export const CHINESE_SPEAKERS = [45, 46, 47, 48, 49, 50, 51, 52] // sid 45-52: 中文

export function getDefaultEnSid(): number { return 0 }   // af_alloy
export function getDefaultZhSid(): number { return 45 }  // zf_xiaobei

export const TTS_SPEAKERS: { sid: number; name: string; label: string }[] = [
  { sid: 0,  name: 'af_alloy',      label: 'af_alloy · American English Female' },
  { sid: 1,  name: 'af_aoede',      label: 'af_aoede · American English Female' },
  { sid: 2,  name: 'af_bella',      label: 'af_bella · American English Female' },
  { sid: 3,  name: 'af_heart',      label: 'af_heart · American English Female' },
  { sid: 4,  name: 'af_jessica',    label: 'af_jessica · American English Female' },
  { sid: 5,  name: 'af_kore',       label: 'af_kore · American English Female' },
  { sid: 6,  name: 'af_nicole',     label: 'af_nicole · American English Female' },
  { sid: 7,  name: 'af_nova',       label: 'af_nova · American English Female' },
  { sid: 8,  name: 'af_river',      label: 'af_river · American English Female' },
  { sid: 9,  name: 'af_sarah',      label: 'af_sarah · American English Female' },
  { sid: 10, name: 'af_sky',        label: 'af_sky · American English Female' },
  { sid: 11, name: 'am_adam',       label: 'am_adam · American English Male' },
  { sid: 12, name: 'am_echo',       label: 'am_echo · American English Male' },
  { sid: 13, name: 'am_eric',       label: 'am_eric · American English Male' },
  { sid: 14, name: 'am_fenrir',     label: 'am_fenrir · American English Male' },
  { sid: 15, name: 'am_liam',       label: 'am_liam · American English Male' },
  { sid: 16, name: 'am_michael',    label: 'am_michael · American English Male' },
  { sid: 17, name: 'am_onyx',       label: 'am_onyx · American English Male' },
  { sid: 18, name: 'am_puck',       label: 'am_puck · American English Male' },
  { sid: 19, name: 'am_santa',      label: 'am_santa · American English Male' },
  { sid: 20, name: 'bf_alice',      label: 'bf_alice · British English Female' },
  { sid: 21, name: 'bf_emma',       label: 'bf_emma · British English Female' },
  { sid: 22, name: 'bf_isabella',   label: 'bf_isabella · British English Female' },
  { sid: 23, name: 'bf_lily',       label: 'bf_lily · British English Female' },
  { sid: 24, name: 'bm_daniel',     label: 'bm_daniel · British English Male' },
  { sid: 25, name: 'bm_fable',      label: 'bm_fable · British English Male' },
  { sid: 26, name: 'bm_george',     label: 'bm_george · British English Male' },
  { sid: 27, name: 'bm_lewis',      label: 'bm_lewis · British English Male' },
  { sid: 28, name: 'ef_dora',       label: 'ef_dora · Spanish Female' },
  { sid: 29, name: 'em_alex',       label: 'em_alex · Spanish Male' },
  { sid: 30, name: 'ff_siwis',      label: 'ff_siwis · French Female' },
  { sid: 31, name: 'hf_alpha',      label: 'hf_alpha · Hindi Female' },
  { sid: 32, name: 'hf_beta',       label: 'hf_beta · Hindi Female' },
  { sid: 33, name: 'hm_omega',      label: 'hm_omega · Hindi Male' },
  { sid: 34, name: 'hm_psi',        label: 'hm_psi · Hindi Male' },
  { sid: 35, name: 'if_sara',       label: 'if_sara · Italian Female' },
  { sid: 36, name: 'im_nicola',     label: 'im_nicola · Italian Male' },
  { sid: 37, name: 'jf_alpha',      label: 'jf_alpha · Japanese Female' },
  { sid: 38, name: 'jf_gongitsune', label: 'jf_gongitsune · Japanese Female' },
  { sid: 39, name: 'jf_nezumi',     label: 'jf_nezumi · Japanese Female' },
  { sid: 40, name: 'jf_tebukuro',   label: 'jf_tebukuro · Japanese Female' },
  { sid: 41, name: 'jm_kumo',       label: 'jm_kumo · Japanese Male' },
  { sid: 42, name: 'pf_dora',       label: 'pf_dora · Portuguese Female' },
  { sid: 43, name: 'pm_alex',       label: 'pm_alex · Portuguese Male' },
  { sid: 44, name: 'pm_santa',      label: 'pm_santa · Portuguese Male' },
  { sid: 45, name: 'zf_xiaobei',    label: 'zf_xiaobei · Chinese Female' },
  { sid: 46, name: 'zf_xiaoni',     label: 'zf_xiaoni · Chinese Female' },
  { sid: 47, name: 'zf_xiaoxiao',   label: 'zf_xiaoxiao · Chinese Female' },
  { sid: 48, name: 'zf_xiaoyi',     label: 'zf_xiaoyi · Chinese Female' },
  { sid: 49, name: 'zm_yunjian',    label: 'zm_yunjian · Chinese Male' },
  { sid: 50, name: 'zm_yunxi',      label: 'zm_yunxi · Chinese Male' },
  { sid: 51, name: 'zm_yunxia',     label: 'zm_yunxia · Chinese Male' },
  { sid: 52, name: 'zm_yunyang',    label: 'zm_yunyang · Chinese Male' },
]
