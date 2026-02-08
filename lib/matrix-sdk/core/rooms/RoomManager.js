import _asyncToGenerator from "@babel/runtime/helpers/asyncToGenerator";
import _defineProperty from "@babel/runtime/helpers/defineProperty";
import { Method } from "../../http-api/index.js";
import { logger } from "../../logger.js";
export class RoomManager {
  constructor(http, store) {
    this.http = http;
    this.store = store;
    _defineProperty(this, "rooms", new Map());
    this.loadRooms();
  }
  createRoom() {
    var _arguments = arguments,
      _this = this;
    return _asyncToGenerator(function* () {
      var options = _arguments.length > 0 && _arguments[0] !== undefined ? _arguments[0] : {};
      var response = yield _this.http.authedRequest(Method.Post, "/createRoom", undefined, options);
      var roomId = response.room_id;
      _this.rooms.set(roomId, {
        roomId,
        joined: true,
        membership: "join",
        createdAt: Date.now()
      });
      yield _this.saveRooms();
      return response;
    })();
  }
  joinRoom(roomIdOrAlias, viaServers) {
    var _this2 = this;
    return _asyncToGenerator(function* () {
      var body = {};
      if (viaServers && viaServers.length > 0) {
        body.via = viaServers;
      }
      var response = yield _this2.http.authedRequest(Method.Post, "/join/".concat(encodeURIComponent(roomIdOrAlias)), undefined, body);
      var roomId = response.room_id;
      _this2.rooms.set(roomId, {
        roomId,
        joined: true,
        membership: "join",
        joinedAt: Date.now()
      });
      yield _this2.saveRooms();
      return response;
    })();
  }
  joinRoomById(roomId, viaServers) {
    var _this3 = this;
    return _asyncToGenerator(function* () {
      var body = {};
      if (viaServers && viaServers.length > 0) {
        body.via = viaServers;
      }
      var response = yield _this3.http.authedRequest(Method.Post, "/rooms/".concat(encodeURIComponent(roomId), "/join"), undefined, body);
      _this3.rooms.set(roomId, {
        roomId,
        joined: true,
        membership: "join",
        joinedAt: Date.now()
      });
      yield _this3.saveRooms();
      return response;
    })();
  }
  leave(roomId) {
    var _this4 = this;
    return _asyncToGenerator(function* () {
      yield _this4.http.authedRequest(Method.Post, "/rooms/".concat(encodeURIComponent(roomId), "/leave"));
      var room = _this4.rooms.get(roomId);
      if (room) {
        room.joined = false;
        room.membership = "leave";
        room.leftAt = Date.now();
      }
      yield _this4.saveRooms();
    })();
  }
  forget(roomId) {
    var _this5 = this;
    return _asyncToGenerator(function* () {
      yield _this5.http.authedRequest(Method.Post, "/rooms/".concat(encodeURIComponent(roomId), "/forget"));
      _this5.rooms.delete(roomId);
      yield _this5.saveRooms();
    })();
  }
  invite(roomId, userId) {
    var _this6 = this;
    return _asyncToGenerator(function* () {
      yield _this6.http.authedRequest(Method.Post, "/rooms/".concat(encodeURIComponent(roomId), "/invite"), undefined, {
        user_id: userId
      });
    })();
  }
  inviteByEmail(roomId, email) {
    var _this7 = this;
    return _asyncToGenerator(function* () {
      yield _this7.http.authedRequest(Method.Post, "/rooms/".concat(encodeURIComponent(roomId), "/invite"), undefined, {
        "m.id.server": email
      });
    })();
  }
  kick(roomId, userId, reason) {
    var _this8 = this;
    return _asyncToGenerator(function* () {
      var body = {
        user_id: userId
      };
      if (reason) {
        body.reason = reason;
      }
      return _this8.http.authedRequest(Method.Post, "/rooms/".concat(encodeURIComponent(roomId), "/kick"), undefined, body);
    })();
  }
  ban(roomId, userId, reason) {
    var _this9 = this;
    return _asyncToGenerator(function* () {
      var body = {
        user_id: userId
      };
      if (reason) {
        body.reason = reason;
      }
      return _this9.http.authedRequest(Method.Post, "/rooms/".concat(encodeURIComponent(roomId), "/ban"), undefined, body);
    })();
  }
  unban(roomId, userId) {
    var _this0 = this;
    return _asyncToGenerator(function* () {
      return _this0.http.authedRequest(Method.Post, "/rooms/".concat(encodeURIComponent(roomId), "/unban"), undefined, {
        user_id: userId
      });
    })();
  }
  getRoomState(roomId, eventType, stateKey) {
    var _this1 = this;
    return _asyncToGenerator(function* () {
      var path = "/rooms/".concat(encodeURIComponent(roomId), "/state");
      if (eventType) {
        path += "/".concat(encodeURIComponent(eventType));
        if (stateKey) {
          path += "/".concat(encodeURIComponent(stateKey));
        }
      }
      return _this1.http.authedRequest(Method.Get, path);
    })();
  }
  setRoomState(roomId, eventType, content, stateKey) {
    var _this10 = this;
    return _asyncToGenerator(function* () {
      var path = "/rooms/".concat(encodeURIComponent(roomId), "/state/").concat(encodeURIComponent(eventType));
      if (stateKey) {
        path += "/".concat(encodeURIComponent(stateKey));
      }
      return _this10.http.authedRequest(Method.Put, path, undefined, content);
    })();
  }
  getRoomMembers(roomId) {
    var _this11 = this;
    return _asyncToGenerator(function* () {
      return _this11.http.authedRequest(Method.Get, "/rooms/".concat(encodeURIComponent(roomId), "/members"));
    })();
  }
  getJoinedMembers(roomId) {
    var _this12 = this;
    return _asyncToGenerator(function* () {
      return _this12.http.authedRequest(Method.Get, "/rooms/".concat(encodeURIComponent(roomId), "/joined_members"));
    })();
  }
  getRoomDirectoryVisibility(roomId) {
    var _this13 = this;
    return _asyncToGenerator(function* () {
      return _this13.http.authedRequest(Method.Get, "/directory/room/".concat(encodeURIComponent(roomId)));
    })();
  }
  setRoomDirectoryVisibility(roomId, visibility) {
    var _this14 = this;
    return _asyncToGenerator(function* () {
      return _this14.http.authedRequest(Method.Put, "/directory/list/room/".concat(encodeURIComponent(roomId)), undefined, {
        visibility
      });
    })();
  }
  getPublicRooms(options) {
    var _this15 = this;
    return _asyncToGenerator(function* () {
      return _this15.http.authedRequest(Method.Post, "/publicRooms", undefined, options);
    })();
  }
  reportEvent(roomId, eventId, score, reason) {
    var _this16 = this;
    return _asyncToGenerator(function* () {
      return _this16.http.authedRequest(Method.Post, "/rooms/".concat(encodeURIComponent(roomId), "/report/").concat(encodeURIComponent(eventId)), undefined, {
        score,
        reason
      });
    })();
  }
  getRoom(roomId) {
    return this.rooms.get(roomId);
  }
  getRooms() {
    return Array.from(this.rooms.values());
  }
  getJoinedRooms() {
    return Array.from(this.rooms.values()).filter(room => room.joined);
  }
  isJoined(roomId) {
    var _room$joined;
    var room = this.rooms.get(roomId);
    return (_room$joined = room === null || room === void 0 ? void 0 : room.joined) !== null && _room$joined !== void 0 ? _room$joined : false;
  }
  updateRoomData(roomId, data) {
    var room = this.rooms.get(roomId);
    if (room) {
      Object.assign(room, data);
      this.saveRooms();
    }
  }
  saveRooms() {
    var _this17 = this;
    return _asyncToGenerator(function* () {
      var rooms = Array.from(_this17.rooms.entries());
      yield _this17.store.setItem("rooms", rooms);
    })();
  }
  loadRooms() {
    var _this18 = this;
    return _asyncToGenerator(function* () {
      try {
        var rooms = yield _this18.store.getItem("rooms");
        if (rooms) {
          _this18.rooms = new Map(rooms);
        }
      } catch (error) {
        logger.warn("Failed to load rooms:", error);
      }
    })();
  }
}
//# sourceMappingURL=RoomManager.js.map