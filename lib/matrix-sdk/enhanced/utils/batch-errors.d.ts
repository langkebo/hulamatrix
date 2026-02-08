import { SynapseEnhancedError } from "./http.ts";
import { ErrorCode as HttpErrorCode } from "./error-codes.ts";
/**
 * Represents a single failure in a batch operation.
 * @typeParam T - The type of the item identifier (e.g., user ID, room ID)
 */
export interface BatchOperationFailure<T = string> {
    /** The identifier of the item that failed */
    itemId: T;
    /** The error message describing why the operation failed */
    error: string;
    /** The timestamp when the failure occurred */
    timestamp?: string;
}
/**
 * Represents the result of a batch operation.
 * @typeParam T - The type of the item identifier
 */
export interface BatchOperationResult<T = string> {
    /** Total number of operations attempted */
    totalOperations: number;
    /** Number of operations that succeeded */
    successCount: number;
    /** Number of operations that failed */
    failureCount: number;
    /** Array of failed operations with details */
    failures: BatchOperationFailure<T>[];
}
/**
 * Error thrown when a batch operation fails.
 * Provides detailed information about which specific items failed and why.
 * @typeParam T - The type of the item identifier (e.g., user ID, room ID)
 * @example
 * ```typescript
 * try {
 *     await friendsApi.batchMoveToCategory(operations);
 * } catch (error) {
 *     if (isBatchOperationError(error)) {
 *         console.log(`Failed items: ${error.getFailedItems()}`);
 *         console.log(error.toSummary());
 *     }
 * }
 * ```
 */
export declare class BatchOperationError<T = string> extends SynapseEnhancedError {
    /** The type of batch operation that failed (e.g., "batchMoveToCategory") */
    readonly operationType: string;
    /** The detailed result of the batch operation */
    readonly result: BatchOperationResult<T>;
    /**
     * Creates a new BatchOperationError instance.
     * @param message - The error message describing the overall failure
     * @param operationType - The type of batch operation that failed
     * @param result - The detailed result containing success/failure information
     * @param code - The error code (defaults to BATCH_OPERATION_FAILED)
     */
    constructor(message: string, operationType: string, result: BatchOperationResult<T>, code?: HttpErrorCode);
    /**
     * Creates a BatchOperationError from a batch response.
     * @param operationType - The type of batch operation
     * @param totalOperations - Total number of operations attempted
     * @param failures - Array of failed items with their errors
     * @param baseMessage - Optional base message for the error
     * @returns A new BatchOperationError instance
     * @typeParam T - The type of the item identifier
     */
    static fromBatchResponse<T>(operationType: string, totalOperations: number, failures: Array<{
        itemId: T;
        error: string;
    }>, baseMessage?: string): BatchOperationError<T>;
    /**
     * Checks if the batch operation had any failures.
     * @returns True if any operations failed, false otherwise
     */
    hasFailures(): boolean;
    /**
     * Gets the list of item IDs that failed.
     * @returns Array of failed item identifiers
     */
    getFailedItems(): T[];
    /**
     * Gets a map of failed item IDs to their error messages.
     * @returns Map where keys are item IDs and values are error messages
     */
    getFailedItemErrors(): Map<T, string>;
    /**
     * Generates a human-readable summary of the batch operation result.
     * @returns A formatted string summarizing the operation results
     * @example
     * ```text
     * Batch Operation Summary [batchMoveToCategory]:
     *   Total Operations: 5
     *   Succeeded: 3
     *   Failed: 2
     *
     * Failed Items:
     *   - @user1:example.com: Not found
     *   - @user2:example.com: Category not found
     * ```
     */
    toSummary(): string;
}
/**
 * Type guard function to check if an error is a BatchOperationError.
 * @param error - The error to check
 * @returns True if the error is a BatchOperationError, false otherwise
 * @example
 * ```typescript
 * try {
 *     await operation();
 * } catch (error) {
 *     if (isBatchOperationError(error)) {
 *         // error is now typed as BatchOperationError
 *         console.log(error.toSummary());
 *     }
 * }
 * ```
 */
export declare function isBatchOperationError(error: unknown): error is BatchOperationError;
/**
 * Extracts batch operation failures from an error.
 * @typeParam T - The type of the item identifier
 * @param error - The error to extract failures from
 * @param operationType - Optional filter to only return failures for a specific operation type
 * @returns Array of failures if the error is a BatchOperationError and matches the filter, null otherwise
 * @example
 * ```typescript
 * try {
 *     await operation();
 * } catch (error) {
 *     const failures = extractBatchFailures<string>(error, "batchUserOperations");
 *     if (failures) {
 *         for (const failure of failures) {
 *             console.log(`Failed: ${failure.itemId} - ${failure.error}`);
 *         }
 *     }
 * }
 * ```
 */
export declare function extractBatchFailures<T>(error: unknown, operationType?: string): BatchOperationFailure<T>[] | null;
//# sourceMappingURL=batch-errors.d.ts.map