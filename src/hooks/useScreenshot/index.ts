/**
 * Screenshot Composables Module
 *
 * Modular structure for Screenshot.vue component functionality
 *
 * Splits the large Screenshot.vue (1666 lines) into:
 * - useScreenshotCanvas.ts - Canvas initialization and image loading
 * - useScreenshotSelection.ts - Selection area management
 *
 * Usage in Screenshot.vue:
 * ```ts
 * import { useScreenshotCanvas, useScreenshotSelection } from '@/hooks/useScreenshot'
 *
 * const canvas = useScreenshotCanvas({ imgCanvas, maskCanvas, drawCanvas, magnifier })
 * const selection = useScreenshotSelection({ selectionArea, screenConfig })
 * ```
 */

// Canvas management
export { useScreenshotCanvas } from './useScreenshotCanvas'
export type {
  ScreenConfig,
  CanvasContext,
  UseScreenshotCanvasState,
  UseScreenshotCanvasActions,
  UseScreenshotCanvasOptions
} from './useScreenshotCanvas'

// Selection management
export { useScreenshotSelection } from './useScreenshotSelection'
export type {
  SelectionAreaStyle,
  SelectionPosition,
  UseScreenshotSelectionState,
  UseScreenshotSelectionActions,
  UseScreenshotSelectionOptions
} from './useScreenshotSelection'
