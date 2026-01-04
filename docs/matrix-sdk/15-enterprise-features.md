# 15. 企业功能

> Matrix JS SDK 企业级功能，包括朋友系统、私密聊天等

## 目录
- [朋友系统](#朋友系统)
- [私密聊天](#私密聊天)
- [语音消息](#语音消息)
- [安全控制](#安全控制)
- [完整示例](#完整示例)

## 朋友系统

### 添加朋友

```typescript
import * as sdk from "matrix-js-sdk";

// 添加用户为朋友
await client.friends.addFriend("@user:server.com");

console.log("Friend added");
```

### 删除朋友

```typescript
// 删除朋友
await client.friends.removeFriend("@user:server.com");

console.log("Friend removed");
```

### 获取朋友列表

```typescript
// 获取所有朋友
const friends = await client.friends.getFriends();

console.log("Friends:", friends);

// friends 可能是：
// [
//   { userId: "@user1:server.com", displayName: "User 1", since: 1234567890 },
//   { userId: "@user2:server.com", displayName: "User 2", since: 1234567891 }
// ]
```

### 检查朋友关系

```typescript
// 检查是否为朋友
const isFriend = await client.friends.isFriend("@user:server.com");

if (isFriend) {
  console.log("User is your friend");
} else {
  console.log("User is not your friend");
}
```

### 获取朋友在线状态

```typescript
// 获取朋友的在线状态
const friends = await client.friends.getFriends();

for (const friend of friends) {
  const user = client.getUser(friend.userId);

  console.log(`${friend.displayName}:`);
  console.log(`  Presence: ${user?.presence}`);
  console.log(`  Status: ${user?.presenceStatusMsg}`);
}
```

### 朋友分类

```typescript
// 朋友系统可能支持分类/分组
await client.friends.addFriend("@user:server.com", {
  category: "work",  // 分组
  notes: "Colleague"  // 备注
});

// 获取特定分组的朋友
const workFriends = await client.friends.getFriendsByCategory("work");
```

## 私密聊天

### 创建私密聊天

```typescript
// 创建私密聊天（端到端加密）
const room = await client.privateChat.createPrivateChat("@friend:server.com", {
  encryption: true,  // 启用加密
  isDirect: true
});

console.log("Private chat created:", room.room_id);
```

### 检查是否为私密聊天

```typescript
// 检查房间是否为私密聊天
const isPrivate = await client.privateChat.isPrivateChat("!roomId:server.com");

if (isPrivate) {
  console.log("This is a private chat");
}
```

### 获取私密聊天列表

```typescript
// 获取所有私密聊天
const privateChats = await client.privateChat.getPrivateChats();

console.log("Private chats:", privateChats);

// privateChats 可能是：
// [
//   { roomId: "!room1:server", userId: "@user1:server.com", unread: 5 },
//   { roomId: "!room2:server", userId: "@user2:server.com", unread: 0 }
// ]
```

### 私密聊天设置

```typescript
// 配置私密聊天设置
await client.privateChat.setPrivateChatSettings("!roomId:server.com", {
  // 消息过期时间（秒）
  messageExpiration: 86400,  // 24 小时

  // 禁止转发
  disableForwarding: true,

  // 阅后即焚
  ephemeral: false,

  // 要求确认
  requireConfirmation: true
});
```

## 语音消息

### 录制语音消息

```typescript
// 录制语音消息
class VoiceMessageRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];

  async start(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true
    });

    this.mediaRecorder = new MediaRecorder(stream, {
      mimeType: "audio/webm"
    });

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.chunks.push(event.data);
      }
    };

    this.mediaRecorder.start();
    console.log("Recording started");
  }

  async stop(): Promise<Blob> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        throw new Error("No active recording");
      }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: "audio/webm" });
        this.chunks = [];
        resolve(blob);
      };

      this.mediaRecorder.stop();

      // 停止音频流
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());

      console.log("Recording stopped");
    });
  }

  cancel(): void {
    if (this.mediaRecorder) {
      this.mediaRecorder.onstop = null;
      this.mediaRecorder.stop();
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
      this.chunks = [];
      this.mediaRecorder = null;
    }
  }
}

// 使用
const recorder = new VoiceMessageRecorder();

// 开始录制
await recorder.start();

// 停止录制（例如 30 秒后或用户点击停止）
setTimeout(async () => {
  const audioBlob = await recorder.stop();
  console.log("Recorded audio size:", audioBlob.size);
}, 5000);
```

### 发送语音消息

```typescript
// 发送语音消息
async function sendVoiceMessage(
  client: sdk.MatrixClient,
  roomId: string,
  audioBlob: Blob
) {
  // 获取音频时长
  const duration = await getAudioDuration(audioBlob);

  // 上传音频
  const mxcUrl = await client.uploadContent(audioBlob, {
    name: "voice.webm",
    type: "audio/webm"
  });

  // 发送语音消息
  await client.sendMessage(roomId, {
    msgtype: "m.audio",
    url: mxcUrl,
    body: "Voice message",
    info: {
      duration: duration,
      mimetype: "audio/webm",
      size: audioBlob.size
    },
    // 标记为语音消息（自定义）
    "org.matrix.foxchat.voice": true
  });

  console.log("Voice message sent");
}

// 获取音频时长
function getAudioDuration(blob: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    const url = URL.createObjectURL(blob);

    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(audio.duration * 1000);
    };

    audio.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load audio"));
    };

    audio.src = url;
  });
}
```

### 播放语音消息

```typescript
// 语音消息播放器
class VoiceMessagePlayer {
  private audio: HTMLAudioElement | null = null;
  private currentUrl: string | null = null;

  async play(mxcUrl: string, client: sdk.MatrixClient): Promise<void> {
    // 停止当前播放
    this.stop();

    // 获取音频 URL
    const httpUrl = client.mxcUrlToHttp(mxcUrl);

    // 创建音频元素
    this.audio = new Audio(httpUrl);
    this.currentUrl = mxcUrl;

    // 播放
    await this.audio.play();
    console.log("Playing voice message");
  }

  pause(): void {
    if (this.audio) {
      this.audio.pause();
      console.log("Paused");
    }
  }

  resume(): void {
    if (this.audio) {
      this.audio.play();
      console.log("Resumed");
    }
  }

  stop(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
      console.log("Stopped");
    }
  }

  getDuration(): number {
    return this.audio?.duration || 0;
  }

  getCurrentTime(): number {
    return this.audio?.currentTime || 0;
  }

  seek(time: number): void {
    if (this.audio) {
      this.audio.currentTime = time;
    }
  }
}

// 使用
const player = new VoiceMessagePlayer();

// 播放语音消息
await player.play("mxc://server.com/mediaId", client);

// 暂停
player.pause();

// 恢复
player.resume();

// 停止
player.stop();
```

## 安全控制

### 设备管理

```typescript
// 获取所有设备
const devices = await client.getDevices();

console.log("Devices:", devices.devices);

devices.devices.forEach(device => {
  console.log(`  - ${device.device_id}`);
  console.log(`    Display name: ${device.display_name}`);
  console.log(`    Last seen: ${new Date(device.last_seen_ts).toLocaleString()}`);
});
```

### 删除设备

```typescript
// 删除设备（需要密码认证）
async function deleteDevice(
  client: sdk.MatrixClient,
  deviceId: string,
  password: string
) {
  // 首次尝试会返回认证流程
  try {
    await client.deleteDevice(deviceId);
  } catch (error: any) {
    if (error.errcode === "M_FORBIDDEN" && error.data?.flows) {
      // 使用密码重新认证
      const auth = {
        type: "m.login.password",
        identifier: {
          type: "m.id.user",
          user: client.getUserId()
        },
        password: password,
        session: error.data.session
      };

      await client.deleteDevice(deviceId, auth);
      console.log("Device deleted");
    }
  }
}
```

### 设置安全策略

```typescript
// 设置房间安全策略
await client.security.setSecurityPolicies("!roomId:server.com", {
  // 要求成员验证
  requireVerification: true,

  // 禁止访客
  allowGuests: false,

  // 要求加密
  requireEncryption: true,

  // 限制历史可见性
  historyVisibility: "joined",

  // 内容审核
  moderation: {
    enableSpamFilter: true,
    enableLinkFilter: false
  }
});
```

### 审计日志

```typescript
// 获取审计日志（如果服务器支持）
const auditLogs = await client.security.getAuditLogs({
  room_id: "!roomId:server.com",
  from: Date.now() - 86400000,  // 过去 24 小时
  limit: 100
});

console.log("Audit logs:", auditLogs.events);

auditLogs.events.forEach(event => {
  console.log(`  [${new Date(event.timestamp).toLocaleString()}]`);
  console.log(`    ${event.action} by ${event.user_id}`);
  console.log(`    Details:`, event.details);
});
```

## 完整示例

### 企业功能管理器

```typescript
import * as sdk from "matrix-js-sdk";

class EnterpriseManager {
  constructor(private client: sdk.MatrixClient) {}

  // === 朋友系统 ===

  async addFriend(userId: string, options?: {
    category?: string;
    notes?: string;
  }): Promise<void> {
    await this.client.friends.addFriend(userId, options);
    console.log(`Added ${userId} as friend`);
  }

  async removeFriend(userId: string): Promise<void> {
    await this.client.friends.removeFriend(userId);
    console.log(`Removed ${userId} from friends`);
  }

  async getFriends(): Promise<any[]> {
    const friends = await this.client.friends.getFriends();
    return friends;
  }

  async isFriend(userId: string): Promise<boolean> {
    return await this.client.friends.isFriend(userId);
  }

  async getOnlineFriends(): Promise<any[]> {
    const friends = await this.client.friends.getFriends();

    return friends.filter(friend => {
      const user = this.client.getUser(friend.userId);
      return user?.presence === "online";
    });
  }

  // === 私密聊天 ===

  async createPrivateChat(userId: string): Promise<string> {
    const room = await this.client.privateChat.createPrivateChat(userId, {
      encryption: true,
      isDirect: true
    });

    return room.room_id;
  }

  async isPrivateChat(roomId: string): Promise<boolean> {
    return await this.client.privateChat.isPrivateChat(roomId);
  }

  async getPrivateChats(): Promise<any[]> {
    return await this.client.privateChat.getPrivateChats();
  }

  // === 语音消息 ===

  async sendVoiceMessage(roomId: string, audioBlob: Blob): Promise<void> {
    const duration = await this.getAudioDuration(audioBlob);

    const mxcUrl = await this.client.uploadContent(audioBlob, {
      name: "voice.webm",
      type: "audio/webm"
    });

    await this.client.sendMessage(roomId, {
      msgtype: "m.audio",
      url: mxcUrl,
      body: "Voice message",
      info: {
        duration: duration,
        mimetype: "audio/webm",
        size: audioBlob.size
      },
      "org.matrix.foxchat.voice": true
    });
  }

  private async getAudioDuration(blob: Blob): Promise<number> {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      const url = URL.createObjectURL(blob);

      audio.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        resolve(audio.duration * 1000);
      };

      audio.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Failed to load audio"));
      };

      audio.src = url;
    });
  }

  // === 安全控制 ===

  async getDevices(): Promise<any[]> {
    const result = await this.client.getDevices();
    return result.devices;
  }

  async deleteDevice(deviceId: string, password: string): Promise<void> {
    try {
      await this.client.deleteDevice(deviceId);
    } catch (error: any) {
      if (error.errcode === "M_FORBIDDEN") {
        const auth = {
          type: "m.login.password",
          identifier: {
            type: "m.id.user",
            user: this.client.getUserId()
          },
          password: password,
          session: error.data?.session
        };

        await this.client.deleteDevice(deviceId, auth);
      }
    }
  }

  async setRoomSecurity(roomId: string, policies: {
    requireVerification?: boolean;
    allowGuests?: boolean;
    requireEncryption?: boolean;
  }): Promise<void> {
    // 实现安全策略设置
    // 这需要根据实际的服务器 API 实现
    console.log("Setting security policies for", roomId, policies);
  }
}

// 使用示例
async function example() {
  const client = sdk.createClient({
    baseUrl: "https://matrix.org",
    accessToken: "token",
    userId: "@user:matrix.org"
  });

  await client.startClient();

  const enterprise = new EnterpriseManager(client);

  // 朋友系统
  await enterprise.addFriend("@friend:matrix.org", {
    category: "family",
    notes: "My friend"
  });

  const friends = await enterprise.getFriends();
  console.log("Friends:", friends.length);

  const onlineFriends = await enterprise.getOnlineFriends();
  console.log("Online friends:", onlineFriends.length);

  // 私密聊天
  const privateChatId = await enterprise.createPrivateChat("@friend:matrix.org");
  console.log("Private chat:", privateChatId);

  // 语音消息
  const recorder = new VoiceMessageRecorder();
  await recorder.start();

  // ... 5 秒后停止
  await new Promise(resolve => setTimeout(resolve, 5000));

  const audioBlob = await recorder.stop();
  await enterprise.sendVoiceMessage(privateChatId, audioBlob);

  // 设备管理
  const devices = await enterprise.getDevices();
  console.log("Devices:", devices.length);

  // 删除设备
  // await enterprise.deleteDevice("DEVICE_ID", "password");
}

example();
```

### 语音消息 UI 组件

```typescript
// 语音消息 UI 组件
class VoiceMessageUI {
  private recorder: VoiceMessageRecorder | null = null;
  private player: VoiceMessagePlayer;
  private isRecording = false;

  constructor(
    private client: sdk.MatrixClient,
    private roomId: string
  ) {
    this.player = new VoiceMessagePlayer();
  }

  // 开始录制
  async startRecording(): Promise<void> {
    this.recorder = new VoiceMessageRecorder();
    await this.recorder.start();
    this.isRecording = true;

    // 60 秒后自动停止
    setTimeout(() => {
      if (this.isRecording) {
        this.stopRecording();
      }
    }, 60000);
  }

  // 停止录制并发送
  async stopRecording(): Promise<void> {
    if (!this.recorder || !this.isRecording) {
      return;
    }

    this.isRecording = false;

    try {
      const audioBlob = await this.recorder.stop();

      if (audioBlob.size > 0) {
        await this.sendVoiceMessage(audioBlob);
      }
    } catch (error) {
      console.error("Failed to record voice message:", error);
    }

    this.recorder = null;
  }

  // 取消录制
  cancelRecording(): void {
    if (this.recorder) {
      this.recorder.cancel();
      this.isRecording = false;
      this.recorder = null;
    }
  }

  // 发送语音消息
  async sendVoiceMessage(audioBlob: Blob): Promise<void> {
    const duration = await this.getAudioDuration(audioBlob);

    const mxcUrl = await this.client.uploadContent(audioBlob, {
      name: "voice.webm",
      type: "audio/webm"
    });

    await this.client.sendMessage(this.roomId, {
      msgtype: "m.audio",
      url: mxcUrl,
      body: "Voice message",
      info: {
        duration: duration,
        mimetype: "audio/webm",
        size: audioBlob.size
      },
      "org.matrix.foxchat.voice": true
    });
  }

  // 播放语音消息
  async playVoiceMessage(mxcUrl: string): Promise<void> {
    await this.player.play(mxcUrl, this.client);
  }

  // 暂停播放
  pausePlayback(): void {
    this.player.pause();
  }

  // 停止播放
  stopPlayback(): void {
    this.player.stop();
  }

  // 获取播放进度
  getPlaybackProgress(): number {
    const duration = this.player.getDuration();
    const current = this.player.getCurrentTime();
    return duration > 0 ? (current / duration) * 100 : 0;
  }

  // 获取音频时长
  private async getAudioDuration(blob: Blob): Promise<number> {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      const url = URL.createObjectURL(blob);

      audio.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        resolve(audio.duration * 1000);
      };

      audio.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Failed to load audio"));
      };

      audio.src = url;
    });
  }
}
```
