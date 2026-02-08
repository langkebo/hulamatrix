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

export var ErrorCode = /*#__PURE__*/function (ErrorCode) {
  ErrorCode["UNKNOWN"] = "M_UNKNOWN";
  ErrorCode["INVALID_PARAM"] = "M_INVALID_PARAM";
  ErrorCode["PARAM_MISSING"] = "M_PARAM_MISSING";
  ErrorCode["PARAM_INVALID"] = "M_PARAM_INVALID";
  ErrorCode["PARAM_TOO_LONG"] = "M_PARAM_TOO_LONG";
  ErrorCode["PARAM_TOO_SMALL"] = "M_PARAM_TOO_SMALL";
  ErrorCode["PARAM_OUT_OF_RANGE"] = "M_PARAM_OUT_OF_RANGE";
  ErrorCode["UNKNOWN_TOKEN"] = "M_UNKNOWN_TOKEN";
  ErrorCode["FORBIDDEN"] = "M_FORBIDDEN";
  ErrorCode["AUTH_FORBIDDEN"] = "M_AUTH_FORBIDDEN";
  ErrorCode["NOT_FOUND"] = "M_NOT_FOUND";
  ErrorCode["LIMIT_EXCEEDED"] = "M_LIMIT_EXCEEDED";
  ErrorCode["INTERNAL_ERROR"] = "M_INTERNAL_ERROR";
  ErrorCode["UNAVAILABLE"] = "M_UNAVAILABLE";
  ErrorCode["TIMEOUT"] = "M_TIMEOUT";
  ErrorCode["NET_ERROR"] = "M_NET_ERROR";
  ErrorCode["ALREADY_EXISTS"] = "M_ALREADY_EXISTS";
  ErrorCode["DEPRECATED"] = "M_DEPRECATED";
  ErrorCode["BATCH_OPERATION_FAILED"] = "M_BATCH_OPERATION_FAILED";
  ErrorCode["BATCH_PARTIAL_FAILURE"] = "M_BATCH_PARTIAL_FAILURE";
  ErrorCode["AUTH_REQUIRED"] = "M_AUTH_REQUIRED";
  ErrorCode["AUTH_INVALID"] = "M_AUTH_INVALID";
  ErrorCode["AUTH_EXPIRED"] = "M_AUTH_EXPIRED";
  ErrorCode["BAD_JSON"] = "M_BAD_JSON";
  ErrorCode["CONFLICT"] = "M_CONFLICT";
  ErrorCode["RATE_LIMITED"] = "M_RATE_LIMITED";
  ErrorCode["THROTTLED"] = "M_THROTTLED";
  ErrorCode["SERVICE_UNAVAILABLE"] = "M_SERVICE_UNAVAILABLE";
  ErrorCode["MISSING_TOKEN"] = "M_MISSING_TOKEN";
  ErrorCode["USER_NOT_FOUND"] = "M_USER_NOT_FOUND";
  ErrorCode["USER_SUSPENDED"] = "M_USER_SUSPENDED";
  ErrorCode["ROOM_NOT_FOUND"] = "M_ROOM_NOT_FOUND";
  ErrorCode["FRIEND_NOT_FOUND"] = "M_FRIEND_NOT_FOUND";
  ErrorCode["FRIEND_REQUEST_PENDING"] = "M_FRIEND_REQUEST_PENDING";
  ErrorCode["BLACKLISTED"] = "M_BLACKLISTED";
  ErrorCode["THREAT_DETECTED"] = "M_THREAT_DETECTED";
  ErrorCode["IP_BLOCKED"] = "M_IP_BLOCKED";
  ErrorCode["CHAT_NOT_FOUND"] = "M_CHAT_NOT_FOUND";
  ErrorCode["MESSAGE_NOT_FOUND"] = "M_MESSAGE_NOT_FOUND";
  ErrorCode["SESSION_NOT_FOUND"] = "M_SESSION_NOT_FOUND";
  ErrorCode["TEMPLATE_NOT_FOUND"] = "M_TEMPLATE_NOT_FOUND";
  ErrorCode["TEMPLATE_EXISTS"] = "M_TEMPLATE_EXISTS";
  ErrorCode["PERMISSION_DENIED"] = "M_PERMISSION_DENIED";
  ErrorCode["CANCELLED"] = "M_CANCELLED";
  return ErrorCode;
}({});
export var HTTP_STATUS_TO_ERROR_CODE = {
  400: ErrorCode.INVALID_PARAM,
  401: ErrorCode.UNKNOWN_TOKEN,
  403: ErrorCode.FORBIDDEN,
  404: ErrorCode.NOT_FOUND,
  409: ErrorCode.ALREADY_EXISTS,
  429: ErrorCode.LIMIT_EXCEEDED,
  500: ErrorCode.INTERNAL_ERROR,
  502: ErrorCode.UNAVAILABLE,
  503: ErrorCode.UNAVAILABLE,
  504: ErrorCode.TIMEOUT
};
export function getErrorCodeFromStatus(status) {
  return HTTP_STATUS_TO_ERROR_CODE[status] || ErrorCode.UNKNOWN;
}
export var ERROR_CODE_MAPPING = {
  "E_USER_NOT_FOUND": ErrorCode.USER_NOT_FOUND,
  "E_FRIEND_NOT_FOUND": ErrorCode.FRIEND_NOT_FOUND,
  "E_ROOM_NOT_FOUND": ErrorCode.ROOM_NOT_FOUND,
  "E_CHAT_NOT_FOUND": ErrorCode.CHAT_NOT_FOUND,
  "E_MESSAGE_NOT_FOUND": ErrorCode.MESSAGE_NOT_FOUND,
  "E_SESSION_NOT_FOUND": ErrorCode.SESSION_NOT_FOUND,
  "E_TEMPLATE_NOT_FOUND": ErrorCode.TEMPLATE_NOT_FOUND,
  "E_TEMPLATE_EXISTS": ErrorCode.TEMPLATE_EXISTS,
  "E_BLACKLISTED": ErrorCode.BLACKLISTED,
  "E_IP_BLOCKED": ErrorCode.IP_BLOCKED,
  "E_THREAT_DETECTED": ErrorCode.THREAT_DETECTED,
  "E_USER_SUSPENDED": ErrorCode.USER_SUSPENDED,
  "E_FRIEND_REQUEST_PENDING": ErrorCode.FRIEND_REQUEST_PENDING,
  "1001": ErrorCode.INVALID_PARAM,
  "1002": ErrorCode.PARAM_MISSING,
  "2001": ErrorCode.AUTH_REQUIRED,
  "2002": ErrorCode.UNKNOWN_TOKEN,
  "3001": ErrorCode.FRIEND_NOT_FOUND,
  "4001": ErrorCode.CHAT_NOT_FOUND,
  "6001": ErrorCode.USER_NOT_FOUND,
  "9001": ErrorCode.INTERNAL_ERROR
};
export function normalizeErrorCode(code) {
  if (ERROR_CODE_MAPPING[code]) {
    return ERROR_CODE_MAPPING[code];
  }
  if (code.startsWith("M_")) {
    return code;
  }
  return ErrorCode.UNKNOWN;
}
//# sourceMappingURL=error-codes.js.map