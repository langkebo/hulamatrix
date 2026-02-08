import _defineProperty from "@babel/runtime/helpers/defineProperty";
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
var MATRIX_USER_ID_REGEX = /^@[a-zA-Z0-9._=-]+:[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
var MATRIX_ROOM_ID_REGEX = /^![a-zA-Z0-9._=-]+:[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
var MATRIX_EVENT_ID_REGEX = /^\$[a-zA-Z0-9._=-]+(:[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})?$/;
var MATRIX_DEVICE_ID_REGEX = /^[A-Z0-9]{10,}$/;
var BASE64_REGEX = /^[A-Za-z0-9+/]*={0,2}$/;
var HEX_REGEX = /^[a-fA-F0-9]+$/;

// IPv4 regex: 0-255.0-255.0-255.0-255
var IPV4_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/;
// IPv6 regex (simplified - matches common formats)
var IPV6_REGEX = /^([0-9a-fA-F]{0,4}:){7}[0-9a-fA-F]{0,4}$/;
// IPv6 with :: shorthand
var IPV6_SHORT_REGEX = /^(([0-9a-fA-F]{0,4}:)*[0-9a-fA-F]{0,4})?::([0-9a-fA-F]{0,4}:)*[0-9a-fA-F]{0,4}$/;
var MAX_USER_ID_LENGTH = 255;
var MAX_ROOM_ID_LENGTH = 256;
var MAX_EVENT_ID_LENGTH = 255;
var MAX_STRING_LENGTH = 10000;
var MAX_ARRAY_LENGTH = 1000;
var MAX_DEPTH = 20;
export class InputValidator {
  static isValidUserId(userId) {
    if (!userId || typeof userId !== "string") {
      return false;
    }
    if (userId.length > MAX_USER_ID_LENGTH) {
      return false;
    }
    return MATRIX_USER_ID_REGEX.test(userId);
  }
  static isValidRoomId(roomId) {
    if (!roomId || typeof roomId !== "string") {
      return false;
    }
    if (roomId.length > MAX_ROOM_ID_LENGTH) {
      return false;
    }
    return MATRIX_ROOM_ID_REGEX.test(roomId);
  }
  static isValidEventId(eventId) {
    if (!eventId || typeof eventId !== "string") {
      return false;
    }
    if (eventId.length > MAX_EVENT_ID_LENGTH) {
      return false;
    }
    return MATRIX_EVENT_ID_REGEX.test(eventId);
  }
  static isValidDeviceId(deviceId) {
    if (!deviceId || typeof deviceId !== "string") {
      return false;
    }
    return MATRIX_DEVICE_ID_REGEX.test(deviceId);
  }
  static isValidBase64(data) {
    var validateLength = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
    if (!data || typeof data !== "string") {
      return false;
    }
    if (validateLength && data.length % 4 !== 0) {
      return false;
    }
    return BASE64_REGEX.test(data);
  }
  static isValidHex(data) {
    if (!data || typeof data !== "string") {
      return false;
    }
    return HEX_REGEX.test(data);
  }
  static sanitizeString(input) {
    var maxLength = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : MAX_STRING_LENGTH;
    if (!input || typeof input !== "string") {
      return "";
    }
    return input.replace(this.SANITIZE_PATTERN, "").replace(this.SCRIPT_PATTERN, "").trim().slice(0, maxLength);
  }
  static sanitizeObject(obj) {
    var depth = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
    if (depth > MAX_DEPTH) {
      throw new SynapseEnhancedError("Object nesting depth exceeds maximum", ErrorCode.INVALID_PARAM, {
        depth
      }, 400);
    }
    var result = {};
    for (var [key, value] of Object.entries(obj)) {
      var sanitizedKey = this.sanitizeString(key, 255);
      if (typeof value === "string") {
        result[sanitizedKey] = this.sanitizeString(value);
      } else if (Array.isArray(value)) {
        result[sanitizedKey] = this.sanitizeArray(value, depth + 1);
      } else if (typeof value === "object" && value !== null) {
        result[sanitizedKey] = this.sanitizeObject(value, depth + 1);
      } else {
        result[sanitizedKey] = value;
      }
    }
    return result;
  }
  static sanitizeArray(arr, depth) {
    if (arr.length > MAX_ARRAY_LENGTH) {
      throw new SynapseEnhancedError("Array length exceeds maximum", ErrorCode.INVALID_PARAM, {
        length: arr.length
      }, 400);
    }
    return arr.map(item => {
      if (typeof item === "string") {
        return this.sanitizeString(item);
      } else if (Array.isArray(item)) {
        return this.sanitizeArray(item, depth + 1);
      } else if (typeof item === "object" && item !== null) {
        return this.sanitizeObject(item, depth + 1);
      }
      return item;
    });
  }
  static checkForSqlInjection(input) {
    if (!input || typeof input !== "string") {
      return false;
    }
    return this.SQL_INJECTION_PATTERN.test(input);
  }
  static sanitizeForHtml(input) {
    if (!input || typeof input !== "string") {
      return "";
    }
    return input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;").replace(/\//g, "&#x2F;");
  }
  static validatePaginationParams(params) {
    if (!params) {
      return;
    }
    if (params.limit !== undefined) {
      if (!Number.isInteger(params.limit) || params.limit < 0 || params.limit > 1000) {
        throw new SynapseEnhancedError("Invalid limit parameter", ErrorCode.INVALID_PARAM, {
          limit: params.limit
        }, 400);
      }
    }
    if (params.from !== undefined) {
      if (typeof params.from !== "string" || params.from.length > 255) {
        throw new SynapseEnhancedError("Invalid from parameter", ErrorCode.INVALID_PARAM, {
          from: params.from
        }, 400);
      }
    }
    if (params.to !== undefined) {
      if (typeof params.to !== "string" || params.to.length > 255) {
        throw new SynapseEnhancedError("Invalid to parameter", ErrorCode.INVALID_PARAM, {
          to: params.to
        }, 400);
      }
    }
  }
  static validateDisplayName(displayName) {
    if (!displayName || typeof displayName !== "string") {
      throw new SynapseEnhancedError("Display name is required", ErrorCode.INVALID_PARAM, undefined, 400);
    }
    var sanitized = this.sanitizeString(displayName, 255);
    if (sanitized.length === 0) {
      throw new SynapseEnhancedError("Display name cannot be empty after sanitization", ErrorCode.INVALID_PARAM, undefined, 400);
    }
    return sanitized;
  }
  static validateRoomAlias(alias) {
    if (!alias || typeof alias !== "string") {
      throw new SynapseEnhancedError("Room alias is required", ErrorCode.INVALID_PARAM, undefined, 400);
    }
    if (!alias.startsWith("#") || !alias.includes(":")) {
      throw new SynapseEnhancedError("Invalid room alias format", ErrorCode.INVALID_PARAM, {
        alias
      }, 400);
    }
    return this.sanitizeString(alias, 255);
  }
  static escapeShellChars(input) {
    return input.replace(/[;&|`$(){}[\]\\!#*?"'<>\n]/g, "");
  }

  /**
   * Validates an IPv4 address
   * @param ip - The IP address string to validate
   * @returns True if valid IPv4 format, false otherwise
   */
  static isValidIPv4(ip) {
    if (!ip || typeof ip !== "string") {
      return false;
    }
    if (!IPV4_REGEX.test(ip)) {
      return false;
    }
    // Check each octet is 0-255
    var octets = ip.split(".");
    return octets.every(octet => {
      var num = Number.parseInt(octet, 10);
      return num >= 0 && num <= 255;
    });
  }

  /**
   * Validates an IPv6 address
   * @param ip - The IP address string to validate
   * @returns True if valid IPv6 format, false otherwise
   */
  static isValidIPv6(ip) {
    if (!ip || typeof ip !== "string") {
      return false;
    }
    return IPV6_REGEX.test(ip) || IPV6_SHORT_REGEX.test(ip);
  }

  /**
   * Validates an IP address (IPv4 or IPv6)
   * @param ip - The IP address string to validate
   * @returns True if valid IP format, false otherwise
   */
  static isValidIpAddress(ip) {
    return this.isValidIPv4(ip) || this.isValidIPv6(ip);
  }

  /**
   * Validates an IP address and returns the normalized form
   * @param ip - The IP address string to validate and normalize
   * @returns The normalized IP address
   * @throws SynapseEnhancedError if IP address is invalid
   */
  static validateIpAddress(ip) {
    if (!ip || typeof ip !== "string") {
      throw new SynapseEnhancedError("IP address is required", ErrorCode.INVALID_PARAM, undefined, 400);
    }
    ip = ip.trim();
    if (!this.isValidIpAddress(ip)) {
      throw new SynapseEnhancedError("Invalid IP address format: ".concat(ip), ErrorCode.INVALID_PARAM, {
        ip
      }, 400);
    }
    return ip;
  }
}
_defineProperty(InputValidator, "SANITIZE_PATTERN", /<[^>]*>/g);
_defineProperty(InputValidator, "SQL_INJECTION_PATTERN", /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|EXEC|Xp_)\b)|(')|(--)|(\/\*)|(\*\/)/i);
_defineProperty(InputValidator, "SCRIPT_PATTERN", /<script[^>]*>.*?<\/script>/gi);
export function assertValidUserId(userId) {
  if (!InputValidator.isValidUserId(userId)) {
    throw new SynapseEnhancedError("Invalid user ID: ".concat(userId), ErrorCode.INVALID_PARAM, {
      userId
    }, 400);
  }
}
export function assertValidRoomId(roomId) {
  if (!InputValidator.isValidRoomId(roomId)) {
    throw new SynapseEnhancedError("Invalid room ID: ".concat(roomId), ErrorCode.INVALID_PARAM, {
      roomId
    }, 400);
  }
}
export function assertValidEventId(eventId) {
  if (!InputValidator.isValidEventId(eventId)) {
    throw new SynapseEnhancedError("Invalid event ID: ".concat(eventId), ErrorCode.INVALID_PARAM, {
      eventId
    }, 400);
  }
}
var SERVER_NAME_REGEX = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
export function validateServerName(serverName) {
  if (!serverName || typeof serverName !== "string") {
    throw new SynapseEnhancedError("Server name is required", ErrorCode.INVALID_PARAM, {
      serverName
    }, 400);
  }
  if (serverName.length > 255) {
    throw new SynapseEnhancedError("Server name too long: ".concat(serverName), ErrorCode.INVALID_PARAM, {
      length: serverName.length
    }, 400);
  }
  if (!SERVER_NAME_REGEX.test(serverName)) {
    throw new SynapseEnhancedError("Invalid server name format: ".concat(serverName), ErrorCode.INVALID_PARAM, {
      serverName
    }, 400);
  }
  return serverName;
}
export function validateString(input, name, options) {
  if (typeof input !== "string") {
    throw new SynapseEnhancedError("".concat(name, " must be a string"), ErrorCode.INVALID_PARAM, {
      expected: "string",
      actual: typeof input
    }, 400);
  }
  if ((options === null || options === void 0 ? void 0 : options.minLength) !== undefined && input.length < options.minLength) {
    throw new SynapseEnhancedError("".concat(name, " must be at least ").concat(options.minLength, " characters"), ErrorCode.INVALID_PARAM, {
      minLength: options.minLength,
      actualLength: input.length
    }, 400);
  }
  if ((options === null || options === void 0 ? void 0 : options.maxLength) !== undefined && input.length > options.maxLength) {
    throw new SynapseEnhancedError("".concat(name, " must be at most ").concat(options.maxLength, " characters"), ErrorCode.INVALID_PARAM, {
      maxLength: options.maxLength,
      actualLength: input.length
    }, 400);
  }
  if ((options === null || options === void 0 ? void 0 : options.pattern) !== undefined && !options.pattern.test(input)) {
    throw new SynapseEnhancedError("".concat(name, " does not match the required pattern"), ErrorCode.INVALID_PARAM, {
      pattern: options.pattern.toString()
    }, 400);
  }
  return input;
}
export function validateNumber(input, name, options) {
  if (typeof input !== "number" || isNaN(input) || !isFinite(input)) {
    throw new SynapseEnhancedError("".concat(name, " must be a valid number"), ErrorCode.INVALID_PARAM, {
      expected: "number",
      actual: typeof input
    }, 400);
  }
  if ((options === null || options === void 0 ? void 0 : options.min) !== undefined && input < options.min) {
    throw new SynapseEnhancedError("".concat(name, " must be at least ").concat(options.min), ErrorCode.INVALID_PARAM, {
      min: options.min,
      actual: input
    }, 400);
  }
  if ((options === null || options === void 0 ? void 0 : options.max) !== undefined && input > options.max) {
    throw new SynapseEnhancedError("".concat(name, " must be at most ").concat(options.max), ErrorCode.INVALID_PARAM, {
      max: options.max,
      actual: input
    }, 400);
  }
  if ((options === null || options === void 0 ? void 0 : options.integer) !== undefined && options.integer && !Number.isInteger(input)) {
    throw new SynapseEnhancedError("".concat(name, " must be an integer"), ErrorCode.INVALID_PARAM, {
      expected: "integer",
      actual: input
    }, 400);
  }
  return input;
}
export function validateBoolean(input, name) {
  if (typeof input !== "boolean") {
    throw new SynapseEnhancedError("".concat(name, " must be a boolean"), ErrorCode.INVALID_PARAM, {
      expected: "boolean",
      actual: typeof input
    }, 400);
  }
  return input;
}
export function validateArray(input, name, options) {
  if (!Array.isArray(input)) {
    throw new SynapseEnhancedError("".concat(name, " must be an array"), ErrorCode.INVALID_PARAM, {
      expected: "array",
      actual: typeof input
    }, 400);
  }
  if ((options === null || options === void 0 ? void 0 : options.minLength) !== undefined && input.length < options.minLength) {
    throw new SynapseEnhancedError("".concat(name, " must have at least ").concat(options.minLength, " elements"), ErrorCode.INVALID_PARAM, {
      minLength: options.minLength,
      actualLength: input.length
    }, 400);
  }
  if ((options === null || options === void 0 ? void 0 : options.maxLength) !== undefined && input.length > options.maxLength) {
    throw new SynapseEnhancedError("".concat(name, " must have at most ").concat(options.maxLength, " elements"), ErrorCode.INVALID_PARAM, {
      maxLength: options.maxLength,
      actualLength: input.length
    }, 400);
  }
  if ((options === null || options === void 0 ? void 0 : options.itemValidator) !== undefined) {
    for (var i = 0; i < input.length; i++) {
      var validationResult = options.itemValidator(input[i]);
      var isValid = typeof validationResult === "boolean" ? validationResult : validationResult.valid;
      if (!isValid) {
        throw new SynapseEnhancedError("".concat(name, "[").concat(i, "] failed validation"), ErrorCode.INVALID_PARAM, {
          index: i,
          value: input[i]
        }, 400);
      }
    }
  }
  return input;
}
export function validateObject(input, name, options) {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new SynapseEnhancedError("".concat(name, " must be an object"), ErrorCode.INVALID_PARAM, {
      expected: "object",
      actual: typeof input
    }, 400);
  }
  var obj = input;
  if (options) {
    for (var [_field, fieldOptions] of Object.entries(options)) {
      if (fieldOptions.required && !(_field in obj)) {
        throw new SynapseEnhancedError("".concat(name, ".").concat(_field, " is required"), ErrorCode.INVALID_PARAM, {
          field: _field
        }, 400);
      }
      if (_field in obj && fieldOptions.validator !== undefined) {
        var validationResult = fieldOptions.validator(obj[_field]);
        var isValid = typeof validationResult === "boolean" ? validationResult : validationResult.valid;
        if (!isValid) {
          throw new SynapseEnhancedError("".concat(name, ".").concat(_field, " failed validation"), ErrorCode.INVALID_PARAM, {
            field: _field,
            value: obj[_field]
          }, 400);
        }
      }
    }
  }
  return obj;
}
export function validateUserId(userId) {
  if (!InputValidator.isValidUserId(userId)) {
    return {
      valid: false,
      error: "Invalid user ID: ".concat(userId)
    };
  }
  return {
    valid: true
  };
}
export function validateRoomId(roomId) {
  if (!InputValidator.isValidRoomId(roomId)) {
    return {
      valid: false,
      error: "Invalid room ID: ".concat(roomId)
    };
  }
  return {
    valid: true
  };
}
export function validateEventId(eventId) {
  if (!InputValidator.isValidEventId(eventId)) {
    return {
      valid: false,
      error: "Invalid event ID: ".concat(eventId)
    };
  }
  return {
    valid: true
  };
}
export function validatePaginationParams(params) {
  var result = {};
  var safeParams = params !== null && params !== void 0 ? params : {};
  if (safeParams.limit !== undefined) {
    if (typeof safeParams.limit !== "number" || safeParams.limit < 1 || safeParams.limit > 1000) {
      throw new SynapseEnhancedError("Limit must be a number between 1 and 1000", ErrorCode.INVALID_PARAM, {
        limit: safeParams.limit
      }, 400);
    }
    result.limit = safeParams.limit;
  }
  if (safeParams.page !== undefined) {
    if (typeof safeParams.page !== "number" || safeParams.page < 1) {
      throw new SynapseEnhancedError("Page must be a positive number", ErrorCode.INVALID_PARAM, {
        page: safeParams.page
      }, 400);
    }
    result.page = safeParams.page;
  }
  if (safeParams.cursor !== undefined) {
    if (typeof safeParams.cursor !== "string" || safeParams.cursor.length === 0) {
      throw new SynapseEnhancedError("Cursor must be a non-empty string", ErrorCode.INVALID_PARAM, {
        cursor: safeParams.cursor
      }, 400);
    }
    result.cursor = safeParams.cursor;
  }
  return result;
}
export function validateMessageId(messageId) {
  if (!InputValidator.isValidEventId(messageId)) {
    return {
      valid: false,
      error: "Invalid message ID: ".concat(messageId)
    };
  }
  return {
    valid: true
  };
}
export function sanitizeContent(content, options) {
  var result;
  if (content == null) {
    result = "";
  } else if (typeof content === "string") {
    result = InputValidator.sanitizeString(content);
  } else {
    result = InputValidator.sanitizeString(JSON.stringify(content));
  }
  if ((options === null || options === void 0 ? void 0 : options.maxLength) !== undefined && result.length > options.maxLength) {
    result = result.slice(0, options.maxLength);
  }
  return result;
}

/**
 * Asserts that a value is a valid IP address (IPv4 or IPv6)
 * @param ip - The IP address to validate
 * @throws SynapseEnhancedError if IP address is invalid
 */
export function assertValidIpAddress(ip) {
  if (!InputValidator.isValidIpAddress(ip)) {
    throw new SynapseEnhancedError("Invalid IP address: ".concat(ip), ErrorCode.INVALID_PARAM, {
      ip
    }, 400);
  }
}

/**
 * Validates an IP address and returns a validation result
 * @param ip - The IP address to validate
 * @returns Validation result with valid flag and optional error message
 */
export function validateIpAddress(ip) {
  if (!InputValidator.isValidIpAddress(ip)) {
    return {
      valid: false,
      error: "Invalid IP address: ".concat(ip)
    };
  }
  return {
    valid: true
  };
}
//# sourceMappingURL=validator.js.map