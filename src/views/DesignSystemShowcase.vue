<template>
  <div class="design-system-showcase">
    <!-- 页面头部 -->
    <header class="showcase-header">
      <div class="header-content">
        <h1>HuLa 设计系统展示</h1>
        <p class="header-subtitle">统一色彩系统 · 响应式工具类 · 无障碍优化</p>
        <div class="header-meta">
          <span class="version">版本 1.0.0</span>
          <span class="date">更新于 2026-01-09</span>
        </div>
      </div>
      <ThemeSwitcher />
    </header>

    <!-- 导航标签 -->
    <nav class="showcase-nav">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="nav-tab"
        :class="{ active: activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        <Icon :icon="tab.icon" class="tab-icon" />
        <span>{{ tab.label }}</span>
      </button>
    </nav>

    <!-- 内容区域 -->
    <main class="showcase-content">
      <!-- 色彩系统 -->
      <section v-show="activeTab === 'colors'" class="showcase-section">
        <h2>色彩系统</h2>
        <div class="color-system">
          <!-- 品牌色 -->
          <div class="color-category">
            <h3>品牌色</h3>
            <div class="color-grid">
              <div v-for="color in brandColors" :key="color.name" class="color-card">
                <div class="color-swatch" :style="{ background: color.value }"></div>
                <div class="color-info">
                  <span class="color-name">{{ color.name }}</span>
                  <span class="color-value">{{ color.value }}</span>
                  <span class="color-variable">{{ color.variable }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 功能色 -->
          <div class="color-category">
            <h3>功能色</h3>
            <div class="color-grid">
              <div v-for="color in functionalColors" :key="color.name" class="color-card">
                <div class="color-swatch" :style="{ background: color.value }"></div>
                <div class="color-info">
                  <span class="color-name">{{ color.name }}</span>
                  <span class="color-value">{{ color.value }}</span>
                  <span class="color-variable">{{ color.variable }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 中性色 -->
          <div class="color-category">
            <h3>中性色</h3>
            <div class="color-grid">
              <div v-for="color in neutralColors" :key="color.name" class="color-card">
                <div class="color-swatch" :style="{ background: color.value }"></div>
                <div class="color-info">
                  <span class="color-name">{{ color.name }}</span>
                  <span class="color-value">{{ color.value }}</span>
                  <span class="color-variable">{{ color.variable }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 组件示例 -->
      <section v-show="activeTab === 'components'" class="showcase-section">
        <h2>组件示例</h2>

        <!-- 按钮组件 -->
        <div class="component-demo">
          <h3>按钮组件</h3>
          <p class="demo-desc">使用统一色彩系统和触摸目标优化的按钮组件</p>
          <ButtonShowcase />
        </div>

        <!-- 输入框组件 -->
        <div class="component-demo">
          <h3>输入框组件</h3>
          <p class="demo-desc">包含焦点状态、验证状态的完整表单组件</p>
          <InputShowcase />
        </div>

        <!-- 连接状态组件 -->
        <div class="component-demo">
          <h3>连接状态组件</h3>
          <p class="demo-desc">用户友好的连接状态指示器</p>
          <div class="connection-demo">
            <div class="demo-states">
              <h4>不同状态示例</h4>
              <div class="state-row">
                <span>已连接:</span>
                <ConnectionStatus :ws-state="'CONNECTED'" :matrix-state="'READY'" mode="mini" />
              </div>
              <div class="state-row">
                <span>同步中:</span>
                <ConnectionStatus :ws-state="'CONNECTED'" :matrix-state="'SYNCING'" :is-syncing="true" mode="mini" />
              </div>
              <div class="state-row">
                <span>连接断开:</span>
                <ConnectionStatus :ws-state="'DISCONNECTED'" :matrix-state="'ERROR'" mode="mini" />
              </div>
              <div class="state-row">
                <span>完整模式:</span>
                <ConnectionStatus :ws-state="'CONNECTED'" :matrix-state="'READY'" mode="full" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 响应式工具类 -->
      <section v-show="activeTab === 'responsive'" class="showcase-section">
        <h2>响应式工具类</h2>
        <div class="responsive-demo">
          <!-- 显示/隐藏 -->
          <div class="responsive-example">
            <h3>显示/隐藏工具类</h3>
            <div class="demo-box">
              <div class="box mobile-only u-hide-desktop">
                <Icon icon="mdi:cellphone" />
                <span>仅移动端可见</span>
              </div>
              <div class="box desktop-only u-hide-mobile">
                <Icon icon="mdi:monitor" />
                <span>仅桌面端可见</span>
              </div>
              <div class="box both-visible">
                <Icon icon="mdi:devices" />
                <span>两端都可见</span>
              </div>
            </div>
          </div>

          <!-- 触摸目标 -->
          <div class="responsive-example">
            <h3>触摸目标优化</h3>
            <div class="demo-box">
              <button class="btn-brand u-touch-target">
                <Icon icon="mdi:thumb-up" />
                最小触摸目标 (44x44px)
              </button>
              <button class="btn-brand btn-brand-sm">
                <Icon icon="mdi:alert-circle-outline" />
                小按钮（不符合标准）
              </button>
            </div>
          </div>

          <!-- 响应式容器 -->
          <div class="responsive-example">
            <h3>响应式容器</h3>
            <div class="u-container demo-container">
              <p>这是一个响应式容器，宽度会根据屏幕大小自动调整。</p>
              <p>当前屏幕宽度: {{ screenWidth }}px</p>
            </div>
          </div>

          <!-- 响应式网格 -->
          <div class="responsive-example">
            <h3>响应式网格</h3>
            <div class="u-grid-3 demo-grid">
              <div class="grid-item">项目 1</div>
              <div class="grid-item">项目 2</div>
              <div class="grid-item">项目 3</div>
              <div class="grid-item">项目 4</div>
              <div class="grid-item">项目 5</div>
              <div class="grid-item">项目 6</div>
            </div>
          </div>
        </div>
      </section>

      <!-- 无障碍优化 -->
      <section v-show="activeTab === 'accessibility'" class="showcase-section">
        <h2>无障碍优化</h2>
        <div class="a11y-demo">
          <!-- 焦点可见性 -->
          <div class="a11y-example">
            <h3>焦点可见性</h3>
            <p class="demo-desc">使用 Tab 键浏览，观察焦点指示器</p>
            <div class="focus-demo">
              <button class="btn-brand">按钮 1</button>
              <button class="btn-brand-outline">按钮 2</button>
              <a href="#" class="link-brand">链接</a>
              <input type="text" class="input-brand" placeholder="输入框" />
            </div>
          </div>

          <!-- ARIA 属性 -->
          <div class="a11y-example">
            <h3>ARIA 属性</h3>
            <p class="demo-desc">正确使用 ARIA 属性提升辅助技术支持</p>
            <div class="aria-demo">
              <button
                :aria-expanded="isExpanded"
                aria-controls="demo-panel"
                @click="isExpanded = !isExpanded"
              >
                {{ isExpanded ? '收起' : '展开' }}内容
              </button>
              <div
                v-show="isExpanded"
                id="demo-panel"
                role="region"
                aria-live="polite"
              >
                这是可展开的内容区域
              </div>

              <!-- 开关示例 -->
              <label class="switch-label">
                <span>启用通知</span>
                <div
                  class="switch-brand"
                  :class="{ active: notificationEnabled }"
                  @click="notificationEnabled = !notificationEnabled"
                  role="switch"
                  :aria-checked="notificationEnabled"
                  tabindex="0"
                ></div>
              </label>
            </div>
          </div>

          <!-- 跳过导航链接 -->
          <div class="a11y-example">
            <h3>跳过导航链接</h3>
            <p class="demo-desc">按 Tab 键可以看到"跳到主内容"链接</p>
            <a href="#main-content" class="skip-to-content">跳到主内容</a>
          </div>

          <!-- 屏幕阅读器专用文本 -->
          <div class="a11y-example">
            <h3>屏幕阅读器支持</h3>
            <div class="sr-demo">
              <button class="btn-brand">
                <Icon icon="mdi:delete" />
                <span class="sr-only">删除项目</span>
              </button>
              <span class="sr-only-focusable">按 Tab 键可看到此文本</span>
            </div>
          </div>
        </div>
      </section>

      <!-- 最佳实践 -->
      <section v-show="activeTab === 'guidelines'" class="showcase-section">
        <h2>开发最佳实践</h2>
        <div class="guidelines-content">
          <article class="guideline-item">
            <h3>1. 使用统一色彩变量</h3>
            <div class="code-example">
              <div class="code-block bad">
                <span class="code-label">❌ 不推荐</span>
                <pre><code>.my-component {
  color: var(--hula-brand-primary);
  background: var(--hula-brand-primary);
}</code></pre>
              </div>
              <div class="code-block good">
                <span class="code-label">✅ 推荐</span>
                <pre><code>.my-component {
  color: var(--hula-brand-primary);
  background: var(--hula-bg-component);
}</code></pre>
              </div>
            </div>
          </article>

          <article class="guideline-item">
            <h3>2. 使用响应式工具类</h3>
            <div class="code-example">
              <div class="code-block bad">
                <span class="code-label">❌ 不推荐</span>
                <pre><code>@media (max-width: 768px) {
  .sidebar {
    display: none;
  }
}</code></pre>
              </div>
              <div class="code-block good">
                <span class="code-label">✅ 推荐</span>
                <pre><code>&lt;aside class="sidebar u-hide-mobile"&gt;
  侧边栏内容
&lt;/aside&gt;</code></pre>
              </div>
            </div>
          </article>

          <article class="guideline-item">
            <h3>3. 确保触摸目标尺寸</h3>
            <div class="code-example">
              <div class="code-block bad">
                <span class="code-label">❌ 不推荐</span>
                <pre><code>&lt;button class="icon-btn"&gt;
  &lt;Icon name="close" /&gt;
&lt;/button&gt;

.icon-btn {
  width: 24px;
  height: 24px;
}</code></pre>
              </div>
              <div class="code-block good">
                <span class="code-label">✅ 推荐</span>
                <pre><code>&lt;button class="u-touch-target"&gt;
  &lt;Icon name="close" /&gt;
&lt;/button&gt;

/* 或添加工具类 */
&lt;button class="icon-btn u-mobile-touch-target"&gt;</code></pre>
              </div>
            </div>
          </article>

          <article class="guideline-item">
            <h3>4. 添加适当的 ARIA 属性</h3>
            <div class="code-example">
              <div class="code-block bad">
                <span class="code-label">❌ 不推荐</span>
                <pre><code>&lt;button @click="toggle"&gt;
  &lt;Icon :name="isExpanded ? 'up' : 'down'" /&gt;
&lt;/button&gt;</code></pre>
              </div>
              <div class="code-block good">
                <span class="code-label">✅ 推荐</span>
                <pre><code>&lt;button
  :aria-expanded="isExpanded"
  :aria-label="isExpanded ? '收起' : '展开'"
  @click="toggle"
&gt;
  &lt;Icon :name="isExpanded ? 'up' : 'down'" /&gt;
&lt;/button&gt;</code></pre>
              </div>
            </div>
          </article>
        </div>
      </section>
    </main>

    <!-- 页脚 -->
    <footer class="showcase-footer">
      <p>HuLa 设计系统 · UI/UX 优化项目</p>
      <p>基于 WCAG 2.1 AA 标准构建</p>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Icon } from '@iconify/vue'
import ThemeSwitcher from '@/components/common/ThemeSwitcher.vue'
import ConnectionStatus from '@/components/common/ConnectionStatus.vue'
import ButtonShowcase from '@/components/examples/ButtonShowcase.vue'
import InputShowcase from '@/components/examples/InputShowcase.vue'

// 当前激活的标签
const activeTab = ref('colors')

// 标签列表
const tabs = [
  { key: 'colors', label: '色彩系统', icon: 'mdi:palette' },
  { key: 'components', label: '组件示例', icon: 'mdi:view-dashboard' },
  { key: 'responsive', label: '响应式', icon: 'mdi:responsive' },
  { key: 'accessibility', label: '无障碍', icon: 'mdi:human' },
  { key: 'guidelines', label: '最佳实践', icon: 'mdi:book-open' }
]

// 屏幕宽度
const screenWidth = ref(0)

// 更新屏幕宽度
const updateScreenWidth = () => {
  screenWidth.value = window.innerWidth
}

// 无障碍演示状态
const isExpanded = ref(false)
const notificationEnabled = ref(false)

// 生命周期
onMounted(() => {
  updateScreenWidth()
  window.addEventListener('resize', updateScreenWidth)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateScreenWidth)
})

// 色彩数据
const brandColors = [
  { name: '主色', value: 'var(--hula-brand-primary)', variable: '--hula-brand-primary' },
  { name: '悬停', value: 'var(--hula-brand-primary)', variable: '--hula-brand-hover' },
  { name: '激活', value: 'var(--hula-brand-primary)', variable: '--hula-brand-active' },
  { name: '柔和', value: 'rgba(0, 191, 165, 0.1)', variable: '--hula-brand-subtle' }
]

const functionalColors = [
  { name: '成功', value: 'var(--hula-brand-primary)', variable: '--hula-success' },
  { name: '警告', value: 'var(--hula-brand-primary)', variable: '--hula-warning' },
  { name: '错误', value: 'var(--hula-brand-primary)', variable: '--hula-error' },
  { name: '信息', value: 'var(--hula-brand-primary)', variable: '--hula-info' }
]

const neutralColors = [
  { name: '50', value: 'var(--hula-brand-primary)', variable: '--hula-gray-50' },
  { name: '200', value: 'var(--hula-brand-primary)', variable: '--hula-gray-200' },
  { name: '500', value: 'var(--hula-brand-primary)', variable: '--hula-gray-500' },
  { name: '800', value: 'var(--hula-brand-primary)', variable: '--hula-gray-800' }
]
</script>

<style lang="scss" scoped>
.design-system-showcase {
  min-height: 100vh;
  background: var(--hula-bg-page, var(--hula-brand-primary));
  padding-bottom: 40px;
}

/* 页面头部 */
.showcase-header {
  background: var(--hula-bg-component, var(--hula-brand-primary));
  border-bottom: 1px solid var(--hula-border, var(--hula-gray-200, var(--hula-brand-primary)));
  padding: 32px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 24px;

  .header-content {
    flex: 1;

    h1 {
      font-size: 36px;
      font-weight: 700;
      margin-bottom: 8px;
      color: var(--hula-text-primary, var(--hula-gray-800, var(--hula-brand-primary)));
    }

    .header-subtitle {
      font-size: 16px;
      color: var(--hula-text-secondary, var(--hula-gray-600, var(--hula-brand-primary)));
      margin-bottom: 16px;
    }

    .header-meta {
      display: flex;
      gap: 16px;

      span {
        font-size: 12px;
        padding: 4px 12px;
        background: var(--hula-brand-subtle, rgba(0, 191, 165, 0.1));
        color: var(--hula-brand-primary, var(--hula-brand-primary));
        border-radius: 9999px;
        font-weight: 500;
      }
    }
  }
}

/* 导航标签 */
.showcase-nav {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--hula-bg-component, var(--hula-brand-primary));
  border-bottom: 1px solid var(--hula-border, var(--hula-gray-200, var(--hula-brand-primary)));
  padding: 0 32px;
  display: flex;
  gap: 8px;
  overflow-x: auto;

  .nav-tab {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 16px 20px;
    border: none;
    border-bottom: 2px solid transparent;
    background: transparent;
    color: var(--hula-text-secondary, var(--hula-gray-600, var(--hula-brand-primary)));
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s ease;
    white-space: nowrap;

    .tab-icon {
      font-size: 18px;
    }

    &:hover {
      color: var(--hula-brand-primary, var(--hula-brand-primary));
    }

    &.active {
      color: var(--hula-brand-primary, var(--hula-brand-primary));
      border-bottom-color: var(--hula-brand-primary, var(--hula-brand-primary));
    }
  }
}

/* 内容区域 */
.showcase-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 32px;
}

.showcase-section {
  h2 {
    font-size: 28px;
    font-weight: 600;
    margin-bottom: 24px;
    color: var(--hula-text-primary, var(--hula-gray-800, var(--hula-brand-primary)));
  }
}

/* 色彩系统 */
.color-system {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.color-category {
  h3 {
    font-size: 18px;
    font-weight: 500;
    margin-bottom: 16px;
    color: var(--hula-text-secondary, var(--hula-gray-600, var(--hula-brand-primary)));
  }
}

.color-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

.color-card {
  background: var(--hula-bg-component, var(--hula-brand-primary));
  border: 1px solid var(--hula-border, var(--hula-gray-200, var(--hula-brand-primary)));
  border-radius: 12px;
  padding: 16px;
  transition: all 0.3s ease;

  &:hover {
    box-shadow: var(--hula-shadow-md, 0 4px 6px rgba(0, 0, 0, 0.1));
    transform: translateY(-2px);
  }

  .color-swatch {
    width: 100%;
    height: 80px;
    border-radius: 8px;
    margin-bottom: 12px;
    box-shadow: var(--hula-shadow-sm, 0 1px 2px rgba(0, 0, 0, 0.05));
  }

  .color-info {
    display: flex;
    flex-direction: column;
    gap: 4px;

    .color-name {
      font-weight: 500;
      color: var(--hula-text-primary, var(--hula-gray-800, var(--hula-brand-primary)));
    }

    .color-value {
      font-size: 12px;
      font-family: monospace;
      color: var(--hula-text-tertiary, var(--hula-gray-500, var(--hula-brand-primary)));
    }

    .color-variable {
      font-size: 11px;
      font-family: monospace;
      color: var(--hula-brand-primary, var(--hula-brand-primary));
      background: var(--hula-brand-subtle, rgba(0, 191, 165, 0.1));
      padding: 2px 6px;
      border-radius: 4px;
      align-self: flex-start;
    }
  }
}

/* 组件演示 */
.component-demo {
  background: var(--hula-bg-component, var(--hula-brand-primary));
  border: 1px solid var(--hula-border, var(--hula-gray-200, var(--hula-brand-primary)));
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;

  h3 {
    font-size: 20px;
    font-weight: 500;
    margin-bottom: 8px;
  }

  .demo-desc {
    color: var(--hula-text-tertiary, var(--hula-gray-500, var(--hula-brand-primary)));
    margin-bottom: 20px;
  }
}

/* 连接状态演示 */
.connection-demo {
  .demo-states {
    display: flex;
    flex-direction: column;
    gap: 16px;

    h4 {
      font-size: 16px;
      font-weight: 500;
      margin-bottom: 12px;
    }

    .state-row {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 12px;
      background: var(--hula-bg-tertiary, var(--hula-gray-50, var(--hula-brand-primary)));
      border-radius: 8px;

      span:first-child {
        min-width: 100px;
        font-size: 14px;
        color: var(--hula-text-secondary, var(--hula-gray-600, var(--hula-brand-primary)));
      }
    }
  }
}

/* 响应式演示 */
.responsive-demo {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.responsive-example {
  background: var(--hula-bg-component, var(--hula-brand-primary));
  border: 1px solid var(--hula-border, var(--hula-gray-200, var(--hula-brand-primary)));
  border-radius: 12px;
  padding: 24px;

  h3 {
    font-size: 18px;
    font-weight: 500;
    margin-bottom: 16px;
  }

  .demo-box {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;

    .box {
      padding: 16px 24px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      background: var(--hula-brand-subtle, rgba(0, 191, 165, 0.1));
      color: var(--hula-brand-primary, var(--hula-brand-primary));
      border: 1px solid var(--hula-brand-primary, var(--hula-brand-primary));
    }

    button {
      display: flex;
      align-items: center;
      gap: 8px;
    }
  }

  .demo-container {
    background: var(--hula-bg-tertiary, var(--hula-gray-50, var(--hula-brand-primary)));
    border: 2px dashed var(--hula-border, var(--hula-gray-200, var(--hula-brand-primary)));
    border-radius: 8px;
    padding: 24px;
    text-align: center;

    p {
      margin: 8px 0;
      color: var(--hula-text-secondary, var(--hula-gray-600, var(--hula-brand-primary)));
    }
  }

  .demo-grid {
    .grid-item {
      background: var(--hula-brand-primary, var(--hula-brand-primary));
      color: var(--hula-brand-primary);
      padding: 32px;
      border-radius: 8px;
      text-align: center;
      font-weight: 500;
    }
  }
}

/* 无障碍演示 */
.a11y-demo {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.a11y-example {
  background: var(--hula-bg-component, var(--hula-brand-primary));
  border: 1px solid var(--hula-border, var(--hula-gray-200, var(--hula-brand-primary)));
  border-radius: 12px;
  padding: 24px;

  h3 {
    font-size: 18px;
    font-weight: 500;
    margin-bottom: 8px;
  }

  .demo-desc {
    color: var(--hula-text-tertiary, var(--hula-gray-500, var(--hula-brand-primary)));
    margin-bottom: 16px;
  }

  .focus-demo {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
  }

  .aria-demo {
    display: flex;
    flex-direction: column;
    gap: 16px;

    button[aria-controls="demo-panel"] {
      margin-bottom: 8px;
    }

    #demo-panel {
      padding: 16px;
      background: var(--hula-bg-tertiary, var(--hula-gray-50, var(--hula-brand-primary)));
      border-radius: 8px;
      border-left: 4px solid var(--hula-brand-primary, var(--hula-brand-primary));
    }

    .switch-label {
      display: inline-flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px;
      background: var(--hula-bg-tertiary, var(--hula-gray-50, var(--hula-brand-primary)));
      border-radius: 8px;
      cursor: pointer;
    }
  }

  .sr-demo {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
  }
}

/* 最佳实践 */
.guidelines-content {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.guideline-item {
  background: var(--hula-bg-component, var(--hula-brand-primary));
  border: 1px solid var(--hula-border, var(--hula-gray-200, var(--hula-brand-primary)));
  border-radius: 12px;
  padding: 24px;

  h3 {
    font-size: 18px;
    font-weight: 500;
    margin-bottom: 16px;
    color: var(--hula-brand-primary, var(--hula-brand-primary));
  }
}

.code-example {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
}

.code-block {
  border-radius: 8px;
  overflow: hidden;

  .code-label {
    display: block;
    padding: 8px 12px;
    font-size: 12px;
    font-weight: 500;
    margin-bottom: 0;
  }

  &.bad .code-label {
    background: var(--hula-error, var(--hula-brand-primary));
    color: var(--hula-brand-primary);
  }

  &.good .code-label {
    background: var(--hula-success, var(--hula-brand-primary));
    color: var(--hula-brand-primary);
  }

  pre {
    margin: 0;
    padding: 16px;
    background: var(--hula-gray-900, var(--hula-brand-primary));
    overflow-x: auto;

    code {
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 13px;
      line-height: 1.6;
      color: var(--hula-gray-100, var(--hula-brand-primary));
    }
  }
}

/* 页脚 */
.showcase-footer {
  margin-top: 60px;
  padding: 32px;
  text-align: center;
  background: var(--hula-bg-component, var(--hula-brand-primary));
  border-top: 1px solid var(--hula-border, var(--hula-gray-200, var(--hula-brand-primary)));

  p {
    margin: 4px 0;
    font-size: 14px;
    color: var(--hula-text-tertiary, var(--hula-gray-500, var(--hula-brand-primary)));
  }
}

/* 跳过导航链接 */
.skip-to-content {
  position: absolute;
  top: -40px;
  left: 0;
  z-index: 99999;
  padding: 8px 16px;
  background: var(--hula-brand-primary, var(--hula-brand-primary));
  color: #fff;
  text-decoration: none;
  font-weight: 500;
  transition: top 0.3s ease;

  &:focus {
    top: 0;
  }
}

/* 暗色模式适配 */
[data-theme='dark'] {
  .showcase-header,
  .showcase-nav,
  .showcase-footer {
    background: var(--hula-pc-bg-elevated, var(--hula-brand-primary));
    border-color: var(--hula-pc-border, var(--hula-brand-primary));
  }

  .color-card,
  .component-demo,
  .responsive-example,
  .a11y-example,
  .guideline-item {
    background: var(--hula-pc-bg-secondary, var(--hula-brand-primary));
    border-color: var(--hula-pc-border, var(--hula-brand-primary));
  }

  .code-block pre {
    background: var(--hula-brand-primary);
  }
}

/* 响应式适配 */
@media (max-width: 768px) {
  .showcase-header {
    flex-direction: column;
    padding: 20px;
  }

  .showcase-nav {
    padding: 0 16px;
  }

  .showcase-content {
    padding: 16px;
  }

  .color-grid {
    grid-template-columns: 1fr;
  }

  .code-example {
    grid-template-columns: 1fr;
  }
}
</style>
