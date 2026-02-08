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
import { ErrorCode } from "./error-codes.js";
describe("Error Codes", () => {
  describe("ErrorCode enum", () => {
    it("should have all expected error codes", () => {
      expect(ErrorCode.UNKNOWN).toBe("M_UNKNOWN");
      expect(ErrorCode.INVALID_PARAM).toBe("M_INVALID_PARAM");
      expect(ErrorCode.FORBIDDEN).toBe("M_FORBIDDEN");
      expect(ErrorCode.NOT_FOUND).toBe("M_NOT_FOUND");
      expect(ErrorCode.RATE_LIMITED).toBe("M_RATE_LIMITED");
    });
    it("should include auth-related error codes", () => {
      expect(ErrorCode.AUTH_FORBIDDEN).toBe("M_AUTH_FORBIDDEN");
      expect(ErrorCode.AUTH_REQUIRED).toBe("M_AUTH_REQUIRED");
      expect(ErrorCode.AUTH_INVALID).toBe("M_AUTH_INVALID");
      expect(ErrorCode.AUTH_EXPIRED).toBe("M_AUTH_EXPIRED");
    });
    it("should include batch operation error codes", () => {
      expect(ErrorCode.BATCH_OPERATION_FAILED).toBe("M_BATCH_OPERATION_FAILED");
      expect(ErrorCode.BATCH_PARTIAL_FAILURE).toBe("M_BATCH_PARTIAL_FAILURE");
    });
  });
});
describe("SynapseEnhancedError", () => {
  it("should create error with all properties", () => {
    var error = new SynapseEnhancedError("Test error message", ErrorCode.INVALID_PARAM, {
      field: "test_field"
    }, 400);
    expect(error.message).toBe("Test error message");
    expect(error.code).toBe(ErrorCode.INVALID_PARAM);
    expect(error.detail).toEqual({
      field: "test_field"
    });
    expect(error.statusCode).toBe(400);
    expect(error.name).toBe("SynapseEnhancedError");
  });
  it("should create error with default status code", () => {
    var error = new SynapseEnhancedError("Test error", ErrorCode.UNKNOWN);
    expect(error.message).toBe("Test error");
    expect(error.code).toBe(ErrorCode.UNKNOWN);
    expect(error.detail).toBeUndefined();
    expect(error.statusCode).toBe(500);
  });
  it("should be instance of Error", () => {
    var error = new SynapseEnhancedError("Test", ErrorCode.UNKNOWN);
    expect(error instanceof Error).toBe(true);
    expect(error instanceof SynapseEnhancedError).toBe(true);
  });
  it("should capture stack trace", () => {
    var error = new SynapseEnhancedError("Test", ErrorCode.UNKNOWN);
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain("SynapseEnhancedError");
  });
  describe("error code categorization", () => {
    it("should identify auth errors", () => {
      var authErrors = [ErrorCode.AUTH_FORBIDDEN, ErrorCode.AUTH_REQUIRED, ErrorCode.AUTH_INVALID, ErrorCode.AUTH_EXPIRED];
      for (var code of authErrors) {
        var error = new SynapseEnhancedError("Auth error", code);
        expect(isAuthError(error)).toBe(true);
      }
    });
    it("should identify client errors (4xx)", () => {
      var error = new SynapseEnhancedError("Bad request", ErrorCode.INVALID_PARAM, undefined, 400);
      expect(isClientError(error)).toBe(true);
    });
    it("should identify server errors (5xx)", () => {
      var error = new SynapseEnhancedError("Internal error", ErrorCode.INTERNAL_ERROR, undefined, 500);
      expect(isServerError(error)).toBe(true);
    });
  });
});
function isAuthError(error) {
  var authCodes = [ErrorCode.AUTH_FORBIDDEN, ErrorCode.AUTH_REQUIRED, ErrorCode.AUTH_INVALID, ErrorCode.AUTH_EXPIRED];
  return authCodes.includes(error.code);
}
function isClientError(error) {
  return error.statusCode !== undefined && error.statusCode >= 400 && error.statusCode < 500;
}
function isServerError(error) {
  return error.statusCode !== undefined && error.statusCode >= 500;
}
//# sourceMappingURL=errors.test.js.map