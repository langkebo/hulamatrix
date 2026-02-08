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

import { SynapseEnhancedError } from "../utils/http.js";
import { ErrorCode } from "../utils/error-codes.js";
import { validatePagination, validateOffsetPagination, buildPaginationQuery, buildOffsetPaginationQuery, createPaginatedResult, createCursorPaginatedResult, calculateOffset, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../api/pagination.js";
describe("Pagination Module", () => {
  describe("validatePagination", () => {
    it("should return default values for undefined input", () => {
      var result = validatePagination(undefined);
      expect(result.limit).toBe(DEFAULT_PAGE_SIZE);
      expect(result.cursor).toBeUndefined();
    });
    it("should clamp limit to MAX_PAGE_SIZE", () => {
      var result = validatePagination({
        limit: 200
      });
      expect(result.limit).toBe(MAX_PAGE_SIZE);
    });
    it("should not allow limit less than 1", () => {
      var result = validatePagination({
        limit: 0
      });
      expect(result.limit).toBe(1);
    });
    it("should preserve cursor parameter", () => {
      var result = validatePagination({
        limit: 10,
        cursor: "abc123"
      });
      expect(result.limit).toBe(10);
      expect(result.cursor).toBe("abc123");
    });
    it("should preserve cursor when limit is 0", () => {
      var result = validatePagination({
        limit: 0,
        cursor: "abc123"
      });
      expect(result.limit).toBe(1);
      expect(result.cursor).toBe("abc123");
    });
  });
  describe("validateOffsetPagination", () => {
    it("should return default values for undefined input", () => {
      var result = validateOffsetPagination(undefined);
      expect(result.limit).toBe(DEFAULT_PAGE_SIZE);
      expect(result.page).toBe(1);
    });
    it("should not allow page less than 1", () => {
      var result = validateOffsetPagination({
        page: 0
      });
      expect(result.page).toBe(1);
    });
    it("should preserve offset parameter", () => {
      var result = validateOffsetPagination({
        limit: 10,
        offset: 50
      });
      expect(result.limit).toBe(10);
      expect(result.offset).toBe(50);
    });
  });
  describe("buildPaginationQuery", () => {
    it("should not include default limit", () => {
      var query = buildPaginationQuery({
        limit: DEFAULT_PAGE_SIZE
      });
      expect(query.limit).toBeUndefined();
    });
    it("should include non-default limit", () => {
      var query = buildPaginationQuery({
        limit: 50
      });
      expect(query.limit).toBe("50");
    });
    it("should include cursor when provided", () => {
      var query = buildPaginationQuery({
        cursor: "abc123"
      });
      expect(query.cursor).toBe("abc123");
    });
    it("should include limit and cursor together", () => {
      var query = buildPaginationQuery({
        limit: 25,
        cursor: "xyz789"
      });
      expect(query.limit).toBe("25");
      expect(query.cursor).toBe("xyz789");
    });
  });
  describe("buildOffsetPaginationQuery", () => {
    it("should not include default page", () => {
      var query = buildOffsetPaginationQuery({
        page: 1
      });
      expect(query.page).toBeUndefined();
    });
    it("should include non-default page", () => {
      var query = buildOffsetPaginationQuery({
        page: 5
      });
      expect(query.page).toBe("5");
    });
    it("should include offset when provided", () => {
      var query = buildOffsetPaginationQuery({
        offset: 100
      });
      expect(query.offset).toBe("100");
    });
  });
  describe("createPaginatedResult", () => {
    it("should calculate total_pages correctly", () => {
      var result = createPaginatedResult([1, 2, 3], 1, 10, 25);
      expect(result.pagination.total_pages).toBe(3);
      expect(result.pagination.has_next).toBe(true);
    });
    it("should indicate no more pages on last page", () => {
      var result = createPaginatedResult([1, 2], 3, 10, 25);
      expect(result.pagination.has_next).toBe(false);
    });
    it("should handle empty results", () => {
      var result = createPaginatedResult([], 1, 20, 0);
      expect(result.items).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.total_pages).toBe(0);
    });
  });
  describe("createCursorPaginatedResult", () => {
    it("should create result with next cursor", () => {
      var result = createCursorPaginatedResult([1, 2, 3], true, "next123", 100);
      expect(result.pagination.has_next).toBe(true);
      expect(result.pagination.next_cursor).toBe("next123");
      expect(result.pagination.total).toBe(100);
    });
    it("should create result without next cursor", () => {
      var result = createCursorPaginatedResult([1, 2], false, undefined);
      expect(result.pagination.has_next).toBe(false);
      expect(result.pagination.next_cursor).toBeUndefined();
    });
  });
  describe("calculateOffset", () => {
    it("should calculate correct offset for page 1", () => {
      expect(calculateOffset(1, 20)).toBe(0);
    });
    it("should calculate correct offset for page 2", () => {
      expect(calculateOffset(2, 20)).toBe(20);
    });
    it("should calculate correct offset for page 3", () => {
      expect(calculateOffset(3, 10)).toBe(20);
    });
    it("should handle page 1 with custom page size", () => {
      expect(calculateOffset(1, 50)).toBe(0);
    });
    it("should handle large page numbers", () => {
      expect(calculateOffset(100, 20)).toBe(1980);
    });
  });
});
describe("ErrorCode Enum", () => {
  it("should have all expected error codes", () => {
    expect(ErrorCode.UNKNOWN).toBe("M_UNKNOWN");
    expect(ErrorCode.INVALID_PARAM).toBe("M_INVALID_PARAM");
    expect(ErrorCode.PARAM_MISSING).toBe("M_PARAM_MISSING");
    expect(ErrorCode.UNKNOWN_TOKEN).toBe("M_UNKNOWN_TOKEN");
    expect(ErrorCode.FORBIDDEN).toBe("M_FORBIDDEN");
    expect(ErrorCode.NOT_FOUND).toBe("M_NOT_FOUND");
    expect(ErrorCode.LIMIT_EXCEEDED).toBe("M_LIMIT_EXCEEDED");
    expect(ErrorCode.INTERNAL_ERROR).toBe("M_INTERNAL_ERROR");
    expect(ErrorCode.UNAVAILABLE).toBe("M_UNAVAILABLE");
    expect(ErrorCode.TIMEOUT).toBe("M_TIMEOUT");
    expect(ErrorCode.NET_ERROR).toBe("M_NET_ERROR");
  });
});
describe("SynapseEnhancedError", () => {
  it("should create error with default values", () => {
    var error = new SynapseEnhancedError("Test error");
    expect(error.message).toBe("Test error");
    expect(error.code).toBe(ErrorCode.UNKNOWN);
    expect(error.statusCode).toBe(500);
  });
  it("should create error with custom values", () => {
    var error = new SynapseEnhancedError("Custom error", ErrorCode.INVALID_PARAM, {
      detail: "some detail"
    }, 400);
    expect(error.message).toBe("Custom error");
    expect(error.code).toBe(ErrorCode.INVALID_PARAM);
    expect(error.detail).toEqual({
      detail: "some detail"
    });
    expect(error.statusCode).toBe(400);
  });
  it("should extend Error class", () => {
    var error = new SynapseEnhancedError("Test");
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(SynapseEnhancedError);
    expect(error.name).toBe("SynapseEnhancedError");
  });
});
//# sourceMappingURL=client.integration.test.js.map