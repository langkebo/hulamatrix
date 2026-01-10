<template>
  <nav :class="menuClasses">
    <!-- 菜单组 -->
    <template v-for="group in menuGroups" :key="group.title">
      <div v-if="group.title" class="h-sidebar-menu__group-title">
        {{ group.title }}
      </div>

      <ul class="h-sidebar-menu__list">
        <li v-for="item in group.items" :key="item.key" :class="getItemClasses(item)" @click="handleItemClick(item)">
          <!-- 普通菜单项 -->
          <template v-if="!item.children || item.children.length === 0">
            <component
              :is="item.to ? 'router-link' : item.href ? 'a' : 'button'"
              :to="item.to"
              :href="item.href"
              class="h-sidebar-menu__link"
              :target="item.href ? '_blank' : undefined">
              <span class="h-sidebar-menu__icon" v-if="item.icon">
                <Icon :icon="item.icon" />
              </span>
              <span class="h-sidebar-menu__text">{{ item.label }}</span>
              <span class="h-sidebar-menu__badge" v-if="item.badge">{{ item.badge }}</span>
            </component>
          </template>

          <!-- 有子菜单的项 -->
          <template v-else>
            <button class="h-sidebar-menu__link" @click.stop="toggleSubmenu(item.key)">
              <span class="h-sidebar-menu__icon" v-if="item.icon">
                <Icon :icon="item.icon" />
              </span>
              <span class="h-sidebar-menu__text">{{ item.label }}</span>
              <span
                class="h-sidebar-menu__arrow"
                :class="{ 'h-sidebar-menu__arrow--expanded': expandedSubmenus.has(item.key) }">
                <Icon icon="material-symbols:chevron-right" />
              </span>
            </button>

            <transition name="submenu">
              <ul v-show="expandedSubmenus.has(item.key)" class="h-sidebar-menu__submenu">
                <li
                  v-for="child in item.children"
                  :key="child.key"
                  :class="getItemClasses(child, true)"
                  @click="handleItemClick(child)">
                  <component
                    :is="child.to ? 'router-link' : child.href ? 'a' : 'button'"
                    :to="child.to"
                    :href="child.href"
                    class="h-sidebar-menu__link"
                    :target="child.href ? '_blank' : undefined">
                    <span class="h-sidebar-menu__text">{{ child.label }}</span>
                    <span class="h-sidebar-menu__badge" v-if="child.badge">{{ child.badge }}</span>
                  </component>
                </li>
              </ul>
            </transition>
          </template>
        </li>
      </ul>
    </template>
  </nav>
</template>

<script setup lang="ts">
import { ref, computed, inject } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Icon } from '@iconify/vue'

interface MenuItem {
  key: string
  label: string
  icon?: string
  to?: string
  href?: string
  badge?: number | string
  disabled?: boolean
  children?: MenuItem[]
  handler?: () => void
}

interface MenuGroup {
  title?: string
  items: MenuItem[]
}

interface Props {
  menuGroups: MenuGroup[]
  collapsed?: boolean
  activeKeys?: string[]
  defaultExpandedKeys?: string[]
}

const props = withDefaults(defineProps<Props>(), {
  collapsed: false,
  activeKeys: () => [],
  defaultExpandedKeys: () => []
})

const emit = defineEmits<{
  itemClick: [item: MenuItem]
  submenuExpand: [key: string, expanded: boolean]
}>()

const router = useRouter()
const route = useRoute()

// 子菜单展开状态
const expandedSubmenus = ref(new Set(props.defaultExpandedKeys))

// 注入的父级组件状态（如果有的话）
const parentCollapsed = inject('sidebarCollapsed', ref(false))

// 计算属性
const menuClasses = computed(() => [
  'h-sidebar-menu',
  {
    'h-sidebar-menu--collapsed': props.collapsed || parentCollapsed.value
  }
])

// 方法
const getItemClasses = (item: MenuItem, isSubItem = false) => [
  'h-sidebar-menu__item',
  {
    'h-sidebar-menu__item--active': isActive(item),
    'h-sidebar-menu__item--disabled': item.disabled,
    'h-sidebar-menu__item--sub': isSubItem
  }
]

const isActive = (item: MenuItem): boolean => {
  if (item.to) {
    return route.path === item.to || route.matched.some((m) => m.path === item.to)
  }
  return props.activeKeys.includes(item.key)
}

const handleItemClick = (item: MenuItem) => {
  if (item.disabled) return

  if (item.handler) {
    item.handler()
  } else if (item.to) {
    router.push(item.to)
  } else if (item.href) {
    window.open(item.href, '_blank')
  }

  emit('itemClick', item)
}

const toggleSubmenu = (key: string) => {
  const newSet = new Set(expandedSubmenus.value)
  if (newSet.has(key)) {
    newSet.delete(key)
  } else {
    newSet.add(key)
  }
  expandedSubmenus.value = newSet
  emit('submenuExpand', key, newSet.has(key))
}
</script>

<style lang="scss" scoped>
.h-sidebar-menu {
  flex: 1;
  padding: 8px 0;
  overflow-y: auto;
  overflow-x: hidden;

  // 自定义滚动条
  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--scrollbar-color);
    border-radius: 2px;
    opacity: 0.5;

    &:hover {
      opacity: 1;
    }
  }

  &__group-title {
    padding: 8px 16px 4px;
    font-size: 11px;
    font-weight: 500;
    color: var(--sidebar-text-color-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    cursor: default;
    opacity: 1;
    transition: opacity var(--transition-fast);
  }

  &--collapsed &__group-title {
    opacity: 0;
    height: 0;
    padding: 0;
    margin: 0;
  }

  &__list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  &__item {
    position: relative;
    margin: 2px 8px;

    &--active {
      > .h-sidebar-menu__link {
        background: var(--primary-bg);
        color: var(--primary-color);
        font-weight: 500;

        &::before {
          content: '';
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 3px;
          height: 20px;
          background: var(--primary-color);
          border-radius: 0 3px 3px 0;
        }
      }
    }

    &--disabled {
      > .h-sidebar-menu__link {
        opacity: 0.5;
        cursor: not-allowed;

        &:hover {
          background: none;
          color: var(--sidebar-text-color-disabled);
        }
      }
    }

    &--sub {
      padding-left: 16px;
    }
  }

  &__link {
    display: flex;
    align-items: center;
    gap: var(--hula-spacing-md);
    width: 100%;
    padding: var(--hula-spacing-sm) var(--hula-spacing-md);
    color: var(--sidebar-text-color);
    text-decoration: none;
    border: none;
    background: transparent;
    border-radius: var(--hula-radius-sm);
    transition:
      background var(--transition-fast),
      color var(--transition-fast);
    cursor: pointer;
    position: relative;
    font-size: var(--hula-text-sm);
    text-align: left;

    &:hover {
      background: var(--sidebar-hover-bg);
      color: var(--sidebar-text-color-hover);
    }

    &:focus {
      outline: 2px solid var(--focus-ring-color);
      outline-offset: 2px;
    }
  }

  &__icon {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform var(--transition-fast);

    svg {
      width: 100%;
      height: 100%;
    }
  }

  &__text {
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: opacity var(--transition-fast);
  }

  &__badge {
    flex-shrink: 0;
    min-width: 18px;
    height: 18px;
    padding: 0 6px;
    background: var(--danger-color);
    color: var(--hula-brand-primary);
    font-size: 10px;
    font-weight: 500;
    line-height: 18px;
    text-align: center;
    border-radius: 9px;
    animation: menu-badge-bounce 0.3s ease;
  }

  &__arrow {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    transition: transform var(--transition-fast);
    margin-left: auto;

    &--expanded {
      transform: rotate(90deg);
    }

    svg {
      width: 100%;
      height: 100%;
    }
  }

  &__submenu {
    list-style: none;
    padding: 0;
    margin: 0;
    overflow: hidden;

    .h-sidebar-menu__link {
      font-size: 13px;
      padding-left: 24px;
    }
  }

  // 折叠状态样式
  &--collapsed {
    .h-sidebar-menu__text,
    .h-sidebar-menu__badge,
    .h-sidebar-menu__arrow {
      opacity: 0;
      width: 0;
      overflow: hidden;
    }

    .h-sidebar-menu__link {
      justify-content: center;
      padding: 10px;

      &:hover {
        transform: none;

        .h-sidebar-menu__icon {
          transform: scale(1.1);
        }
      }
    }

    .h-sidebar-menu__submenu {
      display: none;
    }

    // 工具提示
    .h-sidebar-menu__item {
      position: relative;

      &:hover {
        &::after {
          content: attr(data-tooltip);
          position: absolute;
          left: 100%;
          top: 50%;
          transform: translateY(-50%);
          margin-left: 8px;
          padding: 4px 8px;
          background: var(--tooltip-bg);
          color: var(--tooltip-text);
          font-size: 12px;
          border-radius: 4px;
          white-space: nowrap;
          box-shadow: var(--shadow-md);
          z-index: 1000;
          pointer-events: none;
        }
      }
    }
  }
}

// 动画
.submenu-enter-active,
.submenu-leave-active {
  transition: max-height 0.3s ease;
}

.submenu-enter-from,
.submenu-leave-to {
  max-height: 0;
}

.submenu-enter-to,
.submenu-leave-from {
  max-height: 300px;
}

@keyframes menu-badge-bounce {
  0% {
    transform: scale(0);
  }
  50% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1);
  }
}

// 暗色模式适配
[data-theme-content='dark'] {
  .h-sidebar-menu {
    &__link {
      color: var(--sidebar-text-color-dark);

      &:hover {
        background: var(--sidebar-hover-bg-dark);
        color: var(--sidebar-text-color-hover-dark);
      }
    }

    &__badge {
      background: var(--danger-color-dark);
    }
  }
}
</style>
