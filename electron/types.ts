export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
}

export interface DirEntry {
  name: string
  path: string
}

export interface ImportResult {
  filePath: string
  content: string
}
