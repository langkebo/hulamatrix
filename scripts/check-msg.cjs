#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const SRC = path.join(ROOT, 'src')
const exts = new Set(['.ts', '.tsx', '.js', '.jsx', '.vue'])
const allowUseMessage = new Set([
  path.join(SRC, 'components/common/NaiveProvider.vue')
])
const allowWindowMessage = allowUseMessage
const ignoreFiles = new Set([
  path.join(SRC, 'typings/env.d.ts')
])
const offenders = []

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      walk(p)
    } else if (exts.has(path.extname(e.name))) {
      const content = fs.readFileSync(p, 'utf8')
      const lines = content.split(/\r?\n/)
      lines.forEach((line, i) => {
        if (ignoreFiles.has(p)) return
        if (/window\s*\.\$message/.test(line) && !allowWindowMessage.has(p)) {
          offenders.push({ file: p, line: i + 1, text: line.trim(), rule: 'window.$message forbidden' })
        }
        if (/\buseMessage\b/.test(line) && /from\s+['"]naive-ui['"]/.test(content) && !allowUseMessage.has(p)) {
          offenders.push({ file: p, line: i + 1, text: line.trim(), rule: 'useMessage import forbidden' })
        }
      })
    }
  }
}

if (!fs.existsSync(SRC)) {
  console.error('src directory not found')
  process.exit(2)
}

walk(SRC)

if (offenders.length) {
  console.error('Found forbidden UI message usage:')
  offenders.forEach((o) => {
    console.error(`- ${o.file}:${o.line} [${o.rule}] => ${o.text}`)
  })
  console.error('\nPlease use SafeUI.msg instead, and i18n for text.')
  process.exit(1)
} else {
  console.log('OK: no forbidden message usage found')
}
