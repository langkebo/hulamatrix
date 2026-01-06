# Matrix SDK - 服务发现 (Server Discovery)

**文档版本**: 1.0.0
**SDK 版本**: 39.1.3
**最后更新**: 2026-01-04
**相关规范**: [Matrix Server Discovery v1.0](https://spec.matrix.org/v1.10/client-server-api/#server-discovery)

---

## 概述

Matrix SDK 提供完整的**服务发现（Auto-discovery）**功能，允许客户端自动发现：
- 用户的主服务器（Homeserver）
- 身份服务器（Identity Server）
- 其他服务端点

服务发现遵循 [RFC 8615 Well-Known URIs](https://datatracker.ietf.org/doc/html/rfc8615) 规范。

---

## 核心类：AutoDiscovery

### 导入

```typescript
import { AutoDiscovery } from "matrix-js-sdk";
```

### 发现状态枚举

```typescript
enum AutoDiscoveryAction {
    SUCCESS = "SUCCESS",        // 发现成功
    IGNORE = "IGNORE",          // 忽略（无需操作）
    PROMPT = "PROMPT",          // 提示用户输入更多信息
    FAIL_PROMPT = "FAIL_PROMPT", // 失败但可恢复（提示用户）
    FAIL_ERROR = "FAIL_ERROR",   // 失败且不可恢复（显示错误）
}
```

### 发现错误枚举

```typescript
enum AutoDiscoveryError {
    Invalid = "Invalid homeserver discovery response",
    GenericFailure = "Failed to get autodiscovery configuration from server",
    InvalidHsBaseUrl = "Invalid base_url for m.homeserver",
    InvalidHomeserver = "Homeserver URL does not appear to be a valid Matrix homeserver",
    InvalidIsBaseUrl = "Invalid base_url for m.identity_server",
    InvalidIdentityServer = "Identity server URL does not appear to be a valid identity server",
    InvalidIs = "Invalid identity server discovery response",
    MissingWellknown = "No .well-known JSON file found",
    InvalidJson = "Invalid JSON",
    UnsupportedHomeserverSpecVersion = "The homeserver does not meet the version requirements",
}
```

---

## API 使用方法

### 1. 从域名自动发现配置

```typescript
// 自动发现 example.com 的 Matrix 配置
const config = await AutoDiscovery.fromDiscoveryConfig("example.com");

// 或者提供完整的 .well-known 配置
const wellKnown = {
    "m.homeserver": {
        "base_url": "https://matrix.example.com"
    },
    "m.identity_server": {
        "base_url": "https://identity.example.com"
    }
};
const config = await AutoDiscovery.fromDiscoveryConfig(wellKnown);
```

### 2. 完整的服务发现流程

```typescript
async function discoverServer(domain: string) {
    // 步骤 1: 获取 .well-known 配置
    const response = await fetch(`https://${domain}/.well-known/matrix/client`);
    const wellKnown = await response.json();

    // 步骤 2: 验证配置
    const clientConfig = await AutoDiscovery.fromDiscoveryConfig(wellKnown);

    // 步骤 3: 处理结果
    const hsConfig = clientConfig["m.homeserver"];
    const isConfig = clientConfig["m.identity_server"];

    switch (hsConfig.state) {
        case AutoDiscovery.SUCCESS:
            console.log("发现成功:", hsConfig.base_url);
            break;
        case AutoDiscovery.PROMPT:
            console.log("需要手动输入服务器 URL");
            break;
        case AutoDiscovery.FAIL_PROMPT:
            console.error("错误:", hsConfig.error);
            console.log("但可以提示用户手动输入");
            break;
        case AutoDiscovery.FAIL_ERROR:
            console.error("严重错误:", hsConfig.error);
            throw new Error("无法继续");
    }

    return clientConfig;
}
```

### 3. 验证和清理 URL

```typescript
// 清理和验证 Well-Known URL
const cleanUrl = AutoDiscovery.sanitizeWellKnownUrl("https://matrix.example.com/");
// 返回: "https://matrix.example.com"

const invalidUrl = AutoDiscovery.sanitizeWellKnownUrl("not-a-url");
// 返回: null
```

### 4. 检查服务器版本兼容性

```typescript
// AutoDiscovery 内部会自动检查服务器版本
// 但你也可以手动检查
import { SUPPORTED_MATRIX_VERSIONS } from "matrix-js-sdk";

console.log("支持的版本:", SUPPORTED_MATRIX_VERSIONS);
// 输出: ["r0.5.0", "r0.6.0", "r0.6.1", "v1.0", "v1.1", ...]
```

---

## 客户端配置接口

### ClientConfig 结构

```typescript
interface ClientConfig {
    "m.homeserver": {
        state: AutoDiscoveryAction;
        error?: AutoDiscoveryError | null;
        base_url: string | null;
    };
    "m.identity_server": {
        state: AutoDiscoveryAction;
        error?: AutoDiscoveryError | null;
        base_url: string | null;
    };
}
```

---

## 完整示例：带 UI 反馈的登录流程

```typescript
import { AutoDiscovery, MatrixClient } from "matrix-js-sdk";

async function loginWithAutoDiscovery(
    username: string,
    password: string,
    domain?: string
): Promise<MatrixClient> {
    let baseUrl: string;

    if (domain) {
        // 尝试自动发现
        console.log(`正在发现 ${domain} 的 Matrix 服务器...`);
        const config = await AutoDiscovery.fromDiscoveryConfig(domain);

        const hsConfig = config["m.homeserver"];

        if (hsConfig.state === AutoDiscovery.SUCCESS) {
            baseUrl = hsConfig.base_url!;
            console.log(`✓ 找到服务器: ${baseUrl}`);
        } else if (hsConfig.state === AutoDiscovery.FAIL_PROMPT) {
            // 显示警告，但仍允许继续
            console.warn(`⚠ 警告: ${hsConfig.error}`);
            console.log("尝试使用找到的 URL:", hsConfig.base_url);
            baseUrl = hsConfig.base_url!;
        } else {
            // 完全失败，需要用户手动输入
            throw new Error(
                `无法自动发现服务器: ${hsConfig.error}\n` +
                "请手动输入主服务器 URL"
            );
        }
    } else {
        // 用户手动提供了 baseUrl
        baseUrl = "https://matrix.example.com";
    }

    // 创建客户端并登录
    const client = MatrixClient.createSimpleClient({
        baseUrl: baseUrl,
    });

    await client.login("m.login.password", {
        user: username,
        password: password,
    });

    return client;
}

// 使用示例
try {
    const client = await loginWithAutoDiscovery(
        "alice",
        "password",
        "example.com"
    );
    console.log("登录成功!");
} catch (error) {
    console.error("登录失败:", error.message);
}
```

---

## MatrixClient 中的集成

### 使用 discoverAndConnect 方法

```typescript
import * as sdk from "matrix-js-sdk";

// SDK 提供便捷的发现方法
async function connect(domain: string) {
    // SDK 会自动进行服务发现
    const client = sdk.createClient({
        discover: true, // 启用自动发现
        baseUrl: `https://${domain}`,
    });

    await client.startClient();
}
```

### ClientConfig 的使用

```typescript
// 获取客户端配置（包含所有发现的信息）
const config = await AutoDiscovery.fromDiscoveryConfig("example.com");

// 使用发现的配置创建客户端
const client = sdk.createClient({
    baseUrl: config["m.homeserver"].base_url,
    idBaseUrl: config["m.identity_server"].base_url,
});
```

---

## 错误处理最佳实践

```typescript
async function robustDiscovery(domain: string) {
    try {
        const config = await AutoDiscovery.fromDiscoveryConfig(domain);
        const hsConfig = config["m.homeserver"];

        switch (hsConfig.state) {
            case AutoDiscovery.SUCCESS:
                return {
                    success: true,
                    baseUrl: hsConfig.base_url,
                };

            case AutoDiscovery.FAIL_PROMPT:
                // 可恢复的错误，允许用户选择是否继续
                return {
                    success: false,
                    recoverable: true,
                    error: hsConfig.error,
                    suggestedUrl: hsConfig.base_url,
                };

            case AutoDiscovery.FAIL_ERROR:
            default:
                // 严重错误，无法恢复
                return {
                    success: false,
                    recoverable: false,
                    error: hsConfig.error,
                };
        }
    } catch (error) {
        // 网络错误、JSON 解析错误等
        return {
            success: false,
            recoverable: false,
            error: AutoDiscovery.ERROR_GENERIC_FAILURE,
        };
    }
}
```

---

## 高级功能

### 1. 自定义 Well-Known URI

```typescript
// 从非标准位置获取配置
const customUrl = "https://example.com/custom/path/config.json";
const response = await fetch(customUrl);
const wellKnown = await response.json();
const config = await AutoDiscovery.fromDiscoveryConfig(wellKnown);
```

### 2. 缓存发现的配置

```typescript
async function getCachedConfig(domain: string) {
    const cacheKey = `matrix_config_${domain}`;
    const cached = localStorage.getItem(cacheKey);

    if (cached) {
        const parsed = JSON.parse(cached);
        // 检查缓存是否过期（例如 24 小时）
        if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
            return parsed.config;
        }
    }

    // 执行发现
    const config = await AutoDiscovery.fromDiscoveryConfig(domain);

    // 缓存结果
    localStorage.setItem(cacheKey, JSON.stringify({
        timestamp: Date.now(),
        config: config,
    }));

    return config;
}
```

### 3. 支持自定义服务器

```typescript
async function loginWithFallback(
    username: string,
    password: string,
    domain?: string,
    customBaseUrl?: string
) {
    let baseUrl: string;

    if (customBaseUrl) {
        // 用户手动指定服务器
        baseUrl = customBaseUrl;
    } else if (domain) {
        // 尝试自动发现
        const config = await AutoDiscovery.fromDiscoveryConfig(domain);
        if (config["m.homeserver"].state !== AutoDiscovery.SUCCESS) {
            throw new Error("自动发现失败，请手动输入服务器 URL");
        }
        baseUrl = config["m.homeserver"].base_url!;
    } else {
        throw new Error("必须提供 domain 或 baseUrl");
    }

    const client = sdk.createClient({ baseUrl });
    await client.login("m.login.password", { user: username, password });
    return client;
}
```

---

## 类型定义

```typescript
/**
 * 客户端 Well-Known 配置
 */
interface IClientWellKnown {
    "m.homeserver": {
        base_url: string;
    };
    "m.identity_server"?: {
        base_url: string;
    };
    "m.tile_server"?: {
        map_style_url: string;
    };
}

/**
 * 服务器版本信息
 */
interface IServerVersions {
    versions: string[];
    unstable_features?: {
        [featureName: string]: boolean;
    };
}

/**
 * 发现结果
 */
interface ClientConfig {
    "m.homeserver": {
        state: AutoDiscoveryAction;
        error?: AutoDiscoveryError | null;
        base_url: string | null;
    };
    "m.identity_server": {
        state: AutoDiscoveryAction;
        error?: AutoDiscoveryError | null;
        base_url: string | null;
    };
}
```

---

## 调试和日志

```typescript
// SDK 会自动记录发现过程
// 查看浏览器控制台或服务器日志

// 示例日志输出：
// [AutoDiscovery] Fetching .well-known for example.com
// [AutoDiscovery] Found base_url: https://matrix.example.com
// [AutoDiscovery] Checking /versions endpoint
// [AutoDiscovery] Server supports v1.1
// [AutoDiscovery] Discovery successful
```

---

## 测试

```typescript
// 测试服务发现
async function testDiscovery() {
    // 测试有效的域名
    const result1 = await AutoDiscovery.fromDiscoveryConfig("matrix.org");
    console.assert(result1["m.homeserver"].state === AutoDiscovery.SUCCESS);

    // 测试无效的域名
    const result2 = await AutoDiscovery.fromDiscoveryConfig("invalid-domain-12345.com");
    console.assert(result2["m.homeserver"].state === AutoDiscovery.FAIL_ERROR);

    // 测试手动配置
    const result3 = await AutoDiscovery.fromDiscoveryConfig({
        "m.homeserver": {
            "base_url": "https://matrix.example.com"
        }
    });
    console.assert(result3["m.homeserver"].state === AutoDiscovery.SUCCESS);

    console.log("所有测试通过!");
}
```

---

## 常见问题

### Q: 如何处理不支持 .well-known 的旧服务器？

**A:** 检查发现结果状态，如果是 `FAIL_PROMPT` 或 `FAIL_ERROR`，允许用户手动输入服务器 URL。

### Q: 发现过程超时怎么办？

**A:** 使用 `timeout` 参数或包装在 `Promise.race` 中：

```typescript
const configPromise = AutoDiscovery.fromDiscoveryConfig("example.com");
const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Timeout")), 5000)
);

const config = await Promise.race([configPromise, timeoutPromise]);
```

### Q: 如何验证发现的服务器 URL？

**A:** SDK 会自动调用 `/versions` 端点验证。你也可以手动验证：

```typescript
async function validateHomeserver(baseUrl: string): Promise<boolean> {
    try {
        const response = await fetch(`${baseUrl}/_matrix/client/versions`);
        const data = await response.json();
        return Array.isArray(data.versions);
    } catch {
        return false;
    }
}
```

---

## 相关文档

- [01-client-basics.md](./01-client-basics.md) - 客户端基础
- [02-authentication.md](./02-authentication.md) - 认证和登录
- [Matrix 规范 - 服务发现](https://spec.matrix.org/v1.10/client-server-api/#server-discovery)
- [RFC 8615 Well-Known URIs](https://datatracker.ietf.org/doc/html/rfc8615)

---

**文档维护**: 如有更新，请同步修改 Matrix SDK 版本号和最后更新日期。
