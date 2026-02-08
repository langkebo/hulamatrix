import _asyncToGenerator from "@babel/runtime/helpers/asyncToGenerator";
import _defineProperty from "@babel/runtime/helpers/defineProperty";
/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import { MXID_PATTERN } from "../models/room-member.js";
import { deepCompare } from "../utils.js";
import { slotDescriptionToId, slotIdToDescription } from "./MatrixRTCSession.js";
import { sha256 } from "../digest.js";
import { encodeUnpaddedBase64 } from "../base64.js";
/**
 * The default duration in milliseconds that a membership is considered valid for.
 * Ordinarily the client responsible for the session will update the membership before it expires.
 * We use this duration as the fallback case where stale sessions are present for some reason.
 */
export var DEFAULT_EXPIRE_DURATION = 1000 * 60 * 60 * 4;
var checkRtcMembershipData = (data, errors, referenceUserId) => {
  var _data$sticky_key;
  var prefix = " - ";

  // required fields
  if (typeof data.slot_id !== "string") {
    errors.push(prefix + "slot_id must be string");
  } else {
    if (data.slot_id.split("#").length !== 2) errors.push(prefix + 'slot_id must include exactly one "#"');
  }
  if (typeof data.member !== "object" || data.member === null) {
    errors.push(prefix + "member must be an object");
  } else {
    var member = data.member;
    if (typeof member.user_id !== "string") errors.push(prefix + "member.user_id must be string");else if (!MXID_PATTERN.test(member.user_id)) errors.push(prefix + "member.user_id must be a valid mxid");
    // This is not what the spec enforces but there currently are no rules what power levels are required to
    // send a m.rtc.member event for a other user. So we add this check for simplicity and to avoid possible attacks until there
    // is a proper definition when this is allowed.
    else if (member.user_id !== referenceUserId) errors.push(prefix + "member.user_id must match the sender");
    if (typeof member.device_id !== "string") errors.push(prefix + "member.device_id must be string");
    if (typeof member.id !== "string") errors.push(prefix + "member.id must be string");
  }
  if (typeof data.application !== "object" || data.application === null) {
    errors.push(prefix + "application must be an object");
  } else {
    var application = data.application;
    if (typeof application.type !== "string") {
      errors.push(prefix + "application.type must be a string");
    } else {
      if (application.type.includes("#")) errors.push(prefix + 'application.type must not include "#"');
    }
  }
  if (data.rtc_transports === undefined || !Array.isArray(data.rtc_transports)) {
    errors.push(prefix + "rtc_transports must be an array");
  } else {
    // validate that each transport has at least a string 'type'
    for (var t of data.rtc_transports) {
      if (typeof t !== "object" || t === null || typeof t.type !== "string") {
        errors.push(prefix + "rtc_transports entries must be objects with a string type");
        break;
      }
    }
  }
  if (data.versions === undefined || !Array.isArray(data.versions)) {
    errors.push(prefix + "versions must be an array");
  } else if (!data.versions.every(v => typeof v === "string")) {
    errors.push(prefix + "versions must be an array of strings");
  }

  // optional fields
  if (((_data$sticky_key = data.sticky_key) !== null && _data$sticky_key !== void 0 ? _data$sticky_key : data.msc4354_sticky_key) === undefined) {
    errors.push(prefix + "sticky_key or msc4354_sticky_key must be a defined");
  }
  if (data.sticky_key !== undefined && typeof data.sticky_key !== "string") {
    errors.push(prefix + "sticky_key must be a string");
  }
  if (data.msc4354_sticky_key !== undefined && typeof data.msc4354_sticky_key !== "string") {
    errors.push(prefix + "msc4354_sticky_key must be a string");
  }
  if (data.sticky_key !== undefined && data.msc4354_sticky_key !== undefined && data.sticky_key !== data.msc4354_sticky_key) {
    errors.push(prefix + "sticky_key and msc4354_sticky_key must be equal if both are defined");
  }
  if (data["m.relates_to"] !== undefined) {
    var rel = data["m.relates_to"];
    if (typeof rel !== "object" || rel === null) {
      errors.push(prefix + "m.relates_to must be an object if provided");
    } else {
      if (typeof rel.event_id !== "string") errors.push(prefix + "m.relates_to.event_id must be a string");
      if (rel.rel_type !== "m.reference") errors.push(prefix + "m.relates_to.rel_type must be m.reference");
    }
  }
  return errors.length === 0;
};

/**
 * MSC4143 (MatrixRTC) session membership data.
 * Represents the `session` in the memberships section of an m.call.member event as it is on the wire.
 **/

var checkSessionsMembershipData = (data, errors) => {
  var prefix = " - ";
  if (typeof data.device_id !== "string") errors.push(prefix + "device_id must be string");
  if (typeof data.call_id !== "string") errors.push(prefix + "call_id must be string");
  if (typeof data.application !== "string") errors.push(prefix + "application must be a string");
  var focusActive = data.focus_active;
  if (typeof (focusActive === null || focusActive === void 0 ? void 0 : focusActive.type) !== "string") errors.push(prefix + "focus_active.type must be a string");
  if (focusActive === undefined) {
    errors.push(prefix + "focus_active has an invalid type");
  }
  if (data.foci_preferred !== undefined && !(Array.isArray(data.foci_preferred) && data.foci_preferred.every(f => typeof f === "object" && f !== null && typeof f.type === "string"))) {
    errors.push(prefix + "foci_preferred must be an array of transport objects");
  }
  // optional parameters
  if (data.created_ts !== undefined && typeof data.created_ts !== "number") {
    errors.push(prefix + "created_ts must be number");
  }

  // application specific data (we first need to check if they exist)
  if (data.scope !== undefined && typeof data.scope !== "string") errors.push(prefix + "scope must be string");
  if (data["m.call.intent"] !== undefined && typeof data["m.call.intent"] !== "string") {
    errors.push(prefix + "m.call.intent must be a string");
  }
  return errors.length === 0;
};
// TODO: Rename to RtcMembership once we removed the legacy SessionMembership from this file.
export class CallMembership {
  static equal(a, b) {
    return deepCompare(a === null || a === void 0 ? void 0 : a.membershipData, b === null || b === void 0 ? void 0 : b.membershipData);
  }
  constructor(/** The required parts of the Matrix event that this membership is based on */
  matrixEvent,
  /**
   * The type checked membership data {data: (content of the matrix event), kind: (type hint)}
   *
   */
  membershipData,
  /**
   *
   * Anonymized identity to use with the RTC backend.
   *
   * The rtcBackendIdentity is a hashed version of all the identity parts:
   * `sha256(${this.userId}|${this.deviceId}|${this.memberId})`
   *
   * It is used to anonymize the identity of the user in the RTC backend.
   */
  rtcBackendIdentity,
  /**
   * The constructor will automatically create a properly tagged child logger instance.
   */
  logger) {
    this.membershipData = membershipData;
    this.rtcBackendIdentity = rtcBackendIdentity;
    _defineProperty(this, "logger", void 0);
    /** The parsed data from the Matrix event.
     * To access checked eventId and sender from the matrixEvent.
     * Class construction will fail if these values cannot get obtained. */
    _defineProperty(this, "matrixEventData", void 0);
    var [eventId, sender, ts] = [matrixEvent.getId(), matrixEvent.getSender(), matrixEvent.getTs()];
    if (eventId === undefined) throw new Error("parentEvent is missing eventId field");
    if (sender === undefined) throw new Error("parentEvent is missing sender field");
    this.matrixEventData = {
      eventId,
      sender,
      ts
    };
    this.logger = logger === null || logger === void 0 ? void 0 : logger.getChild("[CallMembership ".concat(sender, ":").concat(this.deviceId, "]"));
  }

  /**
   * sha256(`${this.userId}|${this.deviceId}|${this.memberId}`) for sticky events (kind = rtc)
   * `${this.userId}:${this.deviceId}` for state events (kind = session)
   */
  static computeRtcBackendIdentity(matrixEvent, membershipData) {
    return _asyncToGenerator(function* () {
      var {
        kind,
        data
      } = membershipData;
      switch (kind) {
        case "rtc":
          {
            return CallMembership.computeRtcIdentityRaw(data.member.user_id, data.member.device_id, data.member.id);
          }
        case "session":
          return "".concat(matrixEvent.getSender(), ":").concat(data.device_id);
      }
    })();
  }
  static computeRtcIdentityRaw(userId, deviceId, memberId) {
    return _asyncToGenerator(function* () {
      return encodeUnpaddedBase64(yield sha256("".concat(userId, "|").concat(deviceId, "|").concat(memberId)));
    })();
  }
  static membershipDataFromMatrixEvent(matrixEvent) {
    var [eventId, sender, content] = [matrixEvent.getId(), matrixEvent.getSender(), matrixEvent.getContent()];
    if (eventId === undefined) throw new Error("parentEvent is missing eventId field");
    if (sender === undefined) throw new Error("parentEvent is missing sender field");
    var sessionErrors = [];
    var rtcErrors = [];
    if (checkSessionsMembershipData(content, sessionErrors)) {
      return {
        kind: "session",
        data: content
      };
    } else if (checkRtcMembershipData(content, rtcErrors, sender)) {
      return {
        kind: "rtc",
        data: content
      };
    } else {
      var details = sessionErrors.length < rtcErrors.length ? "Does not match MSC4143 m.call.member:\n".concat(sessionErrors.join("\n"), "\n\n") : "Does not match MSC4143 m.rtc.member:\n".concat(rtcErrors.join("\n"), "\n\n");
      var json = "\nevent:\n" + JSON.stringify(content).replaceAll('"', "'");
      throw Error("unknown CallMembership data.\n" + details + json);
    }
  }

  /** @deprecated use userId instead */
  get sender() {
    return this.userId;
  }
  get userId() {
    var {
      kind,
      data
    } = this.membershipData;
    switch (kind) {
      case "rtc":
        return data.member.user_id;
      case "session":
      default:
        return this.matrixEventData.sender;
    }
  }
  get eventId() {
    return this.matrixEventData.eventId;
  }

  /**
   * The ID of the MatrixRTC slot that this membership belongs to (format `{application}#{id}`).
   * This is computed in case SessionMembershipData is used.
   */
  get slotId() {
    var {
      kind,
      data
    } = this.membershipData;
    switch (kind) {
      case "rtc":
        return data.slot_id;
      case "session":
      default:
        return slotDescriptionToId({
          application: this.application,
          id: data.call_id
        });
    }
  }
  get deviceId() {
    var {
      kind,
      data
    } = this.membershipData;
    switch (kind) {
      case "rtc":
        return data.member.device_id;
      case "session":
      default:
        return data.device_id;
    }
  }
  get callIntent() {
    var {
      kind,
      data
    } = this.membershipData;
    switch (kind) {
      case "rtc":
        {
          var _this$logger;
          var intent = data.application["m.call.intent"];
          if (typeof intent === "string") {
            return intent;
          }
          (_this$logger = this.logger) === null || _this$logger === void 0 || _this$logger.warn("RTC membership has invalid m.call.intent");
          return undefined;
        }
      case "session":
      default:
        return data["m.call.intent"];
    }
  }

  /**
   * Parsed `slot_id` (format `{application}#{id}`) into its components (application and id).
   */
  get slotDescription() {
    return slotIdToDescription(this.slotId);
  }
  get application() {
    var {
      kind,
      data
    } = this.membershipData;
    switch (kind) {
      case "rtc":
        return data.application.type;
      case "session":
      default:
        return data.application;
    }
  }
  get applicationData() {
    var {
      kind,
      data
    } = this.membershipData;
    switch (kind) {
      case "rtc":
        return data.application;
      case "session":
      default:
        return {
          "type": data.application,
          "m.call.intent": data["m.call.intent"]
        };
    }
  }

  /** @deprecated scope is not used and will be removed in future versions. replaced by application specific types.*/
  get scope() {
    var {
      kind,
      data
    } = this.membershipData;
    switch (kind) {
      case "rtc":
        return undefined;
      case "session":
      default:
        return data.scope;
    }
  }
  /**
   * @deprecated renamed to `memberId`
   */
  get membershipID() {
    return this.memberId;
  }

  /**
   * This computes the membership ID for the membership.
   * For the sticky event based rtcSessionData this is trivial it is `member.id`.
   * This is not supposed to be used to identity on an rtc backend. This is just a nouance for
   * a generated (sha256) anonymised identity. Only send `rtcBackendIdentity` to any rtc backend service.
   *
   * For the legacy sessionMemberEvents it is a bit more complex. Here we sometimes do not have this data
   * in the event content and we expected the SFU and the client to use `${this.matrixEventData.sender}:${data.device_id}`.
   *
   * So if there is no membershipID we use the hard coded jwt id default (`${this.matrixEventData.sender}:${data.device_id}`)
   * value (used until version 0.16.0)
   *
   * It is also possible for a session event to set a custom membershipID. in that case this will be used.
   */
  get memberId() {
    var _data$membershipID;
    // the createdTs behaves equivalent to the membershipID.
    // we only need the field for the legacy member events where we needed to update them
    // synapse ignores sending state events if they have the same content.
    var {
      kind,
      data
    } = this.membershipData;
    switch (kind) {
      case "rtc":
        return data.member.id;
      case "session":
      default:
        return (// best case we have a client already publishing the right custom membershipId
          (_data$membershipID = data.membershipID) !== null && _data$membershipID !== void 0 ? _data$membershipID : // alternativly we use the hard coded jwt id defuatl value (used until version 0.16.0)
          "".concat(this.matrixEventData.sender, ":").concat(data.device_id)
        );
    }
  }
  createdTs() {
    var _data$created_ts;
    var {
      kind,
      data
    } = this.membershipData;
    switch (kind) {
      case "rtc":
        // TODO we need to read the referenced (relation) event if available to get the real created_ts
        return this.matrixEventData.ts;
      case "session":
      default:
        return (_data$created_ts = data.created_ts) !== null && _data$created_ts !== void 0 ? _data$created_ts : this.matrixEventData.ts;
    }
  }

  /**
   * Gets the absolute expiry timestamp of the membership.
   * @returns The absolute expiry time of the membership as a unix timestamp in milliseconds or undefined if not applicable
   */
  getAbsoluteExpiry() {
    var _data$expires;
    var {
      kind,
      data
    } = this.membershipData;
    switch (kind) {
      case "rtc":
        return undefined;
      case "session":
      default:
        // TODO: calculate this from the MatrixRTCSession join configuration directly
        return this.createdTs() + ((_data$expires = data.expires) !== null && _data$expires !== void 0 ? _data$expires : DEFAULT_EXPIRE_DURATION);
    }
  }

  /**
   * @returns The number of milliseconds until the membership expires or undefined if applicable
   */
  getMsUntilExpiry() {
    var {
      kind
    } = this.membershipData;
    switch (kind) {
      case "rtc":
        return undefined;
      case "session":
      default:
        // Assume that local clock is sufficiently in sync with other clocks in the distributed system.
        // We used to try and adjust for the local clock being skewed, but there are cases where this is not accurate.
        // The current implementation allows for the local clock to be -infinity to +MatrixRTCSession.MEMBERSHIP_EXPIRY_TIME/2
        return this.getAbsoluteExpiry() - Date.now();
    }
  }

  /**
   * @returns true if the membership has expired, otherwise false
   */
  isExpired() {
    var {
      kind
    } = this.membershipData;
    switch (kind) {
      case "rtc":
        return false;
      case "session":
      default:
        return this.getMsUntilExpiry() <= 0;
    }
  }

  /**
   * ## RTC Membership
   * Gets the primary transport to use for this RTC membership (m.rtc.member).
   * This will return the primary transport that is used by this call membership to publish their media.
   * Directly relates to the `rtc_transports` field.
   *
   * ## Legacy session membership
   * In case of a legacy session membership (m.call.member) this will return the selected transport where
   * media is published. How this selection happens depends on the `focus_active` field of the session membership.
   * If the `focus_selection` is `oldest_membership` this will return the transport of the oldest membership
   * in the room (based on the `created_ts` field of the session membership).
   * If the `focus_selection` is `multi_sfu` it will return the first transport of the `foci_preferred` list.
   * (`multi_sfu` is equivalent to how `m.rtc.member` `rtc_transports` work).
   * @param oldestMembership For backwards compatibility with session membership (legacy). Unused in case of RTC membership.
   * Always required to make the consumer not care if it deals with RTC or session memberships.
   * @returns The transport this membership uses to publish media or undefined if no transport is available.
   */
  getTransport(oldestMembership) {
    var {
      kind,
      data
    } = this.membershipData;
    switch (kind) {
      case "rtc":
        return data.rtc_transports[0];
      case "session":
        switch (data.focus_active.focus_selection) {
          case "multi_sfu":
            return data.foci_preferred[0];
          case "oldest_membership":
            if (CallMembership.equal(this, oldestMembership)) return data.foci_preferred[0];
            if (oldestMembership !== undefined) return oldestMembership.getTransport(oldestMembership);
            break;
        }
    }
    return undefined;
  }

  /**
   * The focus_active filed of the session membership (m.call.member).
   * @deprecated focus_active is not used and will be removed in future versions.
   */
  getFocusActive() {
    var {
      kind,
      data
    } = this.membershipData;
    if (kind === "session") return data.focus_active;
    return undefined;
  }
  /**
   * The value of the `rtc_transports` field for RTC memberships (m.rtc.member).
   * Or the value of the `foci_preferred` field for legacy session memberships (m.call.member).
   */
  get transports() {
    var {
      kind,
      data
    } = this.membershipData;
    switch (kind) {
      case "rtc":
        return data.rtc_transports;
      case "session":
      default:
        return data.foci_preferred;
    }
  }
  get kind() {
    return this.membershipData.kind;
  }
}
//# sourceMappingURL=CallMembership.js.map