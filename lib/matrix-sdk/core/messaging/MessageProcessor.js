import _asyncToGenerator from "@babel/runtime/helpers/asyncToGenerator";
import _defineProperty from "@babel/runtime/helpers/defineProperty";
import { Method } from "../../http-api/index.js";
export class MessageProcessor {
  constructor(http) {
    this.http = http;
    _defineProperty(this, "pendingMessages", new Map());
    _defineProperty(this, "messageQueue", new Map());
  }
  sendMessage(roomId, content) {
    var _arguments = arguments,
      _this = this;
    return _asyncToGenerator(function* () {
      var options = _arguments.length > 2 && _arguments[2] !== undefined ? _arguments[2] : {};
      var txnId = options.txnId || _this.generateTxnId();
      var eventType = options.eventType || "m.room.message";
      var key = "".concat(roomId, ":").concat(txnId);
      if (_this.pendingMessages.has(key)) {
        return _this.pendingMessages.get(key);
      }
      var promise = _this.sendEvent(roomId, eventType, content, txnId);
      _this.pendingMessages.set(key, promise);
      try {
        var eventId = yield promise;
        return eventId;
      } finally {
        _this.pendingMessages.delete(key);
      }
    })();
  }
  sendTextMessage(roomId, text, txnId) {
    var _this2 = this;
    return _asyncToGenerator(function* () {
      return _this2.sendMessage(roomId, {
        msgtype: "m.text",
        body: text
      }, {
        txnId
      });
    })();
  }
  sendHtmlMessage(roomId, html, text, txnId) {
    var _this3 = this;
    return _asyncToGenerator(function* () {
      return _this3.sendMessage(roomId, {
        msgtype: "m.text",
        body: text,
        format: "org.matrix.custom.html",
        formatted_body: html
      }, {
        txnId
      });
    })();
  }
  sendEmote(roomId, text, txnId) {
    var _this4 = this;
    return _asyncToGenerator(function* () {
      return _this4.sendMessage(roomId, {
        msgtype: "m.emote",
        body: text
      }, {
        txnId
      });
    })();
  }
  sendNotice(roomId, text, txnId) {
    var _this5 = this;
    return _asyncToGenerator(function* () {
      return _this5.sendMessage(roomId, {
        msgtype: "m.notice",
        body: text
      }, {
        txnId
      });
    })();
  }
  sendImage(roomId, url, info, text, txnId) {
    var _this6 = this;
    return _asyncToGenerator(function* () {
      return _this6.sendMessage(roomId, {
        msgtype: "m.image",
        url,
        body: text || "Image",
        info
      }, {
        txnId
      });
    })();
  }
  sendVideo(roomId, url, info, text, txnId) {
    var _this7 = this;
    return _asyncToGenerator(function* () {
      return _this7.sendMessage(roomId, {
        msgtype: "m.video",
        url,
        body: text || "Video",
        info
      }, {
        txnId
      });
    })();
  }
  sendAudio(roomId, url, info, text, txnId) {
    var _this8 = this;
    return _asyncToGenerator(function* () {
      return _this8.sendMessage(roomId, {
        msgtype: "m.audio",
        url,
        body: text || "Audio",
        info
      }, {
        txnId
      });
    })();
  }
  sendFile(roomId, url, info, text, txnId) {
    var _this9 = this;
    return _asyncToGenerator(function* () {
      return _this9.sendMessage(roomId, {
        msgtype: "m.file",
        url,
        body: text || "File",
        info
      }, {
        txnId
      });
    })();
  }
  sendLocation(roomId, geoUri, text, txnId) {
    var _this0 = this;
    return _asyncToGenerator(function* () {
      return _this0.sendMessage(roomId, {
        msgtype: "m.location",
        geo_uri: geoUri,
        body: text || "Location"
      }, {
        txnId
      });
    })();
  }
  sendReaction(roomId, eventId, emoji, txnId) {
    var _this1 = this;
    return _asyncToGenerator(function* () {
      return _this1.sendEvent(roomId, "m.reaction", {
        "m.relates_to": {
          rel_type: "m.annotation",
          event_id: eventId,
          key: emoji
        }
      }, txnId !== null && txnId !== void 0 ? txnId : _this1.generateTxnId());
    })();
  }
  redactEvent(roomId, eventId, reason, txnId) {
    var _this10 = this;
    return _asyncToGenerator(function* () {
      var path = "/rooms/".concat(roomId, "/redact/").concat(encodeURIComponent(eventId));
      var body = {};
      if (reason) {
        body.reason = reason;
      }
      var response = yield _this10.http.authedRequest(Method.Put, "".concat(path, "/").concat(txnId || _this10.generateTxnId()), undefined, body);
      return response.event_id;
    })();
  }
  getRoomMessages(roomId) {
    var _arguments2 = arguments,
      _this11 = this;
    return _asyncToGenerator(function* () {
      var options = _arguments2.length > 1 && _arguments2[1] !== undefined ? _arguments2[1] : {};
      return _this11.http.authedRequest(Method.Get, "/rooms/".concat(roomId, "/messages"), options);
    })();
  }
  getEventContext(roomId, eventId, limit) {
    var _this12 = this;
    return _asyncToGenerator(function* () {
      return _this12.http.authedRequest(Method.Get, "/rooms/".concat(roomId, "/context/").concat(encodeURIComponent(eventId)), {
        limit
      });
    })();
  }
  setReadReceipt(roomId, eventId) {
    var _arguments3 = arguments,
      _this13 = this;
    return _asyncToGenerator(function* () {
      var receiptType = _arguments3.length > 2 && _arguments3[2] !== undefined ? _arguments3[2] : "m.read";
      yield _this13.http.authedRequest(Method.Post, "/rooms/".concat(roomId, "/receipt/").concat(receiptType, "/").concat(encodeURIComponent(eventId)));
    })();
  }
  setReadMarkers(roomId, options) {
    var _this14 = this;
    return _asyncToGenerator(function* () {
      return _this14.http.authedRequest(Method.Post, "/rooms/".concat(roomId, "/read_markers"), undefined, options);
    })();
  }
  setTyping(roomId, isTyping, timeout) {
    var _this15 = this;
    return _asyncToGenerator(function* () {
      var userId = _this15.http.opts.userId;
      if (!userId) {
        throw new Error("User ID not set");
      }
      return _this15.http.authedRequest(Method.Put, "/rooms/".concat(roomId, "/typing/").concat(encodeURIComponent(userId)), undefined, {
        typing: isTyping,
        timeout
      });
    })();
  }
  queueMessage(roomId, event) {
    if (!this.messageQueue.has(roomId)) {
      this.messageQueue.set(roomId, []);
    }
    this.messageQueue.get(roomId).push(event);
  }
  getQueuedMessages(roomId) {
    return this.messageQueue.get(roomId) || [];
  }
  clearQueuedMessages(roomId) {
    this.messageQueue.delete(roomId);
  }
  sendEvent(roomId, eventType, content, txnId) {
    var _this16 = this;
    return _asyncToGenerator(function* () {
      var response = yield _this16.http.authedRequest(Method.Put, "/rooms/".concat(roomId, "/send/").concat(eventType, "/").concat(txnId), undefined, content);
      return response.event_id;
    })();
  }
  generateTxnId() {
    return "txn_".concat(Date.now(), "_").concat(Math.random().toString(36).substring(2, 11));
  }
}
//# sourceMappingURL=MessageProcessor.js.map