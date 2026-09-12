// 文件列表中的单个文件信息
export interface RemoteBookFile {
  name: string        // 文件名，如 "CET4_1.json"
  dir: string         // 目录路径，如 "json_original/json-full/"
  size: number | null // 文件大小（字节），GitHub 有，Gitee 为 null
  downloadUrl: string // 原始文件下载链接
}

// 远程仓库信息
export interface BookSource {
  label: string       // 显示标签，如 "GitHub - KyleBing/english-vocabulary"
  owner: string       // 仓库所有者
  repo: string        // 仓库名
  path: string        // 目录路径，默认 "json/"
  platform: 'github' | 'gitee'
}

// 预设源
export const PRESET_SOURCES: BookSource[] = [
  { label: 'GitHub - KyleBing/english-vocabulary', owner: 'KyleBing', repo: 'english-vocabulary', path: 'json/', platform: 'github' },
  { label: 'Gitee - pradio/english-vocabulary', owner: 'pradio', repo: 'english-vocabulary', path: 'json/', platform: 'gitee' },
]

/**
 * 去除字符串首尾空白，含全角空格
 */
function trimStr(s: string): string {
  return s.replace(/^[\s\u3000]+|[\s\u3000]+$/g, '')
}

/**
 * 从 GitHub/Gitee 远程仓库获取词书列表并下载 JSON
 */
export class GitHubBookFetcher {
  /**
   * 解析用户输入的 URL 或 "owner/repo" 格式，返回 BookSource
   * 支持格式：
   *   - https://github.com/KyleBing/english-vocabulary
   *   - https://github.com/KyleBing/english-vocabulary/tree/master/json
   *   - KyleBing/english-vocabulary
   *   - https://gitee.com/pradio/english-vocabulary
   * 如果无法解析，返回 null
   */
  parseUrl(input: string): BookSource | null {
    try {
      const raw = trimStr(input)
      if (!raw) return null

      // 判断平台
      const isGitee = /gitee\.com/i.test(raw)
      const isGithub = /github\.com/i.test(raw)

      // 如果是 URL 格式，从 URL 中提取 owner/repo/path
      if (isGithub || isGitee) {
        // 移除协议和域名部分，取路径部分
        // 例如: https://github.com/KyleBing/english-vocabulary/tree/master/json
        //  -> /KyleBing/english-vocabulary/tree/master/json
        const url = new URL(raw)
        const pathParts = url.pathname.split('/').filter(Boolean)

        // 至少需要 owner/repo
        if (pathParts.length < 2) return null

        const owner = pathParts[0]
        const repo = pathParts[1]

        // 检查是否有 tree/master/{path} 部分
        let dirPath = 'json/'
        if (pathParts.length > 4 && pathParts[2] === 'tree' && pathParts[3] === 'master') {
          dirPath = pathParts.slice(4).join('/')
          if (!dirPath.endsWith('/')) dirPath += '/'
        }

        const platform = isGithub ? 'github' : 'gitee'
        const label = `${platform === 'github' ? 'GitHub' : 'Gitee'} - ${owner}/${repo}`

        return { label, owner, repo, path: dirPath, platform }
      }

      // 处理 owner/repo 格式（无协议头）
      const slashMatch = raw.match(/^([^/\s]+)\/([^/\s]+)$/)
      if (slashMatch) {
        return {
          label: `GitHub - ${slashMatch[1]}/${slashMatch[2]}`,
          owner: slashMatch[1],
          repo: slashMatch[2],
          path: 'json/',
          platform: 'github',
        }
      }

      return null
    } catch {
      return null
    }
  }

  /**
   * 获取远程仓库中所有 JSON 文件列表（递归扫描全仓库）
   * 调用 GitHub/Gitee 的 Git Tree API: GET .../git/trees/master?recursive=1
   * 返回整个仓库中所有 .json 文件，按目录分组
   * 如果 API 调用失败，抛出错误
   */
  async fetchBookList(source: BookSource): Promise<RemoteBookFile[]> {
    const apiUrl = this._buildApiUrl(source)

    let response: Response
    try {
      response = await fetch(apiUrl, {
        headers: { 'Accept': 'application/json' },
      })
    } catch (err) {
      throw new Error(`无法连接 API 服务器: ${err instanceof Error ? err.message : String(err)}`)
    }

    if (!response.ok) {
      const status = response.status
      if (status === 404) {
        throw new Error(`仓库不存在 (404): ${source.owner}/${source.repo}`)
      } else if (status === 403) {
        throw new Error(`API 访问被拒绝 (403)，可能触发了频率限制`)
      } else {
        throw new Error(`API 请求失败 (${status}): ${response.statusText}`)
      }
    }

    let body: Record<string, unknown>
    try {
      body = await response.json() as Record<string, unknown>
    } catch {
      throw new Error('API 返回的数据格式不正确，无法解析')
    }

    const tree = body.tree
    if (!Array.isArray(tree)) {
      throw new Error('API 返回的数据格式不正确，期望 tree 数组')
    }

    const jsonFiles: RemoteBookFile[] = []

    for (const item of tree) {
      if (!item || typeof item !== 'object') continue

      const entry = item as Record<string, unknown>

      // 只处理 blob（文件）类型且以 .json / .jsonl 结尾
      if (entry.type !== 'blob') continue
      if (typeof entry.path !== 'string') continue
      const lowerPath = entry.path.toLowerCase()
      if (!lowerPath.endsWith('.json') && !lowerPath.endsWith('.jsonl')) continue

      // 从完整路径中提取文件名和目录
      const pathParts = entry.path.split('/')
      const fileName = pathParts.pop() || ''
      const dir = pathParts.length > 0 ? pathParts.join('/') + '/' : ''

      // 获取文件大小
      let fileSize: number | null = null
      if (source.platform === 'github' && typeof entry.size === 'number') {
        fileSize = entry.size
      }

      // 使用完整路径构造 raw 下载链接
      const downloadUrl = this._buildRawUrl(source, entry.path)

      jsonFiles.push({
        name: fileName,
        dir,
        size: fileSize,
        downloadUrl,
      })
    }

    return jsonFiles
  }

  /**
   * 下载 JSON 文件内容
   * 直接使用 fetch 从 downloadUrl 获取内容
   * 返回 JSON 字符串
   * 如果下载失败，抛出错误
   */
  async downloadJson(downloadUrl: string): Promise<string> {
    let response: Response
    try {
      response = await fetch(downloadUrl)
    } catch (err) {
      throw new Error(`无法连接到下载地址: ${err instanceof Error ? err.message : String(err)}`)
    }

    if (!response.ok) {
      throw new Error(`下载失败 (${response.status}): ${response.statusText}`)
    }

    try {
      return await response.text()
    } catch (err) {
      throw new Error(`读取下载内容失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  /**
   * 构建 Git Tree API URL（递归获取整个仓库的文件树）
   */
  private _buildApiUrl(source: BookSource): string {
    const { owner, repo, platform } = source
    const encodedOwner = encodeURIComponent(owner)
    const encodedRepo = encodeURIComponent(repo)

    if (platform === 'gitee') {
      return `https://gitee.com/api/v5/repos/${encodedOwner}/${encodedRepo}/git/trees/master?recursive=1`
    }
    return `https://api.github.com/repos/${encodedOwner}/${encodedRepo}/git/trees/master?recursive=1`
  }

  /**
   * 构建 raw 文件下载链接
   * @param filePath 完整文件路径，如 "json/3-CET4-顺序.json"
   */
  private _buildRawUrl(source: BookSource, filePath: string): string {
    const { owner, repo, platform } = source
    const encodedOwner = encodeURIComponent(owner)
    const encodedRepo = encodeURIComponent(repo)
    const encodedPath = filePath.split('/').map(p => encodeURIComponent(p)).join('/')

    if (platform === 'gitee') {
      return `https://gitee.com/${encodedOwner}/${encodedRepo}/raw/master/${encodedPath}`
    }
    return `https://raw.githubusercontent.com/${encodedOwner}/${encodedRepo}/master/${encodedPath}`
  }
}
