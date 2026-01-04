# 10. 搜索功能

> Matrix JS SDK 消息、用户、房间搜索功能

## 目录
- [搜索消息](#搜索消息)
- [搜索用户](#搜索用户)
- [搜索房间](#搜索房间)
- [搜索历史](#搜索历史)
- [完整示例](#完整示例)

## 搜索消息

### 基本消息搜索

```typescript
import * as sdk from "matrix-js-sdk";

// 在房间中搜索消息
const searchResults = await client.searchRoomMessages({
  search_term: "hello",
  room_id: "!roomId:server.com"
});

console.log("Found:", searchResults.results.length, "messages");
```

### 全局搜索

```typescript
// 在所有房间中搜索
const searchResults = await client.searchRoomMessages({
  search_term: "matrix",
  // 不指定 room_id，搜索所有房间
});

searchResults.results.forEach(result => {
  const event = result.result;
  const roomId = result.room_id;

  console.log(`Found in ${roomId}:`);
  console.log(`  ${event.getContent().body}`);
  console.log(`  Rank: ${result.rank}`);
});
```

### 高级搜索选项

```typescript
// 使用高级搜索选项
const searchResults = await client.searchRoomMessages({
  search_term: "important announcement",

  // 搜索配置
  room_id: "!roomId:server.com",  // 可选：特定房间
  limit: 50,                       // 结果数量限制

  // 搜索过滤器
  filter: {
    // 限制搜索范围
    rooms: ["!room1:server.com", "!room2:server.com"],

    // 按时间范围搜索
    timeline: {
      from: Date.now() - 86400000,  // 过去 24 小时
      to: Date.now()
    },

    // 按发送者搜索
    senders: ["@user1:server.com"],

    // 按事件类型搜索
    types: ["m.room.message"]
  },

  // 结果排序
  order_by: "recent",  // "recent" | "rank"
  // "recent": 按时间排序
  // "rank": 按相关性排序

  // 包含历史上下文
  include_context: true,
  context_before: 1,
  context_after: 1
});
```

### 分页搜索

```typescript
// 分页获取搜索结果
async function searchAllMessages(
  client: sdk.MatrixClient,
  searchTerm: string,
  roomId?: string
) {
  let allResults: any[] = [];
  let nextBatch: string | undefined;

  do {
    const searchResults = await client.searchRoomMessages({
      search_term: searchTerm,
      room_id: roomId,
      next_batch: nextBatch,
      limit: 100
    });

    allResults = allResults.concat(searchResults.results);
    nextBatch = searchResults.next_batch;

    console.log(`Found ${allResults.length} results so far...`);

  } while (nextBatch);

  return allResults;
}

// 使用
const results = await searchAllMessages(client, "keyword", "!roomId:server.com");
console.log(`Total results: ${results.length}`);
```

### 高亮搜索结果

```typescript
// 搜索结果包含高亮信息
const searchResults = await client.searchRoomMessages({
  search_term: "matrix sdk",
  room_id: "!roomId:server.com"
});

searchResults.results.forEach(result => {
  const event = result.result;
  const highlights = result highlights || [];

  console.log("Message:", event.getContent().body);
  console.log("Highlights:", highlights);
  // highlights: ["<b>matrix</b> <b>sdk</b>"]
});
```

## 搜索用户

### 搜索用户目录

```typescript
// 在用户目录中搜索
const searchResults = await client.searchUserDirectory({
  search_term: "john",
  limit: 10
});

console.log("Found users:", searchResults.results.length);

searchResults.results.forEach(user => {
  console.log("User ID:", user.user_id);
  console.log("Display name:", user.display_name);
  console.log("Avatar:", user.avatar_url);
});
```

### 带过滤器的用户搜索

```typescript
// 使用过滤器搜索用户
const searchResults = await client.searchUserDirectory({
  search_term: "john",
  limit: 20,

  // 可选的过滤器
  filter: {
    // 只搜索特定域的用户
    limit: 20
  }
});
```

### 按用户 ID 搜索

```typescript
// 直接获取用户信息（如果知道用户 ID）
const userId = "@john:server.com";

// 获取用户资料
const profile = await client.getProfileInfo(userId);

console.log("Display name:", profile.displayname);
console.log("Avatar URL:", profile.avatar_url);

// 获取用户在线状态
const presence = await client.getPresence(userId);

console.log("Presence:", presence.presence);
console.log("Status:", presence.status_msg);
```

### 推荐用户

```typescript
// 获取推荐的联系人（如果服务器支持）
try {
  const contacts = await client.getContacts();

  console.log("Recommended contacts:");
  contacts.forEach(contact => {
    console.log(`  - ${contact.display_name || contact.user_id}`);
  });
} catch (error) {
  console.log("Contact recommendation not supported");
}
```

## 搜索房间

### 搜索公开房间

```typescript
// 搜索公开房间
const publicRooms = await client.publicRooms({
  limit: 20,
  since: "next_batch_token",  // 分页令牌
  filter: {
    generic_search_term: "matrix",
    room_types: []  // 空数组表示搜索所有类型
  }
});

console.log("Found rooms:", publicRooms.chunk.length);

publicRooms.chunk.forEach(room => {
  console.log("Room ID:", room.room_id);
  console.log("Name:", room.name);
  console.log("Topic:", room.topic);
  console.log("Members:", room.num_joined_members);
  console.log("Alias:", room.canonical_alias);
});
```

### 按房间别名搜索

```typescript
// 通过房间 ID 或别名获取房间信息
async function findRoomByAlias(client: sdk.MatrixClient, alias: string) {
  try {
    const roomId = await client.getRoomIdForAlias(alias);
    const room = client.getRoom(roomId.room_id);

    if (room) {
      return {
        id: room.roomId,
        name: room.name,
        topic: room.topic,
        members: room.getJoinedMemberCount(),
        avatar: room.avatarUrl
      };
    }
  } catch (error) {
    console.error("Room not found:", error);
  }

  return null;
}

// 使用
const roomInfo = await findRoomByAlias(client, "#matrix:matrix.org");
if (roomInfo) {
  console.log("Found room:", roomInfo);
}
```

### 搜索已加入的房间

```typescript
// 在已加入的房间中搜索
function searchJoinedRooms(
  client: sdk.MatrixClient,
  searchTerm: string
): sdk.Room[] {
  const rooms = client.getRooms();

  return rooms.filter(room => {
    // 搜索房间名
    if (room.name && room.name.toLowerCase().includes(searchTerm.toLowerCase())) {
      return true;
    }

    // 搜索主题
    if (room.topic && room.topic.toLowerCase().includes(searchTerm.toLowerCase())) {
      return true;
    }

    // 搜索别名
    const aliases = room.getAliases();
    if (aliases.some(alias => alias.includes(searchTerm))) {
      return true;
    }

    return false;
  });
}

// 使用
const matchingRooms = searchJoinedRooms(client, "matrix");
console.log("Matching rooms:", matchingRooms.map(r => r.name));
```

### 获取房间目录

```typescript
// 获取房间目录（如果服务器支持）
try {
  const rooms = await client.getRoomDirectory();

  console.log("Room directory:");
  rooms.forEach(room => {
    console.log(`  - ${room.name} (${room.room_id})`);
  });
} catch (error) {
  console.error("Room directory not available:", error);
}
```

## 搜索历史

### 保存搜索历史

```typescript
class SearchHistory {
  private history: Array<{
    query: string;
    timestamp: number;
    results: number;
  }> = [];

  constructor(private maxItems = 50) {
    this.load();
  }

  add(query: string, resultCount: number) {
    // 移除重复项
    this.history = this.history.filter(h => h.query !== query);

    // 添加到开头
    this.history.unshift({
      query,
      timestamp: Date.now(),
      results: resultCount
    });

    // 限制数量
    if (this.history.length > this.maxItems) {
      this.history = this.history.slice(0, this.maxItems);
    }

    this.save();
  }

  getRecent(limit = 10): Array<{ query: string; results: number }> {
    return this.history.slice(0, limit).map(h => ({
      query: h.query,
      results: h.results
    }));
  }

  clear() {
    this.history = [];
    this.save();
  }

  private save() {
    localStorage.setItem("search_history", JSON.stringify(this.history));
  }

  private load() {
    const stored = localStorage.getItem("search_history");
    if (stored) {
      this.history = JSON.parse(stored);
    }
  }
}

// 使用
const searchHistory = new SearchHistory();

// 执行搜索后
const results = await client.searchRoomMessages({
  search_term: "hello"
});

searchHistory.add("hello", results.results.length);

// 获取最近搜索
const recent = searchHistory.getRecent();
console.log("Recent searches:", recent);
```

### 搜索建议

```typescript
// 搜索建议功能
class SearchSuggestions {
  private suggestions: Set<string> = new Set();

  async loadFromHistory(client: sdk.MatrixClient) {
    // 从搜索历史加载
    const history = new SearchHistory();
    const recent = history.getRecent(50);

    recent.forEach(h => this.suggestions.add(h.query));

    // 从房间名加载
    const rooms = client.getRooms();
    rooms.forEach(room => {
      if (room.name) {
        const words = room.name.split(/\s+/);
        words.forEach(word => this.suggestions.add(word));
      }
    });

    // 从成员名加载
    rooms.forEach(room => {
      const members = room.getJoinedMembers();
      members.forEach(member => {
        if (member.displayName) {
          const words = member.displayName.split(/\s+/);
          words.forEach(word => this.suggestions.add(word));
        }
      });
    });
  }

  getSuggestions(prefix: string, limit = 10): string[] {
    const lowerPrefix = prefix.toLowerCase();

    return Array.from(this.suggestions)
      .filter(s => s.toLowerCase().startsWith(lowerPrefix))
      .slice(0, limit);
  }
}

// 使用
const suggestions = new SearchSuggestions();
await suggestions.loadFromHistory(client);

const userTyped = "mat";  // 用户输入
const matches = suggestions.getSuggestions(userTyped);
console.log("Suggestions:", matches);
// ["matrix", "math", "material", ...]
```

## 完整示例

### 完整的搜索管理器

```typescript
import * as sdk from "matrix-js-sdk";

interface SearchResult {
  roomId: string;
  roomName: string;
  eventId: string;
  sender: string;
  body: string;
  timestamp: number;
  rank?: number;
  highlights?: string[];
}

class SearchManager {
  private history = new SearchHistory();

  constructor(private client: sdk.MatrixClient) {}

  // 搜索消息
  async searchMessages(
    searchTerm: string,
    options?: {
      roomId?: string;
      limit?: number;
      includeContext?: boolean;
    }
  ): Promise<SearchResult[]> {
    const searchResults = await this.client.searchRoomMessages({
      search_term: searchTerm,
      room_id: options?.roomId,
      limit: options?.limit || 50,
      include_context: options?.includeContext ? true : undefined,
      context_before: options?.includeContext ? 1 : undefined,
      context_after: options?.includeContext ? 1 : undefined
    });

    // 保存到历史
    this.history.add(searchTerm, searchResults.results.length);

    // 转换结果
    return searchResults.results.map(result => {
      const event = result.result;
      const roomId = result.room_id;
      const room = this.client.getRoom(roomId);

      return {
        roomId,
        roomName: room?.name || roomId,
        eventId: event.getId()!,
        sender: event.getSender()!,
        body: event.getContent().body || "",
        timestamp: event.getTs(),
        rank: result.rank,
        highlights: result.highlights
      };
    });
  }

  // 搜索用户
  async searchUsers(searchTerm: string, limit = 20): Promise<Array<{
    userId: string;
    displayName?: string;
    avatarUrl?: string;
  }>> {
    const searchResults = await this.client.searchUserDirectory({
      search_term: searchTerm,
      limit
    });

    return searchResults.results.map(user => ({
      userId: user.user_id,
      displayName: user.display_name,
      avatarUrl: user.avatar_url
    }));
  }

  // 搜索房间
  async searchRooms(
    searchTerm: string,
    limit = 20
  ): Promise<Array<{
    roomId: string;
    name: string;
    topic?: string;
    members: number;
    alias?: string;
  }>> {
    const publicRooms = await this.client.publicRooms({
      limit,
      filter: {
        generic_search_term: searchTerm
      }
    });

    return publicRooms.chunk.map(room => ({
      roomId: room.room_id,
      name: room.name || room.room_id,
      topic: room.topic,
      members: room.num_joined_members,
      alias: room.canonical_alias
    }));
  }

  // 搜索已加入的房间
  searchJoinedRooms(searchTerm: string): sdk.Room[] {
    const rooms = this.client.getRooms();
    const lowerTerm = searchTerm.toLowerCase();

    return rooms.filter(room => {
      if (room.name?.toLowerCase().includes(lowerTerm)) return true;
      if (room.topic?.toLowerCase().includes(lowerTerm)) return true;

      const aliases = room.getAliases();
      if (aliases.some(a => a.toLowerCase().includes(lowerTerm))) return true;

      return false;
    });
  }

  // 获取搜索历史
  getSearchHistory(limit = 10): Array<{ query: string; results: number }> {
    return this.history.getRecent(limit);
  }

  // 清除搜索历史
  clearHistory() {
    this.history.clear();
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

  const searchManager = new SearchManager(client);

  // 搜索消息
  const messages = await searchManager.searchMessages("matrix sdk", {
    roomId: undefined,  // 所有房间
    limit: 20,
    includeContext: true
  });

  console.log("Found messages:", messages.length);
  messages.forEach(msg => {
    console.log(`[${msg.roomName}] ${msg.sender}: ${msg.body}`);
  });

  // 搜索用户
  const users = await searchManager.searchUsers("john");
  console.log("Found users:", users.map(u => u.displayName || u.userId));

  // 搜索房间
  const rooms = await searchManager.searchRooms("matrix");
  console.log("Found rooms:", rooms.map(r => r.name));

  // 搜索已加入的房间
  const joinedRooms = searchManager.searchJoinedRooms("test");
  console.log("Matching rooms:", joinedRooms.map(r => r.name));

  // 获取搜索历史
  const history = searchManager.getSearchHistory();
  console.log("Recent searches:", history);
}

example();
```

### 搜索 UI 组件

```typescript
// 搜索 UI 组件
class SearchUI {
  private searchManager: SearchManager;
  private suggestions: SearchSuggestions;

  constructor(
    client: sdk.MatrixClient,
    private inputElement: HTMLInputElement,
    private resultsElement: HTMLElement
  ) {
    this.searchManager = new SearchManager(client);
    this.suggestions = new SearchSuggestions();
    this.setup();
  }

  private async setup() {
    await this.suggestions.loadFromHistory(this.client);

    // 输入事件
    this.inputElement.addEventListener("input", async () => {
      const query = this.inputElement.value.trim();

      if (query.length < 2) {
        this.showSuggestions([]);
        return;
      }

      const matches = this.suggestions.getSuggestions(query, 5);
      this.showSuggestions(matches);
    });

    // 选择建议
    this.inputElement.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        this.performSearch();
      }
    });
  }

  private async performSearch() {
    const query = this.inputElement.value.trim();
    if (!query) return;

    this.showLoading();

    try {
      const results = await this.searchManager.searchMessages(query, {
        limit: 20,
        includeContext: true
      });

      this.showResults(results);
    } catch (error) {
      this.showError(error as Error);
    }
  }

  private showSuggestions(suggestions: string[]) {
    // 实现建议显示逻辑
    console.log("Suggestions:", suggestions);
  }

  private showResults(results: SearchResult[]) {
    this.resultsElement.innerHTML = "";

    results.forEach(result => {
      const div = document.createElement("div");
      div.className = "search-result";

      div.innerHTML = `
        <div class="room">${result.roomName}</div>
        <div class="message">
          <span class="sender">${result.sender}</span>
          <span class="body">${this.highlightText(result.body)}</span>
        </div>
        <div class="time">${new Date(result.timestamp).toLocaleString()}</div>
      `;

      div.addEventListener("click", () => {
        this.openResult(result);
      });

      this.resultsElement.appendChild(div);
    });
  }

  private highlightText(text: string): string {
    const query = this.inputElement.value.trim();
    const regex = new RegExp(`(${query})`, "gi");
    return text.replace(regex, "<mark>$1</mark>");
  }

  private openResult(result: SearchResult) {
    // 实现打开结果逻辑
    console.log("Open result:", result);
  }

  private showLoading() {
    this.resultsElement.innerHTML = "<div class='loading'>Searching...</div>";
  }

  private showError(error: Error) {
    this.resultsElement.innerHTML = `<div class='error'>${error.message}</div>`;
  }
}
```

