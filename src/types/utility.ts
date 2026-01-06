/**
 * Utility Types for Type Safety
 * Provides reusable type transformations and constraints
 */

// =============================================================================
// Type Guards and Predicates
// =============================================================================

/**
 * Type guard for checking if a value is not null/undefined
 */
export type NotNull<T> = T extends null | undefined ? never : T

/**
 * Type guard for checking if a value is defined (not undefined)
 */
export type Defined<T> = T extends undefined ? never : T

/**
 * Type guard for nullable types
 */
export type Nullable<T> = T | null

/**
 * Type guard for optional types
 */
export type Optional<T> = T | undefined

/**
 * Type guard for nullable or optional types
 */
export type Maybe<T> = T | null | undefined

// =============================================================================
// Promise Types
// =============================================================================

/**
 * Extract the resolved type from a Promise
 */
export type PromiseValue<T> = T extends Promise<infer V> ? V : never

/**
 * Extract the resolved type from an async function
 */
export type AsyncReturnType<T extends (...args: unknown[]) => Promise<unknown>> = PromiseValue<ReturnType<T>>

// =============================================================================
// Function Types
// =============================================================================

/**
 * Make specific parameters optional
 */
export type OptionalParams<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

/**
 * Make specific parameters required
 */
export type RequiredParams<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>

/**
 * Function with typed `this` context
 */
export type ThisTypedFunction<TThis, TArgs extends unknown[], TReturn> = (this: TThis, ...args: TArgs) => TReturn

// =============================================================================
// Object Types
// =============================================================================

/**
 * Deep partial type - makes all nested properties optional
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

/**
 * Deep required type - makes all nested properties required
 */
export type DeepRequired<T> = {
  [P in keyof T]-?: T[P] extends object ? DeepRequired<T[P]> : T[P]
}

/**
 * Deep readonly type - makes all nested properties readonly
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P]
}

/**
 * Pick by value type
 */
export type PickByType<T, U> = {
  [P in keyof T as T[P] extends U ? P : never]: T[P]
}

/**
 * Omit by value type
 */
export type OmitByType<T, U> = {
  [P in keyof T as T[P] extends U ? never : P]: T[P]
}

// =============================================================================
// String Types
// =============================================================================

/**
 * Split a string type into a tuple of characters
 */
export type Split<S extends string, D extends string> = S extends `${infer T}${D}${infer U}`
  ? [T, ...Split<U, D>]
  : S extends ''
    ? []
    : [S]

/**
 * Join a tuple type into a string
 */
export type Join<T extends string[], D extends string> = T extends [infer First extends string]
  ? First
  : T extends [infer First extends string, ...infer Rest extends string[]]
    ? `${First}${D}${Join<Rest, D>}`
    : ''

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error with code
 */
export interface ErrorWithCode extends Error {
  code: string
}

/**
 * Error with status code
 */
export interface ErrorWithStatusCode extends Error {
  statusCode: number
  status?: string
}

/**
 * API Error response
 */
export interface ApiErrorResponse {
  error: string
  errcode?: string
  status?: number
}

// =============================================================================
// Event Types
// =============================================================================

/**
 * Event handler function
 */
export type EventHandler<T = unknown> = (event: T) => void

/**
 * Event handler with error handling
 */
export type SafeEventHandler<T = unknown> = (event: T) => void | Promise<void>

/**
 * Event map - mapping of event names to their data types
 */
export type EventMap = Record<string, unknown>

/**
 * Extract event data type from EventMap
 */
export type EventData<TMap extends EventMap, TEvent extends keyof TMap> = TMap[TEvent]

// =============================================================================
// Constructor Types
// =============================================================================

/**
 * Extract constructor parameters
 */
export type ConstructorParameters<T extends new (...args: unknown[]) => unknown> = T extends new (
  ...args: infer P
) => unknown
  ? P
  : never

/**
 * Extract instance type from constructor
 */
export type InstanceType<T extends new (...args: unknown[]) => unknown> = T extends new (
  ...args: unknown[]
) => infer I
  ? I
  : never

// =============================================================================
// Comparison Types
// =============================================================================

/**
 * Type that is T if T extends U, otherwise never
 */
export type IfExtends<T, U, Y = true, N = false> = T extends U ? Y : N

/**
 * Type that is T if T is assignable to U, otherwise never
 */
export type IfAssignable<T, U, Y = true, N = false> = [T] extends [U] ? Y : N

/**
 * XOR (exclusive or) type
 */
export type XOR<T, U> = T | U extends object ? (Without<T, U> & U) | (Without<U, T> & T) : T | U

type Without<T, U> = T extends object ? T & Omit<T, keyof U> : T

// =============================================================================
// Branding Types (Nominal Typing)
// =============================================================================

/**
 * Branded type for nominal typing
 */
export type Branded<T, B> = T & { __brand: B }

/**
 * Create a branded string type
 */
export type BrandedString<B> = Branded<string, B>

/**
 * Create a branded number type
 */
export type BrandedNumber<B> = Branded<number, B>

// =============================================================================
// Validation Types
// =============================================================================

/**
 * Non-empty string type
 */
export type NonEmptyString = string & { readonly __brand: unique symbol }

/**
 * Positive number type
 */
export type PositiveNumber = number & { readonly __brand: unique symbol }

/**
 * Non-negative number type
 */
export type NonNegativeNumber = number & { readonly __brand: unique symbol }

/**
 * Integer number type
 */
export type IntegerNumber = number & { readonly __brand: unique symbol }

// =============================================================================
// Matrix-Specific Utility Types
// =============================================================================

/**
 * MXID (Matrix ID) type - e.g., @user:server.com
 */
export type MXID = BrandedString<'MXID'>

/**
 * Room ID type - e.g., !room:server.com
 */
export type RoomID = BrandedString<'RoomID'>

/**
 * Event ID type - e.g., $event:server.com
 */
export type EventID = BrandedString<'EventID'>

/**
 * Type guard to check if a string is a valid MXID
 */
export function isMXID(value: string): value is `${string}:${string}` {
  return value.startsWith('@') && value.includes(':')
}

/**
 * Type guard to check if a string is a valid Room ID
 */
export function isRoomID(value: string): value is `!${string}:${string}` {
  return value.startsWith('!') && value.includes(':')
}

/**
 * Type guard to check if a string is a valid Event ID
 */
export function isEventID(value: string): value is `$${string}:${string}` {
  return value.startsWith('$') && value.includes(':')
}

// =============================================================================
// Export all utility types
// =============================================================================

// Note: TypeScript utility types are globally available and don't need to be re-exported
// Use them directly: Partial<T>, Required<T>, Readonly<T>, etc.
