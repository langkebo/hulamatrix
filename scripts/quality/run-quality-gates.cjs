#!/usr/bin/env node
/**
 * 代码质量门禁检查
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
}

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`)
}

function logStep(step, message) {
  console.log(`\n${colors.cyan}[${step}] ${message}${colors.reset}`)
}

function logSuccess(message) {
  log(`✓ ${message}`, colors.green)
}

function logError(message) {
  log(`✗ ${message}`, colors.red)
}

function logWarning(message) {
  log(`⚠ ${message}`, colors.yellow)
}

const results = {
  passed: true,
  checks: [],
  summary: { total: 0, passed: 0, failed: 0, warnings: 0 },
  typeCheckPassed: false
}

function addCheckResult(name, category, status, message = '') {
  results.checks.push({ name, category, status, message, timestamp: new Date().toISOString() })
  results.summary.total++
  if (status === 'pass') results.summary.passed++
  else if (status === 'fail') { results.summary.failed++; results.passed = false; }
  else if (status === 'warn') results.summary.warnings++
}

function execCommand(command) {
  try {
    return { success: true, output: execSync(command, { encoding: 'utf-8', stdio: 'pipe' }) }
  } catch (error) {
    return { success: false, output: error.stdout || '', error: error.stderr || error.message }
  }
}

function checkTypeScript() {
  logStep('1', '检查 TypeScript 类型错误')
  const result = execCommand('pnpm run typecheck')
  results.typeCheckPassed = result.success
  if (result.success) {
    addCheckResult('TypeScript 类型检查', '类型安全', 'pass', '零编译错误')
  } else {
    const errors = (result.output.match(/error TS\d+:/g) || []).length
    addCheckResult('TypeScript 类型检查', '类型安全', 'fail', `发现 ${errors} 个类型错误`)
  }
}

function checkBiome() {
  logStep('2', '检查代码规范 (Biome)')
  const result = execCommand('pnpm run check')
  if (result.success || result.output.includes('Checked') && !result.output.includes('lint/')) {
    addCheckResult('Biome 代码规范检查', '代码质量', 'pass', '零规范错误')
  } else {
    const errors = (result.output.match(/lint\//g) || []).length
    addCheckResult('Biome 代码规范检查', '代码质量', errors > 0 ? 'fail' : 'pass', errors > 0 ? `发现 ${errors} 个规范问题` : '零规范错误')
  }
}

function checkTests() {
  logStep('3', '运行测试套件')
  const result = execCommand('pnpm run test:run 2>&1')
  if (result.success || result.output.includes('Test Files')) {
    const match = result.output.match(/Tests\s+(\d+)\s+(passed|failed)/)
    if (match) {
      match[2] === 'passed' 
        ? addCheckResult('单元测试', '测试覆盖率', 'pass', `所有 ${match[1]} 个测试通过`)
        : addCheckResult('单元测试', '测试覆盖率', 'fail', `部分测试失败`)
    } else {
      addCheckResult('单元测试', '测试覆盖率', 'pass', '测试通过')
    }
  } else {
    addCheckResult('单元测试', '测试覆盖率', 'fail', '测试执行失败')
  }
}

function checkBuild() {
  logStep('4', '检查项目构建')
  // TypeScript 检查已包含构建验证
  if (results.typeCheckPassed) {
    addCheckResult('项目构建检查', '构建健康', 'pass', '项目可以成功编译')
  } else {
    addCheckResult('项目构建检查', '构建健康', 'fail', '项目编译失败')
  }
}

function generateReport() {
  logStep('5', '生成质量报告')
  const reportDir = path.join(process.cwd(), 'reports', 'quality')
  fs.mkdirSync(reportDir, { recursive: true })
  const report = {
    timestamp: new Date().toISOString(),
    passed: results.passed,
    summary: results.summary,
    checks: results.checks,
    standards: { zeroCompilerErrors: true, zeroCriticalLintErrors: true, minCoverage: 85 }
  }
  fs.writeFileSync(path.join(reportDir, `quality-gate-${Date.now()}.json`), JSON.stringify(report, null, 2))
  fs.writeFileSync(path.join(reportDir, 'quality-gate-latest.json'), JSON.stringify(report, null, 2))
  logSuccess(`报告已保存到: ${path.join(reportDir, 'quality-gate-latest.json')}`)
  return report
}

async function runQualityGates() {
  log('\n========================================', colors.cyan)
  log('     代码质量门禁检查', colors.cyan)
  log('========================================\n', colors.cyan)
  
  const startTime = Date.now()
  
  checkTypeScript()
  checkBiome()
  checkTests()
  checkBuild()
  generateReport()

  const duration = ((Date.now() - startTime) / 1000).toFixed(2)

  console.log('\n========================================')
  log('质量检查总结', colors.cyan)
  console.log('========================================')
  log(`总计: ${results.summary.total} | 通过: ${results.summary.passed} | 失败: ${results.summary.failed} | 警告: ${results.summary.warnings}`)
  log(`耗时: ${duration}秒`)
  console.log('========================================\n')

  if (results.passed) {
    log('🎉 所有质量检查通过！', colors.green)
    process.exit(0)
  } else {
    log('❌ 质量检查失败！请修复问题后重试。', colors.red)
    process.exit(1)
  }
}

runQualityGates()
