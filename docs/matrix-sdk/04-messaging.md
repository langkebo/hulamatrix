# 04. 消息功能

> Matrix JS SDK 消息发送、接收、处理等功能

## 目录
- [发送消息](#发送消息)
- [接收消息](#接收消息)
- [消息类型](#消息类型)
- [消息编辑](#消息编辑)
- [消息回复](#消息回复)
- [消息删除](#消息删除)
- [消息反应](#消息反应)
- [消息状态](#消息状态)
- [富文本消息](#富文本消息)
- [完整示例](#完整示例)

## 发送消息

### 发送文本消息

```typescript
import * as sdk from "matrix-js-sdk";

// 方法1: 使用 sendMessage
await client.sendMessage("!roomId:server.com", {
  msgtype: "m.text",
  body: "Hello, World!"
});

// 方法2: 使用 sendTextMessage
await client.sendTextMessage("!roomId:server.com", "Hello, World!");

// 方法3: 使用 sendEvent
await client.sendEvent("!roomId:server.com", "m.room.message", {
  msgtype: "m.text",
  body: "Hello, World!"
});
```

### 发送 Markdown 消息

```typescript
// 发送带 HTML 格式的消息
await client.sendMessage("!roomId:server.com", {
  body: "Hello *bold* and _italic_ text",
  msgtype: "m.text",
  format: "org.matrix.custom.html",
  formatted_body: "Hello <b>bold</b> and <i>italic</i> text"
});
```

### 发送代码块

```typescript
// 发送代码块
await client.sendMessage("!roomId:server.com", {
  body: "```javascript\nconst x = 42;\nconsole.log(x);\n```",
  msgtype: "m.text",
  format: "org.matrix.custom.html",
  formatted_body: '<pre><code class="language-javascript">const x = 42;\nconsole.log(x);</code></pre>'
});
```

### 发送通知消息

```typescript
// 发送通知（不显示为用户消息）
await client.sendNotice("!roomId:server.com", "Room was created");
```

### 发送表情消息

```typescript
// 发送表情（短代码）
await client.sendMessage("!roomId:server.com", {
  body: ":smile:",
  msgtype: "m.emote"
});

// 发送 Unicode 表情
await client.sendMessage("!roomId:server.com", {
  body: "😀",
  msgtype: "m.text"
});
```

### 发送带本地 ID 的消息

```typescript
// 设置本地事务 ID，用于跟踪发送状态
const txnId = `local_${Date.now()}`;

await client.sendMessage("!roomId:server.com", {
  msgtype: "m.text",
  body: "Message with transaction ID"
}, txnId);
```

### 批量发送消息

```typescript
// 顺序发送多个消息
const messages = [
  "First message",
  "Second message",
  "Third message"
];

for (const msg of messages) {
  await client.sendMessage("!roomId:server.com", {
    msgtype: "m.text",
    body: msg
  });
}

// 并发发送（不保证顺序）
const promises = messages.map(msg =>
  client.sendMessage("!roomId:server.com", {
    msgtype: "m.text",
    body: msg
  })
);

await Promise.all(promises);
```

## 接收消息

### 监听所有消息

```typescript
import { RoomEvent } from "matrix-js-sdk";

// 监听房间时间线事件
client.on(RoomEvent.Timeline, (event, room) => {
  if (event.getType() === "m.room.message") {
    const content = event.getContent();
    console.log(`New message in ${room.name}:`);
    console.log(`  Sender: ${event.getSender()}`);
    console.log(`  Type: ${content.msgtype}`);
    console.log(`  Body: ${content.body}`);
  }
});
```

### 只监听新消息（忽略历史）

```typescript
client.on(RoomEvent.Timeline, (event, room, toStartOfTimeline) => {
  // toStartOfTimeline 为 true 表示这是历史消息
  if (toStartOfTimeline) {
    return;  // 忽略历史消息
  }

  if (event.getType() === "m.room.message") {
    console.log("New message:", event.getContent().body);
  }
});
```

### 按消息类型过滤

```typescript
client.on(RoomEvent.Timeline, (event, room) => {
  if (event.getType() !== "m.room.message") {
    return;
  }

  const content = event.getContent();

  switch (content.msgtype) {
    case "m.text":
      console.log("Text message:", content.body);
      break;

    case "m.emote":
      console.log("Emote:", content.body);
      break;

    case "m.notice":
      console.log("Notice:", content.body);
      break;

    case "m.image":
      console.log("Image:", content.url);
      break;

    case "m.video":
      console.log("Video:", content.url);
      break;

    case "m.audio":
      console.log("Audio:", content.url);
      break;

    case "m.file":
      console.log("File:", content.url);
      break;

    default:
      console.log("Unknown message type:", content.msgtype);
  }
});
```

### 获取历史消息

```typescript
// 获取房间时间线
const room = client.getRoom("!roomId:server.com");
if (room) {
  // 获取当前时间线的所有事件
  const timeline = room.timeline;
  timeline.forEach(event => {
    if (event.getType() === "m.room.message") {
      console.log(`Event: ${event.getId()}`);
      console.log(`Content: ${event.getContent().body}`);
      console.log(`Sender: ${event.getSender()}`);
      console.log(`Timestamp: ${event.getTs()}`);
    }
  });
}
```

### 分页获取历史消息

```typescript
// 向后滚动获取更多历史消息
const room = client.getRoom("!roomId:server.com");
if (room) {
  // 获取时间线集合
  const timelineSet = room.getUnfilteredTimelineSet();

  // 向后滚动获取 20 条事件
  const events = await client.scrollback(room, 20);

  console.log(`Fetched ${events.length} historical events`);
  events.forEach(event => {
    console.log(`- ${event.getContent().body}`);
  });
}
```

### 搜索特定消息

```typescript
// 在房间中搜索消息
const room = client.getRoom("!roomId:server.com");
if (room) {
  const timeline = room.timeline;

  // 搜索包含特定文本的消息
  const searchTerm = "hello";
  const matchingEvents = timeline.filter(event => {
    if (event.getType() !== "m.room.message") {
      return false;
    }
    const body = event.getContent().body || "";
    return body.toLowerCase().includes(searchTerm.toLowerCase());
  });

  console.log(`Found ${matchingEvents.length} messages containing "${searchTerm}"`);
}
```

## 消息类型

### 文本消息

```typescript
await client.sendMessage("!roomId:server.com", {
  msgtype: "m.text",
  body: "Plain text message"
});
```

### 表情消息（动作）

```typescript
// 显示为 /me 格式
await client.sendMessage("!roomId:server.com", {
  msgtype: "m.emote",
  body: "waves hello"
});
// 显示为: * Username waves hello
```

### 通知消息

```typescript
// 系统通知
await client.sendMessage("!roomId:server.com", {
  msgtype: "m.notice",
  body: "This is a notice message"
});
```

### 图片消息

```typescript
// 首先上传图片
const imageBlob = new Blob([...], { type: "image/jpeg" });
const mxcUrl = await client.uploadContent(imageBlob, {
  name: "image.jpg",
  type: "image/jpeg"
});

// 发送图片消息
await client.sendMessage("!roomId:server.com", {
  msgtype: "m.image",
  url: mxcUrl,
  body: "image.jpg",
  info: {
    h: 480,           // 高度
    w: 640,           // 宽度
    mimetype: "image/jpeg",
    size: 12345       // 字节大小
  }
});
```

### 视频消息

```typescript
// 上传视频
const videoBlob = new Blob([...], { type: "video/mp4" });
const mxcUrl = await client.uploadContent(videoBlob, {
  name: "video.mp4",
  type: "video/mp4"
});

// 发送视频消息
await client.sendMessage("!roomId:server.com", {
  msgtype: "m.video",
  url: mxcUrl,
  body: "video.mp4",
  info: {
    duration: 60000,     // 时长（毫秒）
    h: 720,
    w: 1280,
    mimetype: "video/mp4",
    size: 1024000
  }
});
```

### 音频消息

```typescript
// 上传音频
const audioBlob = new Blob([...], { type: "audio/mp3" });
const mxcUrl = await client.uploadContent(audioBlob, {
  name: "audio.mp3",
  type: "audio/mp3"
});

// 发送音频消息
await client.sendMessage("!roomId:server.com", {
  msgtype: "m.audio",
  url: mxcUrl,
  body: "audio.mp3",
  info: {
    duration: 180000,
    mimetype: "audio/mp3",
    size: 512000
  }
});
```

### 文件消息

```typescript
// 上传文件
const fileBlob = new Blob([...], { type: "application/pdf" });
const mxcUrl = await client.uploadContent(fileBlob, {
  name: "document.pdf",
  type: "application/pdf"
});

// 发送文件消息
await client.sendMessage("!roomId:server.com", {
  msgtype: "m.file",
  url: mxcUrl,
  body: "document.pdf",
  info: {
    mimetype: "application/pdf",
    size: 204800
  }
});
```

### 位置消息

```typescript
// 发送位置
await client.sendMessage("!roomId:server.com", {
  msgtype: "m.location",
  body: "Location",
  geo_uri: "geo:40.7128,-74.0060",
  info: {
    thumbnail_url: "mxc://server.com/abc123"
  }
});
```

## 消息编辑

### 编辑文本消息

```typescript
// 原始消息
const originalEvent = await client.sendMessage("!roomId:server.com", {
  msgtype: "m.text",
  body: "Original message"
});

// 编辑消息
await client.sendMessage("!roomId:server.com", {
  msgtype: "m.text",
  body: "Edited message",
  "m.new_content": {
    msgtype: "m.text",
    body: "Edited message"
  },
  "m.relates_to": {
    rel_type: "m.replace",
    event_id: originalEvent.event_id
  }
});
```

### 获取编辑后的消息

```typescript
// SDK 会自动处理消息编辑
client.on(RoomEvent.Timeline, (event, room) => {
  if (event.getType() === "m.room.message") {
    const content = event.getContent();

    // 检查是否为编辑后的内容
    if (content["m.new_content"]) {
      console.log("Original:", content.body);
      console.log("Edited:", content["m.new_content"].body);
    }
  }
});
```

### 撤销编辑

```typescript
// 撤销编辑，恢复原始消息
await client.sendMessage("!roomId:server.com", {
  msgtype: "m.text",
  body: "Original message",  // 恢复原始内容
  "m.new_content": {
    msgtype: "m.text",
    body: "Original message"
  },
  "m.relates_to": {
    rel_type: "m.replace",
    event_id: originalEvent.event_id
  }
});
```

## 消息回复

### 回复消息

```typescript
// 原始消息
const targetEventId = "$original_event_id";

// 回复消息
await client.sendMessage("!roomId:server.com", {
  msgtype: "m.text",
  body: "> <@sender:server.com> Original message\n\nThis is a reply",
  "m.relates_to": {
    rel_type: "m.reply",
    event_id: targetEventId
  },
  format: "org.matrix.custom.html",
  formatted_body: `<mx-reply><blockquote><a href="https://matrix.to/#/!roomId:server.com/$original_event_id">In reply to</a> <a href="https://matrix.to/#/@sender:server.com">@sender:server.com</a><br>Original message</blockquote></mx-reply>This is a reply`
});
```

### 使用 replyMessage 辅助方法

```typescript
// 使用 SDK 提供的辅助方法（如果可用）
const room = client.getRoom("!roomId:server.com");
if (room) {
  const targetEvent = room.findEventById("$event_id");

  if (targetEvent) {
    const replyContent = client.getReplyContent(
      targetEvent,
      "This is my reply"
    );

    await client.sendMessage("!roomId:server.com", replyContent);
  }
}
```

### 获取回复链

```typescript
// 获取消息的完整回复链
client.on(RoomEvent.Timeline, (event) => {
  const relatesTo = event.getRelation();

  if (relatesTo?.rel_type === "m.reply") {
    const originalEventId = relatesTo.event_id;
    const room = client.getRoom(event.getRoomId());

    if (room) {
      const originalEvent = room.findEventById(originalEventId);
      console.log("Replying to:", originalEvent?.getContent().body);
    }
  }
});
```

### 回复并引用

```typescript
// 回复并引用多条消息
await client.sendMessage("!roomId:server.com", {
  msgtype: "m.text",
  body: "Reply with quotes",
  "m.relates_to": {
    rel_type: "m.reference",
    event_id: "$target_event_id"
  }
});
```

## 消息删除

### 删除/撤回消息

```typescript
// 删除消息（需要权限）
await client.redactEvent(
  "!roomId:server.com",
  "$event_id_to_redact"
);
```

### 带理由的删除

```typescript
// 删除消息并提供理由
await client.redactEvent(
  "!roomId:server.com",
  "$event_id_to_redact",
  {
    reason: "Message violated community guidelines"
  }
);
```

### 监听消息删除

```typescript
client.on(RoomEvent.Timeline, (event) => {
  if (event.getType() === "m.room.redaction") {
    const redactedEventId = event.redacts;
    const reason = event.getContent().reason;

    console.log(`Message ${redactedEventId} was redacted`);
    if (reason) {
      console.log(`Reason: ${reason}`);
    }
  }
});
```

### 批量删除消息

```typescript
// 删除多条消息（需要权限）
const eventIds = ["$event1", "$event2", "$event3"];

for (const eventId of eventIds) {
  try {
    await client.redactEvent("!roomId:server.com", eventId);
  } catch (error) {
    console.error(`Failed to redact ${eventId}:`, error);
  }
}
```

## 消息反应

### 添加反应

```typescript
// 为消息添加表情反应
await client.sendEvent(
  "!roomId:server.com",
  "m.reaction",
  {
    "m.relates_to": {
      rel_type: "m.annotation",
      event_id: "$target_event_id",
      key: "👍"  // 表情符号
    }
  }
);
```

### 添加多种反应

```typescript
// 添加多个反应
const reactions = ["👍", "❤️", "😀"];

for (const emoji of reactions) {
  await client.sendEvent(
    "!roomId:server.com",
    "m.reaction",
    {
      "m.relates_to": {
        rel_type: "m.annotation",
        event_id: "$target_event_id",
        key: emoji
      }
    }
  );
}
```

### 获取反应列表

```typescript
// 获取消息的所有反应
client.on(RoomEvent.Timeline, (event) => {
  if (event.getType() === "m.reaction") {
    const relatesTo = event.getContent()["m.relates_to"];
    const targetEventId = relatesTo.event_id;
    const emoji = relatesTo.key;

    console.log(`${event.getSender()} reacted to ${targetEventId} with ${emoji}`);
  }
});

// 获取特定消息的反应统计
function getReactionsForEvent(room: sdk.Room, eventId: string): Map<string, string[]> {
  const reactions = new Map<string, string[]>();

  const events = room.getLiveTimeline().getEvents();

  events.forEach(event => {
    if (event.getType() === "m.reaction") {
      const relatesTo = event.getContent()["m.relates_to"];
      if (relatesTo?.event_id === eventId) {
        const emoji = relatesTo.key;
        if (!reactions.has(emoji)) {
          reactions.set(emoji, []);
        }
        reactions.get(emoji)!.push(event.getSender());
      }
    }
  });

  return reactions;
}
```

### 删除反应

```typescript
// 删除自己的反应
// 需要先找到反应事件 ID
client.on(RoomEvent.Timeline, (event) => {
  if (event.getType() === "m.reaction") {
    const sender = event.getSender();
    const relatesTo = event.getContent()["m.relates_to"];

    // 如果是我发送的反应
    if (sender === client.getUserId() && relatesTo?.event_id === "$target_event_id") {
      // 删除反应事件
      await client.redactEvent(
        event.getRoomId(),
        event.getId()
      );
    }
  }
});
```

## 消息状态

### 检查发送状态

```typescript
// 发送消息时设置本地事件 ID
const localEventId = `local_${Date.now()}`;

const response = await client.sendMessage("!roomId:server.com", {
  msgtype: "m.text",
  body: "Hello"
}, localEventId);

console.log("Event ID:", response.event_id);
```

### 监听发送状态

```typescript
// 监听本地事件的状态变化
client.on(sdk.RoomEvent.LocalEchoUpdated, (event, room, oldEventId) => {
  const status = event.status;

  switch (status) {
    case sdk.EventStatus.SENDING:
      console.log("Message is sending...");
      break;

    case sdk.EventStatus.SENT:
      console.log("Message sent successfully");
      break;

    case sdk.EventStatus.QUEUED:
      console.log("Message is queued");
      break;

    case sdk.EventStatus.NOT_SENT:
      console.log("Message failed to send");
      break;

    case sdk.EventStatus.CANCELLED:
      console.log("Message was cancelled");
      break;
  }
});
```

### 处理发送失败

```typescript
// 监听发送失败并重试
client.on(sdk.RoomEvent.LocalEchoUpdated, (event) => {
  if (event.status === sdk.EventStatus.NOT_SENT) {
    console.error("Failed to send message");

    // 重试发送
    setTimeout(() => {
      client.sendMessage(event.getRoomId(), event.getContent());
    }, 5000);
  }
});
```

### 取消发送

```typescript
// 取消正在发送的消息
const pendingEvent = {
  roomId: "!roomId:server.com",
  content: {
    msgtype: "m.text",
    body: "Message to cancel"
  },
  txnId: `local_${Date.now()}`
};

// 开始发送
client.sendMessage(pendingEvent.roomId, pendingEvent.content, pendingEvent.txnId);

// 立即取消
client.cancelPendingEvent(pendingEvent.roomId, pendingEvent.txnId);
```

## 富文本消息

### 发送 HTML 消息

```typescript
await client.sendMessage("!roomId:server.com", {
  body: "Plain text fallback",
  msgtype: "m.text",
  format: "org.matrix.custom.html",
  formatted_body: `
    <h1>Heading</h1>
    <p>This is a <strong>bold</strong> paragraph with <em>italic</em> text.</p>
    <ul>
      <li>Item 1</li>
      <li>Item 2</li>
    </ul>
  `
});
```

### 发送链接

```typescript
await client.sendMessage("!roomId:server.com", {
  body: "Check out https://example.com",
  msgtype: "m.text",
  format: "org.matrix.custom.html",
  formatted_body: 'Check out <a href="https://example.com">this link</a>'
});
```

### 发送列表

```typescript
await client.sendMessage("!roomId:server.com", {
  body: "Items:\n- Item 1\n- Item 2\n- Item 3",
  msgtype: "m.text",
  format: "org.matrix.custom.html",
  formatted_body: `
    <p>Items:</p>
    <ul>
      <li>Item 1</li>
      <li>Item 2</li>
      <li>Item 3</li>
    </ul>
  `
});
```

### 发送表格

```typescript
await client.sendMessage("!roomId:server.com", {
  body: "| Header 1 | Header 2 |\n|----------|----------|\n| Cell 1   | Cell 2   |",
  msgtype: "m.text",
  format: "org.matrix.custom.html",
  formatted_body: `
    <table>
      <tr>
        <th>Header 1</th>
        <th>Header 2</th>
      </tr>
      <tr>
        <td>Cell 1</td>
        <td>Cell 2</td>
      </tr>
    </table>
  `
});
```

## 完整示例

### 消息管理类

```typescript
import * as sdk from "matrix-js-sdk";
import { RoomEvent, EventStatus } from "matrix-js-sdk";

class MessageManager {
  private messageHandlers: Map<string, (event: sdk.MatrixEvent) => void> = new Map();

  constructor(private client: sdk.MatrixClient) {
    this.setupListeners();
  }

  private setupListeners() {
    this.client.on(RoomEvent.Timeline, (event, room, toStartOfTimeline) => {
      if (toStartOfTimeline) return;  // 忽略历史消息

      if (event.getType() === "m.room.message") {
        this.handleNewMessage(event);
      }
    });

    this.client.on(RoomEvent.LocalEchoUpdated, (event, room, oldEventId) => {
      this.handleMessageStatus(event);
    });
  }

  // 发送文本消息
  async sendText(roomId: string, text: string): Promise<string> {
    const response = await this.client.sendMessage(roomId, {
      msgtype: "m.text",
      body: text
    });

    console.log(`Sent message to ${roomId}: ${text}`);
    return response.event_id;
  }

  // 发送格式化消息
  async sendFormatted(roomId: string, plain: string, html: string): Promise<string> {
    const response = await this.client.sendMessage(roomId, {
      msgtype: "m.text",
      body: plain,
      format: "org.matrix.custom.html",
      formatted_body: html
    });

    return response.event_id;
  }

  // 发送图片
  async sendImage(roomId: string, blob: Blob, filename: string): Promise<string> {
    const mxcUrl = await this.client.uploadContent(blob, {
      name: filename,
      type: blob.type
    });

    const response = await this.client.sendMessage(roomId, {
      msgtype: "m.image",
      url: mxcUrl,
      body: filename
    });

    return response.event_id;
  }

  // 发送文件
  async sendFile(roomId: string, blob: Blob, filename: string): Promise<string> {
    const mxcUrl = await this.client.uploadContent(blob, {
      name: filename,
      type: blob.type
    });

    const response = await this.client.sendMessage(roomId, {
      msgtype: "m.file",
      url: mxcUrl,
      body: filename
    });

    return response.event_id;
  }

  // 回复消息
  async reply(roomId: string, eventId: string, text: string): Promise<string> {
    const room = this.client.getRoom(roomId);
    if (!room) {
      throw new Error("Room not found");
    }

    const event = room.findEventById(eventId);
    if (!event) {
      throw new Error("Event not found");
    }

    const sender = event.getSender();
    const body = event.getContent().body;

    const replyContent = {
      msgtype: "m.text",
      body: `> <${sender}> ${body}\n\n${text}`,
      "m.relates_to": {
        rel_type: "m.reply",
        event_id: eventId
      },
      format: "org.matrix.custom.html",
      formatted_body: `<mx-reply><blockquote><a href="https://matrix.to/#/${roomId}/${eventId}">In reply to</a> <a href="https://matrix.to/#/${sender}">${sender}</a><br>${body}</blockquote></mx-reply>${text}`
    };

    const response = await this.client.sendMessage(roomId, replyContent);
    return response.event_id;
  }

  // 编辑消息
  async edit(roomId: string, eventId: string, newText: string): Promise<string> {
    const editContent = {
      msgtype: "m.text",
      body: newText,
      "m.new_content": {
        msgtype: "m.text",
        body: newText
      },
      "m.relates_to": {
        rel_type: "m.replace",
        event_id: eventId
      }
    };

    const response = await this.client.sendMessage(roomId, editContent);
    return response.event_id;
  }

  // 删除消息
  async delete(roomId: string, eventId: string, reason?: string): Promise<void> {
    await this.client.redactEvent(roomId, eventId, { reason });
    console.log(`Deleted message ${eventId}`);
  }

  // 添加反应
  async react(roomId: string, eventId: string, emoji: string): Promise<void> {
    await this.client.sendEvent(roomId, "m.reaction", {
      "m.relates_to": {
        rel_type: "m.annotation",
        event_id: eventId,
        key: emoji
      }
    });

    console.log(`Reacted to ${eventId} with ${emoji}`);
  }

  // 获取房间消息
  getMessages(roomId: string, limit: number = 50): sdk.MatrixEvent[] {
    const room = this.client.getRoom(roomId);
    if (!room) return [];

    const timeline = room.timeline;
    const messages = timeline
      .filter(event => event.getType() === "m.room.message")
      .slice(-limit);

    return messages;
  }

  // 获取反应
  getReactions(roomId: string, eventId: string): Map<string, string[]> {
    const room = this.client.getRoom(roomId);
    if (!room) return new Map();

    const reactions = new Map<string, string[]>();
    const events = room.getLiveTimeline().getEvents();

    events.forEach(event => {
      if (event.getType() === "m.reaction") {
        const relatesTo = event.getContent()["m.relates_to"];
        if (relatesTo?.event_id === eventId) {
          const emoji = relatesTo.key;
          if (!reactions.has(emoji)) {
            reactions.set(emoji, []);
          }
          reactions.get(emoji)!.push(event.getSender());
        }
      }
    });

    return reactions;
  }

  // 注册消息处理器
  onMessage(callback: (event: sdk.MatrixEvent) => void) {
    const id = Date.now().toString();
    this.messageHandlers.set(id, callback);
    return () => this.messageHandlers.delete(id);
  }

  private handleNewMessage(event: sdk.MatrixEvent) {
    this.messageHandlers.forEach(handler => handler(event));
  }

  private handleMessageStatus(event: sdk.MatrixEvent) {
    const status = event.status;
    const content = event.getContent();

    switch (status) {
      case EventStatus.SENDING:
        console.log(`Sending: ${content.body}`);
        break;

      case EventStatus.SENT:
        console.log(`Sent: ${content.body}`);
        break;

      case EventStatus.NOT_SENT:
        console.error(`Failed to send: ${content.body}`);
        break;

      default:
        console.log(`Message status: ${status}`);
    }
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

  const messageManager = new MessageManager(client);

  // 发送消息
  const eventId = await messageManager.sendText("!roomId:server.com", "Hello!");

  // 回复消息
  await messageManager.reply("!roomId:server.com", eventId, "Thanks!");

  // 添加反应
  await messageManager.react("!roomId:server.com", eventId, "👍");

  // 编辑消息
  await messageManager.edit("!roomId:server.com", eventId, "Hello, World!");

  // 删除消息
  await messageManager.delete("!roomId:server.com", eventId);

  // 获取消息
  const messages = messageManager.getMessages("!roomId:server.com");
  console.log("Recent messages:", messages.map(m => m.getContent().body));
}
```
