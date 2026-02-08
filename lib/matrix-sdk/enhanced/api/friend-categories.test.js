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
import { FriendCategoriesApi } from "./friend-categories.js";
describe("FriendCategoriesApi", () => {
  var api;
  var httpClient;
  beforeEach(() => {
    httpClient = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn()
    };
    api = new FriendCategoriesApi(httpClient);
  });
  describe("getCategories", () => {
    it("should get categories successfully", /*#__PURE__*/_asyncToGenerator(function* () {
      var mockCategories = {
        Family: {
          users: ["@user1:example.com", "@user2:example.com"]
        },
        Work: {
          users: ["@user3:example.com"]
        }
      };
      var mockResponse = {
        data: {
          status: "ok",
          data: mockCategories
        },
        status: 200
      };
      mocked(httpClient.get).mockResolvedValue(mockResponse);
      var result = yield api.getCategories();
      expect(httpClient.get).toHaveBeenCalledWith("/friends/categories");
      expect(result).toEqual(mockCategories);
    }));
  });
  describe("setCategories", () => {
    it("should set categories successfully", /*#__PURE__*/_asyncToGenerator(function* () {
      var mockResponse = {
        data: {
          status: "ok"
        },
        status: 200
      };
      mocked(httpClient.post).mockResolvedValue(mockResponse);
      yield api.setCategories({
        Family: {
          users: ["@user1:example.com"]
        }
      });
      expect(httpClient.post).toHaveBeenCalledWith("/friends/categories", {
        Family: {
          users: ["@user1:example.com"]
        }
      });
    }));
  });
  describe("getCategory", () => {
    it("should get category successfully", /*#__PURE__*/_asyncToGenerator(function* () {
      var mockResponse = {
        data: {
          status: "ok",
          data: {
            category_name: "Family",
            users: ["@user1:example.com", "@user2:example.com"]
          }
        },
        status: 200
      };
      mocked(httpClient.get).mockResolvedValue(mockResponse);
      var result = yield api.getCategory("Family");
      expect(httpClient.get).toHaveBeenCalledWith("/friends/categories/Family");
      expect(result).toEqual(mockResponse.data.data);
    }));
  });
  describe("updateCategory", () => {
    it("should update category successfully", /*#__PURE__*/_asyncToGenerator(function* () {
      var mockResponse = {
        data: {
          status: "ok"
        },
        status: 200
      };
      mocked(httpClient.put).mockResolvedValue(mockResponse);
      yield api.updateCategory("Family", {
        users: ["@user1:example.com"]
      });
      expect(httpClient.put).toHaveBeenCalledWith("/friends/categories/Family", {
        users: ["@user1:example.com"]
      });
    }));
  });
  describe("deleteCategory", () => {
    it("should delete category successfully", /*#__PURE__*/_asyncToGenerator(function* () {
      var mockResponse = {
        data: {
          status: "ok"
        },
        status: 200
      };
      mocked(httpClient.delete).mockResolvedValue(mockResponse);
      yield api.deleteCategory("Family");
      expect(httpClient.delete).toHaveBeenCalledWith("/friends/categories/Family");
    }));
  });
  describe("addUserToCategory", () => {
    it("should add user to category successfully", /*#__PURE__*/_asyncToGenerator(function* () {
      var mockResponse = {
        data: {
          status: "ok"
        },
        status: 200
      };
      mocked(httpClient.post).mockResolvedValue(mockResponse);
      yield api.addUserToCategory("Family", "@user1:example.com");
      expect(httpClient.post).toHaveBeenCalledWith("/friends/categories/Family/users", {
        user_id: "@user1:example.com"
      });
    }));
  });
  describe("removeUserFromCategory", () => {
    it("should remove user from category successfully", /*#__PURE__*/_asyncToGenerator(function* () {
      var mockResponse = {
        data: {
          status: "ok"
        },
        status: 200
      };
      mocked(httpClient.delete).mockResolvedValue(mockResponse);
      yield api.removeUserFromCategory("Family", "@user1:example.com");
      expect(httpClient.delete).toHaveBeenCalledWith("/friends/categories/Family/users", {
        user_id: "@user1:example.com"
      });
    }));
  });
});
//# sourceMappingURL=friend-categories.test.js.map