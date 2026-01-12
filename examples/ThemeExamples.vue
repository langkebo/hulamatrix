<!--
  Theme System Examples
  Demonstrates dark mode, theming, and theme-aware components
-->
<template>
  <div class="theme-examples">
    <section class="example-section">
      <h2>Theme Toggle</h2>
      <div class="theme-controls">
        <button :class="{ active: themeMode === 'light' }" @click="setTheme('light')">☀️ Light</button>
        <button :class="{ active: themeMode === 'dark' }" @click="setTheme('dark')">🌙 Dark</button>
        <button :class="{ active: themeMode === 'system' }" @click="setTheme('system')">💻 System</button>
      </div>
      <div class="theme-status">
        <p>
          Current theme:
          <strong>{{ theme }}</strong>
        </p>
        <p>
          Theme mode:
          <strong>{{ themeMode }}</strong>
        </p>
        <p v-if="usingSystem">
          System prefers:
          <strong>{{ isDark ? 'Dark' : 'Light' }}</strong>
        </p>
      </div>
    </section>

    <section class="example-section">
      <h2>Color Tokens</h2>
      <div class="color-grid">
        <div class="color-card">
          <div class="color-swatch" style="background: var(--hula-brand-primary)"></div>
          <span>Brand Primary</span>
        </div>
        <div class="color-card">
          <div class="color-swatch" style="background: var(--hula-brand-secondary)"></div>
          <span>Brand Secondary</span>
        </div>
        <div class="color-card">
          <div class="color-swatch" style="background: var(--hula-brand-accent)"></div>
          <span>Brand Accent</span>
        </div>
        <div class="color-card">
          <div class="color-swatch" style="background: var(--hula-success)"></div>
          <span>Success</span>
        </div>
        <div class="color-card">
          <div class="color-swatch" style="background: var(--hula-warning)"></div>
          <span>Warning</span>
        </div>
        <div class="color-card">
          <div class="color-swatch" style="background: var(--hula-error)"></div>
          <span>Error</span>
        </div>
      </div>
    </section>

    <section class="example-section">
      <h2>Text Colors</h2>
      <div class="text-examples">
        <p class="text-primary">Primary text - Main content</p>
        <p class="text-secondary">Secondary text - Supporting content</p>
        <p class="text-tertiary">Tertiary text - Metadata</p>
        <p class="text-disabled">Disabled text - Unavailable</p>
        <p class="text-inverse">Inverse text - On dark backgrounds</p>
      </div>
    </section>

    <section class="example-section">
      <h2>Background Colors</h2>
      <div class="background-examples">
        <div class="bg-box bg-primary">
          <span>Primary Background</span>
        </div>
        <div class="bg-box bg-secondary">
          <span>Secondary Background</span>
        </div>
        <div class="bg-box bg-tertiary">
          <span>Tertiary Background</span>
        </div>
        <div class="bg-box bg-elevated">
          <span>Elevated Background</span>
        </div>
      </div>
    </section>

    <section class="example-section">
      <h2>Theme-Aware Components</h2>
      <div class="component-showcase">
        <GlassCard>
          <h3>GlassCard</h3>
          <p>Automatically adapts to current theme</p>
        </GlassCard>

        <div class="theme-cards">
          <div class="theme-card">
            <PrimaryButton @click="showMessage('Primary action')">Primary Button</PrimaryButton>
          </div>
          <div class="theme-card">
            <SecondaryButton @click="showMessage('Secondary action')">Secondary Button</SecondaryButton>
          </div>
        </div>

        <div class="form-demo">
          <label>Themed Input</label>
          <input v-model="inputValue" type="text" placeholder="Type something..." class="themed-input" />
          <span class="input-value">{{ inputValue || 'No value' }}</span>
        </div>
      </div>
    </section>

    <section class="example-section">
      <h2>Theme-Aware Animations</h2>
      <div class="animation-showcase">
        <div class="anim-box animate-fade-in">Fade In</div>
        <div class="anim-box animate-scale-in">Scale In</div>
        <div class="anim-box animate-slide-in">Slide In</div>
        <div class="anim-box pulse-glow">Pulse Glow</div>
      </div>
    </section>

    <section class="example-section">
      <h2>System Preference Detection</h2>
      <div class="system-pref">
        <p>
          System prefers dark mode:
          <strong>{{ prefersDark ? 'Yes' : 'No' }}</strong>
        </p>
        <button @click="toggleSystemListener">{{ systemListenerActive ? 'Stop' : 'Start' }} Listening</button>
        <p v-if="systemChangeCount" class="system-changes">System changed {{ systemChangeCount }} time(s)</p>
      </div>
    </section>

    <section class="example-section">
      <h2>Auto Dark Mode (Time-Based)</h2>
      <div class="auto-dark">
        <p>
          Current time is dark mode time:
          <strong>{{ isDarkTime ? 'Yes' : 'No' }}</strong>
        </p>
        <p>Dark mode hours: 7 PM - 7 AM</p>
        <button @click="enableAutoDark">Enable Auto Dark Mode</button>
      </div>
    </section>

    <section class="example-section">
      <h2>Theme Transitions</h2>
      <div class="transition-demo">
        <label>
          <input v-model="smoothTransitions" type="checkbox" />
          Enable smooth transitions
        </label>
        <button @click="toggleTheme">Toggle Theme</button>
        <p class="hint">Toggle the checkbox to see the difference in theme switching animation</p>
      </div>
    </section>

    <section class="example-section">
      <h2>Custom Theme Variables</h2>
      <div class="custom-theme">
        <div class="custom-themed">
          <h4>Custom Themed Card</h4>
          <p>This card uses custom theme variables</p>
        </div>
        <div class="custom-themed-2">
          <h4>Another Custom Theme</h4>
          <p>Different custom color scheme</p>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { useDarkMode, useAutoDarkMode, useSystemDarkMode } from '@/hooks/useDarkMode'
import { useThemeProvider } from '@/composables/useThemeProvider'
import GlassCard from '@/components/common/GlassCard.vue'
import PrimaryButton from '@/components/shared/buttons/PrimaryButton.vue'
import SecondaryButton from '@/components/shared/buttons/SecondaryButton.vue'

// Theme management
const {
  theme,
  themeMode,
  isDark,
  isLight,
  usingSystem,
  toggleTheme: baseToggleTheme,
  setTheme: baseSetTheme
} = useDarkMode()

const { systemPreference, watchSystemPreference } = useSystemDarkMode()

const { isDarkTime, startAutoUpdate } = useAutoDarkMode()

// State
const inputValue = ref('')
const smoothTransitions = ref(true)
const systemListenerActive = ref(false)
const systemChangeCount = ref(0)
const prefersDark = computed(() => systemPreference.value)

// Methods
const setTheme = (mode: 'light' | 'dark' | 'system') => {
  baseSetTheme(mode, smoothTransitions.value)
}

const showMessage = (message: string) => {
  alert(message)
}

const toggleSystemListener = () => {
  if (systemListenerActive.value) {
    // Stop listening (cleanup would be handled by the returned function)
    systemListenerActive.value = false
  } else {
    // Start listening
    const cleanup = watchSystemPreference((isDark) => {
      systemChangeCount.value++
      console.log('System preference changed:', isDark ? 'dark' : 'light')
    })
    systemListenerActive.value = true

    // Store cleanup for unmount
    onUnmounted(() => {
      if (systemListenerActive.value) {
        cleanup()
      }
    })
  }
}

const enableAutoDark = () => {
  startAutoUpdate()
  alert('Auto dark mode enabled. Dark mode will activate between 7 PM and 7 AM.')
}

// Watch transitions preference
import { watch } from 'vue'
watch(smoothTransitions, (enabled) => {
  document.documentElement.style.setProperty('--theme-transition-duration', enabled ? '0.3s' : '0s')
})
</script>

<style scoped lang="scss">
@import '@/styles/scss/global/variables.scss';
@import '@/styles/tokens/animations-theme.scss';

.theme-examples {
  padding: var(--spacing-xl);
  max-width: 1200px;
  margin: 0 auto;
}

.example-section {
  margin-bottom: var(--spacing-3xl);

  h2 {
    margin-bottom: var(--spacing-md);
    font-size: 1.5rem;
    color: var(--hula-text-primary);
  }
}

// Theme controls
.theme-controls {
  display: flex;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);

  button {
    padding: var(--spacing-sm) var(--spacing-lg);
    background: var(--hula-bg-elevated);
    border: 2px solid var(--hula-border-default);
    border-radius: 8px;
    cursor: pointer;
    font-size: 1rem;
    transition: all 0.2s ease;

    &:hover {
      border-color: var(--hula-brand-primary);
    }

    &.active {
      background: var(--hula-brand-primary);
      border-color: var(--hula-brand-primary);
      color: white;
    }
  }
}

.theme-status {
  padding: var(--spacing-md);
  background: var(--hula-bg-tertiary);
  border-radius: 8px;

  p {
    margin: var(--spacing-xs) 0;
    color: var(--hula-text-secondary);

    strong {
      color: var(--hula-text-primary);
    }
  }
}

// Color grid
.color-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--spacing-md);
}

.color-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  background: var(--hula-bg-elevated);
  border-radius: 8px;

  .color-swatch {
    width: 60px;
    height: 60px;
    border-radius: 8px;
    border: 1px solid var(--hula-border-subtle);
  }

  span {
    font-size: 0.875rem;
    color: var(--hula-text-secondary);
  }
}

// Text examples
.text-examples {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  background: var(--hula-bg-elevated);
  border-radius: 8px;

  p {
    margin: 0;

    &.text-primary { color: var(--hula-text-primary); }
    &.text-secondary { color: var(--hula-text-secondary); }
    &.text-tertiary { color: var(--hula-text-tertiary); }
    &.text-disabled { color: var(--hula-text-disabled); }
    &.text-inverse {
      color: var(--hula-text-inverse);
      background: var(--hula-text-primary);
      padding: var(--spacing-sm);
    }
  }
}

// Background examples
.background-examples {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--spacing-md);
}

.bg-box {
  padding: var(--spacing-md);
  border-radius: 8px;
  border: 1px solid var(--hula-border-subtle);
  text-align: center;

  &.bg-primary {
    background: var(--hula-bg-primary);
    color: var(--hula-text-primary);
  }

  &.bg-secondary {
    background: var(--hula-bg-secondary);
    color: var(--hula-text-primary);
  }

  &.bg-tertiary {
    background: var(--hula-bg-tertiary);
    color: var(--hula-text-primary);
  }

  &.bg-elevated {
    background: var(--hula-bg-elevated);
    border-color: var(--hula-border-default);
    color: var(--hula-text-primary);
  }
}

// Component showcase
.component-showcase {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.theme-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--spacing-md);
}

.theme-card {
  padding: var(--spacing-md);
  background: var(--hula-bg-tertiary);
  border-radius: 8px;
  text-align: center;
}

.form-demo {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  background: var(--hula-bg-tertiary);
  border-radius: 8px);

  label {
    font-weight: 500;
    color: var(--hula-text-primary);
  }

  .themed-input {
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--hula-bg-primary);
    border: 1px solid var(--hula-border-default);
    border-radius: 8px;
    color: var(--hula-text-primary);
    font-size: 1rem;

    &:focus {
      outline: none;
      border-color: var(--hula-brand-primary);
    }
  }

  .input-value {
    font-size: 0.875rem;
    color: var(--hula-text-tertiary);
  }
}

// Animations
.animation-showcase {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--spacing-md);
}

.anim-box {
  padding: var(--spacing-lg);
  background: var(--hula-bg-elevated);
  border: 1px solid var(--hula-border-default);
  border-radius: 8px;
  text-align: center;
  font-weight: 500;
  color: var(--hula-text-primary);

  &.animate-fade-in {
    animation: fade-in 0.5s ease-out;
  }

  &.animate-scale-in {
    animation: scale-in 0.3s ease-out;
  }

  &.animate-slide-in {
    animation: slide-in-right 0.3s ease-out;
  }

  &.pulse-glow {
    animation: pulse-glow 2s ease-in-out infinite;
  }
}

// System preference
.system-pref {
  padding: var(--spacing-md);
  background: var(--hula-bg-tertiary);
  border-radius: 8px);

  p {
    margin: var(--spacing-sm) 0;
    color: var(--hula-text-secondary);

    strong {
      color: var(--hula-text-primary);
    }
  }

  button {
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--hula-brand-primary);
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
  }

  .system-changes {
    font-size: 0.875rem;
    color: var(--hula-brand-primary);
  }
}

// Auto dark mode
.auto-dark {
  padding: var(--spacing-md);
  background: var(--hula-bg-tertiary);
  border-radius: 8px);

  p {
    margin: var(--spacing-sm) 0;
    color: var(--hula-text-secondary);

    strong {
      color: var(--hula-text-primary);
    }
  }

  button {
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--hula-brand-primary);
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
  }
}

// Transition demo
.transition-demo {
  padding: var(--spacing-md);
  background: var(--hula-bg-tertiary);
  border-radius: 8px);

  label {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-md);
    color: var(--hula-text-primary);
    cursor: pointer;
  }

  button {
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--hula-brand-primary);
    color: white;
    border: none;
    border-radius: 8px);
    cursor: pointer;
  }

  .hint {
    margin-top: var(--spacing-sm);
    font-size: 0.875rem;
    color: var(--hula-text-tertiary);
  }
}

// Custom theme
.custom-theme {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--spacing-md);
}

.custom-themed {
  --custom-bg: #8B5CF6;
  --custom-text: #FFFFFF;
  --custom-border: #7C3AED;

  padding: var(--spacing-lg);
  background: var(--custom-bg);
  border: 2px solid var(--custom-border);
  border-radius: 8px;
  color: var(--custom-text);

  h4 {
    margin: 0 0 var(--spacing-sm) 0;
  }

  p {
    margin: 0;
    opacity: 0.9;
  }
}

.custom-themed-2 {
  --custom-bg: #F59E0B;
  --custom-text: #1E293B;
  --custom-border: #D97706;

  padding: var(--spacing-lg);
  background: var(--custom-bg);
  border: 2px solid var(--custom-border);
  border-radius: 8px);
  color: var(--custom-text);

  h4 {
    margin: 0 0 var(--spacing-sm) 0;
  }

  p {
    margin: 0;
    opacity: 0.9;
  }
}
</style>
