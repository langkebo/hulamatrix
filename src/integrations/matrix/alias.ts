export function validateAlias(alias: string): { valid: boolean; reason?: string } {
  const a = (alias || '').trim()
  if (!a) return { valid: false, reason: '别名不能为空' }
  if (!a.startsWith('#')) return { valid: false, reason: '别名需以 # 开头' }
  const parts = a.split(':')
  if (parts.length !== 2 || !parts[0] || !parts[1])
    return { valid: false, reason: '别名需包含域名，例如 #foo:example.org' }
  if (!/^#[A-Za-z0-9._-]+$/.test(parts[0])) return { valid: false, reason: '别名只允许字母数字和._-字符' }
  if (!/^[A-Za-z0-9._-]+$/.test(parts[1])) return { valid: false, reason: '域名只允许字母数字和._-字符' }
  return { valid: true }
}
