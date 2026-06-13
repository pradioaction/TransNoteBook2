import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

export class PathManager {
  static readonly DATA_DIR_NAME = '.TransRead'
  static readonly DB_FILENAME = 'words.db'
  static readonly CONFIG_FILENAME = 'studywordmode.json'

  private _workspacePath: string | null = null

  setWorkspace(workspacePath: string): void {
    this._workspacePath = path.resolve(workspacePath)
  }

  getWorkspace(): string | null {
    return this._workspacePath
  }

  getDataDir(): string | null {
    if (!this._workspacePath) return null
    return path.join(this._workspacePath, PathManager.DATA_DIR_NAME)
  }

  getDbPath(): string | null {
    const dataDir = this.getDataDir()
    if (!dataDir) return null
    return path.join(dataDir, PathManager.DB_FILENAME)
  }

  getConfigPath(): string | null {
    const dataDir = this.getDataDir()
    if (!dataDir) return null
    return path.join(dataDir, PathManager.CONFIG_FILENAME)
  }

  ensureDataDir(): boolean {
    const dataDir = this.getDataDir()
    if (!dataDir) return false

    try {
      fs.mkdirSync(dataDir, { recursive: true })

      // Set hidden attribute on Windows
      if (process.platform === 'win32') {
        try {
          const { execSync } = require('child_process')
          execSync(`attrib +h "${dataDir}"`, { stdio: 'ignore' })
        } catch {
          // Ignore if attrib fails
        }
      }

      return true
    } catch {
      return false
    }
  }

  isValid(): boolean {
    return this._workspacePath !== null
  }
}

export class DatabaseManager {
  private _pathManager: PathManager
  private _db: Database.Database | null = null

  constructor(pathManager: PathManager) {
    this._pathManager = pathManager
  }

  initialize(): boolean {
    if (!this._pathManager.isValid()) {
      console.error('[Recitation] PathManager not configured')
      return false
    }

    if (!this._pathManager.ensureDataDir()) {
      console.error('[Recitation] Failed to create data directory')
      return false
    }

    const dbPath = this._pathManager.getDbPath()
    if (!dbPath) {
      console.error('[Recitation] Failed to get database path')
      return false
    }

    try {
      this._db = new Database(dbPath)
      this._db.pragma('journal_mode = WAL')
      this._db.pragma('foreign_keys = ON')
      this._createTables()
      console.log(`[Recitation] Database initialized: ${dbPath}`)
      return true
    } catch (err) {
      console.error(`[Recitation] Database init failed: ${err}`)
      return false
    }
  }

  private _createTables(): void {
    if (!this._db) throw new Error('Database not initialized')

    this._db.exec(`
      CREATE TABLE IF NOT EXISTS book (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        path TEXT NOT NULL,
        count INTEGER DEFAULT 0,
        create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS word (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        book_id INTEGER NOT NULL,
        word TEXT NOT NULL,
        phonetic TEXT DEFAULT '',
        definition TEXT DEFAULT '',
        example TEXT DEFAULT '',
        raw_data TEXT DEFAULT '',
        FOREIGN KEY (book_id) REFERENCES book (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS user_study (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        book_id INTEGER NOT NULL,
        word_id INTEGER NOT NULL,
        stage INTEGER DEFAULT 0,
        weight REAL DEFAULT 0.0,
        last_review TIMESTAMP,
        next_review TIMESTAMP,
        FOREIGN KEY (book_id) REFERENCES book (id) ON DELETE CASCADE,
        FOREIGN KEY (word_id) REFERENCES word (id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_word_book_id ON word (book_id);
      CREATE INDEX IF NOT EXISTS idx_user_study_book_id ON user_study (book_id);
      CREATE INDEX IF NOT EXISTS idx_user_study_word_id ON user_study (word_id);
      CREATE INDEX IF NOT EXISTS idx_user_study_next_review ON user_study (next_review);
    `)
  }

  getDb(): Database.Database {
    if (!this._db) throw new Error('Database not initialized')
    return this._db
  }

  vacuum(): boolean {
    try {
      this.getDb().exec('VACUUM')
      return true
    } catch (err) {
      console.error(`[Recitation] Vacuum failed: ${err}`)
      return false
    }
  }

  isInitialized(): boolean {
    return this._db !== null
  }

  close(): void {
    if (this._db) {
      this._db.close()
      this._db = null
    }
  }
}
