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

import { BatchOperationError } from "./batch-errors.js";
describe("Batch Operations Utils", () => {
  describe("BatchOperationError", () => {
    it("should create error with correct message", () => {
      var result = {
        totalOperations: 2,
        successCount: 1,
        failureCount: 1,
        failures: [{
          itemId: "item1",
          error: "Failed"
        }]
      };
      var error = new BatchOperationError("Test operation failed: 1/2 succeeded, 1 failed", "test_operation", result);
      expect(error.message).toBe("Test operation failed: 1/2 succeeded, 1 failed");
      expect(error.operationType).toBe("test_operation");
      expect(error.result.totalOperations).toBe(2);
      expect(error.result.failures).toHaveLength(1);
    });
    it("should calculate success count correctly", () => {
      var result = {
        totalOperations: 3,
        successCount: 2,
        failureCount: 1,
        failures: [{
          itemId: "item3",
          error: "Failed"
        }]
      };
      var error = new BatchOperationError("Test failed", "test", result);
      expect(error.result.successCount).toBe(2);
      expect(error.result.failureCount).toBe(1);
    });
    it("should identify if all operations failed", () => {
      var result = {
        totalOperations: 2,
        successCount: 0,
        failureCount: 2,
        failures: [{
          itemId: "item1",
          error: "Failed"
        }, {
          itemId: "item2",
          error: "Failed"
        }]
      };
      var error = new BatchOperationError("All failed", "test", result);
      expect(error.result.successCount).toBe(0);
      expect(error.result.failureCount).toBe(2);
    });
    it("should identify if some operations succeeded", () => {
      var result = {
        totalOperations: 2,
        successCount: 1,
        failureCount: 1,
        failures: [{
          itemId: "item2",
          error: "Failed"
        }]
      };
      var error = new BatchOperationError("Partial failure", "test", result);
      expect(error.result.successCount).toBe(1);
      expect(error.result.failureCount).toBe(1);
    });
  });
  describe("BatchOperationResult", () => {
    it("should create a valid result structure", () => {
      var result = {
        totalOperations: 5,
        successCount: 3,
        failureCount: 2,
        failures: [{
          itemId: "a",
          error: "Error A"
        }, {
          itemId: "b",
          error: "Error B"
        }]
      };
      expect(result.totalOperations).toBe(5);
      expect(result.successCount).toBe(3);
      expect(result.failureCount).toBe(2);
      expect(result.failures).toHaveLength(2);
    });
  });
  describe("BatchOperationFailure", () => {
    it("should create a failure with required fields", () => {
      var failure = {
        itemId: "test-item",
        error: "Something went wrong",
        timestamp: "2024-01-19T00:00:00Z"
      };
      expect(failure.itemId).toBe("test-item");
      expect(failure.error).toBe("Something went wrong");
      expect(failure.timestamp).toBeDefined();
    });
  });
});
//# sourceMappingURL=batch.test.js.map