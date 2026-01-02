/**
 * Tauri event type definitions
 */

export interface TauriEvent<T = unknown> {
  event: string
  payload: T
  id?: number
}

export type TauriEventHandler<T = unknown> = (event: TauriEvent<T>) => void