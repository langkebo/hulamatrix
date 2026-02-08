import _defineProperty from "@babel/runtime/helpers/defineProperty";
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
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

import { getBackendProfile } from "../constants/api.js";
export var DEFAULT_API_MAPPING = {
  paramMappings: {
    admin: {
      search: "q",
      limit: "page_size",
      page: "page",
      sort: "sort_by",
      order: "order_by",
      userId: "user_id",
      roomId: "room_id",
      messageId: "message_id",
      adminId: "admin_id",
      categoryId: "category_id"
    },
    friends: {
      search: "q",
      limit: "page_size",
      cursor: "cursor",
      categoryId: "category_name",
      friendId: "friend_id",
      requestId: "request_id",
      targetUserId: "target_user_id",
      target_id: "target_user_id",
      otherUserId: "other_user_id",
      userId: "user_id",
      query: "q"
    },
    messages: {
      search: "q",
      query: "q",
      limit: "page_size",
      page: "page",
      offset: "offset",
      roomId: "room_id",
      room_id: "room_id",
      senderId: "sender_id",
      sender_id: "sender_id",
      userId: "user_id",
      user_id: "user_id"
    },
    chatrooms: {
      limit: "page_size",
      cursor: "cursor",
      roomId: "room_id",
      userId: "user_id",
      user_id: "user_id"
    },
    privateChat: {
      sessionId: "room_id",
      session_id: "room_id",
      limit: "page_size",
      userId: "user_id",
      user_id: "user_id",
      messageId: "message_id",
      message_id: "message_id"
    },
    security: {
      eventId: "event_id",
      event_id: "event_id",
      policyId: "policy_id",
      policy_id: "policy_id",
      limit: "page_size",
      userId: "user_id",
      user_id: "user_id"
    },
    securityAdmin: {
      eventId: "event_id",
      event_id: "event_id",
      userId: "user_id",
      user_id: "user_id",
      roomId: "room_id",
      room_id: "room_id",
      severity: "severity",
      resolved: "resolved",
      limit: "page_size"
    },
    voice: {
      messageId: "message_id",
      message_id: "message_id",
      limit: "page_size",
      targetFormat: "target_format",
      target_size_mb: "target_size_mb"
    },
    presence: {
      userId: "user_id",
      user_id: "user_id"
    }
  },
  pathMappings: {
    "/enhanced/admin": "/api/v1/admin",
    "/enhanced/friends/v2": "/api/v1/friends",
    "/enhanced/private_chat/v2": "/api/v1/chatrooms",
    "/enhanced/security": "/enhanced/security",
    "/enhanced/friend-requests": "/_matrix/client/v1/friends/requests",
    "/enhanced/friend-categories": "/_matrix/client/v1/friends/categories",
    "/enhanced/blocked-users": "/_matrix/client/v1/friends/blocked",
    "/enhanced/private-chat-admin": "/_synapse/admin/v2/private_chat",
    "/enhanced/audio-upload": "/_matrix/client/v1/upload/audio",
    "/presence": "/presence",
    "/voice": "/voice",
    "/voice/user": "/voice/user"
  },
  // Synapse Rust specific path mappings
  synapseRustPathMappings: {
    // Friends API mappings
    "/_matrix/client/r0/friends": "/_synapse/enhanced/friend",
    "/_matrix/client/r0/friends/requests": "/_synapse/enhanced/friend/requests",
    "/_matrix/client/r0/friends/categories": "/_synapse/enhanced/friend/categories",
    "/_matrix/client/r0/friends/blocked": "/_synapse/enhanced/friend/blocked",
    "/_matrix/client/r0/friends/stats": "/_synapse/enhanced/friend/stats",
    // Private chat API mappings
    "/_matrix/client/r0/private_chat": "/_synapse/enhanced/private",
    "/_matrix/client/r0/private_chat/sessions": "/_synapse/enhanced/private/sessions",
    // Admin API version mappings (v2 -> v1)
    "/_synapse/admin/v2/users": "/_synapse/admin/v1/users",
    "/_synapse/admin/v2/rooms": "/_synapse/admin/v1/rooms",
    "/_synapse/admin/v2/messages": "/_synapse/admin/v1/messages",
    "/_synapse/admin/v2/private_chat": "/_synapse/admin/v1/private_chat"
  },
  defaultPageSize: 20,
  maxPageSize: 100
};
var PARAM_MAPPING_CACHE_MAX_SIZE = 100;
var paramMappingCache = new Map();
function getCachedParamMapping(module, sdkKey) {
  var cacheKey = "".concat(module, ":").concat(sdkKey);
  return paramMappingCache.get(cacheKey);
}
function setParamMappingCache(module, sdkKey, backendKey) {
  if (paramMappingCache.size >= PARAM_MAPPING_CACHE_MAX_SIZE) {
    var firstKey = paramMappingCache.keys().next().value;
    if (firstKey !== undefined) {
      paramMappingCache.delete(firstKey);
    }
  }
  paramMappingCache.set("".concat(module, ":").concat(sdkKey), backendKey);
}
export function mapParams(params, module) {
  var mappings = DEFAULT_API_MAPPING.paramMappings[module] || {};
  var mapped = {};
  for (var [sdkKey, value] of Object.entries(params)) {
    if (value === undefined || value === null) {
      continue;
    }
    var backendKey = getCachedParamMapping(module, sdkKey);
    if (backendKey === undefined) {
      backendKey = mappings[sdkKey] || sdkKey;
      setParamMappingCache(module, sdkKey, backendKey);
    }
    if (typeof value === "boolean") {
      mapped[backendKey] = value ? "yes" : "no";
    } else if (typeof value === "number") {
      mapped[backendKey] = value;
    } else if (typeof value === "string" || typeof value === "object") {
      mapped[backendKey] = value;
    }
  }
  return mapped;
}
export function mapPath(path, backendProfile) {
  var profile = backendProfile !== null && backendProfile !== void 0 ? backendProfile : getBackendProfile();
  var useSynapseRustMappings = profile === "synapse_rust";

  // First, check for standard path mappings
  var standardMappings = DEFAULT_API_MAPPING.pathMappings;
  for (var [sdkPrefix, backendPrefix] of Object.entries(standardMappings)) {
    if (path.startsWith(sdkPrefix)) {
      return path.replace(sdkPrefix, backendPrefix);
    }
  }

  // If Synapse Rust profile, apply Synapse Rust specific mappings
  if (useSynapseRustMappings) {
    var rustMappings = DEFAULT_API_MAPPING.synapseRustPathMappings;
    for (var [_sdkPrefix, _backendPrefix] of Object.entries(rustMappings)) {
      if (path.startsWith(_sdkPrefix)) {
        return path.replace(_sdkPrefix, _backendPrefix);
      }
    }
  }

  // Handle dynamic path segments (e.g., /users/{userId})
  // Apply prefix mappings for dynamic paths
  if (useSynapseRustMappings) {
    // Map admin v2 paths to v1 for Synapse Rust
    if (path.startsWith("/_synapse/admin/v2/")) {
      return path.replace("/_synapse/admin/v2/", "/_synapse/admin/v1/");
    }
    // Map friends paths
    if (path.startsWith("/_matrix/client/r0/friends")) {
      return path.replace("/_matrix/client/r0/friends", "/_synapse/enhanced/friend");
    }
    // Map private_chat paths
    if (path.startsWith("/_matrix/client/r0/private_chat")) {
      return path.replace("/_matrix/client/r0/private_chat", "/_synapse/enhanced/private");
    }
  }
  return path;
}

/**
 * Map parameters based on the backend profile
 * For Synapse Rust, some parameter names are different
 */
export function mapParamsForProfile(params, module, backendProfile) {
  var profile = backendProfile !== null && backendProfile !== void 0 ? backendProfile : getBackendProfile();
  var baseMapped = mapParams(params, module);

  // Synapse Rust specific parameter adjustments
  if (profile === "synapse_rust") {
    var mapped = _objectSpread({}, baseMapped);

    // Handle specific parameter name changes for Synapse Rust
    if (module === "friends") {
      // target_user_id -> user_id for friend requests
      if ("target_user_id" in mapped && mapped.target_user_id !== undefined) {
        mapped.user_id = mapped.target_user_id;
        delete mapped.target_user_id;
      }
    }
    return mapped;
  }
  return baseMapped;
}
export function sanitizeLimit(limit) {
  if (limit === undefined) {
    return DEFAULT_API_MAPPING.defaultPageSize;
  }
  return Math.min(Math.max(1, limit), DEFAULT_API_MAPPING.maxPageSize);
}
export function formatPagination(page, limit) {
  var _sanitizeLimit;
  if (page === undefined && limit === undefined) {
    return undefined;
  }
  return {
    page: page !== null && page !== void 0 ? page : 1,
    page_size: (_sanitizeLimit = sanitizeLimit(limit)) !== null && _sanitizeLimit !== void 0 ? _sanitizeLimit : DEFAULT_API_MAPPING.defaultPageSize
  };
}
export function parseCursor(cursor) {
  if (!cursor) {
    return undefined;
  }
  return {
    cursor
  };
}
//# sourceMappingURL=api-mapping.js.map