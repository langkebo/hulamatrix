import { logger, toError } from '@/utils/logger'

// ============================================================================
// 类型定义
// ============================================================================

/**
 * Tauri FS API 目录条目
 */
interface DirEntry {
  name: string
  isFile: boolean
  isDirectory: boolean
}

/**
 * Tauri FS API 文件元数据
 */
interface FileMetadata {
  size: number
  modifiedAt?: number
  createdAt?: number
}

/**
 * Tauri FS API 模块接口
 */
interface TauriFsModule {
  removeFile?(path: string, options?: { baseDir?: unknown }): Promise<void>
  remove?(path: string, options?: { baseDir?: unknown }): Promise<void>
  readDir(path: string, options?: { baseDir?: unknown }): Promise<DirEntry[]>
  metadata(path: string, options?: { baseDir?: unknown }): Promise<FileMetadata>
}

/**
 * 基础目录选项
 */
type BaseDirOption = unknown

// ============================================================================
// 缓存函数
// ============================================================================

type Entry<T> = { key: string; value: T; ts: number }

export function createCache<T>(max = 100): {
  set: (key: string, value: T) => void
  get: (key: string) => T | undefined
  size: () => number
} {
  const map = new Map<string, Entry<T>>()
  const set = (key: string, value: T) => {
    const now = Date.now()
    map.set(key, { key, value, ts: now })
    if (map.size > max) {
      const arr = Array.from(map.values()).sort((a, b) => a.ts - b.ts)
      const remove = arr.slice(0, Math.floor(max * 0.2))
      for (const e of remove) map.delete(e.key)
    }
  }
  const get = (key: string) => map.get(key)?.value
  const size = () => map.size
  return { set, get, size }
}

/**
 * 安全删除文件
 * @param filePath 文件路径
 */
export async function removeFileSafe(filePath: string, baseDir?: BaseDirOption): Promise<boolean> {
  try {
    const fs = (await import('@tauri-apps/plugin-fs')) as unknown as TauriFsModule

    if (typeof fs.removeFile === 'function') {
      await fs.removeFile(filePath, baseDir ? { baseDir } : undefined)
    } else if (typeof fs.remove === 'function') {
      await fs.remove(filePath, baseDir ? { baseDir } : undefined)
    }
    return true
  } catch (error) {
    logger.error('Failed to remove file:', toError(error))
    return false
  }
}

/**
 * 计算目录大小
 * @param dirPath 目录路径
 */
export async function computeDirSize(dirPath: string, baseDir?: BaseDirOption): Promise<number> {
  try {
    const fs = (await import('@tauri-apps/plugin-fs')) as unknown as TauriFsModule
    const entries = await fs.readDir(dirPath, { baseDir })

    let totalSize = 0
    for (const entry of entries) {
      if (entry.isFile && entry.name) {
        const pathModule = await import('@tauri-apps/api/path')
        const full = await pathModule.join(dirPath, entry.name)
        const metadata = await fs.metadata(full, { baseDir })
        totalSize += Number(metadata.size || 0)
      }
    }
    return totalSize
  } catch {
    return 0
  }
}

export async function enforceCap(dirPath: string, baseDir: BaseDirOption, capBytes: number): Promise<number> {
  const fs = (await import('@tauri-apps/plugin-fs')) as unknown as TauriFsModule
  const entries = await fs.readDir(dirPath, { baseDir })

  const files: Array<{ path: string; size: number; mtime: number }> = []

  for (const entry of entries) {
    if (entry.isFile && entry.name) {
      const pathModule = await import('@tauri-apps/api/path')
      const full = await pathModule.join(dirPath, entry.name)
      const meta = await fs.metadata(full, { baseDir })
      files.push({
        path: full,
        size: meta.size || 0,
        mtime: Number(meta.modifiedAt || meta.createdAt || Date.now())
      })
    }
  }

  let cleaned = 0
  let total = files.reduce((s, f) => s + f.size, 0)

  if (total <= capBytes) return cleaned

  files.sort((a, b) => a.mtime - b.mtime)

  for (const f of files) {
    if (total <= capBytes) break

    try {
      if (typeof fs.removeFile === 'function') {
        await fs.removeFile(f.path, { baseDir })
      } else if (typeof fs.remove === 'function') {
        await fs.remove(f.path, { baseDir })
      }
      total -= f.size
      cleaned += 1
    } catch {
      // 忽略单个文件删除失败
    }
  }

  return cleaned
}
