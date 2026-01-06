/**
 * Matrix 用户目录搜索测试脚本
 *
 * 使用方法：
 * node test-user-search.js <用户名> <访问令牌>
 *
 * 示例：
 * node test-user-search.js rere <your_access_token>
 */

const https = require('https');

// 配置
const HOMESERVER = 'matrix.cjystx.top';
const USER_ID = '@tete:cjystx.top';
const PASSWORD = 'Ljf3790791';

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m'
};

function log(color, ...args) {
  console.log(color + args.join(' ') + colors.reset);
}

// 执行 HTTPS 请求
function httpsRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ statusCode: res.statusCode, headers: res.headers, body: parsed });
        } catch (e) {
          resolve({ statusCode: res.statusCode, headers: res.headers, body });
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

// 1. 登录获取 access token
async function login() {
  log(colors.blue, '\n📝 步骤 1: 登录获取访问令牌...');

  const options = {
    hostname: HOMESERVER,
    port: 443,
    path: '/_matrix/client/r0/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  const data = {
    type: 'm.login.password',
    user: USER_ID,
    password: PASSWORD
  };

  const response = await httpsRequest(options, data);

  if (response.statusCode !== 200) {
    log(colors.red, '❌ 登录失败:', response.body);
    throw new Error('Login failed');
  }

  const accessToken = response.body.access_token;
  const userId = response.body.user_id;
  const deviceId = response.body.device_id;

  log(colors.green, '✅ 登录成功!');
  log(colors.green, '   用户ID:', userId);
  log(colors.green, '   设备ID:', deviceId);
  log(colors.green, '   访问令牌:', accessToken.substring(0, 20) + '...');

  return { accessToken, userId, deviceId };
}

// 2. 搜索用户目录
async function searchUserDirectory(accessToken, searchTerm) {
  log(colors.blue, `\n🔍 步骤 2: 搜索用户 "${searchTerm}"...`);

  const options = {
    hostname: HOMESERVER,
    port: 443,
    path: `/_matrix/client/r0/user_directory/search?search_term=${encodeURIComponent(searchTerm)}`,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  };

  const data = {
    search_term: searchTerm,
    limit: 20
  };

  const response = await httpsRequest(options, data);

  log(colors.yellow, '   状态码:', response.statusCode);
  log(colors.yellow, '   响应:', JSON.stringify(response.body, null, 2));

  if (response.statusCode === 200) {
    const results = response.body.results || [];
    const limited = response.body.limited || false;

    if (results.length > 0) {
      log(colors.green, `✅ 找到 ${results.length} 个用户:`);
      results.forEach((user, index) => {
        log(colors.green, `   ${index + 1}. ${user.user_id}`);
        if (user.display_name) {
          log(colors.green, `      显示名称: ${user.display_name}`);
        }
        if (user.avatar_url) {
          log(colors.green, `      头像: ${user.avatar_url}`);
        }
      });
    } else {
      log(colors.red, '❌ 未找到匹配的用户');
      log(colors.yellow, '   可能的原因:');
      log(colors.yellow, '   1. 用户不存在');
      log(colors.yellow, '   2. 用户在用户目录中不可见（隐私设置）');
      log(colors.yellow, '   3. 服务器未启用用户目录功能');
    }

    if (limited) {
      log(colors.yellow, '⚠️  结果被限制，可能还有更多匹配的用户');
    }

    return results;
  } else {
    log(colors.red, '❌ 搜索请求失败');
    return [];
  }
}

// 3. 检查服务发现
async function checkWellKnown() {
  log(colors.blue, '\n🌐 步骤 3: 检查服务器配置...');

  const options = {
    hostname: HOMESERVER,
    port: 443,
    path: '/.well-known/matrix/client',
    method: 'GET'
  };

  try {
    const response = await httpsRequest(options);
    log(colors.yellow, '   状态码:', response.statusCode);

    if (response.statusCode === 200) {
      log(colors.green, '✅ 服务器配置正常');
      log(colors.yellow, '   配置:', JSON.stringify(response.body, null, 2));
      return response.body;
    } else {
      log(colors.yellow, '⚠️  服务器配置响应非 200');
      return null;
    }
  } catch (error) {
    log(colors.red, '❌ 无法获取服务器配置:', error.message);
    return null;
  }
}

// 4. 检查用户目录支持
async function checkUserDirectorySupport() {
  log(colors.blue, '\n📋 步骤 4: 检查服务器功能支持...');

  const options = {
    hostname: HOMESERVER,
    port: 443,
    path: '/_matrix/client/versions',
    method: 'GET'
  };

  try {
    const response = await httpsRequest(options);
    log(colors.yellow, '   状态码:', response.statusCode);

    if (response.statusCode === 200) {
      log(colors.green, '✅ 服务器版本信息:');
      log(colors.yellow, '   ', JSON.stringify(response.body, null, 2));

      // 检查是否支持用户目录
      const versions = response.body.versions || [];
      const hasUserDir = versions.some(v =>
        v === 'r0.6.0' || v === 'r0.6.1' || v === 'v1.0' || v === 'v1.1'
      );

      if (hasUserDir) {
        log(colors.green, '✅ 服务器支持用户目录 API');
      } else {
        log(colors.yellow, '⚠️  无法确认用户目录 API 支持');
      }
    }
  } catch (error) {
    log(colors.red, '❌ 无法获取服务器版本信息:', error.message);
  }
}

// 主函数
async function main() {
  const searchTerm = process.argv[2] || 'rere';

  log(colors.blue, '═══════════════════════════════════════════════════════════');
  log(colors.blue, '         Matrix 用户目录搜索测试');
  log(colors.blue, '═══════════════════════════════════════════════════════════');
  log(colors.yellow, `服务器: ${HOMESERVER}`);
  log(colors.yellow, `搜索词: "${searchTerm}"`);

  try {
    // 步骤 0: 检查服务器配置
    await checkWellKnown();

    // 步骤 1: 检查服务器功能
    await checkUserDirectorySupport();

    // 步骤 2: 登录
    const { accessToken } = await login();

    // 步骤 3: 搜索用户
    const results = await searchUserDirectory(accessToken, searchTerm);

    log(colors.blue, '\n═══════════════════════════════════════════════════════════');
    if (results.length > 0) {
      log(colors.green, `✅ 测试完成: 找到 ${results.length} 个用户`);
    } else {
      log(colors.red, '❌ 测试完成: 未找到用户');
    }
    log(colors.blue, '═══════════════════════════════════════════════════════════\n');

  } catch (error) {
    log(colors.red, '\n❌ 测试失败:', error.message);
    log(colors.red, error.stack);
    process.exit(1);
  }
}

// 运行
main();
