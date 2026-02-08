import _asyncToGenerator from "@babel/runtime/helpers/asyncToGenerator";
export class AudioUploadApi {
  constructor(httpClient) {
    this.httpClient = httpClient;
  }
  upload(file, options) {
    var _this = this;
    return _asyncToGenerator(function* () {
      var formData = new FormData();
      formData.append("file", file);
      if (options !== null && options !== void 0 && options.filename) {
        formData.append("filename", options.filename);
      }
      if (options !== null && options !== void 0 && options.contentType) {
        formData.append("content_type", options.contentType);
      }
      var response = yield _this.httpClient.post("/_matrix/client/v1/upload/audio", formData);
      return response.data;
    })();
  }
}
//# sourceMappingURL=audio-upload.js.map