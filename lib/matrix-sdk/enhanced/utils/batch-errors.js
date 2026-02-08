import _defineProperty from "@babel/runtime/helpers/defineProperty";
/*
Copyright 2024 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { SynapseEnhancedError } from "./http.js";
import { ErrorCode as HttpErrorCode } from "./error-codes.js";

/**
 * Represents a single failure in a batch operation.
 * @typeParam T - The type of the item identifier (e.g., user ID, room ID)
 */

/**
 * Represents the result of a batch operation.
 * @typeParam T - The type of the item identifier
 */

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
export class BatchOperationError extends SynapseEnhancedError {
  /**
   * Creates a new BatchOperationError instance.
   * @param message - The error message describing the overall failure
   * @param operationType - The type of batch operation that failed
   * @param result - The detailed result containing success/failure information
   * @param code - The error code (defaults to BATCH_OPERATION_FAILED)
   */
  constructor(message, operationType, result) {
    var code = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : HttpErrorCode.BATCH_OPERATION_FAILED;
    super(message, code, {
      operationType,
      result
    });
    /** The type of batch operation that failed (e.g., "batchMoveToCategory") */
    _defineProperty(this, "operationType", void 0);
    /** The detailed result of the batch operation */
    _defineProperty(this, "result", void 0);
    this.name = "BatchOperationError";
    this.operationType = operationType;
    this.result = result;
  }

  /**
   * Creates a BatchOperationError from a batch response.
   * @param operationType - The type of batch operation
   * @param totalOperations - Total number of operations attempted
   * @param failures - Array of failed items with their errors
   * @param baseMessage - Optional base message for the error
   * @returns A new BatchOperationError instance
   * @typeParam T - The type of the item identifier
   */
  static fromBatchResponse(operationType, totalOperations, failures) {
    var baseMessage = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : "Batch operation completed with failures";
    var successCount = totalOperations - failures.length;
    var result = {
      totalOperations,
      successCount,
      failureCount: failures.length,
      failures: failures.map(f => ({
        itemId: f.itemId,
        error: f.error,
        timestamp: new Date().toISOString()
      }))
    };
    var message = failures.length === 0 ? "All operations completed successfully" : "".concat(baseMessage, ": ").concat(successCount, "/").concat(totalOperations, " succeeded, ").concat(failures.length, " failed");
    return new BatchOperationError(message, operationType, result);
  }

  /**
   * Checks if the batch operation had any failures.
   * @returns True if any operations failed, false otherwise
   */
  hasFailures() {
    return this.result.failureCount > 0;
  }

  /**
   * Gets the list of item IDs that failed.
   * @returns Array of failed item identifiers
   */
  getFailedItems() {
    return this.result.failures.map(f => f.itemId);
  }

  /**
   * Gets a map of failed item IDs to their error messages.
   * @returns Map where keys are item IDs and values are error messages
   */
  getFailedItemErrors() {
    var errorMap = new Map();
    for (var failure of this.result.failures) {
      errorMap.set(failure.itemId, failure.error);
    }
    return errorMap;
  }

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
  toSummary() {
    var {
      totalOperations,
      successCount,
      failureCount
    } = this.result;
    var summary = "Batch Operation Summary [".concat(this.operationType, "]:\n");
    summary += "  Total Operations: ".concat(totalOperations, "\n");
    summary += "  Succeeded: ".concat(successCount, "\n");
    summary += "  Failed: ".concat(failureCount, "\n");
    if (this.hasFailures()) {
      summary += "\nFailed Items:\n";
      for (var failure of this.result.failures) {
        summary += "  - ".concat(String(failure.itemId), ": ").concat(failure.error, "\n");
      }
    }
    return summary.trim();
  }
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
export function isBatchOperationError(error) {
  return error instanceof BatchOperationError;
}

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
export function extractBatchFailures(error, operationType) {
  if (isBatchOperationError(error)) {
    if (operationType && error.operationType !== operationType) {
      return null;
    }
    return error.result.failures;
  }
  return null;
}
//# sourceMappingURL=batch-errors.js.map