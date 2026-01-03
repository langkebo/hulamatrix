# 移动端框架迁移测试计划

**日期**: 2026-01-03
**项目**: HuLamatrix
**版本**: v3.0.5
**目标**: 确保移动端从 Naive UI 迁移到 Vant 的质量和稳定性

---

## 📋 测试策略

### 测试原则

1. **分阶段测试**: 每个迁移阶段完成后进行测试
2. **回归测试**: 确保现有功能不受影响
3. **自动化测试**: 使用 Vitest 进行单元测试
4. **手动测试**: 关键功能进行手动验证
5. **用户验收**: 最终阶段进行用户体验测试

### 测试覆盖范围

- ✅ **组件功能测试**: 验证迁移后组件功能正常
- ✅ **UI/UX 测试**: 验证移动端视觉效果和交互体验
- ✅ **兼容性测试**: 验证在不同设备和浏览器的兼容性
- ✅ **性能测试**: 验证迁移后的性能表现
- ✅ **回归测试**: 验证现有功能不受影响

---

## 🧪 测试用例

### 1. 适配层函数测试

#### 测试文件: `src/utils/__tests__/vant-adapter.spec.ts`

```typescript
import { describe, it, expect, vi } from 'vitest'
import { useMessage, useDialog, useNotification } from '../vant-adapter'

describe('Vant Adapter - useMessage', () => {
  it('should show success message', () => {
    const message = useMessage()
    expect(() => message.success('操作成功')).not.toThrow()
  })

  it('should show error message', () => {
    const message = useMessage()
    expect(() => message.error('操作失败')).not.toThrow()
  })

  it('should show warning message', () => {
    const message = useMessage()
    expect(() => message.warning('警告信息')).not.toThrow()
  })

  it('should show info message', () => {
    const message = useMessage()
    expect(() => message.info('提示信息')).not.toThrow()
  })

  it('should show loading message', () => {
    const message = useMessage()
    expect(() => message.loading('加载中...')).not.toThrow()
  })

  it('should destroy all messages', () => {
    const message = useMessage()
    expect(() => message.destroyAll()).not.toThrow()
  })
})

describe('Vant Adapter - useDialog', () => {
  it('should show info dialog', () => {
    const dialog = useDialog()
    expect(() => dialog.info({
      content: '提示信息'
    })).not.toThrow()
  })

  it('should show confirm dialog with callbacks', async () => {
    const dialog = useDialog()
    const onConfirm = vi.fn()
    const onCancel = vi.fn()

    expect(() => dialog.confirm({
      content: '确定要执行此操作吗？',
      onConfirm,
      onCancel
    })).not.toThrow()
  })
})

describe('Vant Adapter - useNotification', () => {
  it('should show success notification', () => {
    const notification = useNotification()
    expect(() => notification.success('成功', '操作已成功完成')).not.toThrow()
  })

  it('should show error notification', () => {
    const notification = useNotification()
    expect(() => notification.error('错误', '操作失败')).not.toThrow()
  })
})
```

### 2. 组件迁移测试

#### 测试清单

| 组件类型 | 测试要点 | 测试方法 |
|---------|---------|---------|
| **按钮** | 点击响应、禁用状态、加载状态 | 手动测试 |
| **图标** | 显示正确、大小适配 | 视觉检查 |
| **弹窗** | 打开/关闭、位置、遮罩 | 手动测试 |
| **输入框** | 输入、验证、清除 | 单元测试 |
| **开关** | 切换状态、事件触发 | 单元测试 |
| **加载** | 显示、隐藏、大小 | 视觉检查 |
| **通知** | 显示、消失、类型 | 手动测试 |
| **选择器** | 选项显示、选择事件 | 手动测试 |
| **滑块** | 拖动、值变化 | 单元测试 |
| **标签页** | 切换、内容显示 | 手动测试 |
| **折叠面板** | 展开/收起 | 手动测试 |
| **标签** | 不同类型显示 | 视觉检查 |
| **头像** | 图片加载、圆角 | 视觉检查 |

### 3. 功能模块测试

#### E2EE 模块测试

**测试文件**: `src/mobile/components/e2ee/__tests__/migration.spec.ts`

```typescript
describe('E2EE Components Migration', () => {
  describe('MobileDeviceList', () => {
    it('should display device list correctly', () => {
      // 测试设备列表显示
    })

    it('should handle device verification', () => {
      // 测试设备验证功能
    })
  })

  describe('MobileDeviceVerificationDialog', () => {
    it('should show verification dialog', () => {
      // 测试验证对话框显示
    })

    it('should handle verification flow', () => {
      // 测试验证流程
    })
  })
})
```

#### Space 权限模块测试

**测试文件**: `src/mobile/components/spaces/__tests__/permissions.spec.ts`

```typescript
describe('Space Permissions Components Migration', () => {
  describe('UserPermissions', () => {
    it('should display user permissions correctly', () => {
      // 测试用户权限显示
    })

    it('should handle permission changes', () => {
      // 测试权限变更
    })
  })

  describe('DefaultPermissions', () => {
    it('should display default permissions', () => {
      // 测试默认权限显示
    })
  })
})
```

#### 消息模块测试

**测试文件**: `src/mobile/components/message/__tests__/migration.spec.ts`

```typescript
describe('Message Components Migration', () => {
  describe('MobileMessageEditDialog', () => {
    it('should open and close correctly', () => {
      // 测试编辑对话框
    })

    it('should handle message editing', () => {
      // 测试消息编辑功能
    })
  })
})
```

---

## 📱 手动测试清单

### 移动端测试设备

- [ ] iPhone (iOS 14+)
- [ ] Android (Android 8+)
- [ ] iPad (平板)
- [ ] Android Tablet

### 浏览器测试

- [ ] Safari (iOS)
- [ ] Chrome (Android)
- [ ] 微信内置浏览器
- [ ] 其他移动浏览器

### 功能测试清单

#### 1. E2EE 功能

- [ ] 设备列表显示
- [ ] 设备验证流程
- [ ] 设备阻止功能
- [ ] 加密状态显示
- [ ] 密钥备份功能

#### 2. Space 权限功能

- [ ] 权限列表显示
- [ ] 权限设置功能
- [ ] 默认权限配置
- [ ] 事件权限配置
- [ ] 房间权限配置

#### 3. 消息功能

- [ ] 消息编辑
- [ ] 消息回复
- [ ] 消息反应
- [ ] 临时会话
- [ ] 消息自毁

#### 4. 设置功能

- [ ] 设置项显示
- [ ] 开关切换
- [ ] 输入框输入
- [ ] 选择器选择

---

## 🔄 回归测试清单

### 核心功能

- [ ] 用户登录/登出
- [ ] 消息发送/接收
- [ ] 房间列表显示
- [ ] 联系人列表
- [ ] 搜索功能

### UI 交互

- [ ] 导航切换
- [ ] 弹窗显示/关闭
- [ ] 滚动性能
- [ ] 触摸响应
- [ ] 手势操作

### 性能指标

- [ ] 首屏加载时间 < 2s
- [ ] 页面切换流畅
- [ ] 内存使用正常
- [ ] 无内存泄漏
- [ ] 包体积减少

---

## ⚠️ 风险测试

### 已知风险点

1. **组件 API 差异**
   - 测试点: 确保适配层函数正确调用 Vant API
   - 测试方法: 单元测试 + 手动验证

2. **样式差异**
   - 测试点: 确保 Vant 组件样式与原 Naive UI 一致
   - 测试方法: 视觉对比 + 截图测试

3. **事件处理差异**
   - 测试点: 确保事件处理函数正确触发
   - 测试方法: 功能测试 + 事件日志

4. **性能差异**
   - 测试点: 确保迁移后性能不下降
   - 测试方法: 性能测试 + 对比基准

### 回滚计划

如果发现严重问题，执行回滚：

1. **立即停止迁移**: 暂停后续组件迁移
2. **评估问题**: 分析问题严重性和影响范围
3. **决定回滚**:
   - 如果问题严重，回滚已迁移的组件
   - 如果问题可控，修复后继续
4. **更新文档**: 记录问题和解决方案

---

## 📊 测试报告模板

### 测试执行记录

```markdown
## 迁移阶段测试报告

**阶段**: 第 X 阶段
**日期**: YYYY-MM-DD
**测试人员**: XXX

### 测试概况

| 测试项 | 通过 | 失败 | 阻塞 | 总计 |
|--------|------|------|------|------|
| 单元测试 |  |  |  |  |
| 功能测试 |  |  |  |  |
| UI 测试 |  |  |  |  |
| 性能测试 |  |  |  |  |
| **总计** |  |  |  |  |

### 失败用例

| 用例ID | 描述 | 严重程度 | 状态 | 备注 |
|--------|------|----------|------|------|
| TC001 | ... | 高/中/低 | ... | ... |

### 问题和风险

| ID | 问题描述 | 影响 | 解决方案 | 状态 |
|----|---------|------|----------|------|
| ... | ... | ... | ... | ... |

### 测试结论

- [ ] 通过，可以进入下一阶段
- [ ] 不通过，需要修复后重新测试

### 备注

...
```

---

## ✅ 测试完成标准

### 阶段完成标准

每个迁移阶段必须满足以下条件才能进入下一阶段：

1. ✅ 所有单元测试通过（100%）
2. ✅ 所有功能测试通过（100%）
3. ✅ 无高优先级 Bug
4. ✅ 中优先级 Bug < 3 个
5. ✅ 性能测试通过（无性能下降）
6. ✅ 代码审查通过
7. ✅ 文档更新完成

### 最终完成标准

整个迁移工作完成的标准：

1. ✅ 所有 5 个阶段测试通过
2. ✅ Naive UI 依赖完全移除
3. ✅ 包体积减少 > 400KB
4. ✅ 无回归 Bug
5. ✅ 用户验收测试通过
6. ✅ 文档完整更新
7. ✅ 代码质量检查通过

---

## 📚 相关文档

- [移动端框架统一评估报告](./MOBILE_FRAMEWORK_UNIFICATION_EVALUATION.md)
- [迁移实施计划](./MOBILE_FRAMEWORK_MIGRATION_PLAN.md) (待创建)
- [组件迁移指南](./MOBILE_COMPONENT_MIGRATION_GUIDE.md) (待创建)

---

**文档创建时间**: 2026-01-03
**最后更新**: 2026-01-03
**版本**: v1.0
