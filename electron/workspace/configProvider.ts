import fs from 'fs'
import path from 'path'

export interface ConfigProvider {
  get(key: string): unknown
  set(key: string, value: unknown): void
  getAll(): Record<string, unknown>
}

export class FileBasedConfig implements ConfigProvider {
  private _filePath: string
  private _cache: Record<string, unknown> = {}
  private _loaded = false

  constructor(filePath: string) {
    this._filePath = filePath
  }

  private _load(): void {
    if (this._loaded) return
    try {
      if (fs.existsSync(this._filePath)) {
        const content = fs.readFileSync(this._filePath, 'utf-8')
        this._cache = JSON.parse(content)
      }
    } catch (err) {
      console.warn(`[FileBasedConfig] Load failed: ${err}`)
      this._cache = {}
    }
    this._loaded = true
  }

  private _save(): void {
    try {
      const dir = path.dirname(this._filePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(this._filePath, JSON.stringify(this._cache, null, 2), 'utf-8')
    } catch (err) {
      console.error(`[FileBasedConfig] Save failed: ${err}`)
    }
  }

  get(key: string): unknown {
    this._load()
    return this._cache[key]
  }

  set(key: string, value: unknown): void {
    this._load()
    this._cache[key] = value
    this._save()
  }

  getAll(): Record<string, unknown> {
    this._load()
    return { ...this._cache }
  }

  setAll(config: Record<string, unknown>): void {
    this._cache = { ...config }
    this._loaded = true
    this._save()
  }
}
