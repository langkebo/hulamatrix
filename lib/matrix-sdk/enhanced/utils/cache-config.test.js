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

import { DEFAULT_CACHE_CONFIG, DEFAULT_CACHE_TTL, getCacheConfig, shouldCacheEndpoint, getEndpointCacheTTL, isCacheableMethod, isCacheableStatus } from "./cache-config.js";
describe("Cache Config Utils", () => {
  describe("DEFAULT_CACHE_CONFIG", () => {
    it("should have cache configuration for friends list", () => {
      var config = DEFAULT_CACHE_CONFIG["/api/v1/friends"];
      expect(config.enabled).toBe(true);
      expect(config.ttl).toBe(300000); // 5 minutes
    });
    it("should have cache configuration for friends categories", () => {
      var config = DEFAULT_CACHE_CONFIG["/api/v1/friend-categories"];
      expect(config.enabled).toBe(true);
      expect(config.ttl).toBe(600000); // 10 minutes
    });
    it("should disable cache for private sessions", () => {
      var config = DEFAULT_CACHE_CONFIG["/api/v1/chatrooms"];
      expect(config.enabled).toBe(false);
    });
    it("should have configuration for voice config", () => {
      var config = DEFAULT_CACHE_CONFIG["/enhanced/voice/config"];
      expect(config.enabled).toBe(true);
      expect(config.ttl).toBe(3600000); // 1 hour
    });
  });
  describe("DEFAULT_CACHE_TTL", () => {
    it("should be 5 minutes in milliseconds", () => {
      expect(DEFAULT_CACHE_TTL).toBe(5 * 60 * 1000);
    });
  });
  describe("getCacheConfig", () => {
    it("should return config for known endpoint", () => {
      var config = getCacheConfig("/api/v1/friends");
      expect(config).toEqual(DEFAULT_CACHE_CONFIG["/api/v1/friends"]);
    });
    it("should return default config for unknown endpoint", () => {
      var config = getCacheConfig("/unknown/endpoint");
      expect(config.enabled).toBe(true);
      expect(config.ttl).toBe(DEFAULT_CACHE_TTL);
    });
  });
  describe("shouldCacheEndpoint", () => {
    it("should return true for cacheable endpoint", () => {
      expect(shouldCacheEndpoint("/enhanced/friends/list")).toBe(true);
    });
    it("should return false for disabled endpoint", () => {
      expect(shouldCacheEndpoint("/api/v1/chatrooms")).toBe(false);
    });
    it("should return true for unknown endpoint (defaults to enabled)", () => {
      expect(shouldCacheEndpoint("/unknown/path")).toBe(true);
    });
  });
  describe("getEndpointCacheTTL", () => {
    it("should return correct TTL for known endpoint", () => {
      expect(getEndpointCacheTTL("/api/v1/friend-categories")).toBe(600000);
    });
    it("should return default TTL for unknown endpoint", () => {
      expect(getEndpointCacheTTL("/unknown/path")).toBe(DEFAULT_CACHE_TTL);
    });
    it("should return 0 for disabled endpoint", () => {
      var config = getCacheConfig("/api/v1/chatrooms");
      expect(config.ttl).toBe(10000);
    });
  });
  describe("isCacheableMethod", () => {
    it("should return true for GET requests", () => {
      expect(isCacheableMethod("GET")).toBe(true);
    });
    it("should return false for POST requests", () => {
      expect(isCacheableMethod("POST")).toBe(false);
    });
    it("should return false for PUT requests", () => {
      expect(isCacheableMethod("PUT")).toBe(false);
    });
    it("should return false for DELETE requests", () => {
      expect(isCacheableMethod("DELETE")).toBe(false);
    });
    it("should return false for PATCH requests", () => {
      expect(isCacheableMethod("PATCH")).toBe(false);
    });
  });
  describe("isCacheableStatus", () => {
    it("should return true for 2xx status codes", () => {
      expect(isCacheableStatus(200)).toBe(true);
      expect(isCacheableStatus(201)).toBe(true);
      expect(isCacheableStatus(204)).toBe(true);
    });
    it("should return false for 3xx status codes", () => {
      expect(isCacheableStatus(301)).toBe(false);
      expect(isCacheableStatus(304)).toBe(false);
    });
    it("should return false for 4xx status codes", () => {
      expect(isCacheableStatus(400)).toBe(false);
      expect(isCacheableStatus(404)).toBe(false);
    });
    it("should return false for 5xx status codes", () => {
      expect(isCacheableStatus(500)).toBe(false);
      expect(isCacheableStatus(503)).toBe(false);
    });
  });
});
//# sourceMappingURL=cache-config.test.js.map