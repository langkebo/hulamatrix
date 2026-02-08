import _asyncToGenerator from "@babel/runtime/helpers/asyncToGenerator";
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

import { ErrorCode } from "../utils/error-codes.js";
import { validateMessageId, validateRoomId, validateUserId } from "../utils/validator.js";
import { EnhancedApi, useMultipartVoiceUpload } from "../constants/api.js";
import { handleApiResponse } from "../utils/response-formatter.js";
import { BaseApi } from "../utils/base-api.js";

// Maximum file size for base64 encoding (100MB) to prevent memory exhaustion
var MAX_FILE_SIZE_FOR_BASE64 = 100 * 1024 * 1024; // 100MB in bytes

export class VoiceApi extends BaseApi {
  constructor(httpClient) {
    super(httpClient);
  }

  /**
   * Get voice configuration
   */
  getConfig() {
    var _this = this;
    return _asyncToGenerator(function* () {
      var response = yield _this.httpClient.get(EnhancedApi.VOICE_CONFIG);
      return handleApiResponse(response, "Failed to get voice config");
    })();
  }

  /**
   * Upload and process a voice message
   *
   * Supports two upload protocols:
   * 1. Multipart/form-data (standard Matrix)
   * 2. JSON base64 (Synapse Rust)
   *
   * The protocol is automatically selected based on the backend profile.
   */
  upload(params) {
    var _this2 = this;
    return _asyncToGenerator(function* () {
      var useMultipart = useMultipartVoiceUpload();
      var format = params.format || "ogg";
      if (useMultipart) {
        // Standard multipart/form-data upload
        var queryParams = {
          ext: ".".concat(format)
        };
        if (params.quality) {
          queryParams.quality = params.quality;
        }
        var headers = {
          "Content-Type": "multipart/form-data; boundary=----WebKitFormBoundaryWorkaround"
        };
        var response = yield _this2.httpClient.request(EnhancedApi.VOICE_UPLOAD, {
          method: "POST",
          body: params.file,
          queryParams,
          headers
        });
        return handleApiResponse(response, "Failed to upload voice message");
      } else {
        // JSON base64 upload (Synapse Rust)
        var fileBuffer = yield _this2.fileToBuffer(params.file);
        var base64Data = _this2.bufferToBase64(fileBuffer);
        var body = {
          file_data: base64Data,
          format,
          filename: params.filename || "voice_".concat(Date.now(), ".").concat(format),
          size: fileBuffer.byteLength,
          mime_type: _this2.getMimeType(format)
        };
        if (params.quality) {
          body.quality = params.quality;
        }
        if (params.duration_ms) {
          body.duration_ms = params.duration_ms;
        }
        var _response = yield _this2.httpClient.post(EnhancedApi.VOICE_UPLOAD, body);
        return handleApiResponse(_response, "Failed to upload voice message");
      }
    })();
  }

  /**
   * Convert File/Blob to ArrayBuffer
   */
  fileToBuffer(file) {
    return _asyncToGenerator(function* () {
      if (file instanceof ArrayBuffer) {
        return file;
      }
      return yield file.arrayBuffer();
    })();
  }

  /**
   * Convert ArrayBuffer to base64 string
   * @param buffer - The ArrayBuffer to convert
   * @returns Base64 encoded string
   * @throws SynapseEnhancedError if buffer size exceeds limit
   */
  bufferToBase64(buffer) {
    // Check buffer size to prevent memory exhaustion attacks
    if (buffer.byteLength > MAX_FILE_SIZE_FOR_BASE64) {
      throw this.createError("File size (".concat(buffer.byteLength, " bytes) exceeds maximum allowed size (").concat(MAX_FILE_SIZE_FOR_BASE64, " bytes) for base64 encoding"), ErrorCode.INVALID_PARAM);
    }
    var bytes = new Uint8Array(buffer);
    var binary = "";
    for (var i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Get MIME type for audio format
   */
  getMimeType(format) {
    var mimeTypes = {
      ogg: "audio/ogg",
      mp3: "audio/mpeg",
      m4a: "audio/mp4",
      wav: "audio/wav",
      opus: "audio/opus",
      aac: "audio/aac",
      flac: "audio/flac"
    };
    return mimeTypes[format] || "audio/ogg";
  }

  /**
   * Get voice message info
   */
  getInfo(messageId) {
    var _this3 = this;
    return _asyncToGenerator(function* () {
      try {
        var _response$data, _response$data2;
        var response = yield _this3.httpClient.get(EnhancedApi.VOICE_DETAIL.replace("{messageId}", encodeURIComponent(messageId)));

        // Check for failed status before handleApiResponse throws
        if (((_response$data = response.data) === null || _response$data === void 0 ? void 0 : _response$data.status) === "failed" || !((_response$data2 = response.data) !== null && _response$data2 !== void 0 && _response$data2.data)) {
          return null;
        }
        return handleApiResponse(response, "Failed to get voice info");
      } catch (_unused) {
        return null;
      }
    })();
  }

  /**
   * Convert voice message to another format
   */
  convert(params) {
    var _this4 = this;
    return _asyncToGenerator(function* () {
      var body = {
        url: params.url,
        message_id: params.message_id,
        target_format: params.target_format
      };
      if (params.bitrate !== undefined) {
        body.bitrate = params.bitrate;
      }
      var response = yield _this4.httpClient.post(EnhancedApi.VOICE_CONVERT, body);
      return handleApiResponse(response, "Failed to convert voice message");
    })();
  }

  /**
   * Optimize voice message file size
   */
  optimize(params) {
    var _this5 = this;
    return _asyncToGenerator(function* () {
      var body = {
        url: params.url,
        message_id: params.message_id
      };
      if (params.target_size_mb !== undefined) {
        body.target_size_mb = params.target_size_mb;
      }
      if (params.bitrate !== undefined) {
        body.bitrate = params.bitrate;
      }
      var response = yield _this5.httpClient.post(EnhancedApi.VOICE_OPTIMIZE, body);
      return handleApiResponse(response, "Failed to optimize voice message");
    })();
  }
  delete(messageId) {
    var _this6 = this;
    return _asyncToGenerator(function* () {
      validateMessageId(messageId);
      var response = yield _this6.httpClient.delete(EnhancedApi.VOICE_DELETE.replace("{messageId}", encodeURIComponent(messageId)));
      handleApiResponse(response, "Failed to delete voice message");
      return true;
    })();
  }
  getUserMessages(userId) {
    var _this7 = this;
    return _asyncToGenerator(function* () {
      validateUserId(userId);
      var response = yield _this7.httpClient.get(EnhancedApi.VOICE_USER.replace("{userId}", encodeURIComponent(userId)));
      var data = handleApiResponse(response, "Failed to get user voice messages");
      return data.voice_messages || [];
    })();
  }
  getRoomMessages(roomId) {
    var _this8 = this;
    return _asyncToGenerator(function* () {
      validateRoomId(roomId);
      var response = yield _this8.httpClient.get(EnhancedApi.VOICE_ROOM.replace("{roomId}", encodeURIComponent(roomId)));
      var data = handleApiResponse(response, "Failed to get room voice messages");
      return data.voice_messages || [];
    })();
  }
  getUserStats(userId) {
    var _this9 = this;
    return _asyncToGenerator(function* () {
      validateUserId(userId);
      var response = yield _this9.httpClient.get(EnhancedApi.VOICE_USER_STATS.replace("{userId}", encodeURIComponent(userId)));
      var data = handleApiResponse(response, "Failed to get user voice stats");
      return data.stats;
    })();
  }
  getDownloadUrl(messageId) {
    var validation = validateMessageId(messageId);
    if (!validation.valid) {
      throw this.createError(validation.error || "Invalid message ID", ErrorCode.INVALID_PARAM);
    }
    return EnhancedApi.VOICE_DOWNLOAD.replace("{messageId}", encodeURIComponent(messageId));
  }
}
//# sourceMappingURL=voice.js.map