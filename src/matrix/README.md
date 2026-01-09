# Matrix Services Module

统一的 Matrix 服务架构，提供对 Matrix SDK 的封装和高级业务逻辑。

## 目录结构

```
src/matrix/
├── core/          # 核心 SDK 封装（低级）
├── services/      # 业务服务层（高级）
└── types/         # 共享类型
```

## 迁移状态

详见 [MIGRATION.md](../../docs/MATRIX_MIGRATION.md)

## 使用方法

### 核心 Client

```typescript
import { matrixClientService } from '@/matrix/core/client'
```

### 服务层

```typescript
// 房间管理
import { matrixRoomManager } from '@/matrix/services/room'

// 消息处理
import { matrixEventHandler } from '@/matrix/services/message'

// 媒体服务
import { uploadContent } from '@/matrix/services/media'
```

## 开发说明

- 所有 Matrix 相关功能统一迁移到 `src/matrix/` 目录
- 旧的 `src/integrations/matrix/` 和 `src/services/matrix*.ts` 将逐步废弃
- 迁移期间保持向后兼容性（旧路径仍可使用）
