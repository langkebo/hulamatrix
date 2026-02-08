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

import { extractResponse, extractListResponse, extractPaginatedResponse } from "./response-handler.js";
import { SynapseEnhancedError } from "./http.js";
describe("Response Handler Utils", () => {
  describe("extractResponse", () => {
    it("should extract response data successfully", () => {
      var mockResult = {
        data: {
          status: "ok",
          data: {
            user_id: "@user:example.com",
            name: "Test User"
          }
        },
        status: 200
      };
      var result = extractResponse(mockResult);
      expect(result).toEqual({
        user_id: "@user:example.com",
        name: "Test User"
      });
    });
    it("should extract nested response field", () => {
      var mockResult = {
        data: {
          status: "ok",
          data: {
            nested: {
              user_id: "@user:example.com"
            }
          }
        },
        status: 200
      };
      var result = extractResponse(mockResult, "nested");
      expect(result).toEqual({
        user_id: "@user:example.com"
      });
    });
    it("should throw SynapseEnhancedError on failed status", () => {
      var mockResult = {
        data: {
          status: "failed",
          error: "Internal server error"
        },
        status: 500
      };
      expect(() => extractResponse(mockResult)).toThrow(SynapseEnhancedError);
      expect(() => extractResponse(mockResult)).toThrow("Internal server error");
    });
    it("should throw SynapseEnhancedError on status 200 but failed", () => {
      var mockResult = {
        data: {
          status: "200",
          error: "Not found"
        },
        status: 200
      };
      expect(() => extractResponse(mockResult)).toThrow("Not found");
    });
    it("should throw SynapseEnhancedError when data is missing", () => {
      var mockResult = {
        data: {
          status: "ok"
        },
        status: 200
      };
      expect(() => extractResponse(mockResult)).toThrow(SynapseEnhancedError);
      expect(() => extractResponse(mockResult)).toThrow("Response data is missing");
    });
  });
  describe("extractListResponse", () => {
    it("should extract list of items", () => {
      var mockResult = {
        data: {
          status: "ok",
          data: {
            items: [{
              id: 1
            }, {
              id: 2
            }, {
              id: 3
            }]
          }
        },
        status: 200
      };
      var result = extractListResponse(mockResult);
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        id: 1
      });
    });
    it("should return empty array when items field is missing", () => {
      var mockResult = {
        data: {
          status: "ok",
          data: {}
        },
        status: 200
      };
      var result = extractListResponse(mockResult);
      expect(result).toEqual([]);
    });
    it("should throw error on failed status", () => {
      var mockResult = {
        data: {
          status: "failed",
          error: "Unauthorized"
        },
        status: 401
      };
      expect(() => extractListResponse(mockResult)).toThrow(SynapseEnhancedError);
      expect(() => extractListResponse(mockResult)).toThrow("Unauthorized");
    });
    it("should use custom items field", () => {
      var mockResult = {
        data: {
          status: "ok",
          data: {
            users: [{
              name: "User1"
            }, {
              name: "User2"
            }]
          }
        },
        status: 200
      };
      var result = extractListResponse(mockResult, "users");
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name: "User1"
      });
    });
  });
  describe("extractPaginatedResponse", () => {
    it("should extract paginated response with items and pagination", () => {
      var mockResult = {
        data: {
          status: "ok",
          data: {
            items: [{
              id: 1
            }, {
              id: 2
            }],
            pagination: {
              has_more: true,
              cursor: "next-cursor",
              total: 100
            }
          }
        },
        status: 200
      };
      var result = extractPaginatedResponse(mockResult);
      expect(result.items).toHaveLength(2);
      expect(result.pagination.has_more).toBe(true);
      expect(result.pagination.cursor).toBe("next-cursor");
      expect(result.pagination.total).toBe(100);
    });
    it("should return empty items when data is missing", () => {
      var mockResult = {
        data: {
          status: "ok"
        },
        status: 200
      };
      var result = extractPaginatedResponse(mockResult);
      expect(result.items).toEqual([]);
      expect(result.pagination).toEqual({});
    });
    it("should throw error on failed status", () => {
      var mockResult = {
        data: {
          status: "failed",
          error: "Rate limited"
        },
        status: 429
      };
      expect(() => extractPaginatedResponse(mockResult)).toThrow(SynapseEnhancedError);
      expect(() => extractPaginatedResponse(mockResult)).toThrow("Rate limited");
    });
    it("should use custom items field", () => {
      var mockResult = {
        data: {
          status: "ok",
          data: {
            messages: [{
              text: "Hello"
            }],
            pagination: {
              has_more: false
            }
          }
        },
        status: 200
      };
      var result = extractPaginatedResponse(mockResult, "messages");
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual({
        text: "Hello"
      });
    });
  });
});
//# sourceMappingURL=response-handler.test.js.map