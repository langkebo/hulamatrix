# 02. 用户认证

> Matrix JS SDK 用户登录、注册、令牌管理等认证功能

## 实现验证状态

> **验证日期**: 2025-12-30
> **验证报告**: [02-authentication-VERIFICATION.md](./02-authentication-VERIFICATION.md)
> **总体完成度**: 95% ✅
>
> ### 功能状态
> - ✅ 密码登录: 已完整实现
> - ✅ 注册: 已完整实现
> - ✅ 登出: 已完整实现
> - ✅ 刷新令牌: 已完整实现
> - ✅ OAuth/OIDC: 已完整实现 (SSO + OpenID Connect)
> - ✅ 访客访问: 已完整实现
> - ✅ whoami: 已完整实现
> - ✅ 登出所有设备: 已完整实现
> - ✅ 检查用户名可用性: 已完整实现
> - ❌ 交互式认证 (UIA): 未实现
>
> ### 主要发现
> 1. **已实现**: 所有主要认证功能完整
> 2. **新增功能**: whoami、logoutAll、loginAsGuest、getOpenIdToken、isUsernameAvailable
> 3. **状态**: 核心认证功能完整，仅 UIA 待实现

## 目录
- [登录](#登录)
- [注册](#注册)
- [登出](#登出)
- [刷新令牌](#刷新令牌)
- [访客访问](#访客访问)
- [OAuth/OIDC](#oauthoidc)
- [交互式认证](#交互式认证)
- [完整示例](#完整示例)

## 登录

### 密码登录

```typescript
import * as sdk from "matrix-js-sdk";

const client = sdk.createClient({
  baseUrl: "https://matrix.org"
});

// 方法1: 使用 login 方法的简化形式
const loginResponse = await client.login("m.login.password", {
  user: "username",
  password: "password"
});

console.log("User ID:", loginResponse.user_id);
console.log("Access token:", loginResponse.access_token);
console.log("Device ID:", loginResponse.device_id);
```

### 使用用户标识符登录

```typescript
// 使用 user 字段
const response1 = await client.login("m.login.password", {
  user: "username",
  password: "password"
});

// 使用 identifier 对象（推荐）
const response2 = await client.login("m.login.password", {
  identifier: {
    type: "m.id.user",
    user: "username"
  },
  password: "password"
});

// 使用第三方 ID
const response3 = await client.login("m.login.password", {
  identifier: {
    type: "m.id.thirdparty",
    medium: "email",
    address: "user@example.com"
  },
  password: "password"
});
```

### 使用已有令牌创建客户端

```typescript
// 如果已有访问令牌，直接创建客户端
const client = sdk.createClient({
  baseUrl: "https://matrix.org",
  accessToken: "syt_existing_token_here",
  userId: "@user:matrix.org",
  deviceId: "existing_device_id"
});

await client.startClient();
```

### 设备管理

```typescript
// 登录时指定设备 ID
const loginResponse = await client.login("m.login.password", {
  identifier: {
    type: "m.id.user",
    user: "username"
  },
  password: "password",
  device_id: "my_custom_device_id",  // 可选，不指定则自动生成
  initial_device_display_name: "My Custom App"  // 设备显示名称
});

// 登录后获取设备信息
console.log("Device ID:", loginResponse.device_id);
```

### 检查登录状态

```typescript
// 检查是否有访问令牌
if (client.getAccessToken()) {
  console.log("User is logged in");
  console.log("User ID:", client.getUserId());
  console.log("Device ID:", client.getDeviceId());
} else {
  console.log("User is not logged in");
}
```

### whoami - 获取当前用户信息

```typescript
// 获取当前认证用户的信息
const whoami = await client.whoami();
console.log("User ID:", whoami.user_id);
console.log("Device ID:", whoami.device_id);
console.log("Is guest:", whoami.is_guest);
```

## 注册

### 基本注册

```typescript
const client = sdk.createClient({
  baseUrl: "https://matrix.org"
});

// 简单注册
const registerResponse = await client.register("m.login.dummy", {
  username: "newuser",
  password: "securepassword"
});

console.log("User ID:", registerResponse.user_id);
console.log("Access token:", registerResponse.access_token);
```

### 使用交互式认证注册

```typescript
// 使用密码注册
const registerResponse = await client.registerRequest({
  username: "newuser",
  password: "securepassword",
  auth: {
    type: "m.login.dummy"
  }
});

console.log("Registered:", registerResponse.user_id);
```

### 检查用户名可用性

```typescript
// 检查用户名是否可用
const isAvailable = await client.isUsernameAvailable("newusername");
if (isAvailable) {
  console.log("Username is available");
} else {
  console.log("Username is already taken");
}
```

### 带邮箱验证的注册

```typescript
// 注册并绑定邮箱
const registerResponse = await client.registerRequest({
  username: "newuser",
  password: "securepassword",
  auth: {
    type: "m.login.dummy"
  },
  // 邮箱信息（需要在注册后验证）
  email: "user@example.com"
});

// 注意：实际邮箱验证流程需要通过交互式认证完成
```

### 注册并自动登录

```typescript
async function registerAndLogin(username: string, password: string) {
  const client = sdk.createClient({
    baseUrl: "https://matrix.org"
  });

  // 注册
  const registerResponse = await client.registerRequest({
    username,
    password,
    auth: { type: "m.login.dummy" }
  });

  // 使用返回的令牌创建客户端
  const authenticatedClient = sdk.createClient({
    baseUrl: "https://matrix.org",
    accessToken: registerResponse.access_token,
    userId: registerResponse.user_id,
    deviceId: registerResponse.device_id
  });

  await authenticatedClient.startClient();
  return authenticatedClient;
}
```

## 登出

### 基本登出

```typescript
// 登出并使访问令牌失效
await client.logout();
console.log("Logged out successfully");

// 登出后停止客户端
client.stopClient();
```

### 登出所有设备

```typescript
// 登出当前账户的所有设备
await client.logoutAll({
  erase: true  // 同时擦除账户数据
});
console.log("Logged out from all devices");
```

### 本地登出（不使令牌失效）

```typescript
// 仅本地清除客户端状态，不使服务器令牌失效
client.stopClient();
await client.clearStores();
console.log("Client cleared (token still valid)");
```

### 登出后处理

```typescript
async function handleLogout(client: sdk.MatrixClient) {
  try {
    // 1. 停止同步
    client.stopClient();

    // 2. 调用登出 API
    await client.logout();

    // 3. 清理加密数据
    const crypto = client.getCrypto();
    if (crypto) {
      await crypto.stop();
    }

    // 4. 清除本地存储
    await client.clearStores();

    console.log("Logged out successfully");

    // 5. 重定向到登录页面
    // window.location.href = "/login";

  } catch (error) {
    console.error("Logout failed:", error);
  }
}
```

## 刷新令牌

### 软登录（刷新令牌）

```typescript
// 使用刷新令牌获取新的访问令牌
const refreshResponse = await client.refreshToken({
  refresh_token: "your_refresh_token"
});

console.log("New access token:", refreshResponse.access_token);
console.log("New refresh token:", refreshResponse.refresh_token);

// 更新客户端令牌
client.setAccessToken(refreshResponse.access_token);
```

### 令牌过期处理

```typescript
// 监听令牌过期事件
client.on(ClientEvent.Session, async (sessionData) => {
  if (sessionData === "soft_logout") {
    console.log("Token expired, need to refresh");

    // 尝试刷新令牌
    try {
      const refreshResponse = await client.login("m.login.token", {
        token: storedRefreshToken
      });

      client.setAccessToken(refreshResponse.access_token);
      await client.startClient();

    } catch (error) {
      console.error("Token refresh failed:", error);
      // 需要重新登录
    }
  }
});
```

## 访客访问

### 访客登录

```typescript
// 作为访客登录
const guestResponse = await client.login("m.login.guest", {});

console.log("Guest access token:", guestResponse.access_token);
console.log("Guest user ID:", guestResponse.user_id);

// 检查是否为访客
if (client.isGuest()) {
  console.log("Logged in as guest");
}
```

### 访客限制

```typescript
// 访客账户有各种限制：
// - 无法创建房间
// - 无法邀请其他用户
// - 某些房间可能禁止访客加入

try {
  await client.createRoom({
    name: "Guest Room"
  });
} catch (error) {
  console.error("Guest cannot create rooms:", error.errcode);
  // error.errcode === "M_GUEST_ACCESS_FORBIDDEN"
}
```

### 访客升级为注册用户

```typescript
// 访客账户可以通过注册升级为完整账户
const upgradeResponse = await client.registerRequest({
  username: "existingguest",
  password: "newpassword",
  auth: {
    type: "m.login.dummy"
  },
  guest_access_token: client.getAccessToken()  // 使用访客令牌
});

console.log("Upgraded to:", upgradeResponse.user_id);
```

## OAuth/OIDC

### OAuth 2.0 登录

```typescript
// 使用 OAuth 2.0 登录
const oauthResponse = await client.login("m.login.oauth2", {
  redirect_uri: "https://myapp.com/callback",
  client_id: "my_client_id",
  response_type: "code",
  scope: "openid profile"
});

// 重定向用户到授权页面
window.location.href = oauthResponse.redirect_url;
```

### 处理 OAuth 回调

```typescript
// 在回调处理页面
async function handleOAuthCallback(code: string) {
  const client = sdk.createClient({
    baseUrl: "https://matrix.org"
  });

  // 使用授权码交换令牌
  const tokenResponse = await client.login("m.login.oauth2", {
    code,
    redirect_uri: "https://myapp.com/callback",
    client_id: "my_client_id",
    grant_type: "authorization_code"
  });

  return tokenResponse;
}
```

### OpenID Connect

```typescript
// 获取 OpenID Connect 令牌
const oidcToken = await client.getOpenIdToken();

console.log("Access token:", oidcToken.access_token);
console.log("Token type:", oidcToken.token_type);
console.log("Matrix token:", oidcToken.matrix_token);
console.log("Expires in:", oidcToken.expires_in);
```

## 交互式认证

### UIA (User-Interactive Authentication)

```typescript
// 许多操作需要交互式认证（如删除账户、修改密码等）

async function changePassword(
  client: sdk.MatrixClient,
  oldPassword: string,
  newPassword: string
) {
  try {
    // 首次尝试
    await client.setPassword(newPassword);
  } catch (error: any) {
    if (error.errcode === "M_FORBIDDEN") {
      // 需要交互式认证
      const authData = {
        type: "m.login.password",
        identifier: {
          type: "m.id.user",
          user: client.getUserId()!
        },
        password: oldPassword,
        session: error.data.session
      };

      // 使用认证数据重试
      await client.setPassword(newPassword, authData);
      console.log("Password changed successfully");
    }
  }
}
```

### 完整的 UIA 处理

```typescript
async function handleUiaFlow(
  client: sdk.MatrixClient,
  operation: string,
  params: any
) {
  try {
    // 尝试直接执行操作
    await client.http.authedRequest<any>(
      undefined,
      "POST",
      operation,
      undefined,
      params
    );
  } catch (error: any) {
    if (error.errcode === "M_FORBIDDEN" && error.data?.flows) {
      // 处理 UIA 流程
      console.log("Available auth flows:", error.data.flows);

      // 选择一个合适的认证流程
      const flow = error.data.flows.find((f: any) =>
        f.stages.includes("m.login.password")
      );

      if (flow) {
        // 收集用户凭证
        const password = await promptUserForPassword();

        // 构造认证数据
        const authData = {
          type: "m.login.password",
          identifier: {
            type: "m.id.user",
            user: client.getUserId()!
          },
          password,
          session: error.data.session
        };

        // 使用认证数据重试
        await client.http.authedRequest<any>(
          undefined,
          "POST",
          operation,
          undefined,
          { ...params, auth: authData }
        );

        console.log("Operation completed successfully");
      }
    }
  }
}

// 使用示例
await handleUiaFlow(client, "/account/password", {
  new_password: "new_secure_password"
});
```

## 完整示例

### 完整的认证管理类

```typescript
import * as sdk from "matrix-js-sdk";
import { ClientEvent } from "matrix-js-sdk";

interface AuthConfig {
  baseUrl: string;
  username?: string;
  password?: string;
  accessToken?: string;
  deviceId?: string;
}

class MatrixAuthManager {
  private client: sdk.MatrixClient | null = null;

  constructor(private config: AuthConfig) {}

  // 登录
  async login(username: string, password: string): Promise<sdk.MatrixClient> {
    this.client = sdk.createClient({
      baseUrl: this.config.baseUrl
    });

    const response = await this.client.login("m.login.password", {
      identifier: {
        type: "m.id.user",
        user: username
      },
      password,
      device_id: this.config.deviceId,
      initial_device_display_name: "Matrix App"
    });

    // 使用返回的令牌重新创建客户端
    this.client = sdk.createClient({
      baseUrl: this.config.baseUrl,
      accessToken: response.access_token,
      userId: response.user_id,
      deviceId: response.device_id
    });

    await this.setupClient();
    return this.client;
  }

  // 使用已有令牌登录
  async loginWithToken(
    accessToken: string,
    userId: string,
    deviceId: string
  ): Promise<sdk.MatrixClient> {
    this.client = sdk.createClient({
      baseUrl: this.config.baseUrl,
      accessToken,
      userId,
      deviceId
    });

    await this.setupClient();
    return this.client;
  }

  // 注册
  async register(username: string, password: string): Promise<sdk.MatrixClient> {
    this.client = sdk.createClient({
      baseUrl: this.config.baseUrl
    });

    const response = await this.client.register("m.login.dummy", {
      username,
      password
    });

    this.client = sdk.createClient({
      baseUrl: this.config.baseUrl,
      accessToken: response.access_token,
      userId: response.user_id,
      deviceId: response.device_id
    });

    await this.setupClient();
    return this.client;
  }

  // 登出
  async logout(): Promise<void> {
    if (!this.client) {
      throw new Error("No active client");
    }

    try {
      await this.client.logout();
    } finally {
      this.cleanup();
    }
  }

  // 检查登录状态
  isAuthenticated(): boolean {
    return !!this.client?.getAccessToken();
  }

  // 获取客户端
  getClient(): sdk.MatrixClient | null {
    return this.client;
  }

  // 设置客户端
  private async setupClient(): Promise<void> {
    if (!this.client) return;

    // 设置事件监听器
    this.client.on(ClientEvent.Session, async (sessionData) => {
      if (sessionData === "soft_logout") {
        console.log("Soft logout detected");
        // 处理软登出
      }
    });

    // 启动客户端
    await this.client.startClient({
      initialSyncLimit: 20
    });
  }

  // 清理资源
  private cleanup(): void {
    if (!this.client) return;

    this.client.stopClient();

    const crypto = this.client.getCrypto();
    if (crypto) {
      crypto.stop().catch(console.error);
    }

    this.client = null;
  }
}

// 使用示例
async function main() {
  const authManager = new MatrixAuthManager({
    baseUrl: "https://matrix.org"
  });

  try {
    // 登录
    const client = await authManager.login("username", "password");
    console.log("Logged in as:", client.getUserId());

    // 使用客户端...

    // 登出
    await authManager.logout();

  } catch (error) {
    console.error("Auth error:", error);
  }
}

main();
```

### 令牌持久化和自动重连

```typescript
class PersistentAuthManager {
  private storageKey = "matrix_auth_data";

  async login(username: string, password: string) {
    const client = sdk.createClient({ baseUrl: "https://matrix.org" });

    const response = await client.login("m.login.password", {
      identifier: { type: "m.id.user", user: username },
      password
    });

    // 保存认证数据
    const authData = {
      accessToken: response.access_token,
      userId: response.user_id,
      deviceId: response.device_id,
      baseUrl: "https://matrix.org"
    };

    localStorage.setItem(this.storageKey, JSON.stringify(authData));

    return authData;
  }

  async restoreSession() {
    const stored = localStorage.getItem(this.storageKey);
    if (!stored) {
      return null;
    }

    const authData = JSON.parse(stored);

    try {
      // 验证令牌是否仍然有效
      const client = sdk.createClient(authData);
      await client.whoami();

      // 令牌有效，启动客户端
      await client.startClient();
      return client;

    } catch (error) {
      // 令牌无效，清除存储
      localStorage.removeItem(this.storageKey);
      return null;
    }
  }

  async logout() {
    const stored = localStorage.getItem(this.storageKey);
    if (stored) {
      const authData = JSON.parse(stored);

      try {
        const client = sdk.createClient(authData);
        await client.logout();
      } catch (error) {
        console.error("Logout error:", error);
      }

      localStorage.removeItem(this.storageKey);
    }
  }
}
```

### 多账户管理

```typescript
class MultiAccountManager {
  private accounts: Map<string, sdk.MatrixClient> = new Map();

  async addAccount(accountId: string, authData: any): Promise<void> {
    const client = sdk.createClient(authData);
    await client.startClient();

    this.accounts.set(accountId, client);
  }

  getAccount(accountId: string): sdk.MatrixClient | undefined {
    return this.accounts.get(accountId);
  }

  getAllAccounts(): sdk.MatrixClient[] {
    return Array.from(this.accounts.values());
  }

  async removeAccount(accountId: string): Promise<void> {
    const client = this.accounts.get(accountId);
    if (client) {
      await client.logout();
      this.accounts.delete(accountId);
    }
  }

  async logoutAll(): Promise<void> {
    const promises = Array.from(this.accounts.values()).map(client =>
      client.logout()
    );

    await Promise.all(promises);
    this.accounts.clear();
  }
}
```

## 常见问题

### Q: 如何处理令牌过期？

```typescript
client.on(ClientEvent.Session, (sessionData) => {
  if (sessionData === "soft_logout") {
    // 访问令牌过期，需要刷新或重新登录
    console.log("Access token expired");
    // 触发重新登录流程
  }
});
```

### Q: 如何实现"记住我"功能？

```typescript
// 登录时保存令牌
async function loginWithRemember(username: string, password: string, remember: boolean) {
  const response = await client.login("m.login.password", {
    identifier: { type: "m.id.user", user: username },
    password
  });

  if (remember) {
    localStorage.setItem("matrix_auth", JSON.stringify({
      accessToken: response.access_token,
      userId: response.user_id,
      deviceId: response.device_id
    }));
  }

  return response;
}
```

### Q: 如何实现单点登录 (SSO)？

```typescript
// SSO 登录流程
async function ssoLogin(identityProviderId?: string) {
  const client = sdk.createClient({ baseUrl: "https://matrix.org" });

  // 获取 SSO 登录 URL
  const ssoUrl = client.getSsoLoginUrl(
    "https://myapp.com/callback",
    identityProviderId,
    "my_device_id"
  );

  // 重定向到 SSO 提供者
  window.location.href = ssoUrl;
}

// 在回调页面处理
async function handleSsoCallback(loginToken: string) {
  const client = sdk.createClient({ baseUrl: "https://matrix.org" });

  const response = await client.login("m.login.token", {
    token: loginToken
  });

  return response;
}
```
