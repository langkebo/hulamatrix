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

import { SynapseEnhancedError, ErrorCode } from "./http.js";
import { getErrorCodeFromStatus, normalizeErrorCode } from "./error-codes.js";
import { isSynapseRust, useWrappedResponse } from "../constants/api.js";
/**
 * Enhanced response handler that supports both wrapped and bare response formats
 *
 * Wrapped format (standard): { status: "ok", data: {...} }
 * Bare format (Synapse Rust): { items: [...] } or { result: ... } or just the data directly
 *
 * @param response - The HTTP response
 * @param defaultError - Default error message if response.error is missing
 * @param allowBareResponse - Whether to accept bare responses (no status field). Default: auto-detect based on backend profile
 */
export function handleApiResponse(response) {
  var defaultError = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "Request failed";
  var allowBareResponse = arguments.length > 2 ? arguments[2] : undefined;
  var responseData = response.data;
  var hasStatusField = "status" in responseData && responseData.status !== undefined;

  // Auto-detect if we should allow bare responses based on backend profile
  var shouldAllowBare = allowBareResponse !== null && allowBareResponse !== void 0 ? allowBareResponse : !useWrappedResponse() || isSynapseRust();

  // Handle bare response (no status field) - common in Synapse Rust
  if (!hasStatusField) {
    if (shouldAllowBare) {
      // Check if response has data-like fields (items, result, or direct data)
      if ("data" in responseData && responseData.data !== undefined) {
        return responseData.data;
      }
      if ("items" in responseData && responseData.items !== undefined) {
        return responseData.items;
      }
      if ("result" in responseData && responseData.result !== undefined) {
        return responseData.result;
      }
      // If response has error field but no status, treat as error
      if ("error" in responseData && responseData.error !== undefined) {
        throw new SynapseEnhancedError(String(responseData.error), ErrorCode.UNKNOWN, undefined, response.status);
      }
      // Treat the whole response as data
      return responseData;
    }
    // Status field required but missing
    throw new SynapseEnhancedError("Response missing status field: ".concat(JSON.stringify(responseData)), ErrorCode.INVALID_PARAM, undefined, response.status);
  }

  // Handle wrapped response with status field
  var status = String(responseData.status);
  var isOk = status === "ok" || status === "success" || status === "200" || status === "true";
  if (isOk) {
    if (responseData.data === undefined) {
      // Some successful responses might not have data, return empty object
      return {};
    }
    return responseData.data;
  }
  throw new SynapseEnhancedError(responseData.error || defaultError, Number.isNaN(Number(status)) ? normalizeErrorCode(status) : getErrorCodeFromStatus(Number(status)));
}
export function formatApiResponse(response) {
  var data;
  if (response.data !== undefined) {
    data = response.data;
  } else if (response.result !== undefined) {
    data = response.result;
  } else if (response.items !== undefined) {
    data = response.items;
  }
  return {
    status: response.status,
    data,
    error: response.error,
    details: response.details
  };
}
export function formatPaginatedResponse(response, page, pageSize) {
  var _response$pagination$, _response$pagination, _response$pagination$2, _response$pagination2, _response$pagination3;
  var items = response.data || response.items || [];
  var total = (_response$pagination$ = (_response$pagination = response.pagination) === null || _response$pagination === void 0 ? void 0 : _response$pagination.total) !== null && _response$pagination$ !== void 0 ? _response$pagination$ : items.length;
  var hasMore = (_response$pagination$2 = (_response$pagination2 = response.pagination) === null || _response$pagination2 === void 0 ? void 0 : _response$pagination2.has_more) !== null && _response$pagination$2 !== void 0 ? _response$pagination$2 : ((_response$pagination3 = response.pagination) === null || _response$pagination3 === void 0 ? void 0 : _response$pagination3.cursor) !== undefined;
  return {
    items,
    pagination: {
      page,
      page_size: pageSize,
      total,
      has_more: hasMore
    }
  };
}
export function isSuccessStatus(status) {
  return status === "ok" || status === "success" || status === "200" || status === "true";
}
export function getErrorMessage(error, defaultMessage) {
  return error || defaultMessage;
}
export function extractDataFromResponse(response) {
  if (!isSuccessStatus(response.status)) {
    return null;
  }
  if (response.data !== undefined) {
    return response.data;
  }
  if (response.result !== undefined) {
    return response.result;
  }
  if (response.items !== undefined) {
    return response.items;
  }
  return null;
}
export function convertBooleanValue(value) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return value === "yes" || value === "true" || value === "1" || value === "ok";
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  return false;
}
export function convertNumberValue(value) {
  var defaultValue = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    var parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
  }
  return defaultValue;
}
export function convertDateValue(value) {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === "string") {
    return new Date(value);
  }
  if (typeof value === "number") {
    return new Date(value);
  }
  return new Date();
}
export function normalizePaginationParams(page, limit) {
  return {
    page: page !== null && page !== void 0 ? page : 1,
    page_size: Math.min(Math.max(1, limit !== null && limit !== void 0 ? limit : 20), 100)
  };
}
export function parsePaginationFromResponse(response) {
  var _response$pagination4, _response$pagination5, _response$pagination6, _response$pagination7, _response$pagination8;
  return {
    page: (_response$pagination4 = response.pagination) === null || _response$pagination4 === void 0 ? void 0 : _response$pagination4.page,
    page_size: (_response$pagination5 = response.pagination) === null || _response$pagination5 === void 0 ? void 0 : _response$pagination5.page_size,
    total: (_response$pagination6 = response.pagination) === null || _response$pagination6 === void 0 ? void 0 : _response$pagination6.total,
    cursor: (_response$pagination7 = response.pagination) === null || _response$pagination7 === void 0 ? void 0 : _response$pagination7.cursor,
    has_more: (_response$pagination8 = response.pagination) === null || _response$pagination8 === void 0 ? void 0 : _response$pagination8.has_more
  };
}
export function extractItemsFromDataResponse(response) {
  var fallbackItems = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
  var responseData = response.data;
  var statusOk = responseData.status === "ok" || responseData.status === 200;
  if (!statusOk || !responseData.data) {
    return {
      items: fallbackItems,
      total: 0,
      page: 1,
      limit: 20
    };
  }
  return {
    items: responseData.data.items || fallbackItems,
    total: responseData.data.total || 0,
    page: responseData.data.page || 1,
    limit: responseData.data.limit || 20
  };
}
export function formatBackendDataResponse(response, dataField) {
  var _response$data;
  var statusOk = response.status === "ok" || response.status === 200;
  if (!statusOk) {
    return {
      status: String(response.status),
      error: response.error
    };
  }
  if ((_response$data = response.data) !== null && _response$data !== void 0 && _response$data.items) {
    return {
      status: "ok",
      [dataField]: response.data.items,
      total: response.data.total,
      page: response.data.page,
      limit: response.data.limit
    };
  }
  return {
    status: "ok",
    [dataField]: [],
    total: 0,
    page: 1,
    limit: 20
  };
}
//# sourceMappingURL=response-formatter.js.map