# Matrix SDK - OIDC 认证 (OpenID Connect)

**文档版本**: 1.0.0
**SDK 版本**: 30.0.0+
**最后更新**: 2026-01-04
**相关规范**: [MSC 2965 - OIDC Authentication](https://github.com/matrix-org/matrix-spec-proposals/pull/2965)

---

## 概述

Matrix SDK 支持 **OpenID Connect (OIDC)** 认证，允许用户使用第三方身份提供商（IdP）登录，如 Google、GitHub、Apple 等。

### OIDC vs 传统认证

| 特性 | 传统认证 | OIDC 认证 |
|------|---------|-----------|
| 用户名/密码 | ✅ 支持 | ⚠️ 可选 |
| 第三方登录 | ❌ 不支持 | ✅ 支持 |
| SSO | ❌ 不支持 | ✅ 支持 |
| 令牌刷新 | ❌ 手动 | ✅ 自动 |
| 设备授权 | ✅ 支持 | ✅ 支持 |

---

## 核心概念

### OIDC 流程

```mermaid
sequenceDiagram
    participant Client
    participant Matrix HS
    participant IdP (Google, GitHub...)

    Client->>Matrix HS: 发现 OIDC 配置
    Matrix HS-->>Client: 返回 IdP 配置

    Client->>IdP: 重定向到授权页面
    IdP-->>Client: 用户登录并授权

    Client->>IdP: 接收授权码
    Client->>Matrix HS: 交换授权码

    Matrix HS->>IdP: 用授权码换取令牌
    IdP-->>Matrix HS: 返回访问令牌

    Matrix HS-->>Client: 登录成功
```

### 术语

| 术语 | 描述 |
|------|------|
| **Issuer** | OIDC 提供商标识符 |
| **Authorization Endpoint** | 授权端点 URL |
| **Token Endpoint** | 令牌端点 URL |
| **Client ID** | 客户端标识符 |
| **Redirect URI** | 重定向 URI |
| **Scope** | 请求的权限范围 |
| **Refresh Token** | 刷新令牌（用于获取新访问令牌） |

---

## 发现 OIDC 配置

### 获取服务器的 OIDC 配置

```typescript
import * as sdk from "matrix-js-sdk";

const baseUrl = "https://matrix.server.com";

// 1. 发现 Well-Known 配置
const wellKnownUrl = `${baseUrl}/.well-known/matrix/client`;
const response = await fetch(wellKnownUrl);
const wellKnown = await response.json();

// 2. 检查是否支持 OIDC
const oidcConfig = wellKnown["m.organisation.matrix_oidc"];
if (!oidcConfig) {
    console.error("服务器不支持 OIDC");
    return;
}

// 3. 获取 OIDC 发现文档
const discoveryUrl = oidcConfig.issuer + "/.well-known/openid-configuration";
const discoveryResponse = await fetch(discoveryUrl);
const discovery = await discoveryResponse.json();

console.log("OIDC 配置:", {
    authorizationEndpoint: discovery.authorization_endpoint,
    tokenEndpoint: discovery.token_endpoint,
    userInfoEndpoint: discovery.userinfo_endpoint,
    supportedScopes: discovery.scopes_supported,
});
```

### 使用 SDK 自动发现

```typescript
import { AutoDiscovery } from "matrix-js-sdk";

const config = await AutoDiscovery.fromDiscoveryConfig("matrix.server.com");

// 检查是否支持 OIDC
if (config["m.homeserver"].state === AutoDiscovery.SUCCESS) {
    // SDK 会自动检测 OIDC 支持
    const baseUrl = config["m.homeserver"].base_url;
    const client = sdk.createClient({ baseUrl });

    // 检查登录流程
    const flows = await client.loginFlows();
    const oidcFlow = flows.flow.find(
        (flow: any) => flow.type === "m.login_oidc"
    );

    if (oidcFlow) {
        console.log("支持 OIDC 认证:", oidcFlow.oidc_config);
    }
}
```

---

## OIDC 登录流程

### 授权码流程（Authorization Code Flow）

```typescript
class OidcAuthManager {
    private clientId: string;
    private redirectUri: string;
    private baseUrl: string;

    constructor(
        baseUrl: string,
        clientId: string,
        redirectUri: string
    ) {
        this.baseUrl = baseUrl;
        this.clientId = clientId;
        this.redirectUri = redirectUri;
    }

    /**
     * 启动 OIDC 登录
     */
    async startLogin(): Promise<string> {
        // 1. 获取 OIDC 配置
        const config = await this.fetchOidcConfig();

        // 2. 生成状态和 PKCE 参数
        const state = this.generateRandomString(32);
        const codeVerifier = this.generateRandomString(64);
        const codeChallenge = await this.sha256(codeVerifier);

        // 3. 构建授权 URL
        const authUrl = new URL(config.authorization_endpoint);
        authUrl.searchParams.set("response_type", "code");
        authUrl.searchParams.set("client_id", this.clientId);
        authUrl.searchParams.set("redirect_uri", this.redirectUri);
        authUrl.searchParams.set("scope", "openid profile matrix");
        authUrl.searchParams.set("state", state);
        authUrl.searchParams.set("code_challenge", codeChallenge);
        authUrl.searchParams.set("code_challenge_method", "S256");

        // 4. 保存状态和 code_verifier
        sessionStorage.setItem("oidc_state", state);
        sessionStorage.setItem("oidc_code_verifier", codeVerifier);

        return authUrl.toString();
    }

    /**
     * 处理回调
     */
    async handleCallback(params: URLSearchParams): Promise<string> {
        const code = params.get("code");
        const state = params.get("state");

        // 验证状态
        const savedState = sessionStorage.getItem("oidc_state");
        if (state !== savedState) {
            throw new Error("Invalid state");
        }

        // 3. 交换授权码换取令牌
        const tokenResponse = await this.exchangeCodeForToken(code!);
        return tokenResponse.access_token;
    }

    /**
     * 用授权码换取令牌
     */
    private async exchangeCodeForToken(code: string): Promise<any> {
        const config = await this.fetchOidcConfig();
        const codeVerifier = sessionStorage.getItem("oidc_code_verifier")!;

        const response = await fetch(config.token_endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                grant_type: "authorization_code",
                code: code,
                redirect_uri: this.redirectUri,
                client_id: this.clientId,
                code_verifier: codeVerifier,
            }),
        });

        if (!response.ok) {
            throw new Error("Token exchange failed");
        }

        return await response.json();
    }

    /**
     * 获取 OIDC 配置
     */
    private async fetchOidcConfig(): Promise<any> {
        // 从 Matrix 服务器获取配置
        const response = await fetch(
            `${this.baseUrl}/_matrix/client/v3/oidc/config`
        );
        return await response.json();
    }

    /**
     * 生成随机字符串
     */
    private generateRandomString(length: number): string {
        const array = new Uint8Array(length);
        crypto.getRandomValues(array);
        return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
    }

    /**
     * SHA256 哈希（用于 PKCE）
     */
    private async sha256(value: string): Promise<string> {
        const encoder = new TextEncoder();
        const data = encoder.encode(value);
        const hash = await crypto.subtle.digest("SHA-256", data);
        return btoa(String.fromCharCode(...new Uint8Array(hash)))
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");
    }
}

// 使用示例
const oidcManager = new OidcAuthManager(
    "https://matrix.server.com",
    "your_client_id",
    "https://yourapp.com/callback"
);

// 启动登录
const authUrl = await oidcManager.startLogin();
window.location.href = authUrl;

// 处理回调（在回调页面）
const params = new URLSearchParams(window.location.search);
const accessToken = await oidcManager.handleCallback(params);

// 使用访问令牌登录 Matrix
const client = sdk.createClient({
    baseUrl: "https://matrix.server.com",
});
await client.login("m.login.oidc", { token: accessToken });
```

---

## 使用 SDK 的 OIDC 集成

### MatrixClient OIDC 支持

```typescript
import * as sdk from "matrix-js-sdk";

const client = sdk.createClient({
    baseUrl: "https://matrix.server.com",
});

// 检查 OIDC 支持
const flows = await client.loginFlows();
const oidcFlow = flows.flow.find(
    (flow: any) => flow.type === "m.login.oidc"
);

if (oidcFlow) {
    // 获取授权 URL
    const config = oidcFlow.oidc_config;
    const authUrl = new URL(config.authorization_endpoint);
    authUrl.searchParams.set("client_id", config.client_id);
    authUrl.searchParams.set("redirect_uri", config.redirect_uri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "openid profile matrix");
    authUrl.searchParams.set("state", generateState());

    // 重定向到 IdP
    window.location.href = authUrl.toString();
}
```

### 令牌刷新

```typescript
// SDK 会自动处理令牌刷新
import { OidcTokenRefresher } from "matrix-js-sdk/src/oidc/tokenRefresher";

const tokenRefresher = new OidcTokenRefresher({
    clientId: "your_client_id",
    tokenEndpoint: "https://idp.example.com/oauth/token",
    refreshToken: "your_refresh_token",
});

// 刷新令牌
const newTokens = await tokenRefresher.refreshTokens();
console.log("新访问令牌:", newTokens.access_token);
```

---

## 完整示例：OIDC 登录管理器

```typescript
import * as sdk from "matrix-js-sdk";

class OidcLoginManager {
    private client: sdk.MatrixClient;
    private config: any;

    constructor(baseUrl: string) {
        this.client = sdk.createClient({ baseUrl });
    }

    /**
     * 初始化 OIDC
     */
    async initialize(): Promise<boolean> {
        // 1. 获取登录流程
        const flows = await this.client.loginFlows();

        // 2. 检查 OIDC 支持
        const oidcFlow = flows.flow.find(
            (flow: any) => flow.type === "m.login.oidc"
        );

        if (!oidcFlow) {
            console.error("服务器不支持 OIDC");
            return false;
        }

        this.config = oidcFlow.oidc_config;
        return true;
    }

    /**
     * 开始登录流程
     */
    async login(): Promise<void> {
        const state = this.generateState();
        const codeVerifier = this.generateCodeVerifier();
        const codeChallenge = await this.generateCodeChallenge(codeVerifier);

        // 保存状态
        sessionStorage.setItem("oidc_state", state);
        sessionStorage.setItem("oidc_code_verifier", codeVerifier);

        // 构建授权 URL
        const params = new URLSearchParams({
            response_type: "code",
            client_id: this.config.client_id,
            redirect_uri: this.config.redirect_uri,
            scope: this.config.scope || "openid profile matrix",
            state: state,
            code_challenge: codeChallenge,
            code_challenge_method: "S256",
        });

        const authUrl = `${this.config.authorization_endpoint}?${params}`;

        // 重定向到授权页面
        window.location.href = authUrl;
    }

    /**
     * 处理回调并完成登录
     */
    async handleCallback(callbackParams: URLSearchParams): Promise<sdk.MatrixClient> {
        const code = callbackParams.get("code");
        const state = callbackParams.get("state");

        // 验证状态
        const savedState = sessionStorage.getItem("oidc_state");
        if (state !== savedState) {
            throw new Error("Invalid state parameter");
        }

        // 交换授权码
        const tokens = await this.exchangeCodeForToken(code!);

        // 使用访问令牌登录 Matrix
        await this.client.login("m.login.oidc", {
            token: tokens.access_token,
        });

        return this.client;
    }

    /**
     * 交换授权码换取令牌
     */
    private async exchangeCodeForToken(code: string): Promise<any> {
        const codeVerifier = sessionStorage.getItem("oidc_code_verifier")!;

        const response = await fetch(this.config.token_endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                grant_type: "authorization_code",
                code: code,
                redirect_uri: this.config.redirect_uri,
                client_id: this.config.client_id,
                code_verifier: codeVerifier,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Token exchange failed: ${error}`);
        }

        return await response.json();
    }

    private generateState(): string {
        return this.generateRandomString(32);
    }

    private generateCodeVerifier(): string {
        return this.generateRandomString(64);
    }

    private async generateCodeChallenge(verifier: string): Promise<string> {
        const encoder = new TextEncoder();
        const data = encoder.encode(verifier);
        const hash = await crypto.subtle.digest("SHA-256", data);
        return btoa(String.fromCharCode(...new Uint8Array(hash)))
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");
    }

    private generateRandomString(length: number): string {
        const array = new Uint8Array(length);
        crypto.getRandomValues(array);
        return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
    }
}

// 使用示例
async function loginWithOidc() {
    const manager = new OidcLoginManager("https://matrix.server.com");

    // 初始化并检查支持
    const supported = await manager.initialize();
    if (!supported) {
        alert("服务器不支持 OIDC 登录");
        return;
    }

    // 检查是否是回调
    const params = new URLSearchParams(window.location.search);
    if (params.has("code")) {
        // 处理回调
        const client = await manager.handleCallback(params);
        console.log("登录成功!", client.getUserId());
        return client;
    } else {
        // 开始登录
        await manager.login();
    }
}
```

---

## 令牌刷新

### 自动令牌刷新

```typescript
import { OidcTokenRefresher } from "matrix-js-sdk/src/oidc/tokenRefresher";

const tokenRefresher = new OidcTokenRefresher({
    clientId: "your_client_id",
    tokenEndpoint: "https://idp.example.com/oauth/token",
    refreshToken: "your_refresh_token",
});

// SDK 会在令牌即将过期时自动刷新
client.setOidcTokenRefresher(tokenRefresher);
```

### 手动令牌刷新

```typescript
// 手动刷新令牌
const newTokens = await tokenRefresher.refreshTokens();

// 更新客户端令牌
client.setAccessToken(newTokens.access_token);

// 保存新的刷新令牌
localStorage.setItem("refresh_token", newTokens.refresh_token);
```

---

## 配置常见 IdP

### Google OAuth

```typescript
// Google OIDC 配置
const config = {
    issuer: "https://accounts.google.com",
    authorization_endpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    token_endpoint: "https://oauth2.googleapis.com/token",
    userinfo_endpoint: "https://openidconnect.googleapis.com/v1/userinfo",
    client_id: "your-google-client-id.apps.googleusercontent.com",
    redirect_uri: "https://yourapp.com/callback",
    scope: "openid profile email",
};
```

### GitHub OAuth

```typescript
// GitHub OIDC 配置
const config = {
    issuer: "https://github.com",
    authorization_endpoint: "https://github.com/login/oauth/authorize",
    token_endpoint: "https://github.com/login/oauth/access_token",
    userinfo_endpoint: "https://api.github.com/user",
    client_id: "your-github-client-id",
    redirect_uri: "https://yourapp.com/callback",
    scope: "openid profile email",
};
```

### Apple Sign In

```typescript
// Apple Sign In 配置
const config = {
    issuer: "https://appleid.apple.com",
    authorization_endpoint: "https://appleid.apple.com/auth/authorize",
    token_endpoint: "https://appleid.apple.com/auth/token",
    client_id: "your.apple.app.bundle.id",
    redirect_uri: "https://yourapp.com/callback",
    scope: "openid name email",
};
```

---

## 相关文档

- [02-authentication.md](./02-authentication.md) - 认证和登录
- [16-server-discovery.md](./16-server-discovery.md) - 服务发现
- [MSC 2965 - OIDC Authentication](https://github.com/matrix-org/matrix-spec-proposals/pull/2965)
- [OIDC 规范](https://openid.net/connect/)

---

**文档维护**: 如有更新，请同步修改 Matrix SDK 版本号和最后更新日期。
