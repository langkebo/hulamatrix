# 06. 加密功能

> Matrix JS SDK 端到端加密 (E2EE) 功能

## 目录
- [初始化加密](#初始化加密)
- [密钥管理](#密钥管理)
- [设备验证](#设备验证)
- [密钥备份](#密钥备份)
- [密钥恢复](#密钥恢复)
- [秘密存储](#秘密存储)
- [加密消息](#加密消息)
- [完整示例](#完整示例)

## 初始化加密

### 基本初始化

```typescript
import * as sdk from "matrix-js-sdk";

const client = sdk.createClient({
  baseUrl: "https://cjystx.top",
  accessToken: "your_access_token",
  userId: "@user:cjystx.top"
});

// 初始化 Rust 加密（推荐）
await client.initRustCrypto();

// 启动客户端
await client.startClient();
```

### 使用 IndexedDB 存储

```typescript
// 浏览器环境使用 IndexedDB（默认）
await client.initRustCrypto({
  // 使用 IndexedDB 进行持久化存储
  useIndexedDB: true,
  // 数据库名称（可选）
  dbName: "matrix_crypto"
});
```

### 使用内存存储

```typescript
// Node.js 或不需要持久化的情况
await client.initRustCrypto({
  useIndexedDB: false  // 使用内存存储
});
```

### 从旧加密栈迁移

```typescript
// 如果之前使用旧加密栈，需要迁移数据
const client = sdk.createClient({
  baseUrl: "https://cjystx.top",
  accessToken: "token",
  userId: "@user:cjystx.top",

  // 提供旧的加密存储
  cryptoStore: myLegacyCryptoStore,
  pickleKey: "my_pickle_key"
});

// 初始化时会自动迁移
await client.initRustCrypto();

// 监听迁移进度
client.on(sdk.CryptoEvent.LegacyCryptoStoreMigrationProgress, (progress, total) => {
  if (progress === -1 && total === -1) {
    console.log("Migration complete");
  } else {
    console.log(`Migration: ${progress}/${total}`);
  }
});
```

### 检查加密状态

```typescript
// 获取加密 API
const crypto = client.getCrypto();
if (crypto) {
  console.log("Encryption is enabled");
} else {
  console.log("Encryption is not enabled");
}

// 检查房间是否加密
const room = client.getRoom("!roomId:server.com");
if (room) {
  const isEncrypted = room.hasEncryptionStateEvent();
  console.log("Room is encrypted:", isEncrypted);
}
```

## 密钥管理

### 上传密钥

```typescript
const crypto = client.getCrypto();
if (crypto) {
  // 上传设备密钥
  await crypto.uploadDeviceKeys();
  console.log("Device keys uploaded");
}
```

### 下载用户密钥

```typescript
const crypto = client.getCrypto();
if (crypto) {
  // 下载特定用户的设备密钥
  const users = ["@user1:server.com", "@user2:server.com"];
  await crypto.downloadKeys(users);

  console.log("Keys downloaded for:", users);
}
```

### 获取设备密钥

```typescript
const crypto = client.getCrypto();
if (crypto) {
  const userId = "@user:server.com";

  // 获取用户的所有设备
  const devices = await crypto.getUserDeviceInfo([userId]);

  console.log(`User ${userId} has ${devices[userId]?.length} devices:`);

  for (const [deviceId, deviceInfo] of Object.entries(devices[userId] || {})) {
    console.log(`  - Device: ${deviceId}`);
    console.log(`    Display name: ${deviceInfo.getDisplayName()}`);
    console.log(`    Trust level: ${deviceInfo.trustLevel}`);
  }
}
```

### 获取自己的设备密钥

```typescript
const crypto = client.getCrypto();
if (crypto) {
  // 获取当前用户的所有设备
  const devices = await crypto.getOwnDeviceKeys();

  console.log("My devices:");
  for (const [deviceId, deviceInfo] of Object.entries(devices)) {
    console.log(`  - ${deviceId}: ${deviceInfo.getDisplayName()}`);

    // 检查是否为当前设备
    if (deviceId === client.getDeviceId()) {
      console.log("    (Current device)");
    }
  }
}
```

### 设置设备名称

```typescript
const crypto = client.getCrypto();
if (crypto) {
  // 设置当前设备的显示名称
  await crypto.setDeviceDisplayName(
    client.getDeviceId()!,
    "My Phone"
  );

  console.log("Device name updated");
}
```

## 设备验证

### 开始设备验证

```typescript
const crypto = client.getCrypto();
if (crypto) {
  // 请求验证用户的其他设备
  await crypto.requestOwnUserVerification("START");

  // 或者请求验证特定设备
  const userId = "@user:server.com";
  const deviceId = "DEVICE_ID";

  const request = await crypto.requestVerification(userId, deviceId);

  // 监听验证状态
  request.on(sdk.VerificationRequestEvent.Change, () => {
    console.log("Verification status:", request.state);

    if (request.state === sdk.VerificationRequestState.Done) {
      console.log("Verification successful!");
    }
  });
}
```

### 处理验证请求

```typescript
const crypto = client.getCrypto();
if (crypto) {
  crypto.on(sdk.CryptoEvent.KeyVerificationRequest, (request) => {
    console.log(`Verification request from ${request.requestingDevice.userId}`);

    // 检查是否为请求的验证
    if (request.transactionId === myExpectedTransactionId) {
      // 自动接受
      request.accept();
    } else {
      // 提示用户
      showVerificationDialog(request);
    }
  });
}
```

### SAS 验证（数字比较）

```typescript
crypto.on(sdk.VerificationEvent.ShowSas, (userId, deviceId, sas) => {
  console.log("SAS verification:");
  console.log(`User: ${userId}`);
  console.log(`Device: ${deviceId}`);

  // 显示 SAS 码（例如：12345678）
  if (sas.get("decimals")) {
    console.log("Code:", sas.get("decimals"));
  }

  // 用户确认后
  sas.confirm();
});

// 或者使用表情符号验证
if (sas.get("emojis")) {
  console.log("Emojis:", sas.get("emojis"));
}
```

### 扫描二维码验证

```typescript
crypto.on(sdk.VerificationEvent.ShowReciprocateQR, (userId, deviceId, qrCodeData) => {
  // 显示二维码供另一个设备扫描
  showQRCode(qrCodeData);

  // 当扫描完成后
  qrCodeData.confirmScanned();
});
```

### 取消验证

```typescript
// 取消验证请求
await request.cancel();

// 或者带原因取消
await request.cancel({
  code: sdk.VerificationCancelCode.User,
  reason: "User cancelled"
});
```

### 检查设备信任状态

```typescript
const crypto = client.getCrypto();
if (crypto) {
  const userId = "@user:server.com";
  const deviceId = "DEVICE_ID";

  // 获取设备信任状态
  const trustLevel = await crypto.checkUserTrust(userId);
  console.log(`User trust: ${trustLevel}`);

  const deviceTrust = await crypto.isDeviceVerified(userId, deviceId);
  console.log(`Device verified: ${deviceTrust}`);

  // trustLevel 可能的值：
  // - "trusted": 用户已通过交叉签名验证
  // - "untrusted": 用户未验证
  // - "unknown": 未知状态
}
```

### 设置设备信任状态

```typescript
const crypto = client.getCrypto();
if (crypto) {
  const userId = "@user:server.com";
  const deviceId = "DEVICE_ID";

  // 标记设备为已验证
  await crypto.setDeviceVerification(userId, deviceId, true);

  // 标记设备为已阻止
  await crypto.setDeviceVerification(userId, deviceId, false);

  // 或者使用更详细的 API
  const device = await crypto.getDevice(userId, deviceId);
  await device.setVerificationStatus(
    sdk.DeviceVerificationStatus.Verified
  );
}
```

## 密钥备份

### 检查密钥备份状态

```typescript
const crypto = client.getCrypto();
if (crypto) {
  // 检查是否有密钥备份
  const backupInfo = await crypto.getKeyBackupInfo();

  if (backupInfo) {
    console.log("Backup exists:", backupInfo.version);
    console.log("Backup algorithm:", backupInfo.algorithm);
  } else {
    console.log("No backup found");
  }
}
```

### 创建密钥备份

```typescript
const crypto = client.getCrypto();
if (crypto) {
  // 创建新的密钥备份
  const backupInfo = await crypto.resetKeyBackup();

  console.log("Backup created:", backupInfo.version);

  // 将房间密钥上传到备份
  await crypto.backupAllGroupSessions();

  console.log("All keys backed up");
}
```

### 备份单个密钥

```typescript
const crypto = client.getCrypto();
if (crypto) {
  const roomId = "!roomId:server.com";
  const sessionId = "session_id";

  // 备份特定会话密钥
  await crypto.backupGroupSession(roomId, sessionId);

  console.log("Session key backed up");
}
```

### 恢复密钥备份

```typescript
const crypto = client.getCrypto();
if (crypto) {
  const backupInfo = await crypto.getKeyBackupInfo();

  if (backupInfo) {
    // 恢复所有密钥
    const result = await crypto.restoreKeyBackup(backupInfo.version);

    console.log(`Restored ${result.total} keys`);
    console.log(`Imported: ${result.imported}`);
    console.log(`Failed: ${result.failed}`);
  }
}
```

### 使用恢复密钥

```typescript
const crypto = client.getCrypto();
if (crypto) {
  // 从恢复密钥创建备份
  const recoveryKey = await crypto.createRecoveryKeyFromPassphrase("my_secure_password");

  console.log("Recovery key:", recoveryKey);

  // 使用恢复密钥恢复备份
  const backupInfo = await crypto.getKeyBackupInfo();
  if (backupInfo) {
    await crypto.restoreKeyBackupWithRecoveryKey(
      backupInfo.version,
      recoveryKey
    );

    console.log("Backup restored with recovery key");
  }
}
```

### 删除密钥备份

```typescript
const crypto = client.getCrypto();
if (crypto) {
  const backupInfo = await crypto.getKeyBackupInfo();

  if (backupInfo) {
    // 删除备份
    await crypto.deleteKeyBackup(backupInfo.version);

    console.log("Backup deleted");
  }
}
```

## 秘密存储

### 设置秘密存储

```typescript
const client = sdk.createClient({
  baseUrl: "https://cjystx.top",
  accessToken: "token",
  userId: "@user:cjystx.top",
  cryptoCallbacks: {
    // 提示用户输入存储密钥
    getSecretStorageKey: async (keys) => {
      const keyId = Object.keys(keys)[0];
      // 提示用户输入密钥
      return await promptUserForSecretKey();
    }
  }
});

await client.initRustCrypto();

const crypto = client.getCrypto();
if (crypto) {
  // 引导设置秘密存储
  await crypto.bootstrapSecretStorage({
    // 创建新的存储密钥
    createSecretStorageKey: async () => {
      // 生成并返回新的私钥
      return await generateSecretStorageKey();
    },
    // 保存私钥
    saveSecretStorageKey: async (key) => {
      // 保存私钥供以后使用
      await saveSecretKey(key);
    }
  });

  console.log("Secret storage set up");
}
```

### 存储秘密

```typescript
const crypto = client.getCrypto();
if (crypto) {
  // 存储秘密
  await crypto.storeSecret("m.secret.my_app.data", JSON.stringify({
    apiKey: "my_api_key",
    settings: { theme: "dark" }
  }));

  console.log("Secret stored");
}
```

### 获取秘密

```typescript
const crypto = client.getCrypto();
if (crypto) {
  // 获取秘密
  const secret = await crypto.getSecret("m.secret.my_app.data");

  if (secret) {
    const data = JSON.parse(secret);
    console.log("Retrieved secret:", data);
  } else {
    console.log("Secret not found");
  }
}
```

### 检查秘密是否存在

```typescript
const crypto = client.getCrypto();
if (crypto) {
  // 检查是否有特定秘密
  const hasSecret = await crypto.isSecretStored("m.secret.my_app.data");

  console.log("Secret exists:", hasSecret);
}
```

## 交叉签名

### 引导交叉签名

```typescript
const crypto = client.getCrypto();
if (crypto) {
  // 设置交叉签名
  await crypto.bootstrapCrossSigning({
    // 认证回调
    authUploadDeviceSigningKeys: async (makeRequest) => {
      // 如果需要用户交互认证
      const authDict = await getUserAuth();
      return makeRequest(authDict);
    }
  });

  console.log("Cross-signing enabled");
}
```

### 检查交叉签名状态

```typescript
const crypto = client.getCrypto();
if (crypto) {
  // 检查是否已设置交叉签名
  const crossSigningStatus = await crypto.getCrossSigningStatus();

  console.log("Cross-signing keys:");
  console.log("  Master key:", crossSigningStatus.hasMasterKey ? "Set" : "Not set");
  console.log("  Self-signing key:", crossSigningStatus.hasSelfSigningKey ? "Set" : "Not set");
  console.log("  User-signing key:", crossSigningStatus.hasUserSigningKey ? "Set" : "Not set");
}
```

### 签名设备

```typescript
const crypto = client.getCrypto();
if (crypto) {
  // 签名自己的设备
  const deviceId = "DEVICE_ID";

  await crypto.signOwnDevice(deviceId);

  console.log(`Device ${deviceId} signed`);
}
```

### 签名用户

```typescript
const crypto = client.getCrypto();
if (crypto) {
  // 签名其他用户
  const userId = "@user:server.com";

  await crypto.signUser(userId);

  console.log(`User ${userId} signed`);
}
```

## 加密消息

### 自动加密消息

```typescript
// 如果房间已启用加密，发送消息会自动加密
const room = client.getRoom("!roomId:server.com");

if (room?.hasEncryptionStateEvent()) {
  // 消息会自动加密
  await client.sendMessage("!roomId:server.com", {
    msgtype: "m.text",
    body: "This will be encrypted"
  });
}
```

### 解密消息

```typescript
client.on(RoomEvent.Timeline, async (event) => {
  if (event.getType() === "m.room.encrypted") {
    // 尝试解密消息
    try {
      const crypto = client.getCrypto();
      if (crypto) {
        const decryptedEvent = await crypto.decryptEvent(event);

        console.log("Decrypted message:", decryptedEvent.getContent().body);
      }
    } catch (error) {
      console.error("Decryption failed:", error);
    }
  }
});
```

### 启用房间加密

```typescript
// 为房间启用加密
await client.sendStateEvent(
  "!roomId:server.com",
  "m.room.encryption",
  {
    algorithm: "m.megolm.v1.aes-sha2",
    rotation_period_ms: 604800000,  // 7 天
    rotation_period_msgs: 100        // 100 条消息
  },
  ""
);

console.log("Room encryption enabled");
```

## 完整示例

### 完整的加密管理类

```typescript
import * as sdk from "matrix-js-sdk";
import { CryptoEvent, VerificationEvent } from "matrix-js-sdk";

class CryptoManager {
  constructor(private client: sdk.MatrixClient) {}

  // 初始化加密
  async init(options?: { useIndexedDB?: boolean; dbName?: string }): Promise<void> {
    await this.client.initRustCrypto({
      useIndexedDB: options?.useIndexedDB ?? true,
      dbName: options?.dbName ?? "matrix_crypto"
    });

    console.log("Encryption initialized");
    this.setupListeners();
  }

  // 设置监听器
  private setupListeners() {
    const crypto = this.client.getCrypto();
    if (!crypto) return;

    // 验证请求
    crypto.on(CryptoEvent.KeyVerificationRequest, (request) => {
      console.log(`Verification request from ${request.requestingDevice.userId}`);
      this.handleVerificationRequest(request);
    });

    // 信任状态变化
    crypto.on(CryptoEvent.UserTrustStatusChanged, (userId, trustLevel) => {
      console.log(`User ${userId} trust level: ${trustLevel}`);
    });

    // 设备验证变化
    crypto.on(CryptoEvent.DeviceVerificationChanged, (userId, deviceInfo, trustLevel) => {
      console.log(`Device ${deviceInfo.deviceId} of ${userId}: ${trustLevel}`);
    });
  }

  // 处理验证请求
  private async handleVerificationRequest(request: sdk.VerificationRequest) {
    // 在实际应用中，这里应该提示用户
    console.log("Verification request from:", request.requestingDevice.userId);

    // 自动接受（仅供演示）
    try {
      await request.accept();
      console.log("Verification request accepted");
    } catch (error) {
      console.error("Failed to accept verification:", error);
    }
  }

  // 获取设备列表
  async getDevices(userId: string): Promise<Map<string, sdk.DeviceInfo>> {
    const crypto = this.client.getCrypto();
    if (!crypto) {
      throw new Error("Crypto not initialized");
    }

    const devices = await crypto.getUserDeviceInfo([userId]);
    return devices[userId] || new Map();
  }

  // 验证设备
  async verifyDevice(userId: string, deviceId: string): Promise<void> {
    const crypto = this.client.getCrypto();
    if (!crypto) {
      throw new Error("Crypto not initialized");
    }

    await crypto.setDeviceVerification(userId, deviceId, true);
    console.log(`Device ${deviceId} of ${userId} verified`);
  }

  // 阻止设备
  async blockDevice(userId: string, deviceId: string): Promise<void> {
    const crypto = this.client.getCrypto();
    if (!crypto) {
      throw new Error("Crypto not initialized");
    }

    await crypto.setDeviceVerification(userId, deviceId, false);
    console.log(`Device ${deviceId} of ${userId} blocked`);
  }

  // 创建密钥备份
  async createBackup(): Promise<string> {
    const crypto = this.client.getCrypto();
    if (!crypto) {
      throw new Error("Crypto not initialized");
    }

    const backupInfo = await crypto.resetKeyBackup();
    await crypto.backupAllGroupSessions();

    return backupInfo.version;
  }

  // 恢复密钥备份
  async restoreBackup(backupVersion: string): Promise<void> {
    const crypto = this.client.getCrypto();
    if (!crypto) {
      throw new Error("Crypto not initialized");
    }

    const result = await crypto.restoreKeyBackup(backupVersion);
    console.log(`Restored ${result.imported}/${result.total} keys`);
  }

  // 设置秘密存储
  async setupSecretStorage(passphrase: string): Promise<string> {
    const crypto = this.client.getCrypto();
    if (!crypto) {
      throw new Error("Crypto not initialized");
    }

    // 生成恢复密钥
    const recoveryKey = await crypto.createRecoveryKeyFromPassphrase(passphrase);

    // 引导设置秘密存储
    await crypto.bootstrapSecretStorage({
      createSecretStorageKey: async () => recoveryKey,
      saveSecretStorageKey: async () => {
        // 保存恢复密钥
        await this.saveRecoveryKey(recoveryKey);
      }
    });

    // 引导设置交叉签名
    await crypto.bootstrapCrossSigning({
      authUploadDeviceSigningKeys: async (makeRequest) => {
        return makeRequest({});
      }
    });

    return recoveryKey;
  }

  // 保存恢复密钥
  private async saveRecoveryKey(key: string): Promise<void> {
    // 在实际应用中，安全地保存密钥
    console.log("Recovery key (save this securely):", key);
  }

  // 存储秘密
  async storeSecret(name: string, value: string): Promise<void> {
    const crypto = this.client.getCrypto();
    if (!crypto) {
      throw new Error("Crypto not initialized");
    }

    await crypto.storeSecret(name, value);
    console.log(`Secret "${name}" stored`);
  }

  // 获取秘密
  async getSecret(name: string): Promise<string | null> {
    const crypto = this.client.getCrypto();
    if (!crypto) {
      throw new Error("Crypto not initialized");
    }

    return await crypto.getSecret(name);
  }

  // 检查用户信任状态
  async checkUserTrust(userId: string): Promise<sdk.TrustLevel> {
    const crypto = this.client.getCrypto();
    if (!crypto) {
      throw new Error("Crypto not initialized");
    }

    return await crypto.checkUserTrust(userId);
  }

  // 检查设备信任状态
  async checkDeviceTrust(userId: string, deviceId: string): Promise<boolean> {
    const crypto = this.client.getCrypto();
    if (!crypto) {
      throw new Error("Crypto not initialized");
    }

    return await crypto.isDeviceVerified(userId, deviceId);
  }
}

// 使用示例
async function example() {
  const client = sdk.createClient({
    baseUrl: "https://cjystx.top",
    accessToken: "token",
    userId: "@user:cjystx.top"
  });

  // 初始化加密
  const cryptoManager = new CryptoManager(client);
  await cryptoManager.init();

  // 启动客户端
  await client.startClient();

  // 设置秘密存储
  await cryptoManager.setupSecretStorage("my_secure_password");

  // 创建备份
  const backupVersion = await cryptoManager.createBackup();
  console.log("Backup version:", backupVersion);

  // 获取设备列表
  const userId = "@user:cjystx.top";
  const devices = await cryptoManager.getDevices(userId);
  console.log(`User has ${devices.size} devices`);

  // 验证设备
  for (const [deviceId, deviceInfo] of devices.entries()) {
    if (!deviceInfo.isVerified()) {
      await cryptoManager.verifyDevice(userId, deviceId);
    }
  }

  // 检查信任状态
  const isTrusted = await cryptoManager.checkUserTrust(userId);
  console.log(`User trust level: ${isTrusted}`);
}

example();
```
