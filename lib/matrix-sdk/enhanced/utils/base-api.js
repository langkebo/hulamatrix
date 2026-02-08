import _asyncToGenerator from "@babel/runtime/helpers/asyncToGenerator";
import { SynapseEnhancedError } from "./http.js";
import { ErrorCode } from "./error-codes.js";
import { handleApiResponse } from "./response-formatter.js";
export class BaseApi {
  constructor(httpClient) {
    this.httpClient = httpClient;
  }
  get(endpoint, params) {
    var _arguments = arguments,
      _this = this;
    return _asyncToGenerator(function* () {
      var errorMessage = _arguments.length > 2 && _arguments[2] !== undefined ? _arguments[2] : "GET request failed";
      var response = yield _this.httpClient.request(endpoint, {
        method: "GET",
        queryParams: params
      });
      return handleApiResponse(response, errorMessage);
    })();
  }
  post(endpoint, body) {
    var _arguments2 = arguments,
      _this2 = this;
    return _asyncToGenerator(function* () {
      var errorMessage = _arguments2.length > 2 && _arguments2[2] !== undefined ? _arguments2[2] : "POST request failed";
      var response = yield _this2.httpClient.request(endpoint, {
        method: "POST",
        body: body
      });
      return handleApiResponse(response, errorMessage);
    })();
  }
  put(endpoint, body) {
    var _arguments3 = arguments,
      _this3 = this;
    return _asyncToGenerator(function* () {
      var errorMessage = _arguments3.length > 2 && _arguments3[2] !== undefined ? _arguments3[2] : "PUT request failed";
      var response = yield _this3.httpClient.request(endpoint, {
        method: "PUT",
        body: body
      });
      return handleApiResponse(response, errorMessage);
    })();
  }
  deleteRequest(endpoint, params) {
    var _arguments4 = arguments,
      _this4 = this;
    return _asyncToGenerator(function* () {
      var errorMessage = _arguments4.length > 2 && _arguments4[2] !== undefined ? _arguments4[2] : "DELETE request failed";
      var response = yield _this4.httpClient.request(endpoint, {
        method: "DELETE",
        queryParams: params
      });
      return handleApiResponse(response, errorMessage);
    })();
  }
  patch(endpoint, body) {
    var _arguments5 = arguments,
      _this5 = this;
    return _asyncToGenerator(function* () {
      var errorMessage = _arguments5.length > 2 && _arguments5[2] !== undefined ? _arguments5[2] : "PATCH request failed";
      var response = yield _this5.httpClient.request(endpoint, {
        method: "PATCH",
        body: body
      });
      return handleApiResponse(response, errorMessage);
    })();
  }
  handleResponse(response, errorMessage) {
    if (!response.data) {
      throw new SynapseEnhancedError(errorMessage, ErrorCode.UNKNOWN, undefined, response.status);
    }
    return response.data;
  }
  createError(message, code, detail) {
    var statusCode = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 500;
    throw new SynapseEnhancedError(message, code, detail, statusCode);
  }
  throwRateLimitError(retryAfterSeconds) {
    var detail = {
      retry_after_ms: Math.max(0, Math.floor(retryAfterSeconds * 1000))
    };
    throw new SynapseEnhancedError("Rate limit exceeded", ErrorCode.LIMIT_EXCEEDED, detail, 429, true);
  }
  withRetry(operation) {
    var _arguments6 = arguments;
    return _asyncToGenerator(function* () {
      var maxRetries = _arguments6.length > 1 && _arguments6[1] !== undefined ? _arguments6[1] : 3;
      var delay = _arguments6.length > 2 && _arguments6[2] !== undefined ? _arguments6[2] : 1000;
      var lastError;
      var _loop = function* _loop(attempt) {
          try {
            return {
              v: yield operation()
            };
          } catch (error) {
            lastError = error;
            if (attempt < maxRetries) {
              yield new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt)));
            }
          }
        },
        _ret;
      for (var attempt = 0; attempt <= maxRetries; attempt++) {
        _ret = yield* _loop(attempt);
        if (_ret) return _ret.v;
      }
      throw lastError;
    })();
  }
}
//# sourceMappingURL=base-api.js.map