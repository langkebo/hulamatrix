<template>
  <div class="button-showcase">
    <h2>按钮组件示例 - 使用统一色彩系统</h2>

    <!-- 主要按钮 -->
    <section class="showcase-section">
      <h3>主要按钮</h3>
      <div class="button-group">
        <button class="btn-brand">主要按钮</button>
        <button class="btn-brand" disabled>禁用状态</button>
      </div>
    </section>

    <!-- 次要按钮 -->
    <section class="showcase-section">
      <h3>次要按钮</h3>
      <div class="button-group">
        <button class="btn-brand-outline">轮廓按钮</button>
        <button class="btn-brand-outline" disabled>禁用状态</button>
      </div>
    </section>

    <!-- 幽灵按钮 -->
    <section class="showcase-section">
      <h3>幽灵按钮</h3>
      <div class="button-group">
        <button class="btn-brand-ghost">幽灵按钮</button>
        <button class="btn-brand-ghost" disabled>禁用状态</button>
      </div>
    </section>

    <!-- 功能按钮 -->
    <section class="showcase-section">
      <h3>功能按钮</h3>
      <div class="button-group">
        <button class="btn-success">成功</button>
        <button class="btn-warning">警告</button>
        <button class="btn-error">错误</button>
        <button class="btn-info">信息</button>
      </div>
    </section>

    <!-- 尺寸变体 -->
    <section class="showcase-section">
      <h3>尺寸变体</h3>
      <div class="button-group">
        <button class="btn-brand btn-brand-sm">小按钮</button>
        <button class="btn-brand">默认按钮</button>
        <button class="btn-brand btn-brand-lg">大按钮</button>
      </div>
    </section>

    <!-- 带图标按钮 -->
    <section class="showcase-section">
      <h3>带图标按钮</h3>
      <div class="button-group">
        <button class="btn-brand">
          <Icon icon="mdi:check" class="mr-2" />
          确认
        </button>
        <button class="btn-brand-outline">
          <Icon icon="mdi:close" class="mr-2" />
          取消
        </button>
      </div>
    </section>

    <!-- 图标按钮 -->
    <section class="showcase-section">
      <h3>纯图标按钮（触摸目标优化）</h3>
      <div class="button-group">
        <button class="icon-btn-brand" aria-label="添加">
          <Icon icon="mdi:plus" />
        </button>
        <button class="icon-btn-brand" aria-label="编辑">
          <Icon icon="mdi:pencil" />
        </button>
        <button class="icon-btn-brand" aria-label="删除">
          <Icon icon="mdi:trash-can" />
        </button>
      </div>
    </section>

    <!-- 加载状态 -->
    <section class="showcase-section">
      <h3>加载状态</h3>
      <div class="button-group">
        <button class="btn-brand btn-brand-loading">
          <span class="btn-brand-spinner"></span>
          加载中...
        </button>
        <button class="btn-brand-outline btn-brand-loading">
          <span class="btn-brand-spinner"></span>
          提交中...
        </button>
      </div>
    </section>

    <!-- 链接样式 -->
    <section class="showcase-section">
      <h3>链接样式</h3>
      <div class="button-group">
        <a href="#" class="link-brand">链接样式</a>
        <a href="#" class="link-brand-with-icon">
          <Icon icon="mdi:arrow-right" class="ml-1" />
          带图标的链接
        </a>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
</script>

<style lang="scss" scoped>
.button-showcase {
  padding: 32px;
  max-width: 1200px;
  margin: 0 auto;

  h2 {
    font-size: 32px;
    font-weight: 600;
    margin-bottom: 32px;
    color: var(--hula-text-primary, var(--hula-gray-800, var(--hula-brand-primary)));
  }

  .showcase-section {
    margin-bottom: 40px;

    h3 {
      font-size: 18px;
      font-weight: 500;
      margin-bottom: 16px;
      color: var(--hula-text-secondary, var(--hula-gray-600, var(--hula-brand-primary)));
    }

    .button-group {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      align-items: center;
    }
  }
}

/* 使用统一色彩系统的按钮样式 */
.btn-brand {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 500;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;

  /* 使用统一色彩变量 */
  background: var(--hula-brand-primary, var(--hula-brand-primary));
  color: var(--hula-brand-primary);

  &:hover:not(:disabled) {
    background: var(--hula-brand-hover, var(--hula-brand-primary));
    transform: translateY(-1px);
    box-shadow: var(--hula-shadow-brand, 0 4px 12px rgba(0, 191, 165, 0.3));
  }

  &:active:not(:disabled) {
    background: var(--hula-brand-active, var(--hula-brand-primary));
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }

  /* 尺寸变体 */
  &.btn-brand-sm {
    padding: 6px 12px;
    font-size: 12px;
  }

  &.btn-brand-lg {
    padding: 14px 28px;
    font-size: 16px;
  }

  /* 加载状态 */
  &.btn-brand-loading {
    position: relative;
    color: transparent;

    .btn-brand-spinner {
      position: absolute;
      width: 16px;
      height: 16px;
      border: 2px solid var(--hula-brand-primary);
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }
  }
}

/* 次要按钮（轮廓样式） */
.btn-brand-outline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 500;
  border: 2px solid var(--hula-brand-primary, var(--hula-brand-primary));
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;
  background: transparent;
  color: var(--hula-brand-primary, var(--hula-brand-primary));

  &:hover:not(:disabled) {
    background: var(--hula-brand-primary, var(--hula-brand-primary));
    color: var(--hula-brand-primary);
    transform: translateY(-1px);
    box-shadow: var(--hula-shadow-brand, 0 4px 12px rgba(0, 191, 165, 0.3));
  }

  &:active:not(:disabled) {
    background: var(--hula-brand-active, var(--hula-brand-primary));
    border-color: var(--hula-brand-active, var(--hula-brand-primary));
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* 加载状态 */
  &.btn-brand-loading {
    position: relative;
    color: transparent;

    .btn-brand-spinner {
      position: absolute;
      width: 16px;
      height: 16px;
      border: 2px solid var(--hula-brand-primary, var(--hula-brand-primary));
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }

    &:hover .btn-brand-spinner {
      border-color: var(--hula-brand-primary);
      border-top-color: transparent;
    }
  }
}

/* 幽灵按钮 */
.btn-brand-ghost {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 500;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;
  background: transparent;
  color: var(--hula-brand-primary, var(--hula-brand-primary));

  &:hover:not(:disabled) {
    background: var(--hula-brand-primary, var(--hula-brand-primary));
    color: var(--hula-brand-primary);
  }

  &:active:not(:disabled) {
    background: var(--hula-brand-active, var(--hula-brand-primary));
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

/* 功能按钮 */
.btn-success {
  @extend .btn-brand;
  background: var(--hula-success, var(--hula-brand-primary));

  &:hover:not(:disabled) {
    background: color-mix(in srgb, var(--hula-success, var(--hula-brand-primary)) 90%, black 10%);
    box-shadow: 0 4px 12px rgba(var(--hula-success-rgb, 0, 191, 165), 0.3);
  }
}

.btn-warning {
  @extend .btn-brand;
  background: var(--hula-warning, var(--hula-brand-primary));

  &:hover:not(:disabled) {
    background: color-mix(in srgb, var(--hula-warning, var(--hula-brand-primary)) 90%, black 10%);
    box-shadow: 0 4px 12px rgba(var(--hula-warning-rgb, 255, 184, 77), 0.3);
  }
}

.btn-error {
  @extend .btn-brand;
  background: var(--hula-error, var(--hula-brand-primary));

  &:hover:not(:disabled) {
    background: color-mix(in srgb, var(--hula-error, var(--hula-brand-primary)) 90%, black 10%);
    box-shadow: 0 4px 12px rgba(var(--hula-error-rgb, 255, 107, 107), 0.3);
  }
}

.btn-info {
  @extend .btn-brand;
  background: var(--hula-info, var(--hula-brand-primary));

  &:hover:not(:disabled) {
    background: color-mix(in srgb, var(--hula-info, var(--hula-brand-primary)) 90%, black 10%);
    box-shadow: 0 4px 12px rgba(var(--hula-info-rgb, 74, 144, 226), 0.3);
  }
}

/* 图标按钮（触摸目标优化） */
.icon-btn-brand {
  min-width: 44px;
  min-height: 44px;
  padding: 10px;
  border: none;
  border-radius: 8px;
  background: var(--hula-brand-primary, var(--hula-brand-primary));
  color: var(--hula-brand-primary);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: inline-flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: var(--hula-brand-hover, var(--hula-brand-primary));
    transform: scale(1.1);
  }

  &:active {
    background: var(--hula-brand-active, var(--hula-brand-primary));
    transform: scale(0.95);
  }
}

/* 链接样式 */
.link-brand {
  color: var(--hula-brand-primary, var(--hula-brand-primary));
  text-decoration: none;
  transition: color 0.3s ease;
  font-weight: 500;

  &:hover {
    color: var(--hula-brand-hover, var(--hula-brand-primary));
    text-decoration: underline;
  }

  &:active {
    color: var(--hula-brand-active, var(--hula-brand-primary));
  }
}

.link-brand-with-icon {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  @extend .link-brand;
}

/* 动画 */
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* 无障碍优化 */
button:focus-visible,
a:focus-visible {
  outline: 2px solid var(--hula-brand-primary, var(--hula-brand-primary));
  outline-offset: 2px;
}

/* 减少动画模式 */
@media (prefers-reduced-motion: reduce) {
  button,
  a {
    transition: none;
  }
}

/* 响应式适配 */
@media (max-width: 768px) {
  .button-showcase {
    padding: 16px;
  }

  .showcase-section .button-group {
    flex-direction: column;
    align-items: stretch;

    button,
    a {
      width: 100%;
    }
  }
}
</style>
