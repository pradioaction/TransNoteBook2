import fs from 'fs'
import path from 'path'

export interface BookData {
  name: string
  path: string
  count: number
}

export interface WordData {
  word: string
  phonetic: string
  definition: string
  example: string
  raw_data: string
}

export interface ImportResult {
  book: BookData | null
  words: WordData[]
}

/**
 * 词书导入器 —— 解析 KyleBing 格式 JSON 词书
 * 与原始 Python BookImporter 完全一致
 */
export class BookImporter {
  importFromFile(filePath: string): ImportResult {
    try {
      if (!fs.existsSync(filePath)) {
        console.error(`[BookImporter] File not found: ${filePath}`)
        return { book: null, words: [] }
      }

      const content = fs.readFileSync(filePath, 'utf-8')
      const data = JSON.parse(content)

      const pathObj = path.parse(filePath)
      const bookName = pathObj.name
      const words = this._parseWords(data)

      return {
        book: {
          name: bookName,
          path: filePath,
          count: words.length,
        },
        words,
      }
    } catch (err) {
      console.error(`[BookImporter] Import failed: ${err}`)
      return { book: null, words: [] }
    }
  }

  private _parseWords(data: unknown): WordData[] {
    const words: WordData[] = []

    if (!data) return words

    let list: unknown[] = []

    if (Array.isArray(data)) {
      list = data
    } else if (typeof data === 'object' && data !== null) {
      const obj = data as Record<string, unknown>
      const possibleKeys = ['words', 'data', 'list', 'items']
      for (const key of possibleKeys) {
        if (key in obj && Array.isArray(obj[key])) {
          list = obj[key] as unknown[]
          break
        }
      }
    }

    for (let index = 0; index < list.length; index++) {
      try {
        const word = this._parseSingleWord(list[index])
        if (word && word.word.trim()) {
          words.push(word)
        }
      } catch (err) {
        console.warn(`[BookImporter] Parse item ${index} failed: ${err}`)
      }
    }

    return words
  }

  private _parseSingleWord(item: unknown): WordData | null {
    if (!item || typeof item !== 'object') return null

    const obj = item as Record<string, unknown>

    // 1. Save raw data
    const rawData = JSON.stringify(item)

    // 2. Extract word text
    let wordText = ''
    if (typeof obj.headWord === 'string') {
      wordText = obj.headWord.trim()
    }
    if (!wordText && typeof obj.word === 'string') {
      wordText = obj.word.trim()
    } else if (!wordText && obj.word && typeof obj.word === 'object') {
      const wordNode = obj.word as Record<string, unknown>
      if (typeof wordNode.wordHead === 'string') {
        wordText = wordNode.wordHead.trim()
      }
    }

    if (!wordText) return null

    // 3. Find deep content node
    let deepContent: Record<string, unknown> | null = null
    if (obj.content && typeof obj.content === 'object') {
      const level1 = obj.content as Record<string, unknown>
      if (level1.word && typeof level1.word === 'object') {
        const level2 = level1.word as Record<string, unknown>
        if (level2.content && typeof level2.content === 'object') {
          deepContent = level2.content as Record<string, unknown>
        }
      }
    }

    // 4. Extract phonetic
    let phonetic = ''
    if (deepContent) {
      for (const key of ['usphone', 'phone', 'ukphone', 'phonetic']) {
        if (typeof deepContent[key] === 'string') {
          let val = (deepContent[key] as string).trim()
          if (val) {
            if (val.startsWith(',')) val = val.substring(1).trim()
            phonetic = val
            break
          }
        }
      }
    }

    // 5. Extract definition
    let definition = ''
    if (deepContent && deepContent.trans && Array.isArray(deepContent.trans)) {
      const defParts: string[] = []
      for (const t of deepContent.trans) {
        if (t && typeof t === 'object') {
          const trans = t as Record<string, unknown>
          const pos = typeof trans.pos === 'string' ? trans.pos : ''
          const tranCn = typeof trans.tranCn === 'string' ? trans.tranCn : ''
          if (tranCn) {
            defParts.push(pos ? `${pos} ${tranCn}` : tranCn)
          }
        }
      }
      if (defParts.length > 0) {
        definition = defParts.join('\n')
      }
    }

    // 6. Extract example
    let example = ''
    if (
      deepContent &&
      deepContent.sentence &&
      typeof deepContent.sentence === 'object'
    ) {
      const sentenceObj = deepContent.sentence as Record<string, unknown>
      if (
        sentenceObj.sentences &&
        Array.isArray(sentenceObj.sentences)
      ) {
        const exParts: string[] = []
        for (const s of sentenceObj.sentences) {
          if (s && typeof s === 'object') {
            const sent = s as Record<string, unknown>
            const sContent = typeof sent.sContent === 'string' ? sent.sContent : ''
            const sCn = typeof sent.sCn === 'string' ? sent.sCn : ''
            if (sContent) {
              exParts.push(sContent)
              if (sCn) exParts.push(`  ${sCn}`)
            }
          }
        }
        if (exParts.length > 0) {
          example = exParts.join('\n')
        }
      }
    }

    return {
      word: wordText,
      phonetic,
      definition,
      example,
      raw_data: rawData,
    }
  }
}
