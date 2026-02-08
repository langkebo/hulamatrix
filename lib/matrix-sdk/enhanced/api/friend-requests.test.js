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
import { FriendRequestsApi } from "./friend-requests.js";
describe("FriendRequestsApi", () => {
  var api;
  var httpClient;
  beforeEach(() => {
    httpClient = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      request: jest.fn()
    };
    api = new FriendRequestsApi(httpClient);
  });
  describe("sendFriendRequest", () => {
    it("should send friend request successfully", /*#__PURE__*/_asyncToGenerator(function* () {
      var mockResponse = {
        data: {
          status: "ok",
          data: {
            room_id: "!room:example.com",
            target_user_id: "@user:example.com",
            status: "pending"
          }
        },
        status: 200
      };
      mocked(httpClient.post).mockResolvedValue(mockResponse);
      var result = yield api.sendFriendRequest({
        target_user_id: "@user:example.com",
        message: "Hello!"
      });
      expect(httpClient.post).toHaveBeenCalledWith("/friend/request", {
        target_user_id: "@user:example.com",
        message: "Hello!"
      });
      expect(result).toEqual(mockResponse.data.data);
    }));
  });
  describe("acceptFriendRequest", () => {
    it("should accept friend request successfully", /*#__PURE__*/_asyncToGenerator(function* () {
      var mockResponse = {
        data: {
          status: "ok",
          data: {
            room_id: "!room:example.com",
            status: "accepted",
            direct_chats: {
              "@user:example.com": ["!room:example.com"]
            }
          }
        },
        status: 200
      };
      mocked(httpClient.post).mockResolvedValue(mockResponse);
      var result = yield api.acceptFriendRequest("!room:example.com");
      expect(httpClient.post).toHaveBeenCalledWith("/friend/request/!room%3Aexample.com/accept", {});
      expect(result).toEqual(mockResponse.data.data);
    }));
  });
  describe("rejectFriendRequest", () => {
    it("should reject friend request successfully", /*#__PURE__*/_asyncToGenerator(function* () {
      var mockResponse = {
        data: {
          status: "ok",
          data: {
            room_id: "!room:example.com",
            status: "rejected"
          }
        },
        status: 200
      };
      mocked(httpClient.post).mockResolvedValue(mockResponse);
      var result = yield api.rejectFriendRequest("!room:example.com");
      expect(httpClient.post).toHaveBeenCalledWith("/friend/request/!room%3Aexample.com/decline", {});
      expect(result).toEqual(mockResponse.data.data);
    }));
  });
});
//# sourceMappingURL=friend-requests.test.js.map