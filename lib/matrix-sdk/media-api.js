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

/**
 * Media API for uploading, downloading, and managing media files.
 *
 * This module provides methods for interacting with the Matrix Content Repository API.
 * @see https://spec.matrix.org/v1.11/client-server-api/#matrix-content-repository
 */

/**
 * Response from a successful media upload.
 */

/**
 * Parameters for uploading media.
 */

/**
 * Media configuration response from the homeserver.
 */

/**
 * Media API class for handling media operations.
 */
export class MediaApi {
  /**
   * Creates a new MediaApi instance.
   *
   * @param baseUrl - The base URL of the homeserver.
   * @param accessToken - The access token for authenticated requests.
   */
  constructor(baseUrl, accessToken) {
    this.baseUrl = baseUrl;
    this.accessToken = accessToken;
  }

  /**
   * Upload media to the content repository.
   *
   * @param file - The file data as a Buffer, Blob, or string.
   * @param options - Optional upload parameters.
   * @returns Promise resolving to the content URI of the uploaded file.
   * @see https://spec.matrix.org/v1.11/client-server-api/#post_matrixmediav3upload
   */
  upload(file, options) {
    var _this = this;
    return _asyncToGenerator(function* () {
      var formData = new FormData();
      var blob = file instanceof Blob ? file : new Blob([file]);
      formData.append("file", blob, (options === null || options === void 0 ? void 0 : options.filename) || "upload");
      var url = new URL("/_matrix/media/v3/upload", _this.baseUrl);
      if (options !== null && options !== void 0 && options.filename) {
        url.searchParams.set("filename", options.filename);
      }
      var headers = {};
      if (options !== null && options !== void 0 && options.contentType) {
        headers["Content-Type"] = options.contentType;
      }
      if (_this.accessToken) {
        headers["Authorization"] = "Bearer ".concat(_this.accessToken);
      }
      var response = yield fetch(url.href, {
        method: "POST",
        headers,
        body: formData
      });
      if (!response.ok) {
        var error = yield response.text();
        throw new Error("Failed to upload media: ".concat(response.status, " ").concat(response.statusText, " - ").concat(error));
      }
      return response.json();
    })();
  }

  /**
   * Download media from the content repository.
   *
   * @param serverName - The homeserver name (e.g., "matrix.org").
   * @param mediaId - The media ID.
   * @param allowRedirects - Whether to allow redirects. Defaults to true.
   * @returns Promise resolving to the media data as a Blob.
   * @see https://spec.matrix.org/v1.11/client-server-api/#get_matrixmediav3downloadservernamemediaid
   */
  download(serverName, mediaId) {
    var _arguments = arguments,
      _this2 = this;
    return _asyncToGenerator(function* () {
      var allowRedirects = _arguments.length > 2 && _arguments[2] !== undefined ? _arguments[2] : true;
      var url = new URL("/_matrix/media/v3/download/".concat(encodeURIComponent(serverName), "/").concat(encodeURIComponent(mediaId)), _this2.baseUrl);
      if (allowRedirects !== undefined) {
        url.searchParams.set("allow_redirect", String(allowRedirects));
      }
      var headers = {};
      if (_this2.accessToken) {
        headers["Authorization"] = "Bearer ".concat(_this2.accessToken);
      }
      var response = yield fetch(url.href, {
        method: "GET",
        headers
      });
      if (!response.ok) {
        throw new Error("Failed to download media: ".concat(response.status, " ").concat(response.statusText));
      }
      return response.blob();
    })();
  }

  /**
   * Download media as an ArrayBuffer.
   *
   * @param serverName - The homeserver name (e.g., "matrix.org").
   * @param mediaId - The media ID.
   * @param allowRedirects - Whether to allow redirects. Defaults to true.
   * @returns Promise resolving to the media data as an ArrayBuffer.
   */
  downloadAsArrayBuffer(serverName, mediaId) {
    var _arguments2 = arguments,
      _this3 = this;
    return _asyncToGenerator(function* () {
      var allowRedirects = _arguments2.length > 2 && _arguments2[2] !== undefined ? _arguments2[2] : true;
      var blob = yield _this3.download(serverName, mediaId, allowRedirects);
      return blob.arrayBuffer();
    })();
  }

  /**
   * Download media as a data URL.
   *
   * @param serverName - The homeserver name (e.g., "matrix.org").
   * @param mediaId - The media ID.
   * @param allowRedirects - Whether to allow redirects. Defaults to true.
   * @returns Promise resolving to the media data as a base64 data URL.
   */
  downloadAsDataUrl(serverName, mediaId) {
    var _arguments3 = arguments,
      _this4 = this;
    return _asyncToGenerator(function* () {
      var allowRedirects = _arguments3.length > 2 && _arguments3[2] !== undefined ? _arguments3[2] : true;
      var blob = yield _this4.download(serverName, mediaId, allowRedirects);
      return new Promise((resolve, reject) => {
        var reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Failed to convert blob to data URL"));
        reader.readAsDataURL(blob);
      });
    })();
  }

  /**
   * Get a thumbnail for media.
   *
   * @param serverName - The homeserver name (e.g., "matrix.org").
   * @param mediaId - The media ID.
   * @param width - The desired width of the thumbnail.
   * @param height - The desired height of the thumbnail.
   * @param method - The resize method ("crop" or "scale"). Defaults to "scale".
   * @param allowRedirects - Whether to allow redirects. Defaults to true.
   * @returns Promise resolving to the thumbnail data as a Blob.
   * @see https://spec.matrix.org/v1.11/client-server-api/#get_matrixmediav3thumbnailservernamemediaid
   */
  getThumbnail(serverName, mediaId, width, height) {
    var _arguments4 = arguments,
      _this5 = this;
    return _asyncToGenerator(function* () {
      var method = _arguments4.length > 4 && _arguments4[4] !== undefined ? _arguments4[4] : "scale";
      var allowRedirects = _arguments4.length > 5 && _arguments4[5] !== undefined ? _arguments4[5] : true;
      var url = new URL("/_matrix/media/v3/thumbnail/".concat(encodeURIComponent(serverName), "/").concat(encodeURIComponent(mediaId)), _this5.baseUrl);
      url.searchParams.set("width", Math.round(width).toString());
      url.searchParams.set("height", Math.round(height).toString());
      url.searchParams.set("method", method);
      url.searchParams.set("allow_redirect", String(allowRedirects));
      var headers = {};
      if (_this5.accessToken) {
        headers["Authorization"] = "Bearer ".concat(_this5.accessToken);
      }
      var response = yield fetch(url.href, {
        method: "GET",
        headers
      });
      if (!response.ok) {
        throw new Error("Failed to get thumbnail: ".concat(response.status, " ").concat(response.statusText));
      }
      return response.blob();
    })();
  }

  /**
   * Get a thumbnail as a data URL.
   *
   * @param serverName - The homeserver name (e.g., "matrix.org").
   * @param mediaId - The media ID.
   * @param width - The desired width of the thumbnail.
   * @param height - The desired height of the thumbnail.
   * @param method - The resize method ("crop" or "scale"). Defaults to "scale".
   * @param allowRedirects - Whether to allow redirects. Defaults to true.
   * @returns Promise resolving to the thumbnail data as a base64 data URL.
   */
  getThumbnailAsDataUrl(serverName, mediaId, width, height) {
    var _arguments5 = arguments,
      _this6 = this;
    return _asyncToGenerator(function* () {
      var method = _arguments5.length > 4 && _arguments5[4] !== undefined ? _arguments5[4] : "scale";
      var allowRedirects = _arguments5.length > 5 && _arguments5[5] !== undefined ? _arguments5[5] : true;
      var blob = yield _this6.getThumbnail(serverName, mediaId, width, height, method, allowRedirects);
      return new Promise((resolve, reject) => {
        var reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Failed to convert blob to data URL"));
        reader.readAsDataURL(blob);
      });
    })();
  }

  /**
   * Get the media configuration from the homeserver.
   *
   * @returns Promise resolving to the media configuration.
   * @see https://spec.matrix.org/v1.11/client-server-api/#get_matrixmediav1config
   */
  getConfig() {
    var _this7 = this;
    return _asyncToGenerator(function* () {
      var url = new URL("/_matrix/media/v1/config", _this7.baseUrl);
      var headers = {};
      if (_this7.accessToken) {
        headers["Authorization"] = "Bearer ".concat(_this7.accessToken);
      }
      var response = yield fetch(url.href, {
        method: "GET",
        headers
      });
      if (!response.ok) {
        throw new Error("Failed to get media config: ".concat(response.status, " ").concat(response.statusText));
      }
      return response.json();
    })();
  }

  /**
   * Get the maximum upload size configured on the homeserver.
   *
   * @returns Promise resolving to the maximum upload size in bytes, or null if not configured.
   */
  getMaxUploadSize() {
    var _this8 = this;
    return _asyncToGenerator(function* () {
      var _config$mUploadSize;
      var config = yield _this8.getConfig();
      return (_config$mUploadSize = config["m.upload.size"]) !== null && _config$mUploadSize !== void 0 ? _config$mUploadSize : null;
    })();
  }
}
//# sourceMappingURL=media-api.js.map