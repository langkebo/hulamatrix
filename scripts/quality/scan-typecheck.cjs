const { execSync } = require('node:child_process')
function run(cmd) {
  return execSync(cmd, { encoding: 'utf8' })
}
function parseErrors(output) {
  const lines = output.split('\n')
  let total = 0
  const files = []
  const perFile = new Map()
  for (const line of lines) {
    const m = line.match(/^Found\s+(\d+)\s+errors\s+in\s+(\d+)\s+files\./)
    if (m) total = Number(m[1])
    const em = line.match(/error\s+TS\d+:/)
    if (em) total += 1
    const loc = line.match(/^(.+?):\d+:\d+\s+-\s+error\s+TS\d+:/)
    if (loc) {
      const f = loc[1]
      perFile.set(f, (perFile.get(f) || 0) + 1)
    }
  }
  for (const [file, count] of perFile.entries()) files.push({ file, errors: count })
  return { total, files }
}
try {
  const output = run('pnpm typecheck 2>&1')
  const summary = parseErrors(output)
  console.log(JSON.stringify(summary, null, 2))
} catch (e) {
  const msg = String(e.output?.[1] || e.message || '')
  const summary = parseErrors(msg)
  console.log(JSON.stringify(summary, null, 2))
  process.exit(1)
}
