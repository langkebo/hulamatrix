import _asyncToGenerator from "@babel/runtime/helpers/asyncToGenerator";
/*
Copyright 2024 The Matrix.org Foundation C.I.C.

Licensed under Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { describe, it, expect, beforeEach } from "@jest/globals";
import { mocked } from "jest-mock";
import { SecurityApi } from "./security.js";
describe("SecurityApi", () => {
  var api;
  var mockHttpClient;
  beforeEach(() => {
    mockHttpClient = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      request: jest.fn(),
      delete: jest.fn()
    };
    api = new SecurityApi(mockHttpClient);
  });
  describe("getPolicies", () => {
    it("should return policies on success", /*#__PURE__*/_asyncToGenerator(function* () {
      mocked(mockHttpClient.get).mockResolvedValue({
        data: {
          status: "ok",
          data: {
            policies: [{
              id: "policy1",
              name: "Spam Protection",
              description: "Blocks spam content",
              rules: [],
              enabled: true,
              created_at: "2024-01-01T00:00:00Z",
              updated_at: "2024-01-01T00:00:00Z"
            }]
          }
        },
        status: 200
      });
      var result = yield api.getPolicies();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("policy1");
      expect(result[0].name).toBe("Spam Protection");
    }));
    it("should return empty array when no policies", /*#__PURE__*/_asyncToGenerator(function* () {
      mocked(mockHttpClient.get).mockResolvedValue({
        data: {
          status: "ok",
          data: {
            policies: []
          }
        },
        status: 200
      });
      var result = yield api.getPolicies();
      expect(result).toEqual([]);
    }));
    it("should throw error on API failure", /*#__PURE__*/_asyncToGenerator(function* () {
      mocked(mockHttpClient.get).mockResolvedValue({
        data: {
          status: "failed",
          error: "Internal error"
        },
        status: 500
      });
      yield expect(api.getPolicies()).rejects.toThrow();
    }));
  });
  describe("detectThreats", () => {
    it("should return threat detection result", /*#__PURE__*/_asyncToGenerator(function* () {
      mocked(mockHttpClient.post).mockResolvedValue({
        data: {
          status: "ok",
          data: {
            threats: [{
              type: "spam",
              severity: "high",
              description: "Spam detected"
            }],
            scan_id: "scan123",
            scanned_at: "2024-01-01T00:00:00Z",
            status: "completed",
            safe: false
          }
        },
        status: 200
      });
      var result = yield api.detectThreats("suspicious content");
      expect(result.safe).toBe(false);
      expect(result.threats).toHaveLength(1);
      expect(result.threats[0].type).toBe("spam");
    }));
    it("should return clean result when no threats", /*#__PURE__*/_asyncToGenerator(function* () {
      mocked(mockHttpClient.post).mockResolvedValue({
        data: {
          status: "ok",
          data: {
            threats: [],
            scan_id: "scan123",
            scanned_at: "2024-01-01T00:00:00Z",
            status: "completed",
            safe: true
          }
        },
        status: 200
      });
      var result = yield api.detectThreats("normal content");
      expect(result.safe).toBe(true);
      expect(result.threats).toHaveLength(0);
    }));
    it("should include context when provided", /*#__PURE__*/_asyncToGenerator(function* () {
      mocked(mockHttpClient.post).mockResolvedValue({
        data: {
          status: "ok",
          data: {
            threats: [],
            scan_id: "scan123",
            scanned_at: "2024-01-01T00:00:00Z",
            status: "completed",
            safe: true
          }
        },
        status: 200
      });
      yield api.detectThreats("content", {
        user_id: "@user:example.com"
      });
      expect(mocked(mockHttpClient.post)).toHaveBeenCalledWith("/security", expect.objectContaining({
        action: "detect",
        content: "content",
        context: {
          user_id: "@user:example.com"
        }
      }));
    }));
  });
  describe("getIpStatus", () => {
    it("should return IP status", /*#__PURE__*/_asyncToGenerator(function* () {
      mocked(mockHttpClient.get).mockResolvedValue({
        data: {
          status: "ok",
          data: {
            blocked: false,
            reputation_score: 85,
            last_checked: "2024-01-01T00:00:00Z",
            threat_score: 10
          }
        },
        status: 200
      });
      var result = yield api.getIpStatus("192.168.1.1");
      expect(result.blocked).toBe(false);
      expect(result.reputation_score).toBe(85);
    }));
  });
  describe("getBlockedIps", () => {
    it("should return blocked IPs list", /*#__PURE__*/_asyncToGenerator(function* () {
      mocked(mockHttpClient.get).mockResolvedValue({
        data: {
          status: "ok",
          data: {
            blocked_ips: [{
              ip: "192.168.1.1",
              reason: "Spam",
              blocked_at: "2024-01-01"
            }]
          }
        },
        status: 200
      });
      var result = yield api.getBlockedIps();
      expect(result).toHaveLength(1);
      expect(result[0].ip).toBe("192.168.1.1");
    }));
  });
  describe("getHighRiskIps", () => {
    it("should return high risk IPs", /*#__PURE__*/_asyncToGenerator(function* () {
      mocked(mockHttpClient.get).mockResolvedValue({
        data: {
          status: "ok",
          data: {
            high_risk_ips: [{
              ip: "10.0.0.1",
              risk_score: 95,
              threat_type: "botnet"
            }]
          }
        },
        status: 200
      });
      var result = yield api.getHighRiskIps();
      expect(result).toHaveLength(1);
      expect(result[0].risk_score).toBe(95);
    }));
  });
  describe("getReputationStats", () => {
    it("should return reputation stats", /*#__PURE__*/_asyncToGenerator(function* () {
      mocked(mockHttpClient.get).mockResolvedValue({
        data: {
          status: "ok",
          data: {
            total_blocked: 1000,
            active_blocked: 50,
            high_risk_count: 20,
            average_threat_score: 75
          }
        },
        status: 200
      });
      var result = yield api.getReputationStats();
      expect(result.total_blocked).toBe(1000);
      expect(result.active_blocked).toBe(50);
    }));
  });
  describe("getSecurityEvents", () => {
    it("should return security events", /*#__PURE__*/_asyncToGenerator(function* () {
      mocked(mockHttpClient.get).mockResolvedValue({
        data: {
          status: "ok",
          data: {
            events: [{
              id: "event1",
              event_type: "ip_blocked",
              ip: "192.168.1.1",
              timestamp: "2024-01-01T00:00:00Z"
            }]
          }
        },
        status: 200
      });
      var result = yield api.getSecurityEvents({
        event_type: "ip_blocked",
        limit: 10
      });
      expect(result).toHaveLength(1);
      expect(result[0].event_type).toBe("ip_blocked");
    }));
  });
  describe("createPolicy", () => {
    it("should create policy successfully", /*#__PURE__*/_asyncToGenerator(function* () {
      mocked(mockHttpClient.post).mockResolvedValue({
        data: {
          status: "ok",
          data: {
            id: "policy123",
            name: "New Policy",
            description: "Test policy",
            rules: [{
              id: "rule1",
              name: "test",
              condition: {},
              action: "block",
              enabled: true,
              priority: 1
            }],
            enabled: true,
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z"
          }
        },
        status: 200
      });
      var result = yield api.createPolicy({
        name: "New Policy",
        rules: [{
          id: "new-rule-id",
          name: "test-rule",
          condition: {},
          action: "block",
          enabled: true,
          priority: 1
        }]
      });
      expect(result.id).toBe("policy123");
      expect(result.name).toBe("New Policy");
    }));
    it("should throw error for invalid policy name", /*#__PURE__*/_asyncToGenerator(function* () {
      yield expect(api.createPolicy({
        name: "",
        rules: []
      })).rejects.toThrow();
    }));
    it("should throw error for empty rules", /*#__PURE__*/_asyncToGenerator(function* () {
      yield expect(api.createPolicy({
        name: "Test Policy",
        rules: []
      })).rejects.toThrow();
    }));
  });
  describe("updatePolicy", () => {
    it("should update policy successfully", /*#__PURE__*/_asyncToGenerator(function* () {
      mocked(mockHttpClient.put).mockResolvedValue({
        data: {
          status: "ok",
          data: {
            id: "policy123",
            name: "Updated Policy",
            description: "Updated description",
            rules: [],
            enabled: false,
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-02T00:00:00Z"
          }
        },
        status: 200
      });
      var result = yield api.updatePolicy("policy123", {
        name: "Updated Policy",
        enabled: false
      });
      expect(result.id).toBe("policy123");
      expect(result.enabled).toBe(false);
    }));
    it("should throw error for invalid policy ID", /*#__PURE__*/_asyncToGenerator(function* () {
      yield expect(api.updatePolicy("", {
        name: "Test"
      })).rejects.toThrow();
    }));
  });
  describe("setPolicyEnabled", () => {
    it("should enable policy", /*#__PURE__*/_asyncToGenerator(function* () {
      mocked(mockHttpClient.put).mockResolvedValue({
        data: {
          status: "ok",
          data: {
            id: "policy123",
            name: "Test Policy",
            description: "",
            rules: [],
            enabled: true,
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-02T00:00:00Z"
          }
        },
        status: 200
      });
      var result = yield api.setPolicyEnabled("policy123", true);
      expect(result.enabled).toBe(true);
    }));
  });
  describe("addPolicyRule", () => {
    it("should add rule to policy", /*#__PURE__*/_asyncToGenerator(function* () {
      mocked(mockHttpClient.post).mockResolvedValue({
        data: {
          status: "ok",
          data: {
            id: "policy123",
            name: "Test Policy",
            description: "",
            rules: [{
              id: "rule1",
              name: "new_rule",
              condition: {},
              action: "allow",
              enabled: true,
              priority: 1
            }],
            enabled: true,
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-02T00:00:00Z"
          }
        },
        status: 200
      });
      var result = yield api.addPolicyRule("policy123", {
        id: "new-rule-id",
        name: "new_rule",
        condition: {},
        action: "allow",
        enabled: true,
        priority: 1
      });
      expect(result.rules).toHaveLength(1);
    }));
    it("should throw error for invalid policy ID", /*#__PURE__*/_asyncToGenerator(function* () {
      yield expect(api.addPolicyRule("", {
        id: "rule1",
        name: "test",
        condition: {},
        action: "block",
        enabled: true,
        priority: 1
      })).rejects.toThrow();
    }));
  });
  describe("removePolicyRule", () => {
    it("should remove rule from policy", /*#__PURE__*/_asyncToGenerator(function* () {
      mocked(mockHttpClient.post).mockResolvedValue({
        data: {
          status: "ok",
          data: {
            id: "policy123",
            name: "Test Policy",
            description: "",
            rules: [],
            enabled: true,
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-02T00:00:00Z"
          }
        },
        status: 200
      });
      var result = yield api.removePolicyRule("policy123", 0);
      expect(result.rules).toHaveLength(0);
    }));
    it("should throw error for invalid policy ID", /*#__PURE__*/_asyncToGenerator(function* () {
      yield expect(api.removePolicyRule("", 0)).rejects.toThrow();
    }));
    it("should throw error for invalid rule index", /*#__PURE__*/_asyncToGenerator(function* () {
      yield expect(api.removePolicyRule("policy123", -1)).rejects.toThrow();
    }));
  });
});
//# sourceMappingURL=security.test.js.map