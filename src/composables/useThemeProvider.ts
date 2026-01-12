/**
 * Theme Provider - Theme management and context
 *
 * Provides comprehensive theme management with:
 * - Light/dark/system theme modes
 * - Persistent theme preference
 * - System preference sync
 * - Smooth theme transitions
 * - CSS custom property management
 *
 * @example
 * ```vue
 * <script setup>
 * import { useThemeProvider } from '@/composables/useThemeProvider'
 *
 * const { theme, toggleTheme, setTheme, isDark } = useThemeProvider()
 * </script>
 *
 * <template>
 *   <button @click="toggleTheme">
 *     {{ isDark ? '🌙' : '☀️' }}
 *   </button>
 * </template>
 * ```
 */

import { computed, onMounted, onUnmounted, ref, type ComputedRef } from 'vue'

export type ThemeMode = 'light' | 'dark' | 'system'
export type Theme = 'light' | 'dark'

const THEME_STORAGE_KEY = 'hula-theme'
const THEME_ATTRIBUTE = 'data-theme'

// Global state (singleton pattern)
const globalTheme = ref<ThemeMode>('system')
const resolvedTheme = ref<Theme>('light')
const isInitialized = ref(false)

// Media query for system preference
let mediaQuery: MediaQueryList | null = null

/**
 * Get system theme preference
 */
function getSystemTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/**
 * Resolve the actual theme (handle 'system' mode)
 */
function resolveTheme(mode: ThemeMode): Theme {
  if (mode === 'system') {
    return getSystemTheme()
  }
  return mode
}

/**
 * Apply theme to DOM
 */
function applyTheme(theme: Theme, animate = true) {
  if (typeof document === 'undefined') return

  const root = document.documentElement

  if (animate) {
    // Add transition class for smooth theme change
    root.style.setProperty('--theme-transition-duration', '0.3s')
    root.classList.add('theme-transitioning')

    // Remove transition class after animation
    setTimeout(() => {
      root.classList.remove('theme-transitioning')
      root.style.removeProperty('--theme-transition-duration')
    }, 300)
  }

  // Set theme attribute
  root.setAttribute(THEME_ATTRIBUTE, theme)

  // Update resolved theme
  resolvedTheme.value = theme
}

/**
 * Load theme from localStorage
 */
function loadTheme(): ThemeMode {
  if (typeof localStorage === 'undefined') return 'system'

  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored as ThemeMode
    }
  } catch {
    // Ignore localStorage errors
  }

  return 'system'
}

/**
 * Save theme to localStorage
 */
function saveTheme(mode: ThemeMode) {
  if (typeof localStorage === 'undefined') return

  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode)
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Handle system theme change
 */
function handleSystemThemeChange(e: MediaQueryListEvent) {
  if (globalTheme.value === 'system') {
    applyTheme(e.matches ? 'dark' : 'light')
  }
}

/**
 * Set up system theme listener
 */
function setupSystemListener() {
  if (typeof window === 'undefined') return

  // Clean up existing listener
  if (mediaQuery) {
    mediaQuery.removeEventListener('change', handleSystemThemeChange)
  }

  // Create new listener
  mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  mediaQuery.addEventListener('change', handleSystemThemeChange)
}

/**
 * Clean up system theme listener
 */
function _cleanupSystemListener() {
  if (mediaQuery) {
    mediaQuery.removeEventListener('change', handleSystemThemeChange)
    mediaQuery = null
  }
}

/**
 * Main theme provider composable
 */
export function useThemeProvider() {
  // Initialize on first use
  if (!isInitialized.value) {
    onMounted(() => {
      const savedMode = loadTheme()
      globalTheme.value = savedMode
      applyTheme(resolveTheme(savedMode), false)
      setupSystemListener()
      isInitialized.value = true
    })

    // Clean up on unmount (only if this is the last instance)
    onUnmounted(() => {
      // For singleton pattern, we typically keep the listener
      // But you could implement ref counting if needed
    })
  }

  /**
   * Set theme mode
   */
  const setTheme = (mode: ThemeMode, animate = true) => {
    globalTheme.value = mode
    saveTheme(mode)
    applyTheme(resolveTheme(mode), animate)

    // Update system listener based on new mode
    if (mode === 'system') {
      setupSystemListener()
    }
  }

  /**
   * Toggle between light and dark
   */
  const toggleTheme = (animate = true) => {
    const current = resolvedTheme.value
    setTheme(current === 'dark' ? 'light' : 'dark', animate)
  }

  /**
   * Check if current theme is dark
   */
  const isDark: ComputedRef<boolean> = computed(() => resolvedTheme.value === 'dark')

  /**
   * Check if current theme is light
   */
  const isLight: ComputedRef<boolean> = computed(() => resolvedTheme.value === 'light')

  /**
   * Get current theme mode (light/dark/system)
   */
  const themeMode: ComputedRef<ThemeMode> = computed(() => globalTheme.value)

  /**
   * Get resolved theme (light/dark)
   */
  const theme: ComputedRef<Theme> = computed(() => resolvedTheme.value)

  /**
   * Check if using system theme
   */
  const usingSystem: ComputedRef<boolean> = computed(() => globalTheme.value === 'system')

  /**
   * Get theme for a specific element (supports theme-aware components)
   */
  const getThemeColor = (colorVar: string): string => {
    if (typeof window === 'undefined') return colorVar
    return getComputedStyle(document.documentElement).getPropertyValue(colorVar).trim()
  }

  return {
    // State
    theme,
    themeMode,
    isDark,
    isLight,
    usingSystem,

    // Methods
    setTheme,
    toggleTheme,
    getThemeColor,

    // Internal state (for advanced use)
    resolvedTheme
  }
}

/**
 * Theme-aware utility for component styles
 * Returns appropriate colors based on current theme
 */
export function useThemeColors() {
  const { isDark, getThemeColor } = useThemeProvider()

  /**
   * Get text color for current theme
   */
  const textColor = computed(() => {
    return isDark.value ? 'var(--hula-text-primary, #F1F5F9)' : 'var(--hula-text-primary, #1E293B)'
  })

  /**
   * Get background color for current theme
   */
  const backgroundColor = computed(() => {
    return isDark.value ? 'var(--hula-bg-primary, #0F1419)' : 'var(--hula-bg-primary, #FFFFFF)'
  })

  /**
   * Get border color for current theme
   */
  const borderColor = computed(() => {
    return isDark.value ? 'var(--hula-border-default, #374151)' : 'var(--hula-border-default, #E2E8F0)'
  })

  /**
   * Get brand color
   */
  const brandColor = computed(() => {
    return isDark.value ? 'var(--hula-brand-primary, #1AB89C)' : 'var(--hula-brand-primary, #13987F)'
  })

  return {
    isDark,
    textColor,
    backgroundColor,
    borderColor,
    brandColor,
    getThemeColor
  }
}

/**
 * Initialize theme on app startup
 * Call this in your main.ts or App.vue
 */
export function initTheme() {
  if (typeof window === 'undefined') return

  const mode = loadTheme()
  globalTheme.value = mode
  applyTheme(resolveTheme(mode), false)
  setupSystemListener()
  isInitialized.value = true

  return {
    theme: globalTheme,
    resolved: resolvedTheme
  }
}

/**
 * Export global theme state for direct access
 */
export { globalTheme, resolvedTheme }
