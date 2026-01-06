# Matrix SDK - 投票功能 (Polls)

**文档版本**: 1.0.0
**SDK 版本**: 23.0.0+
**最后更新**: 2026-01-04
**相关规范**: [MSC 3381 - Polls](https://github.com/matrix-org/matrix-spec-proposals/pull/3381), [MSC 2677 - Extensible Events](https://github.com/matrix-org/matrix-spec-proposals/pull/2677)

---

## 概述

Matrix SDK 支持**投票（Polls）**功能，基于可扩展事件（Extensible Events）框架实现。

投票事件类型：

| 事件类型 | 描述 |
|---------|------|
| `m.poll.start` | 开始投票（定义问题和选项） |
| `m.poll.response` | 响应投票（选择答案） |
| `m.poll.end` | 结束投票 |

---

## 创建投票

### 发送投票开始事件

```typescript
import * as sdk from "matrix-js-sdk";

const client = sdk.createClient({ ... });
const roomId = "!roomId:server.com";

// 创建投票
await client.sendEvent(roomId, "m.poll.start", {
    // MSC3381 投票开始事件
    "m.poll.start": {
        question: {
            body: "What's your favorite programming language?",
            format: "org.matrix.custom.html",
            formatted_body: "What's your <b>favorite</b> programming language?",
        },
        kind: "m.poll.disclosed", // disclosed: 公开结果 | undisclosed: 隐藏结果
        max_selections: 1, // 最多选择几项
        answers: [
            {
                id: "option_1",
                "m.canvas": [{ body: "JavaScript", type: "text" }],
            },
            {
                id: "option_2",
                "m.canvas": [{ body: "Python", type: "text" }],
            },
            {
                id: "option_3",
                "m.canvas": [{ body: "TypeScript", type: "text" }],
            },
            {
                id: "option_4",
                "m.canvas": [{ body: "Rust", type: "text" }],
            },
        ],
        fallback_text: "Poll: What's your favorite programming language?",
    },
    // 可扩展事件包装
    "m.message": [
        {
            body: "Poll: What's your favorite programming language?",
            msgtype: "m.text",
        },
    ],
});
```

### 多选投票

```typescript
// 允许多选
await client.sendEvent(roomId, "m.poll.start", {
    "m.poll.start": {
        question: {
            body: "Which features do you want?",
        },
        kind: "m.poll.disclosed",
        max_selections: 3, // 最多选 3 项
        answers: [
            { id: "opt_1", "m.canvas": [{ body: "Dark Mode", type: "text" }] },
            { id: "opt_2", "m.canvas": [{ body: "Notifications", type: "text" }] },
            { id: "opt_3", "m.canvas": [{ body: "Auto-save", type: "text" }] },
            { id: "opt_4", "m.canvas": [{ body: "Offline Mode", type: "text" }] },
            { id: "opt_5", "m.canvas": [{ body: "Themes", type: "text" }] },
        ],
        fallback_text: "Poll: Which features do you want?",
    },
    "m.message": [
        { body: "Poll: Which features do you want?", msgtype: "m.text" },
    ],
});
```

### 隐藏结果投票

```typescript
// 投票结果对其他用户隐藏（直到投票结束）
await client.sendEvent(roomId, "m.poll.start", {
    "m.poll.start": {
        question: {
            body: "Who should be the team lead?",
        },
        kind: "m.poll.undisclosed", // 隐藏结果
        max_selections: 1,
        answers: [
            { id: "opt_1", "m.canvas": [{ body: "Alice", type: "text" }] },
            { id: "opt_2", "m.canvas": [{ body: "Bob", type: "text" }] },
            { id: "opt_3", "m.canvas": [{ body: "Charlie", type: "text" }] },
        ],
        fallback_text: "Poll: Who should be the team lead?",
    },
    "m.message": [
        { body: "Poll: Who should be the team lead?", msgtype: "m.text" },
    ],
});
```

---

## 响应投票

### 发送投票响应

```typescript
// 用户选择答案
const pollStartEventId = "$event_id";
const selectedAnswerIds = ["option_2"]; // 选择 "Python"

await client.sendEvent(roomId, "m.poll.response", {
    "m.poll.response": {
        // 引用原始投票事件
        "m.relates_to": {
            rel_type: "m.reference",
            event_id: pollStartEventId,
        },
        answers: selectedAnswerIds, // 选中的答案 ID 列表
    },
    "m.message": [
        {
            body: "I voted for Python",
            msgtype: "m.text",
        },
    ],
});
```

### 多选响应

```typescript
// 多选投票的响应
await client.sendEvent(roomId, "m.poll.response", {
    "m.poll.response": {
        "m.relates_to": {
            rel_type: "m.reference",
            event_id: pollStartEventId,
        },
        answers: ["opt_1", "opt_3", "opt_5"], // 选择多项
    },
    "m.message": [
        { body: "I selected: Dark Mode, Auto-save, Themes", msgtype: "m.text" },
    ],
});
```

---

## 结束投票

### 结束并公布结果

```typescript
await client.sendEvent(roomId, "m.poll.end", {
    "m.poll.end": {
        // 引用原始投票事件
        "m.relates_to": {
            rel_type: "m.reference",
            event_id: pollStartEventId,
        },
        // 投票结果（由服务器/客户端汇总）
        results: {
            "option_1": 5, // JavaScript: 5 票
            "option_2": 8, // Python: 8 票
            "option_3": 6, // TypeScript: 6 票
            "option_4": 3, // Rust: 3 票
        },
        // 总票数
        total: 22,
        // 投票用户列表
        users: {
            "option_1": ["@user1:server.com", "@user2:server.com"],
            "option_2": ["@user3:server.com", "@user4:server.com"],
            // ...
        },
    },
    "m.message": [
        {
            body: "Poll ended: Python won with 8 votes!",
            msgtype: "m.text",
        },
    ],
});
```

### 提前结束投票

```typescript
// 投票创建者可以随时结束投票
await client.sendEvent(roomId, "m.poll.end", {
    "m.poll.end": {
        "m.relates_to": {
            rel_type: "m.reference",
            event_id: pollStartEventId,
        },
        // 可以添加结束原因
        text: "Poll ended by creator",
    },
    "m.message": [
        { body: "Poll ended early", msgtype: "m.text" },
    ],
});
```

---

## 完整示例：投票管理器

```typescript
import * as sdk from "matrix-js-sdk";

interface PollAnswer {
    id: string;
    text: string;
}

interface PollStart {
    question: string;
    kind: "m.poll.disclosed" | "m.poll.undisclosed";
    maxSelections: number;
    answers: PollAnswer[];
    eventId: string;
}

class PollManager {
    constructor(private client: sdk.MatrixClient) {}

    /**
     * 创建投票
     */
    async createPoll(
        roomId: string,
        question: string,
        answers: string[],
        options: {
            maxSelections?: number;
            disclosed?: boolean; // true: 公开结果, false: 隐藏结果
        } = {}
    ): Promise<string> {
        const { maxSelections = 1, disclosed = true } = options;

        const response = await this.client.sendEvent(roomId, "m.poll.start", {
            "m.poll.start": {
                question: { body: question },
                kind: disclosed ? "m.poll.disclosed" "m.poll.undisclosed",
                max_selections: maxSelections,
                answers: answers.map((text, index) => ({
                    id: `option_${index}`,
                    "m.canvas": [{ body: text, type: "text" }],
                })),
                fallback_text: `Poll: ${question}`,
            },
            "m.message": [
                { body: `Poll: ${question}`, msgtype: "m.text" },
            ],
        });

        return response.event_id;
    }

    /**
     * 响应投票
     */
    async respondToPoll(
        roomId: string,
        pollEventId: string,
        selectedAnswers: string[]
    ): Promise<void> {
        await this.client.sendEvent(roomId, "m.poll.response", {
            "m.poll.response": {
                "m.relates_to": {
                    rel_type: "m.reference",
                    event_id: pollEventId,
                },
                answers: selectedAnswers,
            },
            "m.message": [
                {
                    body: `I voted for ${selectedAnswers.length} option(s)`,
                    msgtype: "m.text",
                },
            ],
        });
    }

    /**
     * 结束投票
     */
    async endPoll(
        roomId: string,
        pollEventId: string,
        results?: Record<string, number>
    ): Promise<void> {
        const content: any = {
            "m.poll.end": {
                "m.relates_to": {
                    rel_type: "m.reference",
                    event_id: pollEventId,
                },
            },
            "m.message": [
                { body: "Poll ended", msgtype: "m.text" },
            ],
        };

        if (results) {
            content["m.poll.end"].results = results;
            content["m.poll.end"].total = Object.values(results).reduce(
                (sum, count) => sum + count,
                0
            );
        }

        await this.client.sendEvent(roomId, "m.poll.end", content);
    }

    /**
     * 获取房间的所有投票
     */
    getPolls(roomId: string): PollStart[] {
        const room = this.client.getRoom(roomId);
        if (!room) return [];

        const timeline = room.getLiveTimeline();
        const events = timeline.getEvents();

        const pollStartEvents = events.filter(
            (e) => e.getType() === "m.poll.start"
        );

        return pollStartEvents.map((event) => {
            const content = event.getContent();
            const pollData = content["m.poll.start"];

            return {
                question: pollData.question.body,
                kind: pollData.kind,
                maxSelections: pollData.max_selections,
                answers: pollData.answers.map((a: any) => ({
                    id: a.id,
                    text: a["m.canvas"][0].body,
                })),
                eventId: event.getId()!,
            };
        });
    }

    /**
     * 统计投票结果
     */
    getPollResults(roomId: string, pollEventId: string): {
        results: Record<string, number>;
        totalVotes: number;
        votesByUser: Record<string, string>;
    } {
        const room = this.client.getRoom(roomId);
        if (!room) {
            return { results: {}, totalVotes: 0, votesByUser: {} };
        }

        // 获取投票的选项
        const pollEvent = room.findEventById(pollEventId);
        const pollData = pollEvent?.getContent()["m.poll.start"];
        if (!pollData) {
            return { results: {}, totalVotes: 0, votesByUser: {} };
        }

        // 初始化结果
        const results: Record<string, number> = {};
        pollData.answers.forEach((a: any) => {
            results[a.id] = 0;
        });

        // 获取所有响应
        const timeline = room.getLiveTimeline();
        const events = timeline.getEvents();

        const responseEvents = events.filter((e) => {
            if (e.getType() !== "m.poll.response") return false;
            const relatesTo = e.getContent()["m.poll.response"]?.["m.relates_to"];
            return relatesTo?.event_id === pollEventId;
        });

        // 统计结果
        const votesByUser: Record<string, string> = {};
        responseEvents.forEach((event) => {
            const sender = event.getSender()!;
            const answers = event.getContent()["m.poll.response"]?.answers || [];

            // 记录每个用户的投票
            if (answers.length > 0) {
                votesByUser[sender] = answers[0];
            }

            // 累计结果
            answers.forEach((answerId: string) => {
                if (results[answerId] !== undefined) {
                    results[answerId]++;
                }
            });
        });

        const totalVotes = Object.keys(votesByUser).length;

        return {
            results,
            totalVotes,
            votesByUser,
        };
    }

    /**
     * 获取当前用户的投票
     */
    getUserVote(roomId: string, pollEventId: string): string[] | null {
        const room = this.client.getRoom(roomId);
        if (!room) return null;

        const userId = this.client.getUserId()!;
        const timeline = room.getLiveTimeline();
        const events = timeline.getEvents();

        const userResponse = events.find((e) => {
            if (e.getType() !== "m.poll.response") return false;
            if (e.getSender() !== userId) return false;
            const relatesTo = e.getContent()["m.poll.response"]?.["m.relates_to"];
            return relatesTo?.event_id === pollEventId;
        });

        return userResponse?.getContent()["m.poll.response"]?.answers || null;
    }
}

// 使用示例
const client = sdk.createClient({ ... });
const pollManager = new PollManager(client);

// 创建投票
const pollId = await pollManager.createPoll(
    "!roomId:server.com",
    "What's your favorite color?",
    ["Red", "Blue", "Green", "Yellow"],
    { maxSelections: 1, disclosed: true }
);

// 响应投票
await pollManager.respondToPoll("!roomId:server.com", pollId, ["option_1"]);

// 获取结果
const results = pollManager.getPollResults("!roomId:server.com", pollId);
console.log("投票结果:", results);
// {
//   results: { option_1: 5, option_2: 8, option_3: 3, option_4: 2 },
//   totalVotes: 18,
//   votesByUser: { "@user1:server.com": "option_1", ... }
// }

// 结束投票
await pollManager.endPoll("!roomId:server.com", pollId, results.results);
```

---

## 监听投票事件

### 监听新投票

```typescript
client.on(sdk.RoomEvent.Timeline, (event, room) => {
    if (event.getType() === "m.poll.start") {
        const content = event.getContent();
        const pollData = content["m.poll.start"];

        console.log("新投票:", pollData.question.body);
        console.log("选项:", pollData.answers);
    }
});
```

### 监听投票响应

```typescript
client.on(sdk.RoomEvent.Timeline, (event, room) => {
    if (event.getType() === "m.poll.response") {
        const content = event.getContent();
        const responseData = content["m.poll.response"];

        console.log("用户投票:", {
            user: event.getSender(),
            answers: responseData.answers,
            pollEventId: responseData["m.relates_to"].event_id,
        });
    }
});
```

### 监听投票结束

```typescript
client.on(sdk.RoomEvent.Timeline, (event, room) => {
    if (event.getType() === "m.poll.end") {
        const content = event.getContent();
        const endData = content["m.poll.end"];

        console.log("投票已结束:", {
            pollEventId: endData["m.relates_to"].event_id,
            results: endData.results,
            total: endData.total,
        });
    }
});
```

---

## UI 组件示例

### 投票显示组件

```typescript
import { h } from "vue";

const PollComponent = {
    props: ["poll", "results", "userVote"],
    setup(props: any) {
        const totalVotes = props.results?.totalVotes || 0;

        return () => (
            <div class="poll">
                <h3>{props.poll.question}</h3>
                <div class="poll-options">
                    {props.poll.answers.map((answer: PollAnswer) => {
                        const votes = props.results?.results[answer.id] || 0;
                        const percentage = totalVotes > 0
                            ? (votes / totalVotes) * 100
                            : 0;
                        const isSelected = props.userVote?.includes(answer.id);

                        return (
                            <div
                                class={[
                                    "poll-option",
                                    { selected: isSelected },
                                ]}
                                key={answer.id}
                            >
                                <div class="option-text">{answer.text}</div>
                                <div class="option-bar">
                                    <div
                                        class="option-fill"
                                        style={{ width: `${percentage}%` }}
                                    />
                                </div>
                                <div class="option-stats">
                                    {votes} 票 ({percentage.toFixed(1)}%)
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div class="poll-total">总票数: {totalVotes}</div>
            </div>
        );
    },
};
```

---

## 相关文档

- [04-messaging.md](./04-messaging.md) - 消息功能
- [05-events-handling.md](./05-events-handling.md) - 事件处理
- [MSC 3381 - Polls](https://github.com/matrix-org/matrix-spec-proposals/pull/3381)
- [MSC 2677 - Extensible Events](https://github.com/matrix-org/matrix-spec-proposals/pull/2677)

---

**文档维护**: 如有更新，请同步修改 Matrix SDK 版本号和最后更新日期。
