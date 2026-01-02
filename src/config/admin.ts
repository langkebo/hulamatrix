/**
 * Admin accounts configuration
 * Defines which accounts have administrative privileges
 */

/**
 * Vite import.meta.env 类型定义
 */
interface ImportMetaEnv {
  VITE_ADMIN_ACCOUNTS?: string
  [key: string]: string | boolean | undefined
}

interface ImportMeta {
  env: ImportMetaEnv
}

// Type-safe import.meta.env access
const getImportMetaEnv = (): ImportMetaEnv => {
  return typeof import.meta !== 'undefined' && (import.meta as ImportMeta).env
    ? (import.meta as ImportMeta).env
    : ({} as ImportMetaEnv)
}

const env = getImportMetaEnv()
const rawAdmins = env.VITE_ADMIN_ACCOUNTS || ''
export const ADMIN_ACCOUNTS: string[] = String(rawAdmins)
  .split(',')
  .map((s) => s.trim())
  .filter((s) => s.length > 0)
