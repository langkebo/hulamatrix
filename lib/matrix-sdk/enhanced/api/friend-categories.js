import _asyncToGenerator from "@babel/runtime/helpers/asyncToGenerator";
import { validateString, validateUserId } from "../utils/validator.js";
import { EnhancedApi } from "../constants/api.js";
import { handleApiResponse } from "../utils/response-formatter.js";
export class FriendCategoriesApi {
  constructor(httpClient) {
    this.httpClient = httpClient;
  }
  getCategories() {
    var _this = this;
    return _asyncToGenerator(function* () {
      var response = yield _this.httpClient.get(EnhancedApi.FRIENDS_CATEGORIES);
      return handleApiResponse(response, "Failed to get categories");
    })();
  }
  setCategories(categories) {
    var _this2 = this;
    return _asyncToGenerator(function* () {
      for (var [categoryName, categoryData] of Object.entries(categories)) {
        validateString(categoryName, "categoryName", {
          minLength: 1,
          maxLength: 50
        });
        if (categoryData.users) {
          categoryData.users.forEach(userId => {
            validateUserId(userId);
          });
        }
      }
      var response = yield _this2.httpClient.post(EnhancedApi.FRIENDS_CATEGORY_CREATE, categories);
      return handleApiResponse(response, "Failed to set categories");
    })();
  }
  getCategory(categoryName) {
    var _this3 = this;
    return _asyncToGenerator(function* () {
      var response = yield _this3.httpClient.get(EnhancedApi.FRIENDS_CATEGORY_UPDATE.replace("{categoryName}", encodeURIComponent(categoryName)));
      return handleApiResponse(response, "Failed to get category");
    })();
  }
  updateCategory(categoryName, data) {
    var _this4 = this;
    return _asyncToGenerator(function* () {
      validateString(categoryName, "categoryName", {
        minLength: 1,
        maxLength: 100
      });
      if (data.users) {
        data.users.forEach(userId => {
          validateUserId(userId);
        });
      }
      var response = yield _this4.httpClient.put(EnhancedApi.FRIENDS_CATEGORY_UPDATE.replace("{categoryName}", encodeURIComponent(categoryName)), data);
      return handleApiResponse(response, "Failed to update category");
    })();
  }
  deleteCategory(categoryName) {
    var _this5 = this;
    return _asyncToGenerator(function* () {
      validateString(categoryName, "categoryName", {
        minLength: 1,
        maxLength: 100
      });
      var response = yield _this5.httpClient.delete(EnhancedApi.FRIENDS_CATEGORY_DELETE.replace("{categoryName}", encodeURIComponent(categoryName)));
      return handleApiResponse(response, "Failed to delete category");
    })();
  }
  addUserToCategory(categoryName, userId) {
    var _this6 = this;
    return _asyncToGenerator(function* () {
      validateString(categoryName, "categoryName", {
        minLength: 1,
        maxLength: 100
      });
      validateUserId(userId);
      var response = yield _this6.httpClient.post("".concat(EnhancedApi.FRIENDS_CATEGORIES, "/").concat(encodeURIComponent(categoryName), "/users"), {
        user_id: userId
      });
      return handleApiResponse(response, "Failed to add user to category");
    })();
  }
  removeUserFromCategory(categoryName, userId) {
    var _this7 = this;
    return _asyncToGenerator(function* () {
      validateString(categoryName, "categoryName", {
        minLength: 1,
        maxLength: 100
      });
      validateUserId(userId);
      var response = yield _this7.httpClient.delete("".concat(EnhancedApi.FRIENDS_CATEGORIES, "/").concat(encodeURIComponent(categoryName), "/users"), {
        user_id: userId
      });
      return handleApiResponse(response, "Failed to remove user from category");
    })();
  }
}
//# sourceMappingURL=friend-categories.js.map