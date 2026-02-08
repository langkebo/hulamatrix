import _asyncToGenerator from "@babel/runtime/helpers/asyncToGenerator";
import _defineProperty from "@babel/runtime/helpers/defineProperty";
import { Method } from "../http-api/index.js";
import { logger } from "../logger.js";
export class IncrementalSyncManager {
  constructor(http, store) {
    var _options$batchSize, _options$maxBackoff, _options$initialBacko;
    var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
    this.http = http;
    this.store = store;
    _defineProperty(this, "syncToken", null);
    _defineProperty(this, "roomStates", new Map());
    _defineProperty(this, "pendingEvents", new Map());
    _defineProperty(this, "backoff", void 0);
    _defineProperty(this, "maxBackoff", void 0);
    _defineProperty(this, "batchSize", void 0);
    this.batchSize = (_options$batchSize = options.batchSize) !== null && _options$batchSize !== void 0 ? _options$batchSize : 100;
    this.maxBackoff = (_options$maxBackoff = options.maxBackoff) !== null && _options$maxBackoff !== void 0 ? _options$maxBackoff : 60000;
    this.backoff = (_options$initialBacko = options.initialBackoff) !== null && _options$initialBacko !== void 0 ? _options$initialBacko : 1000;
    this.loadState();
  }
  syncOnce(since) {
    var _arguments = arguments,
      _this = this;
    return _asyncToGenerator(function* () {
      var timeout = _arguments.length > 1 && _arguments[1] !== undefined ? _arguments[1] : 30000;
      var syncToken = since !== null && since !== void 0 ? since : _this.syncToken;
      try {
        var response = yield _this.http.authedRequest(Method.Get, "/sync", {
          since: syncToken !== null && syncToken !== void 0 ? syncToken : undefined,
          timeout
        });
        _this.syncToken = response.next_batch;
        yield _this.saveState();
        yield _this.processSyncResponse(response);
        _this.backoff = 1000;
        return response;
      } catch (error) {
        var errorObj = error;
        logger.error("Sync failed:", errorObj);
        _this.backoff = Math.min(_this.backoff * 2, _this.maxBackoff);
        throw errorObj;
      }
    })();
  }
  syncIncremental(roomId, limit) {
    var _this2 = this;
    return _asyncToGenerator(function* () {
      var _this2$pendingEvents$;
      var roomState = _this2.roomStates.get(roomId);
      if (!roomState) {
        return [];
      }
      var pending = (_this2$pendingEvents$ = _this2.pendingEvents.get(roomId)) !== null && _this2$pendingEvents$ !== void 0 ? _this2$pendingEvents$ : [];
      var batchSize = limit !== null && limit !== void 0 ? limit : _this2.batchSize;
      var events = pending.slice(0, batchSize);
      _this2.pendingEvents.set(roomId, pending.slice(batchSize));
      return events;
    })();
  }
  getSyncToken() {
    return this.syncToken;
  }
  setSyncToken(token) {
    this.syncToken = token;
    this.saveState();
  }
  getRoomState(roomId) {
    return this.roomStates.get(roomId);
  }
  getPendingEvents(roomId) {
    var _this$pendingEvents$g;
    return (_this$pendingEvents$g = this.pendingEvents.get(roomId)) !== null && _this$pendingEvents$g !== void 0 ? _this$pendingEvents$g : [];
  }
  clearRoomState(roomId) {
    this.roomStates.delete(roomId);
    this.pendingEvents.delete(roomId);
  }
  clearAllStates() {
    this.roomStates.clear();
    this.pendingEvents.clear();
  }
  getBackoff() {
    return this.backoff;
  }
  resetBackoff() {
    this.backoff = 1000;
  }
  processSyncResponse(response) {
    var _this3 = this;
    return _asyncToGenerator(function* () {
      var _response$rooms, _rooms$join, _rooms$invite, _rooms$leave;
      var rooms = (_response$rooms = response.rooms) !== null && _response$rooms !== void 0 ? _response$rooms : {};
      var joinRooms = (_rooms$join = rooms.join) !== null && _rooms$join !== void 0 ? _rooms$join : {};
      for (var roomId of Object.keys(joinRooms)) {
        yield _this3.processJoinedRoom(roomId, joinRooms[roomId]);
      }
      var inviteRooms = (_rooms$invite = rooms.invite) !== null && _rooms$invite !== void 0 ? _rooms$invite : {};
      for (var _roomId of Object.keys(inviteRooms)) {
        yield _this3.processInvitedRoom(_roomId, inviteRooms[_roomId]);
      }
      var leaveRooms = (_rooms$leave = rooms.leave) !== null && _rooms$leave !== void 0 ? _rooms$leave : {};
      for (var _roomId2 of Object.keys(leaveRooms)) {
        yield _this3.processLeftRoom(_roomId2, leaveRooms[_roomId2]);
      }
    })();
  }
  processJoinedRoom(roomId, roomData) {
    var _this4 = this;
    return _asyncToGenerator(function* () {
      var _data$timeline2, _data$state, _data$timeline3;
      var data = roomData;
      var roomState = _this4.roomStates.get(roomId);
      if (!roomState) {
        var _data$timeline$prev_b, _data$timeline;
        roomState = {
          prevBatch: (_data$timeline$prev_b = (_data$timeline = data.timeline) === null || _data$timeline === void 0 ? void 0 : _data$timeline.prev_batch) !== null && _data$timeline$prev_b !== void 0 ? _data$timeline$prev_b : "",
          events: [],
          state: new Map()
        };
        _this4.roomStates.set(roomId, roomState);
      }
      if ((_data$timeline2 = data.timeline) !== null && _data$timeline2 !== void 0 && _data$timeline2.prev_batch) {
        roomState.prevBatch = data.timeline.prev_batch;
      }
      if ((_data$state = data.state) !== null && _data$state !== void 0 && _data$state.events) {
        for (var event of data.state.events) {
          roomState.state.set(event.event_id, event);
        }
      }
      if ((_data$timeline3 = data.timeline) !== null && _data$timeline3 !== void 0 && _data$timeline3.events) {
        var _this4$pendingEvents$;
        var pending = (_this4$pendingEvents$ = _this4.pendingEvents.get(roomId)) !== null && _this4$pendingEvents$ !== void 0 ? _this4$pendingEvents$ : [];
        pending.push(...data.timeline.events);
        _this4.pendingEvents.set(roomId, pending);
      }
      yield _this4.saveRoomState(roomId);
    })();
  }
  processInvitedRoom(roomId, roomData) {
    var _this5 = this;
    return _asyncToGenerator(function* () {
      var _data$invite_state;
      var data = roomData;
      if ((_data$invite_state = data.invite_state) !== null && _data$invite_state !== void 0 && _data$invite_state.events) {
        var roomState = {
          prevBatch: "",
          events: data.invite_state.events,
          state: new Map()
        };
        for (var event of data.invite_state.events) {
          roomState.state.set(event.event_id, event);
        }
        _this5.roomStates.set(roomId, roomState);
        yield _this5.saveRoomState(roomId);
      }
    })();
  }
  processLeftRoom(roomId, roomData) {
    var _this6 = this;
    return _asyncToGenerator(function* () {
      var _data$state2, _data$timeline5;
      var data = roomData;
      var roomState = _this6.roomStates.get(roomId);
      if (!roomState) {
        var _data$timeline$prev_b2, _data$timeline4;
        roomState = {
          prevBatch: (_data$timeline$prev_b2 = (_data$timeline4 = data.timeline) === null || _data$timeline4 === void 0 ? void 0 : _data$timeline4.prev_batch) !== null && _data$timeline$prev_b2 !== void 0 ? _data$timeline$prev_b2 : "",
          events: [],
          state: new Map()
        };
      }
      if ((_data$state2 = data.state) !== null && _data$state2 !== void 0 && _data$state2.events) {
        for (var event of data.state.events) {
          roomState.state.set(event.event_id, event);
        }
      }
      if ((_data$timeline5 = data.timeline) !== null && _data$timeline5 !== void 0 && _data$timeline5.events) {
        var _this6$pendingEvents$;
        var pending = (_this6$pendingEvents$ = _this6.pendingEvents.get(roomId)) !== null && _this6$pendingEvents$ !== void 0 ? _this6$pendingEvents$ : [];
        pending.push(...data.timeline.events);
        _this6.pendingEvents.set(roomId, pending);
      }
      _this6.roomStates.set(roomId, roomState);
      yield _this6.saveRoomState(roomId);
    })();
  }
  saveState() {
    var _this7 = this;
    return _asyncToGenerator(function* () {
      if (_this7.syncToken) {
        yield _this7.store.setItem("incremental_sync_token", _this7.syncToken);
      }
    })();
  }
  loadState() {
    var _this8 = this;
    return _asyncToGenerator(function* () {
      try {
        _this8.syncToken = yield _this8.store.getItem("incremental_sync_token");
      } catch (error) {
        logger.warn("Failed to load incremental sync state:", error);
      }
    })();
  }
  saveRoomState(roomId) {
    var _this9 = this;
    return _asyncToGenerator(function* () {
      var roomState = _this9.roomStates.get(roomId);
      if (!roomState) {
        return;
      }
      var stateData = {
        prevBatch: roomState.prevBatch,
        events: roomState.events,
        state: Array.from(roomState.state.entries())
      };
      yield _this9.store.setItem("room_state_".concat(roomId), stateData);
    })();
  }
}
//# sourceMappingURL=IncrementalSyncManager.js.map