/**
 * Matrix 用户目录搜索测试脚本 - 简化版
 *
 * 使用项目已有的 Vite 代理测试用户搜索
 */

const https = require('https');

const HOMESERVER = 'matrix.cjystx.top';
const PROXY_HOST = 'localhost';
const PROXY_PORT = 6131;

function log(type, ...args) {
  const colors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    warn: '\x1b[33m',
    error: '\x1b[31m',
    reset: '\x1b[0m'
  };
  console.log(colors[type] + args.join(' ') + colors.reset);
}

function httpsRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ statusCode: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ statusCode: res.statusCode, body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function testSearchWithoutAuth(searchTerm) {
  log('info', '\n═══════════════════════════════════════════════════════════');
  log('info', '         测试 1: 用户目录搜索 (无认证)');
  log('info', '═══════════════════════════════════════════════════════════\n');

  const options = {
    hostname: PROXY_HOST,
    port: PROXY_PORT,
    path: `/_matrix/client/r0/user_directory/search?search_term=${encodeURIComponent(searchTerm)}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    // 允许自签名证书（开发环境）
    rejectUnauthorized: false
  };

  const data = {
    search_term: searchTerm,
    limit: 20
  };

  try {
    log('info', `🔍 通过 Vite 代理搜索用户 "${searchTerm}"...`);
    const response = await httpsRequest(options, data);

    log('warn', `状态码: ${response.statusCode}`);

    if (response.statusCode === 401) {
      log('warn', '⚠️  需要认证 (这是正常的，说明用户目录 API 存在)');
      return false;
    }

    if (response.statusCode === 404) {
      log('error', '❌ API 不存在 (404) - 服务器可能不支持用户目录搜索');
      return false;
    }

    if (response.statusCode === 200) {
      const results = response.body.results || [];
      if (results.length > 0) {
        log('success', `✅ 找到 ${results.length} 个用户:`);
        results.forEach((user, i) => {
          log('success', `   ${i + 1}. ${user.user_id}`);
          if (user.display_name) log('success', `      显示名: ${user.display_name}`);
        });
        return true;
      } else {
        log('warn', '⚠️  API 正常但未找到用户');
        return false;
      }
    }

    log('error', '❌ 未知响应:', JSON.stringify(response.body, null, 2));
    return false;

  } catch (error) {
    log('error', '❌ 请求失败:', error.message);
    return false;
  }
}

async function testDirectSearch(searchTerm) {
  log('info', '\n═══════════════════════════════════════════════════════════');
  log('info', '         测试 2: 直接连接服务器搜索');
  log('info', '═══════════════════════════════════════════════════════════\n');

  const options = {
    hostname: HOMESERVER,
    port: 443,
    path: `/_matrix/client/r0/user_directory/search?search_term=${encodeURIComponent(searchTerm)}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  const data = {
    search_term: searchTerm,
    limit: 20
  };

  try {
    log('info', `🔍 直接连接到 ${HOMESERVER} 搜索用户 "${searchTerm}"...`);
    const response = await httpsRequest(options, data);

    log('warn', `状态码: ${response.statusCode}`);
    log('info', '响应:', JSON.stringify(response.body, null, 2));

    if (response.statusCode === 200) {
      const results = response.body.results || [];
      if (results.length > 0) {
        log('success', `✅ 找到 ${results.length} 个用户`);
        return true;
      } else {
        log('warn', '⚠️  未找到用户 (用户可能不存在或不在目录中)');
        return false;
      }
    }

    return false;

  } catch (error) {
    log('error', '❌ 请求失败:', error.message);
    return false;
  }
}

async function main() {
  const searchTerm = process.argv[2] || 'rere';

  log('info', '\n🔍 Matrix 用户目录搜索测试');
  log('warn', `搜索词: "${searchTerm}"`);
  log('warn', `服务器: ${HOMESERVER}`);
  log('warn', `代理: ${PROXY_HOST}:${PROXY_PORT}`);

  // 测试 1: 通过 Vite 代理
  await testSearchWithoutAuth(searchTerm);

  // 测试 2: 直接连接服务器
  await testDirectSearch(searchTerm);

  log('info', '\n═══════════════════════════════════════════════════════════\n');
  log('info', '💡 结论:');
  log('info', '   1. 如果测试1返回401，说明用户目录API存在但需要认证');
  log('info', '   2. 如果测试2返回空结果，说明用户可能不在目录中');
  log('info', '   3. 应用中的问题是"Matrix client not available"，');
  log('info', '      需要确保在搜索前客户端已初始化');
  log('info', '\n═══════════════════════════════════════════════════════════\n');
}

main().catch(err => {
  log('error', '❌ 测试失败:', err.message);
  process.exit(1);
});
