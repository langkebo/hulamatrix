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

/**
 * Generic API response structure from the Synapse enhanced API.
 * @typeParam T - The type of the data payload
 */

/**
 * Result of a request operation containing the response data and HTTP status.
 * @typeParam T - The type of the response data
 */

/**
 * Extracts and validates the response data from an API result.
 * Throws a SynapseEnhancedError if the response status indicates failure.
 * @typeParam T - The expected type of the response data
 * @param result - The request result containing the API response
 * @param responseField - Optional field name to extract from nested data
 * @returns The extracted response data of type T
 * @throws SynapseEnhancedError if the response status is not "ok" or "200" or if data is missing
 * @example
 * ```typescript
 * const result = await httpClient.get("/api/users");
 * const userData = extractResponse<IUserData>(result);
 * ```
 */
export function extractResponse(result, responseField) {
  var _result$data, _result$data2, _result$data3, _result$data5;
  if ((_result$data = result.data) !== null && _result$data !== void 0 && _result$data.error) {
    throw new SynapseEnhancedError(result.data.error, ErrorCode.UNKNOWN, undefined, result.status);
  }
  if (String((_result$data2 = result.data) === null || _result$data2 === void 0 ? void 0 : _result$data2.status) !== "ok" && String((_result$data3 = result.data) === null || _result$data3 === void 0 ? void 0 : _result$data3.status) !== "200") {
    var _result$data4;
    throw new SynapseEnhancedError(((_result$data4 = result.data) === null || _result$data4 === void 0 ? void 0 : _result$data4.error) || "Unknown error", ErrorCode.UNKNOWN, undefined, result.status);
  }
  var data = (_result$data5 = result.data) === null || _result$data5 === void 0 ? void 0 : _result$data5.data;
  if (!data) {
    throw new SynapseEnhancedError("Response data is missing", ErrorCode.INVALID_PARAM, undefined, result.status);
  }
  if (responseField) {
    // Type-safe field extraction with runtime validation
    if (typeof data === "object" && data !== null && responseField in data) {
      var fieldData = data[responseField];
      if (fieldData === undefined) {
        throw new SynapseEnhancedError("Response field '".concat(responseField, "' is undefined"), ErrorCode.INVALID_PARAM, undefined, result.status);
      }
      return fieldData;
    }
    throw new SynapseEnhancedError("Response field '".concat(responseField, "' not found"), ErrorCode.INVALID_PARAM, undefined, result.status);
  }
  return data;
}

/**
 * Extracts a list of items from an API response.
 * Throws a SynapseEnhancedError if the response status indicates failure.
 * @typeParam T - The type of items in the list
 * @param result - The request result containing the API response
 * @param itemsField - The field name containing the items array (default: "items")
 * @returns An array of extracted items, or empty array if items field is missing
 * @throws SynapseEnhancedError if the response status is not "ok" or "200"
 * @example
 * ```typescript
 * const result = await httpClient.get("/api/users");
 * const users = extractListResponse<IUser>(result);
 * ```
 */
export function extractListResponse(result) {
  var _result$data6, _result$data7, _result$data9;
  var itemsField = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "items";
  if (String((_result$data6 = result.data) === null || _result$data6 === void 0 ? void 0 : _result$data6.status) !== "ok" && String((_result$data7 = result.data) === null || _result$data7 === void 0 ? void 0 : _result$data7.status) !== "200") {
    var _result$data8;
    throw new SynapseEnhancedError(((_result$data8 = result.data) === null || _result$data8 === void 0 ? void 0 : _result$data8.error) || "Unknown error", ErrorCode.UNKNOWN, undefined, result.status);
  }
  var data = (_result$data9 = result.data) === null || _result$data9 === void 0 ? void 0 : _result$data9.data;
  if (data && typeof data === "object" && itemsField in data) {
    var items = data[itemsField];
    return Array.isArray(items) ? items : [];
  }
  return [];
}

/**
 * Generic paginated response structure containing items and pagination metadata.
 * @typeParam T - The type of items in the paginated response
 */

/**
 * Extracts a paginated response from an API result.
 * Throws a SynapseEnhancedError if the response status indicates failure.
 * @typeParam T - The type of items in the paginated response
 * @param result - The request result containing the API response
 * @param itemsField - The field name containing the items array (default: "items")
 * @returns A PaginatedResponse object containing items and pagination info
 * @throws SynapseEnhancedError if the response status is not "ok" or "200"
 * @example
 * ```typescript
 * const result = await httpClient.get("/api/users", { limit: 10 });
 * const users = extractPaginatedResponse<IUser>(result);
 * console.log(users.items.length); // Number of users in current page
 * console.log(users.pagination.has_more); // Whether more pages exist
 * ```
 */
export function extractPaginatedResponse(result) {
  var _result$data0, _result$data1, _result$data11;
  var itemsField = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "items";
  if (String((_result$data0 = result.data) === null || _result$data0 === void 0 ? void 0 : _result$data0.status) !== "ok" && String((_result$data1 = result.data) === null || _result$data1 === void 0 ? void 0 : _result$data1.status) !== "200") {
    var _result$data10;
    throw new SynapseEnhancedError(((_result$data10 = result.data) === null || _result$data10 === void 0 ? void 0 : _result$data10.error) || "Unknown error", ErrorCode.UNKNOWN, undefined, result.status);
  }
  var data = (_result$data11 = result.data) === null || _result$data11 === void 0 ? void 0 : _result$data11.data;
  if (!data || typeof data !== "object") {
    return {
      items: [],
      pagination: {}
    };
  }

  // Type-safe extraction of items array
  var itemsValue = data[itemsField];
  var items = Array.isArray(itemsValue) ? itemsValue : [];

  // Type-safe extraction of pagination object
  var paginationValue = data.pagination;
  var paginationObj = paginationValue && typeof paginationValue === "object" ? paginationValue : {};
  return {
    items,
    pagination: {
      has_more: typeof paginationObj.has_more === "boolean" ? paginationObj.has_more : undefined,
      cursor: typeof paginationObj.cursor === "string" ? paginationObj.cursor : undefined,
      page: typeof paginationObj.page === "number" ? paginationObj.page : undefined,
      total: typeof paginationObj.total === "number" ? paginationObj.total : undefined
    }
  };
}
//# sourceMappingURL=response-handler.js.map