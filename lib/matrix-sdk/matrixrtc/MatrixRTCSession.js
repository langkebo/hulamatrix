import _asyncToGenerator from "@babel/runtime/helpers/asyncToGenerator";
import _defineProperty from "@babel/runtime/helpers/defineProperty";
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
/*
Copyright 2023 - 2024 The Matrix.org Foundation C.I.C.

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

import { logger as rootLogger } from "../logger.js";
import { TypedEventEmitter } from "../models/typed-event-emitter.js";
import { EventTimeline } from "../models/event-timeline.js";
import { EventType, RelationType } from "../@types/event.js";
import { KnownMembership } from "../@types/membership.js";
import { CallMembership } from "./CallMembership.js";
import { RoomStateEvent } from "../models/room-state.js";
import { MembershipManager, StickyEventMembershipManager } from "./MembershipManager.js";
import { EncryptionManager } from "./EncryptionManager.js";
import { deepCompare, logDurationSync } from "../utils.js";
import { MembershipManagerEvent } from "./IMembershipManager.js";
import { RTCEncryptionManager } from "./RTCEncryptionManager.js";
import { ToDeviceKeyTransport } from "./ToDeviceKeyTransport.js";
import { TypedReEmitter } from "../ReEmitter.js";
import { RoomStickyEventsEvent } from "../models/room-sticky-events.js";
import { RoomKeyTransport } from "./RoomKeyTransport.js";

/**
 * Events emitted by MatrixRTCSession
 */
export var MatrixRTCSessionEvent = /*#__PURE__*/function (MatrixRTCSessionEvent) {
  // A member joined, left, or updated a property of their membership.
  MatrixRTCSessionEvent["MembershipsChanged"] = "memberships_changed";
  // We joined or left the session: our own local idea of whether we are joined,
  // separate from MembershipsChanged, ie. independent of whether our member event
  // has successfully gone through.
  MatrixRTCSessionEvent["JoinStateChanged"] = "join_state_changed";
  // The key used to encrypt media has changed
  MatrixRTCSessionEvent["EncryptionKeyChanged"] = "encryption_key_changed";
  /** The membership manager had to shut down caused by an unrecoverable error */
  MatrixRTCSessionEvent["MembershipManagerError"] = "membership_manager_error";
  /** The RTCSession did send a call notification caused by joining the call as the first member */
  MatrixRTCSessionEvent["DidSendCallNotification"] = "did_send_call_notification";
  return MatrixRTCSessionEvent;
}({});

/**
 * The session description is used to identify a session. Used in the state event.
 */

export function slotIdToDescription(slotId) {
  var [application, id] = slotId.split("#");
  return {
    application,
    id
  };
}
export function slotDescriptionToId(slotDescription) {
  return "".concat(slotDescription.application, "#").concat(slotDescription.id);
}

// The names follow these principles:
// - we use the technical term delay if the option is related to delayed events.
// - we use delayedLeaveEvent if the option is related to the delayed leave event.
// - we use membershipEvent if the option is related to the rtc member state event.
// - we use the technical term expiry if the option is related to the expiry field of the membership state event.
// - we use a `Ms` postfix if the option is a duration to avoid using words like:
//   `time`, `duration`, `delay`, `timeout`... that might be mistaken/confused with technical terms.

var DEFAULT_SESSION_MEMBERSHIPS_FOR_SLOT_OPTS = {
  listenForStickyEvents: true,
  listenForMemberStateEvents: true
};

/**
 * A MatrixRTCSession manages the membership & properties of a MatrixRTC session.
 * This class doesn't deal with media at all, just membership & properties of a session.
 */
export class MatrixRTCSession extends TypedEventEmitter {
  get membershipStatus() {
    var _this$membershipManag;
    return (_this$membershipManag = this.membershipManager) === null || _this$membershipManag === void 0 ? void 0 : _this$membershipManag.status;
  }
  get probablyLeft() {
    var _this$membershipManag2;
    return (_this$membershipManag2 = this.membershipManager) === null || _this$membershipManag2 === void 0 ? void 0 : _this$membershipManag2.probablyLeft;
  }
  get delayId() {
    var _this$membershipManag3;
    return (_this$membershipManag3 = this.membershipManager) === null || _this$membershipManag3 === void 0 ? void 0 : _this$membershipManag3.delayId;
  }

  /**
   * The callId (sessionId) of the call.
   *
   * It can be undefined since the callId is only known once the first membership joins.
   * The callId is the property that, per definition, groups memberships into one call.
   * @deprecated use `slotId` instead.
   */
  get callId() {
    var _this$slotDescription;
    return (_this$slotDescription = this.slotDescription) === null || _this$slotDescription === void 0 ? void 0 : _this$slotDescription.id;
  }
  /**
   * The slotId of the call.
   * `{application}#{appSpecificId}`
   * It can be undefined since the slotId is only known once the first membership joins.
   * The slotId is the property that, per definition, groups memberships into one call.
   */
  get slotId() {
    return slotDescriptionToId(this.slotDescription);
  }

  /**
   * Returns all the call memberships for a room that match the provided `sessionDescription`,
   * oldest first.
   *
   * By default, this will return *both* sticky and member state events.
   */
  static sessionMembershipsForSlot(room, slotDescription) {
    var _arguments = arguments;
    return _asyncToGenerator(function* () {
      var options = _arguments.length > 2 && _arguments[2] !== undefined ? _arguments[2] : DEFAULT_SESSION_MEMBERSHIPS_FOR_SLOT_OPTS;
      var logger = rootLogger.getChild("[MatrixRTCSession ".concat(room.roomId, "]"));
      var callMemberEvents = collectMembersEvents(room, options, logger);
      var callMemberships = yield computeBackendIdentityAndVerifyMemberEvents(room, callMemberEvents, slotDescription, logger);
      callMemberships.sort((a, b) => a.createdTs() - b.createdTs());
      if (callMemberships.length > 1) {
        logger.debug("Call memberships in room ".concat(room.roomId, ", in order: "), callMemberships.map(m => [m.createdTs(), m.userId]));
      }
      return callMemberships;
    })();
  }

  /**
   * Return the MatrixRTC session for the room.
   * This returned session can be used to find out if there are active sessions
   * for the requested room and `slotDescription`.
   */
  static sessionForSlot(client, room, slotDescription, opts) {
    return new MatrixRTCSession(client, room, slotDescription, opts);
  }

  /**
   * WARN: this can in theory only be a subset of the room with the properties required by
   * this class.
   * Outside of tests this most likely will be a full room, however.
   * @deprecated Relying on a full Room object being available here is an anti-pattern. You should be tracking
   * the room object in your own code and passing it in when needed.
   */
  get room() {
    return this.roomSubset;
  }

  /**
   * This constructs a room session. When using MatrixRTC inside the js-sdk this is expected
   * to be used with the MatrixRTCSessionManager exclusively.
   *
   * In cases where you don't use the js-sdk but build on top of another Matrix stack this class can be used standalone
   * to manage a joined MatrixRTC session.
   *
   * @param client A subset of the {@link MatrixClient} that lets the session interact with the Matrix room.
   * @param roomSubset The room this session is attached to. A subset of a js-sdk Room that the session needs.
   * @param slotDescription The slot description is a virtual address where participants are allowed to meet.
   * This session will only manage memberships that match this slot description.Sessions are distinct if any of
   * those properties are distinct: `roomSubset.roomId`, `slotDescription.application`, `slotDescription.id`.
   */
  constructor(client, roomSubset, slotDescription, calculateMembershipsOpts) {
    var _this;
    super();
    _this = this;
    this.client = client;
    this.roomSubset = roomSubset;
    this.slotDescription = slotDescription;
    this.calculateMembershipsOpts = calculateMembershipsOpts;
    _defineProperty(this, "membershipManager", void 0);
    _defineProperty(this, "encryptionManager", void 0);
    _defineProperty(this, "joinConfig", void 0);
    _defineProperty(this, "logger", void 0);
    _defineProperty(this, "pendingNotificationToSend", void 0);
    /**
     * This timeout is responsible to track any expiration. We need to know when we have to start
     * to ignore other call members. There is no callback for this. This timeout will always be configured to
     * emit when the next membership expires.
     */
    _defineProperty(this, "expiryTimeout", void 0);
    _defineProperty(this, "memberships", []);
    /**
     * The statistics for this session.
     */
    _defineProperty(this, "statistics", {
      counters: {
        roomEventEncryptionKeysSent: 0,
        roomEventEncryptionKeysReceived: 0
      },
      totals: {
        roomEventEncryptionKeysReceivedTotalAge: 0
      }
    });
    _defineProperty(this, "reEmitter", new TypedReEmitter(this));
    /**
     * Call this when the Matrix room members have changed.
     */
    _defineProperty(this, "onRoomMemberUpdate", () => {
      this.ensureRecalculateSessionMembers();
    });
    /**
     * Call this when a sticky event update has occured.
     */
    _defineProperty(this, "onStickyEventUpdate", (added, updated, removed) => {
      if ([...added, ...removed, ...updated.flatMap(v => [v.current, v.previous])].some(e => e.getType() === EventType.RTCMembership)) {
        this.ensureRecalculateSessionMembers();
      }
    });
    /**
     * Call this when something changed that may impacts the current MatrixRTC members in this session.
     */
    // We allow this name schema since this function should only be used for testing purposes.
    // eslint-disable-next-line @typescript-eslint/naming-convention
    _defineProperty(this, "_onRTCSessionMemberUpdate", /*#__PURE__*/_asyncToGenerator(function* () {
      yield _this.recalculateSessionMembers();
    }));
    // helper variables to make sure we do not have parallel running recalculations.
    _defineProperty(this, "recalculateSessionMembersDirty", false);
    _defineProperty(this, "recalculateSessionMembersPromise", undefined);
    /**
     * Call this when anything that could impact rtc memberships has changed: Room Members or RTC members.
     *
     * Examines the latest call memberships and handles any encryption key sending or rotation that is needed.
     *
     * This function should be called when the room members or call memberships might have changed.
     */
    _defineProperty(this, "recalculateSessionMembers", /*#__PURE__*/_asyncToGenerator(function* () {
      var _this$encryptionManag;
      var oldMemberships = _this.memberships;
      _this.memberships = yield MatrixRTCSession.sessionMembershipsForSlot(_this.room, _this.slotDescription, _this.calculateMembershipsOpts);
      var changed = oldMemberships.length != _this.memberships.length || oldMemberships.some((m, i) => !CallMembership.equal(m, _this.memberships[i]));
      if (changed) {
        var _this$membershipManag4, _this$membershipManag5;
        _this.logger.info("Memberships for call in room ".concat(_this.roomSubset.roomId, " have changed: emitting (").concat(_this.memberships.length, " members)"));
        logDurationSync(_this.logger, "emit MatrixRTCSessionEvent.MembershipsChanged", () => {
          _this.emit(MatrixRTCSessionEvent.MembershipsChanged, oldMemberships, _this.memberships);
        });
        void ((_this$membershipManag4 = _this.membershipManager) === null || _this$membershipManag4 === void 0 ? void 0 : _this$membershipManag4.onRTCSessionMemberUpdate(_this.memberships));
        // The `ownMembership` will be set when calling `onRTCSessionMemberUpdate`.
        var ownMembership = (_this$membershipManag5 = _this.membershipManager) === null || _this$membershipManag5 === void 0 ? void 0 : _this$membershipManag5.ownMembership;
        if (_this.pendingNotificationToSend && ownMembership && oldMemberships.length === 0) {
          var _this$joinConfig;
          // If we're the first member in the call, we're responsible for
          // sending the notification event
          if (ownMembership.eventId && (_this$joinConfig = _this.joinConfig) !== null && _this$joinConfig !== void 0 && _this$joinConfig.notificationType) {
            _this.sendCallNotify(ownMembership.eventId, _this.joinConfig.notificationType, ownMembership.callIntent);
          } else {
            _this.logger.warn("Own membership eventId is undefined, cannot send call notification");
          }
        }
        // If anyone else joins the session it is no longer our responsibility to send the notification.
        // (If we were the joiner we already did sent the notification in the block above.)
        if (_this.memberships.length > 0) _this.pendingNotificationToSend = undefined;
      } else {
        _this.logger.debug("No membership changes detected for room ".concat(_this.roomSubset.roomId));
      }
      // This also needs to be done if `changed` = false
      // A member might have updated their fingerprint (created_ts)
      void ((_this$encryptionManag = _this.encryptionManager) === null || _this$encryptionManag === void 0 ? void 0 : _this$encryptionManag.onMembershipsUpdate(oldMemberships));
      _this.setExpiryTimer();
    }));
    this.logger = rootLogger.getChild("[MatrixRTCSession ".concat(roomSubset.roomId, "]"));
    this.roomSubset.on(RoomStateEvent.Members, this.onRoomMemberUpdate);
    this.roomSubset.on(RoomStickyEventsEvent.Update, this.onStickyEventUpdate);

    // We can ignore this promise because `recalculateSessionMembers` will emit
    // `MatrixRTCSessionEvent.MembershipsChanged` once it has completed.
    this.ensureRecalculateSessionMembers();
    this.setExpiryTimer();
  }
  /*
   * Returns true if we intend to be participating in the MatrixRTC session.
   * This is determined by checking if the relativeExpiry has been set.
   */
  isJoined() {
    var _this$membershipManag6, _this$membershipManag7;
    return (_this$membershipManag6 = (_this$membershipManag7 = this.membershipManager) === null || _this$membershipManag7 === void 0 ? void 0 : _this$membershipManag7.isJoined()) !== null && _this$membershipManag6 !== void 0 ? _this$membershipManag6 : false;
  }

  /**
   * Performs cleanup & removes timers for client shutdown
   */
  stop() {
    var _this2 = this;
    return _asyncToGenerator(function* () {
      var _this2$membershipMana;
      yield (_this2$membershipMana = _this2.membershipManager) === null || _this2$membershipMana === void 0 ? void 0 : _this2$membershipMana.leave(1000);
      if (_this2.expiryTimeout) {
        clearTimeout(_this2.expiryTimeout);
        _this2.expiryTimeout = undefined;
      }
      _this2.roomSubset.off(RoomStateEvent.Members, _this2.onRoomMemberUpdate);
      _this2.roomSubset.off(RoomStickyEventsEvent.Update, _this2.onStickyEventUpdate);
    })();
  }
  /**
   * Announces this user and device as joined to the MatrixRTC session,
   * and continues to update the membership event to keep it valid until
   * leaveRoomSession() is called
   * This will not subscribe to updates: remember to call subscribe() separately if
   * desired.
   * This method will return immediately and the session will be joined in the background.
   * @param ownMembershipIdentity the identity of the user and device joining the session.
   * This will be put into the content.member.
   * @param fociPreferred the list of preferred foci to use in the joined RTC membership event.
   * If multiSfuFocus is set, this is only needed if this client wants to publish to multiple transports simultaneously.
   * @param multiSfuFocus the active focus to use in the joined RTC membership event. Setting this implies the
   * membership manager will operate in a multi-SFU connection mode. If `undefined`, an `oldest_membership`
   * transport selection will be used instead.
   * @param joinConfig - Additional configuration for the joined session.
   */
  joinRTCSession(ownMembershipIdentity, fociPreferred, multiSfuFocus, joinConfig) {
    var _this$joinConfig2;
    if (this.isJoined()) {
      this.logger.info("Already joined to session in room ".concat(this.roomSubset.roomId, ": ignoring join call"));
      return;
    } else {
      // Create MembershipManager and pass the RTCSession logger (with room id info)
      this.membershipManager = joinConfig !== null && joinConfig !== void 0 && joinConfig.unstableSendStickyEvents ? new StickyEventMembershipManager(joinConfig, this.roomSubset, this.client, this.slotDescription, ownMembershipIdentity.memberId, this.logger) : new MembershipManager(joinConfig, this.roomSubset, this.client, this.slotDescription, this.logger);
      this.reEmitter.reEmit(this.membershipManager, [MembershipManagerEvent.ProbablyLeft, MembershipManagerEvent.StatusChanged]);
      // Create Encryption manager
      var transport;
      if (joinConfig !== null && joinConfig !== void 0 && joinConfig.useExperimentalToDeviceTransport) {
        this.logger.info("Using experimental to-device transport for encryption keys");
        this.logger.info("Using to-device with room fallback transport for encryption keys");
        var [room, _client, statistics] = [this.roomSubset, this.client, this.statistics];
        var _transport = new ToDeviceKeyTransport(ownMembershipIdentity, room.roomId, _client, statistics);
        this.encryptionManager = new RTCEncryptionManager(ownMembershipIdentity, () => this.memberships, _transport, this.statistics, (keyBin, encryptionKeyIndex, membership, rtcBackendIdentity) => {
          this.emit(MatrixRTCSessionEvent.EncryptionKeyChanged, keyBin, encryptionKeyIndex, membership, rtcBackendIdentity);
        }, this.logger);
      } else {
        // TODO REMOVE ME!
        transport = new RoomKeyTransport(this.roomSubset, this.client, this.statistics);
        this.encryptionManager = new EncryptionManager(ownMembershipIdentity, () => this.memberships, transport, this.statistics, (keyBin, encryptionKeyIndex, membership, rtcBackendIdentity) => {
          this.emit(MatrixRTCSessionEvent.EncryptionKeyChanged, keyBin, encryptionKeyIndex, membership, rtcBackendIdentity);
        });
      }
    }
    this.joinConfig = joinConfig;
    this.pendingNotificationToSend = (_this$joinConfig2 = this.joinConfig) === null || _this$joinConfig2 === void 0 ? void 0 : _this$joinConfig2.notificationType;

    // Join!
    this.membershipManager.join(fociPreferred, multiSfuFocus, e => {
      this.logger.error("MembershipManager encountered an unrecoverable error: ", e);
      this.emit(MatrixRTCSessionEvent.MembershipManagerError, e);
      this.emit(MatrixRTCSessionEvent.JoinStateChanged, this.isJoined());
    });
    this.encryptionManager.join(joinConfig);
    this.emit(MatrixRTCSessionEvent.JoinStateChanged, true);
  }

  /**
   *
   * @param fociPreferred
   * @param multiSfuFocus
   * @param joinConfig
   * @deprecated use the joinRTCSession method instead
   */
  joinRoomSession(fociPreferred, multiSfuFocus, joinConfig) {
    var [userId, deviceId] = [this.client.getUserId(), this.client.getDeviceId()];
    // TODO this wants to become a UUID
    var memberId = "".concat(userId, ":").concat(deviceId);
    this.joinRTCSession({
      userId,
      deviceId,
      memberId
    }, fociPreferred, multiSfuFocus, joinConfig);
  }

  /**
   * Announces this user and device as having left the MatrixRTC session
   * and stops scheduled updates.
   * This will not unsubscribe from updates: remember to call unsubscribe() separately if
   * desired.
   * The membership update required to leave the session will retry if it fails.
   * Without network connection the promise will never resolve.
   * A timeout can be provided so that there is a guarantee for the promise to resolve.
   * @returns Whether the membership update was attempted and did not time out.
   */
  leaveRoomSession() {
    var _arguments2 = arguments,
      _this3 = this;
    return _asyncToGenerator(function* () {
      var timeout = _arguments2.length > 0 && _arguments2[0] !== undefined ? _arguments2[0] : undefined;
      if (!_this3.isJoined()) {
        _this3.logger.info("Not joined to session in room ".concat(_this3.roomSubset.roomId, ": ignoring leave call"));
        return false;
      }
      _this3.logger.info("Leaving call session in room ".concat(_this3.roomSubset.roomId));
      _this3.encryptionManager.leave();
      var leavePromise = _this3.membershipManager.leave(timeout);
      _this3.emit(MatrixRTCSessionEvent.JoinStateChanged, false);
      return yield leavePromise;
    })();
  }
  /**
   * This returns the focus in use by the oldest membership.
   * Do not use since this might be just the focus for the oldest membership. others might use a different focus.
   * @deprecated use `member.getTransport(session.getOldestMembership())` instead for the specific member you want to get the focus for.
   */
  getFocusInUse() {
    var oldestMembership = this.getOldestMembership();
    return oldestMembership === null || oldestMembership === void 0 ? void 0 : oldestMembership.getTransport(oldestMembership);
  }

  /**
   * The used focusActive of the oldest membership (to find out the selection type multi-sfu or oldest membership active focus)
   * @deprecated does not work with m.rtc.member. Do not rely on it.
   */
  getActiveFocus() {
    var _this$getOldestMember;
    return (_this$getOldestMember = this.getOldestMembership()) === null || _this$getOldestMember === void 0 ? void 0 : _this$getOldestMember.getFocusActive();
  }
  getOldestMembership() {
    return this.memberships[0];
  }

  /**
   * Get the call intent for the current call, based on what members are advertising. If one or more
   * members disagree on the current call intent, or nobody specifies one then `undefined` is returned.
   *
   * If all members that specify a call intent agree, that value is returned.
   * @returns A call intent, or `undefined` if no consensus or not given.
   */
  getConsensusCallIntent() {
    var _this$memberships$fin;
    var getFirstCallIntent = (_this$memberships$fin = this.memberships.find(m => !!m.callIntent)) === null || _this$memberships$fin === void 0 ? void 0 : _this$memberships$fin.callIntent;
    if (!getFirstCallIntent) {
      return undefined;
    }
    if (this.memberships.every(m => !m.callIntent || m.callIntent === getFirstCallIntent)) {
      return getFirstCallIntent;
    }
    return undefined;
  }
  updateCallIntent(callIntent) {
    var _this4 = this;
    return _asyncToGenerator(function* () {
      var _this4$membershipMana, _this4$membershipMana2;
      var myMembership = (_this4$membershipMana = _this4.membershipManager) === null || _this4$membershipMana === void 0 ? void 0 : _this4$membershipMana.ownMembership;
      if (!myMembership) {
        throw Error("Not connected yet");
      }
      yield (_this4$membershipMana2 = _this4.membershipManager) === null || _this4$membershipMana2 === void 0 ? void 0 : _this4$membershipMana2.updateCallIntent(callIntent);
    })();
  }

  /**
   * Re-emit an EncryptionKeyChanged event for each tracked encryption key. This can be used to export
   * the keys.
   */
  reemitEncryptionKeys() {
    var _this$encryptionManag2;
    (_this$encryptionManag2 = this.encryptionManager) === null || _this$encryptionManag2 === void 0 || _this$encryptionManag2.getEncryptionKeys().forEach(keyRing => {
      keyRing.forEach(keyInfo => {
        this.emit(MatrixRTCSessionEvent.EncryptionKeyChanged, keyInfo.key, keyInfo.keyIndex, keyInfo.membership, keyInfo.rtcBackendIdentity);
      });
    });
  }

  /**
   * Sets a timer for the soonest membership expiry
   */
  setExpiryTimer() {
    if (this.expiryTimeout) {
      clearTimeout(this.expiryTimeout);
      this.expiryTimeout = undefined;
    }
    var soonestExpiry;
    for (var membership of this.memberships) {
      var thisExpiry = membership.getMsUntilExpiry();
      // If getMsUntilExpiry is undefined we have a MSC4143 (MatrixRTC) compliant event - it never expires
      // but will be reliably resent on disconnect.
      if (thisExpiry !== undefined && (soonestExpiry === undefined || thisExpiry < soonestExpiry)) {
        soonestExpiry = thisExpiry;
      }
    }
    if (soonestExpiry != undefined) {
      this.expiryTimeout = setTimeout(this.ensureRecalculateSessionMembers.bind(this), soonestExpiry);
    }
  }

  /**
   * Sends notification events to indiciate the call has started.
   * Note: This does not return a promise, instead scheduling the notification events to be sent.
   * @param parentEventId Event id linking to your RTC call membership event.
   * @param notificationType The type of notification to send
   * @param callIntent The type of call this is (e.g. "audio").
   */
  sendCallNotify(parentEventId, notificationType, callIntent) {
    var _this5 = this;
    var sendLegacyNotificationEvent = /*#__PURE__*/function () {
      var _ref3 = _asyncToGenerator(function* () {
        var content = {
          "application": "m.call",
          "m.mentions": {
            user_ids: [],
            room: true
          },
          "notify_type": notificationType === "notification" ? "notify" : notificationType,
          "call_id": _this5.callId
        };
        var response = yield _this5.client.sendEvent(_this5.roomSubset.roomId, EventType.CallNotify, content);
        return {
          response,
          content
        };
      });
      return function sendLegacyNotificationEvent() {
        return _ref3.apply(this, arguments);
      };
    }();
    var sendNewNotificationEvent = /*#__PURE__*/function () {
      var _ref4 = _asyncToGenerator(function* () {
        var content = {
          "m.mentions": {
            user_ids: [],
            room: true
          },
          "notification_type": notificationType,
          "m.relates_to": {
            event_id: parentEventId,
            rel_type: RelationType.Reference
          },
          "sender_ts": Date.now(),
          "lifetime": 30000 // 30 seconds
        };
        if (callIntent) {
          content["m.call.intent"] = callIntent;
        }
        var response = yield _this5.client.sendEvent(_this5.roomSubset.roomId, EventType.RTCNotification, content);
        return {
          response,
          content
        };
      });
      return function sendNewNotificationEvent() {
        return _ref4.apply(this, arguments);
      };
    }();
    void Promise.all([sendLegacyNotificationEvent(), sendNewNotificationEvent()]).then(_ref5 => {
      var [legacy, newNotification] = _ref5;
      // Join event_id and origin event content
      var legacyResult = _objectSpread(_objectSpread({}, legacy.response), legacy.content);
      var newResult = _objectSpread(_objectSpread({}, newNotification.response), newNotification.content);
      this.emit(MatrixRTCSessionEvent.DidSendCallNotification, newResult, legacyResult);
    }).catch(_ref6 => {
      var [errorLegacy, errorNew] = _ref6;
      return this.logger.error("Failed to send call notification", errorLegacy, errorNew);
    });
  }
  ensureRecalculateSessionMembers() {
    if (this.recalculateSessionMembersPromise === undefined) {
      this.recalculateSessionMembersPromise = this.recalculateSessionMembers().then(() => {
        this.recalculateSessionMembersPromise = undefined;
        if (this.recalculateSessionMembersDirty) {
          this.ensureRecalculateSessionMembers();
          this.recalculateSessionMembersDirty = false;
        }
      });
    } else {
      this.recalculateSessionMembersDirty = true;
    }
  }
}

/// Private helpers
function computeBackendIdentityAndVerifyMemberEvents(_x, _x2, _x3, _x4) {
  return _computeBackendIdentityAndVerifyMemberEvents.apply(this, arguments);
}
function _computeBackendIdentityAndVerifyMemberEvents() {
  _computeBackendIdentityAndVerifyMemberEvents = _asyncToGenerator(function* (room, callMemberEvents, slotDescription, logger) {
    var callMemberships = [];
    for (var memberEvent of callMemberEvents) {
      var content = memberEvent.getContent();

      // Quick filter to avoid unneeded processing of invalid events or left events.
      // A more thorough validation will be done later with CallMembership.membershipDataFromMatrixEvent.
      if (!quickFilterNonRelevantContents(content, logger)) {
        continue;
      }
      try {
        var membershipData = CallMembership.membershipDataFromMatrixEvent(memberEvent);
        var membership = new CallMembership(memberEvent, membershipData, yield CallMembership.computeRtcBackendIdentity(memberEvent, membershipData), logger);
        if (isValidMembership(membership, room, slotDescription, logger)) {
          callMemberships.push(membership);
        }
      } catch (e) {
        logger.warn("Couldn't construct call membership: ", e);
      }
    }
    return callMemberships;
  });
  return _computeBackendIdentityAndVerifyMemberEvents.apply(this, arguments);
}
function quickFilterNonRelevantContents(content, logger) {
  // Ignore sticky keys for the count
  var eventKeysCount = Object.keys(content).filter(k => k !== "msc4354_sticky_key").length;
  // Don't even bother about empty events (saves us from costly type/"key in" checks in bigger rooms)
  if (eventKeysCount === 0) return false;

  // We first decide if it's a MSC4143 event (per device state key)
  if (eventKeysCount > 1 && "application" in content) {
    // We have a MSC4143 event membership event with a proper joined content
    return true;
  } else if (eventKeysCount === 1 && "memberships" in content) {
    logger.warn("Legacy event found. Those are ignored, they do not contribute to the MatrixRTC session");
    return false;
  } else {
    // Invalid or left content
    return false;
  }
}
function isValidMembership(membership, room, slotDescription, logger) {
  var _membership$userId;
  if (!deepCompare(membership.slotDescription, slotDescription)) {
    logger.info("Ignoring membership of user ".concat(membership.userId, " for a different slot:  ").concat(JSON.stringify(membership.slotDescription)));
    return false;
  }
  if (membership.isExpired()) {
    logger.info("Ignoring expired device membership ".concat(membership.userId, "/").concat(membership.deviceId));
    return false;
  }
  if (!room.hasMembershipState((_membership$userId = membership.userId) !== null && _membership$userId !== void 0 ? _membership$userId : "", KnownMembership.Join)) {
    logger.info("Ignoring membership of user ".concat(membership.userId, " who is not in the room."));
    return false;
  }
  return true;
}

/**
 * Collects the raw member events from room state and sticky store.
 */
function collectMembersEvents(room, options, logger) {
  var {
    listenForStickyEvents,
    listenForMemberStateEvents
  } = options;
  var callMemberEvents = [];
  if (listenForStickyEvents) {
    // prefill with sticky events
    callMemberEvents = [...room._unstable_getStickyEvents()].filter(e => e.getType() === EventType.RTCMembership);
  }
  if (listenForMemberStateEvents) {
    var roomState = room.getLiveTimeline().getState(EventTimeline.FORWARDS);
    if (!roomState) {
      logger.warn("Couldn't get state for room " + room.roomId + "using empty membership array");
      return [];
    }
    var callMemberStateEvents = roomState.getStateEvents(EventType.GroupCallMemberPrefix);
    callMemberEvents = callMemberEvents.concat(callMemberStateEvents.filter(callMemberStateEvent => !callMemberEvents.some(
    // only care about state events which have keys which we have not yet seen in the sticky events.
    // TODO: I believe this can discard a joined state event if there is a matching left sticky event.
    stickyEvent => stickyEvent.getContent().msc4354_sticky_key === callMemberStateEvent.getStateKey())));
  }
  return callMemberEvents;
}
//# sourceMappingURL=MatrixRTCSession.js.map