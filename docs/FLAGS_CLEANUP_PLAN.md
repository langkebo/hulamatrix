# Flags 清理方案

**创建日期**: 2026-01-08
**目的**: 移除所有 `flags.matrixEnabled` 检查，因为项目已完全迁移到 Matrix
**状态**: 执行中

---

## 背景

项目已完全迁移到 Matrix 服务器，不再需要 `flags.matrixEnabled` 功能开关。所有检查都应该简化为 `true`。

---

## 执行摘要

| 文件数 | 检查数量 | 当前状态 |
|--------|---------|---------|
| 23 | 59+ | 清理中 |

---

## 待清理文件清单

### 高优先级文件（核心功能）

1. **src/App.vue** - 应用启动和同步状态检查
2. **src/main.ts** ✅ - 已清理
3. **src/stores/chat/index.ts** - 聊天存储
4. **src/stores/chat/message-state.ts** - 消息状态

### 中优先级文件（功能模块）

5. **src/composables/useRoomStats.ts** - 房间统计
6. **src/composables/useMessageReactions.ts** - 消息反应
7. **src/hooks/useWebRtc.ts** - WebRTC 功能
8. **src/hooks/useDevConnectivity.ts** - 开发连接状态

### 集成层文件

9. **src/integrations/matrix/notifications.ts** - 通知集成
10. **src/integrations/matrix/rtc.ts** - RTC 集成
11. **src/integrations/matrix/pusher.ts** - 推送集成

### 组件文件

12. **src/components/chat/message-renderer/index.vue** - 消息渲染器
13. **src/components/rtc/CallControls.vue** - 通话控制
14. **src/mobile/views/rooms/Manage.vue** - 移动端房间管理

### 工具文件

15. **src/utils/extended-performance-monitor.ts** - 性能监控

### Store 文件

16. **src/stores/reactions.ts** - 反应存储
17. **src/stores/search.ts** - 搜索存储
18. **src/stores/pushRules.ts** - 推送规则存储

### 视图文件

19. **src/views/e2ee/Devices.vue** - E2EE 设备管理
20. **src/views/moreWindow/settings/Sessions.vue** - 会话设置
21. **src/mobile/views/e2ee/MobileKeyBackup.vue** - 移动端密钥备份
22. **src/mobile/views/e2ee/MobileDevices.vue** - 移动端设备管理

---

## 清理策略

### 策略 1: 简化条件表达式

```typescript
// 清理前
if (flags.matrixEnabled && otherCondition) { }

// 清理后
if (otherCondition) { }
```

### 策略 2: 移除反向检查

```typescript
// 清理前
if (!flags.matrixEnabled) { return }

// 清理后
// 完全移除这段代码，因为 matrixEnabled 始终为 true
```

### 策略 3: 简化嵌套检查

```typescript
// 清理前
if (flags.matrixEnabled && flags.matrixRtcEnabled) { }

// 清理后
if (flags.matrixRtcEnabled) { }
```

### 策略 4: 移除三元运算符

```typescript
// 清理前
const value = flags.matrixEnabled ? matrixValue : otherValue

// 清理后
const value = matrixValue
```

---

## 执行步骤

### 步骤 1: 清理核心文件
- [x] src/main.ts
- [ ] src/App.vue
- [ ] src/stores/chat/index.ts
- [ ] src/stores/chat/message-state.ts

### 步骤 2: 清理功能模块文件
- [ ] src/composables/useRoomStats.ts
- [ ] src/composables/useMessageReactions.ts
- [ ] src/hooks/useWebRtc.ts
- [ ] src/hooks/useDevConnectivity.ts

### 步骤 3: 清理集成层文件
- [ ] src/integrations/matrix/notifications.ts
- [ ] src/integrations/matrix/rtc.ts
- [ ] src/integrations/matrix/pusher.ts

### 步骤 4: 清理组件文件
- [ ] src/components/chat/message-renderer/index.vue
- [ ] src/components/rtc/CallControls.vue
- [ ] src/mobile/views/rooms/Manage.vue

### 步骤 5: 清理 Store 文件
- [ ] src/stores/reactions.ts
- [ ] src/stores/search.ts
- [ ] src/stores/pushRules.ts

### 步骤 6: 清理视图文件
- [ ] src/views/e2ee/Devices.vue
- [ ] src/views/moreWindow/settings/Sessions.vue
- [ ] src/mobile/views/e2ee/MobileKeyBackup.vue
- [ ] src/mobile/views/e2ee/MobileDevices.vue

### 步骤 7: 清理工具文件
- [ ] src/utils/extended-performance-monitor.ts

### 步骤 8: 验证
- [ ] 运行类型检查
- [ ] 运行测试
- [ ] 手动测试核心功能

---

## 注意事项

1. **保留其他功能开关**: 只移除 `flags.matrixEnabled`，保留其他功能开关（如 `flags.matrixRtcEnabled`）
2. **类型安全**: 确保清理后的代码类型正确
3. **功能完整**: 确保清理后功能正常工作
4. **性能**: 清理后应该提升性能（减少条件判断）

---

## 预期结果

- [ ] 所有 `flags.matrixEnabled` 检查已移除
- [ ] 代码更简洁，减少约 100+ 行代码
- [ ] 类型检查通过
- [ ] 功能测试通过
- [ ] 性能略有提升

---

**文档版本**: v1.0
**最后更新**: 2026-01-08
**负责人**: Claude Code
