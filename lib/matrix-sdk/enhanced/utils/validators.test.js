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

import { validateString, validateNumber, validateBoolean, validateArray, validateObject, validateUserId, validateRoomId, validateEventId, validateServerName, validatePaginationParams } from "./validator.js";
import { SynapseEnhancedError } from "./http.js";
describe("Validators", () => {
  describe("validateString", () => {
    it("should accept valid strings", () => {
      expect(validateString("hello", "test")).toBe("hello");
    });
    it("should reject non-strings", () => {
      expect(() => validateString(123, "test")).toThrow(SynapseEnhancedError);
      expect(() => validateString(null, "test")).toThrow(SynapseEnhancedError);
    });
    it("should enforce minLength", () => {
      expect(() => validateString("ab", "test", {
        minLength: 3
      })).toThrow();
    });
    it("should enforce maxLength", () => {
      expect(() => validateString("abc", "test", {
        maxLength: 2
      })).toThrow();
    });
    it("should validate pattern", () => {
      expect(() => validateString("abc", "test", {
        pattern: /^[0-9]+$/
      })).toThrow();
      expect(validateString("123", "test", {
        pattern: /^[0-9]+$/
      })).toBe("123");
    });
  });
  describe("validateNumber", () => {
    it("should accept valid numbers", () => {
      expect(validateNumber(42, "test")).toBe(42);
      expect(validateNumber(0, "test")).toBe(0);
    });
    it("should reject non-numbers", () => {
      expect(() => validateNumber("42", "test")).toThrow();
      expect(() => validateNumber(NaN, "test")).toThrow();
    });
    it("should reject non-finite numbers", () => {
      expect(() => validateNumber(Infinity, "test")).toThrow();
      expect(() => validateNumber(-Infinity, "test")).toThrow();
    });
    it("should enforce min", () => {
      expect(() => validateNumber(5, "test", {
        min: 10
      })).toThrow();
    });
    it("should enforce max", () => {
      expect(() => validateNumber(100, "test", {
        max: 50
      })).toThrow();
    });
    it("should enforce integer", () => {
      expect(() => validateNumber(3.14, "test", {
        integer: true
      })).toThrow();
      expect(validateNumber(42, "test", {
        integer: true
      })).toBe(42);
    });
  });
  describe("validateBoolean", () => {
    it("should accept booleans", () => {
      expect(validateBoolean(true, "test")).toBe(true);
      expect(validateBoolean(false, "test")).toBe(false);
    });
    it("should reject non-booleans", () => {
      expect(() => validateBoolean(1, "test")).toThrow();
      expect(() => validateBoolean("true", "test")).toThrow();
    });
  });
  describe("validateArray", () => {
    it("should accept arrays", () => {
      expect(validateArray([1, 2, 3], "test")).toEqual([1, 2, 3]);
    });
    it("should reject non-arrays", () => {
      expect(() => validateArray({}, "test")).toThrow();
    });
    it("should enforce minLength", () => {
      expect(() => validateArray([1], "test", {
        minLength: 2
      })).toThrow();
    });
    it("should enforce maxLength", () => {
      expect(() => validateArray([1, 2, 3], "test", {
        maxLength: 2
      })).toThrow();
    });
    it("should validate items", () => {
      var result = validateArray([1, 2, 3], "test", {
        itemValidator: item => typeof item === "number"
      });
      expect(result).toEqual([1, 2, 3]);
    });
  });
  describe("validateObject", () => {
    it("should accept valid objects", () => {
      var result = validateObject({
        name: "test",
        value: 42
      }, "test", {
        name: {
          required: true
        },
        value: {
          required: true
        }
      });
      expect(result.name).toBe("test");
      expect(result.value).toBe(42);
    });
    it("should reject non-objects", () => {
      expect(() => validateObject("{}", "test", {})).toThrow();
      expect(() => validateObject([], "test", {})).toThrow();
    });
    it("should enforce required fields", () => {
      expect(() => validateObject({}, "test", {
        name: {
          required: true
        }
      })).toThrow();
    });
    it("should validate field values", () => {
      var result = validateObject({
        count: 5
      }, "test", {
        count: {
          required: true,
          validator: val => typeof validateNumber(val, "count") === "number"
        }
      });
      expect(result.count).toBe(5);
    });
  });
  describe("validateUserId", () => {
    it("should accept valid user IDs", () => {
      var result1 = validateUserId("@alice:example.com");
      expect(result1.valid).toBe(true);
      var result2 = validateUserId("@bob:matrix.org");
      expect(result2.valid).toBe(true);
    });
    it("should reject invalid user IDs", () => {
      var result1 = validateUserId("alice");
      expect(result1.valid).toBe(false);
      var result2 = validateUserId("@alice");
      expect(result2.valid).toBe(false);
      var result3 = validateUserId(":example.com");
      expect(result3.valid).toBe(false);
    });
  });
  describe("validateRoomId", () => {
    it("should accept valid room IDs", () => {
      var result = validateRoomId("!abc123:example.com");
      expect(result.valid).toBe(true);
    });
    it("should reject invalid room IDs", () => {
      var result1 = validateRoomId("abc123");
      expect(result1.valid).toBe(false);
      var result2 = validateRoomId("!abc123");
      expect(result2.valid).toBe(false);
    });
  });
  describe("validateEventId", () => {
    it("should accept valid event IDs", () => {
      var result = validateEventId("$event123");
      expect(result.valid).toBe(true);
    });
    it("should reject empty event IDs", () => {
      var result = validateEventId("");
      expect(result.valid).toBe(false);
    });
  });
  describe("validateServerName", () => {
    it("should accept valid server names", () => {
      expect(validateServerName("example.com")).toBe("example.com");
      expect(validateServerName("sub.domain.org")).toBe("sub.domain.org");
    });
    it("should reject invalid server names", () => {
      expect(() => validateServerName("")).toThrow();
    });
  });
  describe("validatePaginationParams", () => {
    it("should accept valid pagination params", () => {
      expect(() => validatePaginationParams({
        limit: 10
      })).not.toThrow();
      expect(() => validatePaginationParams({
        limit: 100
      })).not.toThrow();
    });
    it("should accept empty params", () => {
      expect(() => validatePaginationParams()).not.toThrow();
    });
    it("should reject invalid limit", () => {
      expect(() => validatePaginationParams({
        limit: 0
      })).toThrow(SynapseEnhancedError);
      expect(() => validatePaginationParams({
        limit: 1001
      })).toThrow(SynapseEnhancedError);
    });
    it("should reject invalid page", () => {
      expect(() => validatePaginationParams({
        page: 0
      })).toThrow(SynapseEnhancedError);
      expect(() => validatePaginationParams({
        page: -1
      })).toThrow(SynapseEnhancedError);
    });
    it("should reject invalid cursor", () => {
      expect(() => validatePaginationParams({
        cursor: ""
      })).toThrow(SynapseEnhancedError);
    });
    it("should accept boundary values", () => {
      expect(() => validatePaginationParams({
        limit: 1
      })).not.toThrow();
      expect(() => validatePaginationParams({
        limit: 1000
      })).not.toThrow();
      expect(() => validatePaginationParams({
        page: 1
      })).not.toThrow();
      expect(() => validatePaginationParams({
        page: Number.MAX_SAFE_INTEGER
      })).not.toThrow();
    });
    it("should reject negative values", () => {
      expect(() => validatePaginationParams({
        limit: -1
      })).toThrow(SynapseEnhancedError);
      expect(() => validatePaginationParams({
        page: -100
      })).toThrow(SynapseEnhancedError);
    });
    it("should accept valid cursor strings", () => {
      expect(() => validatePaginationParams({
        cursor: "abc123"
      })).not.toThrow();
      expect(() => validatePaginationParams({
        cursor: "a".repeat(1000)
      })).not.toThrow();
    });
    it("should accept all valid params together", () => {
      expect(() => validatePaginationParams({
        limit: 50,
        page: 2,
        cursor: "xyz"
      })).not.toThrow();
    });
  });
  describe("validateString - Boundary Cases", () => {
    it("should handle empty string with minLength", () => {
      expect(() => validateString("", "test", {
        minLength: 1
      })).toThrow();
    });
    it("should handle string at exact minLength", () => {
      expect(validateString("ab", "test", {
        minLength: 2
      })).toBe("ab");
    });
    it("should handle string at exact maxLength", () => {
      expect(validateString("ab", "test", {
        maxLength: 2
      })).toBe("ab");
    });
    it("should handle very long strings", () => {
      var longString = "a".repeat(10000);
      expect(validateString(longString, "test")).toBe(longString);
    });
    it("should handle unicode characters", () => {
      expect(validateString("你好世界", "test")).toBe("你好世界");
      expect(validateString("🎉🎊", "test")).toBe("🎉🎊");
    });
    it("should handle special characters", () => {
      expect(validateString("!@#$%^&*()", "test")).toBe("!@#$%^&*()");
    });
  });
  describe("validateNumber - Boundary Cases", () => {
    it("should handle zero", () => {
      expect(validateNumber(0, "test")).toBe(0);
    });
    it("should handle very large numbers", () => {
      expect(validateNumber(Number.MAX_SAFE_INTEGER, "test")).toBe(Number.MAX_SAFE_INTEGER);
    });
    it("should handle very small numbers", () => {
      expect(validateNumber(Number.MIN_SAFE_INTEGER, "test")).toBe(Number.MIN_SAFE_INTEGER);
    });
    it("should handle negative numbers at boundary", () => {
      expect(validateNumber(-1, "test")).toBe(-1);
      expect(validateNumber(-100, "test")).toBe(-100);
    });
    it("should handle decimal numbers", () => {
      expect(validateNumber(0.1, "test")).toBe(0.1);
      expect(validateNumber(3.14159, "test")).toBe(3.14159);
    });
    it("should handle numbers at exact min/max boundaries", () => {
      expect(validateNumber(10, "test", {
        min: 10
      })).toBe(10);
      expect(validateNumber(100, "test", {
        max: 100
      })).toBe(100);
    });
  });
  describe("validateArray - Boundary Cases", () => {
    it("should handle empty array", () => {
      expect(validateArray([], "test")).toEqual([]);
    });
    it("should handle array at exact minLength", () => {
      expect(validateArray([1], "test", {
        minLength: 1
      })).toEqual([1]);
    });
    it("should handle array at exact maxLength", () => {
      expect(validateArray([1, 2], "test", {
        maxLength: 2
      })).toEqual([1, 2]);
    });
    it("should handle very large arrays", () => {
      var largeArray = Array(10000).fill(0);
      expect(validateArray(largeArray, "test")).toEqual(largeArray);
    });
    it("should handle arrays with mixed types", () => {
      var mixedArray = [1, "string", true, null, undefined];
      expect(validateArray(mixedArray, "test")).toEqual(mixedArray);
    });
  });
  describe("validateUserId - Boundary Cases", () => {
    it("should handle user ID with special characters", () => {
      var result = validateUserId("@user_name-123:example.com");
      expect(result.valid).toBe(true);
    });
    it("should handle user ID with subdomains", () => {
      var result = validateUserId("@user:sub.example.com");
      expect(result.valid).toBe(true);
    });
    it("should reject user ID without @ symbol", () => {
      var result = validateUserId("user:example.com");
      expect(result.valid).toBe(false);
    });
    it("should reject user ID without server part", () => {
      var result = validateUserId("@user");
      expect(result.valid).toBe(false);
    });
    it("should reject user ID without local part", () => {
      var result = validateUserId(":example.com");
      expect(result.valid).toBe(false);
    });
  });
  describe("validateRoomId - Boundary Cases", () => {
    it("should handle room ID with long random string", () => {
      var longRandom = "a".repeat(243);
      var result = validateRoomId("!".concat(longRandom, ":example.com"));
      expect(result.valid).toBe(true);
    });
    it("should reject room ID without ! prefix", () => {
      var result = validateRoomId("abc123:example.com");
      expect(result.valid).toBe(false);
    });
    it("should reject room ID without server part", () => {
      var result = validateRoomId("!abc123");
      expect(result.valid).toBe(false);
    });
    it("should reject room ID without local part", () => {
      var result = validateRoomId(":example.com");
      expect(result.valid).toBe(false);
    });
  });
  describe("validateEventId - Boundary Cases", () => {
    it("should handle event ID with long random string", () => {
      var longRandom = "a".repeat(43);
      var result = validateEventId("$".concat(longRandom));
      expect(result.valid).toBe(true);
    });
    it("should reject event ID without $ prefix", () => {
      var result = validateEventId("abc123");
      expect(result.valid).toBe(false);
    });
    it("should reject empty event ID", () => {
      var result = validateEventId("");
      expect(result.valid).toBe(false);
    });
    it("should reject event ID with only $ prefix", () => {
      var result = validateEventId("$");
      expect(result.valid).toBe(false);
    });
  });
  describe("validateServerName - Boundary Cases", () => {
    it("should handle server name with subdomains", () => {
      expect(validateServerName("a.b.c.example.com")).toBe("a.b.c.example.com");
    });
    it("should reject empty server name", () => {
      expect(() => validateServerName("")).toThrow();
    });
    it("should reject server name with invalid characters", () => {
      expect(() => validateServerName("example!.com")).toThrow();
      expect(() => validateServerName("example space.com")).toThrow();
    });
  });
});
//# sourceMappingURL=validators.test.js.map