<!--
  SafeAreaWrapper - 安全区域包装组件

  用于自动处理移动端安全区域（刘海屏、Home Indicator等）
  支持 iPhone X 及以上机型的安全区域适配

  使用示例:
  <SafeAreaWrapper :top-inset :bottom-inset>
    <div>内容</div>
  </SafeAreaWrapper>
-->
<template>
  <div
    class="safe-area-wrapper"
    :class="{
      'has-top-inset': topInset,
      'has-bottom-inset': bottomInset,
      'no-top-inset': noTopInset,
      'no-bottom-inset': noBottomInset
    }">
    <slot />
  </div>
</template>

<script setup lang="ts">
/**
 * Props 定义
 */
interface Props {
  /** 是否添加顶部安全区域内边距（默认: true） */
  topInset?: boolean
  /** 是否添加底部安全区域内边距（默认: true） */
  bottomInset?: boolean
  /** 强制禁用顶部安全区域（优先级高于 topInset） */
  noTopInset?: boolean
  /** 强制禁用底部安全区域（优先级高于 bottomInset） */
  noBottomInset?: boolean
}

withDefaults(defineProps<Props>(), {
  topInset: true,
  bottomInset: true,
  noTopInset: false,
  noBottomInset: false
})
</script>

<style scoped lang="scss">
.safe-area-wrapper {
  box-sizing: border-box;

  &.has-top-inset {
    padding-top: env(safe-area-inset-top);
  }

  &.has-bottom-inset {
    padding-bottom: env(safe-area-inset-bottom);
  }

  &.no-top-inset {
    padding-top: 0;
  }

  &.no-bottom-inset {
    padding-bottom: 0;
  }
}

// iOS 13及以上支持更精确的API
@supports (padding: max(0px)) {
  .safe-area-wrapper {
    &.has-top-inset {
      padding-top: max(env(safe-area-inset-top), 0px);
    }

    &.has-bottom-inset {
      padding-bottom: max(env(safe-area-inset-bottom), 0px);
    }
  }
}
</style>
