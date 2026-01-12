/**
 * useDarkMode - Simplified dark mode composable
 *
 * A focused composable for dark mode functionality.
 * Built on top of useThemeProvider for easier integration.
 *
 * @example
 * ```vue
 * <script setup>
 * import { useDarkMode } from '@/hooks/useDarkMode'
 *
 * const { isDark, toggleDark, enableDark, disableDark } = useDarkMode()
 * </script>
 *
 * <template>
 *   <button @click="toggleDark">
 *     Switch to {{ isDark ? 'Light' : 'Dark' }} Mode
 *   </button>
 * </template>
 * ```
 */

import { computed, type ComputedRef, watch } from 'vue'
import { useThemeProvider, type ThemeMode } from '@/composables/useThemeProvider'

export interface DarkModeOptions {
  /**
   * Enable/disable transitions when toggling
   * @default true
   */
  transition?: boolean

  /**
   * Callback when dark mode changes
   */
  onChange?: (isDark: boolean) => void

  /**
   * Initial dark mode state
   * @default undefined (uses stored preference)
   */
  initial?: boolean
}

/**
 * Main dark mode composable
 */
export function useDarkMode(options: DarkModeOptions = {}) {
  const { transition = true, onChange, initial } = options

  const themeProvider = useThemeProvider()

  /**
   * Current dark mode state
   */
  const isDark: ComputedRef<boolean> = computed(() => themeProvider.isDark.value)

  /**
   * Current light mode state
   */
  const isLight: ComputedRef<boolean> = computed(() => themeProvider.isLight.value)

  /**
   * Toggle between light and dark mode
   */
  const toggleDark = () => {
    themeProvider.toggleTheme(transition)
  }

  /**
   * Enable dark mode
   */
  const enableDark = () => {
    themeProvider.setTheme('dark', transition)
  }

  /**
   * Disable dark mode (enable light mode)
   */
  const disableDark = () => {
    themeProvider.setTheme('light', transition)
  }

  /**
   * Set dark mode state
   */
  const setDark = (value: boolean) => {
    if (value) {
      enableDark()
    } else {
      disableDark()
    }
  }

  /**
   * Set theme mode (light/dark/system)
   */
  const setMode = (mode: ThemeMode) => {
    themeProvider.setTheme(mode, transition)
  }

  /**
   * Get current theme mode
   */
  const mode: ComputedRef<ThemeMode> = computed(() => themeProvider.themeMode.value)

  /**
   * Check if using system theme
   */
  const isSystem: ComputedRef<boolean> = computed(() => themeProvider.usingSystem.value)

  /**
   * Watch for changes and call callback
   */
  if (onChange) {
    watch(
      isDark,
      (newValue) => {
        onChange(newValue)
      },
      { immediate: false }
    )
  }

  // Set initial value if provided
  if (initial !== undefined) {
    setDark(initial)
  }

  return {
    // State
    isDark,
    isLight,
    mode,
    isSystem,

    // Methods
    toggleDark,
    enableDark,
    disableDark,
    setDark,
    setMode
  }
}

/**
 * Auto dark mode based on time
 * Automatically enables dark mode during evening hours
 */
export function useAutoDarkMode() {
  const { isDark, setDark } = useDarkMode()

  /**
   * Check if current time is within dark mode hours
   */
  const isDarkTime = (): boolean => {
    const hour = new Date().getHours()
    // Dark mode from 7 PM to 7 AM
    return hour >= 19 || hour < 7
  }

  /**
   * Update dark mode based on current time
   */
  const updateForTime = () => {
    setDark(isDarkTime())
  }

  /**
   * Start auto-update interval (every minute)
   */
  const startAutoUpdate = () => {
    updateForTime()
    return setInterval(updateForTime, 60000) // Check every minute
  }

  return {
    isDark,
    isDarkTime,
    updateForTime,
    startAutoUpdate
  }
}

/**
 * System preference hook
 * Provides system dark mode preference and change listeners
 */
export function useSystemDarkMode() {
  /**
   * Get system preference
   */
  const getSystemPreference = (): boolean => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }

  /**
   * Watch for system preference changes
   */
  const watchSystemPreference = (callback: (isDark: boolean) => void) => {
    if (typeof window === 'undefined') {
      return () => {} // No-op cleanup
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => callback(e.matches)

    mediaQuery.addEventListener('change', handler)

    // Return cleanup function
    return () => {
      mediaQuery.removeEventListener('change', handler)
    }
  }

  /**
   * Current system preference (computed)
   */
  const systemPreference: ComputedRef<boolean> = computed(() => getSystemPreference())

  return {
    getSystemPreference,
    watchSystemPreference,
    systemPreference
  }
}

/**
 * Class-based dark mode utility
 * Adds/removes 'dark' class instead of data attribute
 * Useful for integrations with other libraries
 */
export function useClassDarkMode() {
  const { isDark } = useDarkMode()

  /**
   * Add dark class to element
   */
  const addDarkClass = (element: HTMLElement = document.documentElement) => {
    element.classList.add('dark')
  }

  /**
   * Remove dark class from element
   */
  const removeDarkClass = (element: HTMLElement = document.documentElement) => {
    element.classList.remove('dark')
  }

  /**
   * Toggle dark class on element
   */
  const toggleDarkClass = (element: HTMLElement = document.documentElement) => {
    element.classList.toggle('dark')
  }

  return {
    isDark,
    addDarkClass,
    removeDarkClass,
    toggleDarkClass
  }
}

/**
 * Image dark mode utility
 * Provides different images for light/dark modes
 */
export function useImageDarkMode() {
  const { isDark } = useDarkMode()

  /**
   * Get appropriate image source based on theme
   */
  const getImageSource = (lightSrc: string, darkSrc: string): string => {
    return isDark.value ? darkSrc : lightSrc
  }

  /**
   * Get image source set for responsive images
   */
  const getImageSrcSet = (lightSrcSet: string, darkSrcSet: string): string => {
    return isDark.value ? darkSrcSet : lightSrcSet
  }

  return {
    isDark,
    getImageSource,
    getImageSrcSet
  }
}

/**
 * CSS variable dark mode utility
 * Manages CSS custom properties for theme-aware styling
 */
export function useCSSVarDarkMode() {
  const { isDark } = useDarkMode()

  /**
   * Get CSS variable value
   */
  const getVar = (name: string, element: HTMLElement = document.documentElement): string => {
    return getComputedStyle(element).getPropertyValue(name).trim()
  }

  /**
   * Set CSS variable value
   */
  const setVar = (name: string, value: string, element: HTMLElement = document.documentElement): void => {
    element.style.setProperty(name, value)
  }

  /**
   * Get theme-aware CSS variable
   */
  const getThemeVar = (lightVar: string, darkVar?: string): string => {
    const varName = isDark.value && darkVar ? darkVar : lightVar
    return `var(${varName})`
  }

  return {
    isDark,
    getVar,
    setVar,
    getThemeVar
  }
}

/**
 * Re-export main composable as default
 */
export default useDarkMode
