# 07. WebRTC 通话

> Matrix JS SDK WebRTC 音视频通话功能

## 目录
- [通话基础](#通话基础)
- [语音通话](#语音通话)
- [视频通话](#视频通话)
- [群组通话](#群组通话)
- [屏幕共享](#屏幕共享)
- [通话控制](#通话控制)
- [通话事件](#通话事件)
- [完整示例](#完整示例)

## 通话基础

### 检查通话支持

```typescript
import * as sdk from "matrix-js-sdk";

// 检查浏览器是否支持 WebRTC
function isWebRTCSupported(): boolean {
  return !!(
    navigator.mediaDevices &&
    navigator.mediaDevices.getUserMedia &&
    window.RTCPeerConnection
  );
}

if (isWebRTCSupported()) {
  console.log("WebRTC is supported");
} else {
  console.log("WebRTC is not supported");
}
```

### 请求媒体权限

```typescript
// 请求麦克风权限
async function requestMicrophonePermission(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch (error) {
    console.error("Microphone permission denied:", error);
    return false;
  }
}

// 请求摄像头权限
async function requestCameraPermission(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch (error) {
    console.error("Camera permission denied:", error);
    return false;
  }
}

// 请求音视频权限
async function requestAVPermission(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true
    });
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch (error) {
    console.error("A/V permission denied:", error);
    return false;
  }
}
```

### 创建通话管理器

```typescript
import { CallEvent } from "matrix-js-sdk";

class CallManager {
  constructor(private client: sdk.MatrixClient) {
    this.setupCallHandlers();
  }

  private setupCallHandlers() {
    // 接收通话邀请
    this.client.on(CallEvent.Invite, (call) => {
      this.handleIncomingCall(call);
    });

    // 通话状态变化
    this.client.on(CallEvent.State, (call) => {
      console.log("Call state:", call.state);
    });

    // 通话挂断
    this.client.on(CallEvent.Hangup, (call) => {
      console.log("Call ended");
    });

    // 通话错误
    this.client.on(CallEvent.Error, (call, error) => {
      console.error("Call error:", error);
    });
  }

  private async handleIncomingCall(call: sdk.Call) {
    console.log(`Incoming call from ${call.getOpponentMember().name}`);
    console.log("Call type:", call.type === "voice" ? "Voice" : "Video");

    // 在实际应用中，这里应该提示用户是否接听
    // call.answer();  // 接听
    // call.hangup();  // 拒绝
  }

  // ... 其他方法
}
```

## 语音通话

### 发起语音通话

```typescript
// 创建语音通话
const roomId = "!roomId:server.com";
const call = client.createCall(roomId);

// 设置呼叫类型为语音
call.type = "voice";

// 发起通话
await call.placeCall();

console.log("Voice call initiated");
```

### 接听语音通话

```typescript
client.on(CallEvent.Invite, async (call) => {
  if (call.type === "voice") {
    // 请求麦克风权限
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // 接听通话
      await call.answer({ audio: true });

      console.log("Voice call answered");

    } catch (error) {
      console.error("Failed to answer call:", error);
      call.hangup();
    }
  }
});
```

### 挂断语音通话

```typescript
// 挂断通话
await call.hangup();

console.log("Call ended");
```

### 语音通话控制

```typescript
// 静音/取消静音
if (call.isLocalAudioMuted()) {
  call.unmuteAudio();  // 取消静音
} else {
  call.muteAudio();  // 静音
}

// 检查静音状态
const isMuted = call.isLocalAudioMuted();
console.log("Audio muted:", isMuted);

// 获取音量等级
const audioLevel = call.getAudioLevel();
console.log("Audio level:", audioLevel);
```

## 视频通话

### 发起视频通话

```typescript
// 创建视频通话
const roomId = "!roomId:server.com";
const call = client.createCall(roomId);

// 设置呼叫类型为视频
call.type = "video";

// 发起通话
await call.placeCall();

console.log("Video call initiated");
```

### 接听视频通话

```typescript
client.on(CallEvent.Invite, async (call) => {
  if (call.type === "video") {
    try {
      // 请求音视频权限
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true
      });

      // 接听视频通话
      await call.answer({
        audio: true,
        video: true
      });

      console.log("Video call answered");

      // 设置视频元素
      const localVideo = document.getElementById("localVideo") as HTMLVideoElement;
      const remoteVideo = document.getElementById("remoteVideo") as HTMLVideoElement;

      if (localVideo) {
        localVideo.srcObject = call.getLocalStreams()[0];
      }

      if (remoteVideo) {
        remoteVideo.srcObject = call.getRemoteStreams()[0];
      }

    } catch (error) {
      console.error("Failed to answer video call:", error);
      call.hangup();
    }
  }
});
```

### 视频通话控制

```typescript
// 开启/关闭视频
if (call.isLocalVideoMuted()) {
  call.unmuteVideo();  // 开启视频
} else {
  call.muteVideo();  // 关闭视频
}

// 检查视频状态
const isVideoMuted = call.isLocalVideoMuted();
console.log("Video muted:", isVideoMuted);

// 切换摄像头
await call.switchCamera();

// 获取视频约束
const constraints = call.getVideoConstraints();
console.log("Video constraints:", constraints);
```

### 设置视频质量

```typescript
// 设置视频质量
await call.setVideoQuality("high");  // "low", "medium", "high"

// 或者设置具体的视频约束
await call.updateLocalVideoSettings({
  width: { ideal: 1280 },
  height: { ideal: 720 },
  frameRate: { ideal: 30 }
});
```

## 群组通话

### 创建群组通话

```typescript
// 使用 MatrixRTC 进行群组通话
import { GroupCallEventHandler } from "matrix-js-sdk";

const groupCallManager = new GroupCallEventHandler(client);

// 创建群组通话
const roomId = "!roomId:server.com";
const groupCall = await client.createGroupCall(roomId, {
  type: "m.voice",  // 或 "m.video"
  encryption: true  // 启用端到端加密
});

console.log("Group call created");
```

### 加入群组通话

```typescript
// 加入现有的群组通话
const roomId = "!roomId:server.com";
const groupCall = await client.createGroupCall(roomId);

// 加入通话
await groupCall.enter({
  microphone: "muted",  // 初始麦克风状态
  camera: "off"         // 初始摄像头状态
});

console.log("Joined group call");
```

### 群组通话参与者管理

```typescript
// 获取参与者列表
const participants = groupCall.getParticipants();

console.log("Participants:");
participants.forEach(participant => {
  console.log(`  - ${participant.userId}`);
  console.log(`    Audio: ${participant.audioMuted ? "muted" : "unmuted"}`);
  console.log(`    Video: ${participant.videoMuted ? "off" : "on"}`);
});

// 踢出参与者
await groupCall.removeParticipant(userId);
```

### 群组通话控制

```typescript
// 静音/取消静音
await groupCall.setMicrophoneMuted(true);  // 静音
await groupCall.setMicrophoneMuted(false); // 取消静音

// 开启/关闭视频
await groupCall.setCameraEnabled(true);   // 开启视频
await groupCall.setCameraEnabled(false);  // 关闭视频

// 离开群组通话
await groupCall.leave();

// 结束群组通话（需要权限）
await groupCall.terminate();
```

### 监听群组通话事件

```typescript
groupCall.on("participants", (participants) => {
  console.log("Participants updated:", participants.length);
});

groupCall.on("participant_updated", (participant) => {
  console.log(`Participant ${participant.userId} updated`);
  console.log(`  Audio: ${participant.audioMuted ? "muted" : "unmuted"}`);
  console.log(`  Video: ${participant.videoMuted ? "off" : "on"}`);
});

groupCall.on("ended", () => {
  console.log("Group call ended");
});
```

## 屏幕共享

### 共享屏幕

```typescript
// 开始屏幕共享
try {
  // 获取屏幕流
  const screenStream = await navigator.mediaDevices.getDisplayMedia({
    video: {
      cursor: "always"
    },
    audio: false
  });

  // 将屏幕流添加到通话中
  await call.setLocalScreenShareStream(screenStream);

  console.log("Screen sharing started");

  // 监听用户停止共享
  screenStream.getVideoTracks()[0].onended = () => {
    call.setLocalScreenShareStream(null);
    console.log("Screen sharing stopped");
  };

} catch (error) {
  console.error("Failed to share screen:", error);
}
```

### 选择特定窗口或应用共享

```typescript
// 选择特定媒体源
try {
  const screenStream = await navigator.mediaDevices.getDisplayMedia({
    video: {
      mediaSource: "window"  // "screen", "window", "application", "browser"
    }
  });

  await call.setLocalScreenShareStream(screenStream);

} catch (error) {
  console.error("Failed to share window:", error);
}
```

### 停止屏幕共享

```typescript
// 停止屏幕共享
await call.setLocalScreenShareStream(null);

console.log("Screen sharing stopped");
```

### 查看远程屏幕共享

```typescript
// 监听远程屏幕共享
call.on("screensharing_updated", (userId, isSharing) => {
  if (isSharing) {
    console.log(`${userId} is sharing screen`);

    // 获取远程屏幕流
    const screenStream = call.getRemoteScreenShareStream(userId);

    // 设置到视频元素
    const screenVideo = document.getElementById("screenVideo") as HTMLVideoElement;
    if (screenVideo) {
      screenVideo.srcObject = screenStream;
    }
  } else {
    console.log(`${userId} stopped sharing screen`);
  }
});
```

## 通话控制

### 获取通话信息

```typescript
// 获取通话对方信息
const opponent = call.getOpponentMember();
console.log("Opponent:", opponent.name);
console.log("Opponent ID:", opponent.userId);

// 获取通话状态
const state = call.state;
console.log("Call state:", state);

// 检查是否在通话中
const isInCall = call.state === "connected";
console.log("In call:", isInCall);

// 获取通话时长
const duration = call.getDuration();
console.log("Call duration:", duration, "ms");
```

### DTMF 音频信号

```typescript
// 发送 DTMF 信号（用于电话按键等）
await call.sendDtmf("1");  // 发送按键 "1"
await call.sendDtmf("#");  // 发送按键 "#"

// DTMF 可用字符: 0-9, *, #, A-D
```

### 通话统计

```typescript
// 获取通话统计信息
const stats = await call.getStats();

stats.forEach(report => {
  console.log("Stats report:", report.type);

  if (report.type === "inbound-rtp") {
    console.log("  Bytes received:", report.bytesReceived);
    console.log("  Packets received:", report.packetsReceived);
    console.log("  Packets lost:", report.packetsLost);
  } else if (report.type === "outbound-rtp") {
    console.log("  Bytes sent:", report.bytesSent);
    console.log("  Packets sent:", report.packetsSent);
  }
});
```

### 通话录音（浏览器端）

```typescript
// 录制通话（需要双方同意）
class CallRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];

  async startRecording(call: sdk.Call): Promise<void> {
    // 获取混合流
    const streams = call.getAllStreams();
    const mixedStream = this.mixStreams(streams);

    // 创建录音器
    this.mediaRecorder = new MediaRecorder(mixedStream, {
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

  async stopRecording(): Promise<Blob> {
    if (!this.mediaRecorder) {
      throw new Error("No active recording");
    }

    this.mediaRecorder.stop();

    return new Blob(this.chunks, { type: "audio/webm" });
  }

  private mixStreams(streams: MediaStream[]): MediaStream {
    // 实现流混合
    // ...
    return streams[0];
  }
}
```

## 通话事件

### 完整的事件监听

```typescript
import { CallEvent } from "matrix-js-sdk";

// 通话邀请
client.on(CallEvent.Invite, (call) => {
  console.log("Incoming call");
  showIncomingCallDialog(call);
});

// 通话开始
client.on(CallEvent.Started, (call) => {
  console.log("Call started");
});

// 通话连接
client.on(CallEvent.Connect, (call) => {
  console.log("Call connected");
});

// 通话状态变化
client.on(CallEvent.State, (call) => {
  console.log("Call state:", call.state);

  switch (call.state) {
    case "fledgling":
      console.log("Call initializing");
      break;

    case "invite_sent":
      console.log("Invite sent");
      break;

    case "ringing":
      console.log("Ringing...");
      break;

    case "connected":
      console.log("Call connected!");
      break;

    case "ended":
      console.log("Call ended");
      break;

    case "invite_expired":
      console.log("Invite expired");
      break;
  }
});

// 对方静音状态变化
client.on(CallEvent.RemoteMuteStateChanged, (call, muted) => {
  console.log("Remote mic muted:", muted);
});

// 本地音量变化
client.on(CallEvent.LocalMuteStateChanged, (call, muted) => {
  console.log("Local mic muted:", muted);
});

// 挂断
client.on(CallEvent.Hangup, (call) => {
  console.log("Call hangup");
  hideCallUI();
});

// 错误
client.on(CallEvent.Error, (call, error) => {
  console.error("Call error:", error);
  showErrorMessage(error.message);
});
```

### 侧音（监听自己的声音）

```typescript
// 启用侧音
call.setLocalAudioEnabled(true);

// 禁用侧音
call.setLocalAudioEnabled(false);
```

### 网络状态变化

```typescript
// 监听网络质量
call.on("network_quality", (quality) => {
  console.log("Network quality:", quality);

  // quality 可能是: "excellent", "good", "fair", "poor", "bad"
});

// 监听连接状态
call.on("connection_state", (state) => {
  console.log("Connection state:", state);

  // state 可能是: "connected", "disconnected", "reconnecting"
});
```

## 完整示例

### 完整的通话管理类

```typescript
import * as sdk from "matrix-js-sdk";
import { CallEvent } from "matrix-js-sdk";

interface CallUI {
  showIncomingCall: (callerName: string, callType: "voice" | "video") => Promise<boolean>;
  showCallUI: () => void;
  hideCallUI: () => void;
  updateCallState: (state: string) => void;
  showRemoteStream: (stream: MediaStream) => void;
  showLocalStream: (stream: MediaStream) => void;
  showError: (message: string) => void;
}

class MatrixCallManager {
  private currentCall: sdk.Call | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;

  constructor(
    private client: sdk.MatrixClient,
    private ui: CallUI
  ) {
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.client.on(CallEvent.Invite, (call) => this.handleIncomingCall(call));
    this.client.on(CallEvent.State, (call) => this.handleCallState(call));
    this.client.on(CallEvent.Hangup, () => this.handleCallEnd());
    this.client.on(CallEvent.Error, (call, error) => this.handleError(error));
  }

  // 发起语音通话
  async startVoiceCall(roomId: string): Promise<void> {
    try {
      // 请求麦克风权限
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      });

      // 创建通话
      this.currentCall = this.client.createCall(roomId);
      this.currentCall.type = "voice";

      // 设置本地流
      this.setupCallHandlers();
      await this.currentCall.placeCall(this.localStream);

      this.ui.showCallUI();

    } catch (error: any) {
      this.ui.showError(`Failed to start call: ${error.message}`);
    }
  }

  // 发起视频通话
  async startVideoCall(roomId: string): Promise<void> {
    try {
      // 请求音视频权限
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true
      });

      // 创建通话
      this.currentCall = this.client.createCall(roomId);
      this.currentCall.type = "video";

      // 设置本地流
      this.setupCallHandlers();
      await this.currentCall.placeCall(this.localStream);

      this.ui.showCallUI();

      // 显示本地视频
      if (this.localStream) {
        this.ui.showLocalStream(this.localStream);
      }

    } catch (error: any) {
      this.ui.showError(`Failed to start call: ${error.message}`);
    }
  }

  // 处理来电
  private async handleIncomingCall(call: sdk.Call): Promise<void> {
    const opponent = call.getOpponentMember();
    const callType = call.type;

    // 询问用户是否接听
    const answer = await this.ui.showIncomingCall(opponent.name, callType);

    if (answer) {
      try {
        // 请求权限
        const constraints = callType === "video"
          ? { audio: true, video: true }
          : { audio: true, video: false };

        this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
        this.currentCall = call;

        this.setupCallHandlers();
        await call.answer(this.localStream);

        this.ui.showCallUI();

        // 显示本地视频
        if (callType === "video" && this.localStream) {
          this.ui.showLocalStream(this.localStream);
        }

      } catch (error: any) {
        this.ui.showError(`Failed to answer call: ${error.message}`);
        call.hangup();
      }
    } else {
      call.hangup();
    }
  }

  // 设置通话处理器
  private setupCallHandlers(): void {
    if (!this.currentCall) return;

    // 监听远程流
    this.currentCall.on("remote_stream", (stream) => {
      this.remoteStream = stream;
      this.ui.showRemoteStream(stream);
    });

    // 监听对方静音状态
    this.currentCall.on("remote_muted", (muted) => {
      console.log("Remote mic muted:", muted);
    });
  }

  // 处理通话状态变化
  private handleCallState(call: sdk.Call): void {
    this.ui.updateCallState(call.state);

    if (call.state === "connected") {
      console.log("Call connected");
    } else if (call.state === "ended") {
      this.handleCallEnd();
    }
  }

  // 通话结束处理
  private handleCallEnd(): void {
    this.stopStreams();
    this.currentCall = null;
    this.ui.hideCallUI();
  }

  // 停止媒体流
  private stopStreams(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    this.remoteStream = null;
  }

  // 切换静音
  toggleMute(): void {
    if (!this.currentCall) return;

    if (this.currentCall.isLocalAudioMuted()) {
      this.currentCall.unmuteAudio();
      console.log("Microphone unmuted");
    } else {
      this.currentCall.muteAudio();
      console.log("Microphone muted");
    }
  }

  // 切换视频
  toggleVideo(): void {
    if (!this.currentCall || this.currentCall.type !== "video") return;

    if (this.currentCall.isLocalVideoMuted()) {
      this.currentCall.unmuteVideo();
      console.log("Camera enabled");
    } else {
      this.currentCall.muteVideo();
      console.log("Camera disabled");
    }
  }

  // 挂断通话
  async hangup(): Promise<void> {
    if (this.currentCall) {
      await this.currentCall.hangup();
    }
    this.handleCallEnd();
  }

  // 错误处理
  private handleError(error: Error): void {
    console.error("Call error:", error);
    this.ui.showError(`Call error: ${error.message}`);
  }

  // 获取当前通话
  getCurrentCall(): sdk.Call | null {
    return this.currentCall;
  }

  // 是否在通话中
  isInCall(): boolean {
    return this.currentCall !== null && this.currentCall.state === "connected";
  }
}

// 使用示例
class SimpleCallUI implements CallUI {
  async showIncomingCall(callerName: string, callType: "voice" | "video"): Promise<boolean> {
    const message = `Incoming ${callType} call from ${callerName}. Answer?`;
    return confirm(message);
  }

  showCallUI(): void {
    console.log("Showing call UI");
    // 显示通话界面
  }

  hideCallUI(): void {
    console.log("Hiding call UI");
    // 隐藏通话界面
  }

  updateCallState(state: string): void {
    console.log("Call state:", state);
    // 更新通话状态显示
  }

  showRemoteStream(stream: MediaStream): void {
    const video = document.getElementById("remoteVideo") as HTMLVideoElement;
    if (video) {
      video.srcObject = stream;
    }
  }

  showLocalStream(stream: MediaStream): void {
    const video = document.getElementById("localVideo") as HTMLVideoElement;
    if (video) {
      video.srcObject = stream;
    }
  }

  showError(message: string): void {
    alert(message);
  }
}

// 初始化
const client = sdk.createClient({
  baseUrl: "https://matrix.org",
  accessToken: "token",
  userId: "@user:matrix.org"
});

await client.startClient();

const ui = new SimpleCallUI();
const callManager = new MatrixCallManager(client, ui);

// 发起语音通话
// await callManager.startVoiceCall("!roomId:server.com");

// 发起视频通话
// await callManager.startVideoCall("!roomId:server.com");
```
