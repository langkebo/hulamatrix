#!/usr/bin/env node

/**
 * Matrix Server Discovery Test Script
 * 验证 .well-known 服务发现功能
 */

const https = require('https')

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
}

function log(color, ...args) {
  console.log(`${color}`, ...args, `${colors.reset}`)
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          resolve(json)
        } catch (e) {
          resolve(data)
        }
      })
    }).on('error', reject)
  })
}

async function testDiscovery(serverName) {
  log(colors.blue, `\n=== 测试 Matrix 服务器发现: ${serverName} ===\n`)

  // 1. 测试 .well-known 发现
  const wellKnownUrl = `https://${serverName}/.well-known/matrix/client`
  log(colors.blue, `1. 请求 .well-known 配置: ${wellKnownUrl}`)

  try {
    const wellKnown = await httpsGet(wellKnownUrl)
    log(colors.green, '✅ .well-known 配置获取成功')
    console.log(JSON.stringify(wellKnown, null, 2))

    const homeserverUrl = wellKnown['m.homeserver']?.base_url
    if (!homeserverUrl) {
      log(colors.red, '❌ 未找到 m.homeserver.base_url')
      return false
    }

    log(colors.green, `\n✅ 发现 homeserver URL: ${homeserverUrl}`)

    // 2. 测试 homeserver versions 端点
    const versionsUrl = `${homeserverUrl}/_matrix/client/versions`
    log(colors.blue, `\n2. 测试 homeserver 版本端点: ${versionsUrl}`)

    const versions = await httpsGet(versionsUrl)
    log(colors.green, '✅ Homeserver 响应正常')

    if (versions.versions && versions.versions.length > 0) {
      log(colors.green, `✅ 支持的版本: ${versions.versions.slice(0, 3).join(', ')}...`)

      if (versions.unstable_features) {
        const hasSlidingSync = versions.unstable_features['org.matrix.msc3575'] ||
                              versions.unstable_features['org.matrix.simplified_msc3575']
        if (hasSlidingSync) {
          log(colors.green, '✅ 支持 Sliding Sync (MSC3575)')
        } else {
          log(colors.yellow, '⚠️  不支持 Sliding Sync (MSC3575)')
        }
      }
    }

    // 3. 总结
    log(colors.green, '\n=== 服务发现测试成功 ===')
    console.log(`服务器名称: ${serverName}`)
    console.log(`Homeserver: ${homeserverUrl}`)
    console.log(`状态: ✅ 可连接`)

    return true
  } catch (error) {
    log(colors.red, `\n❌ 服务发现失败: ${error.message}`)
    return false
  }
}

async function main() {
  log(colors.blue, '\n========================================')
  log(colors.blue, 'Matrix Server Discovery Test')
  log(colors.blue, '========================================\n')

  const serverName = process.argv[2] || 'cjystx.top'

  const success = await testDiscovery(serverName)

  process.exit(success ? 0 : 1)
}

main().catch(error => {
  log(colors.red, `\n❌ 测试失败: ${error.message}`)
  process.exit(1)
})
