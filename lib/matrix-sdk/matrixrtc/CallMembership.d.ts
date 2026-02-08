import { type LivekitFocusSelection } from "./LivekitTransport.ts";
import { type SlotDescription } from "./MatrixRTCSession.ts";
import type { RTCCallIntent, Transport } from "./types.ts";
import { type MatrixEvent } from "../models/event.ts";
import { type RelationType } from "../@types/event.ts";
import { type Logger } from "../logger.ts";
/**
 * The default duration in milliseconds that a membership is considered valid for.
 * Ordinarily the client responsible for the session will update the membership before it expires.
 * We use this duration as the fallback case where stale sessions are present for some reason.
 */
export declare const DEFAULT_EXPIRE_DURATION: number;
type CallScope = "m.room" | "m.user";
type Member = {
    user_id: string;
    device_id: string;
    /**
     * The id used on the media backend.
     * (With livekit this is the participant identity on the LK SFU)
     * This can be a UUID but right now it is `${this.matrixEventData.sender}:${data.device_id}`.
     */
    id: string;
    [key: string]: unknown;
};
export interface RtcMembershipData extends Record<string, unknown> {
    "slot_id": string;
    "member": Member;
    "m.relates_to"?: {
        event_id: string;
        rel_type: RelationType.Reference;
    };
    "application": {
        type: string;
        [key: string]: unknown;
    };
    "rtc_transports": Transport[];
    "versions": string[];
    "msc4354_sticky_key"?: string;
    "sticky_key"?: string;
}
/**
 * MSC4143 (MatrixRTC) session membership data.
 * Represents the `session` in the memberships section of an m.call.member event as it is on the wire.
 **/
export type SessionMembershipData = Record<string, unknown> & {
    /**
     * The RTC application defines the type of the RTC session.
     */
    "application": string;
    /**
     * The id of this session.
     * A session can never span over multiple rooms so this id is to distinguish between
     * multiple session in one room. A room wide session that is not associated with a user,
     * and therefore immune to creation race conflicts, uses the `call_id: ""`.
     */
    "call_id": string;
    /**
     * The Matrix device ID of this session. A single user can have multiple sessions on different devices.
     */
    "device_id": string;
    /**
     * The focus selection system this user/membership is using.
     */
    "focus_active": LivekitFocusSelection;
    /**
     * A list of possible foci this user knows about. One of them might be used based on the focus_active
     * selection system.
     */
    "foci_preferred": Transport[];
    /**
     * Optional field that contains the creation of the session. If it is undefined the creation
     * is the `origin_server_ts` of the event itself. For updates to the event this property tracks
     * the `origin_server_ts` of the initial join event.
     *  - If it is undefined it can be interpreted as a "Join".
     *  - If it is defined it can be interpreted as an "Update"
     */
    "created_ts"?: number;
    /**
     * If the `application` = `"m.call"` this defines if it is a room or user owned call.
     * There can always be one room scoped call but multiple user owned calls (breakout sessions)
     */
    "scope"?: CallScope;
    /**
     * Optionally we allow to define a delta to the `created_ts` that defines when the event is expired/invalid.
     * This should be set to multiple hours. The only reason it exist is to deal with failed delayed events.
     * (for example caused by a homeserver crashes)
     **/
    "expires"?: number;
    /**
     * The intent of the call from the perspective of this user. This may be an audio call, video call or
     * something else.
     */
    "m.call.intent"?: RTCCallIntent;
    /**
     * The sticky key in case of a sticky event. This string encodes the application + device_id indicating the used slot + device.
     */
    "msc4354_sticky_key"?: string;
    /**
     * The id used on the media backend.
     * (With livekit this is the participant identity on the LK SFU)
     * This can be a UUID but right now it is `${this.matrixEventData.sender}:${data.device_id}`.
     *
     * It is compleatly valid to not set this field. Other clients will treat `undefined` as `${this.matrixEventData.sender}:${data.device_id}`
     */
    "membershipID"?: string;
};
type MembershipData = {
    kind: "rtc";
    data: RtcMembershipData;
} | {
    kind: "session";
    data: SessionMembershipData;
};
export declare class CallMembership {
    /**
     * The type checked membership data {data: (content of the matrix event), kind: (type hint)}
     *
     */
    private readonly membershipData;
    /**
     *
     * Anonymized identity to use with the RTC backend.
     *
     * The rtcBackendIdentity is a hashed version of all the identity parts:
     * `sha256(${this.userId}|${this.deviceId}|${this.memberId})`
     *
     * It is used to anonymize the identity of the user in the RTC backend.
     */
    readonly rtcBackendIdentity: string;
    static equal(a?: CallMembership, b?: CallMembership): boolean;
    private logger?;
    /** The parsed data from the Matrix event.
     * To access checked eventId and sender from the matrixEvent.
     * Class construction will fail if these values cannot get obtained. */
    private readonly matrixEventData;
    constructor(
    /** The required parts of the Matrix event that this membership is based on */
    matrixEvent: Pick<MatrixEvent, "getId" | "getSender" | "getTs">, 
    /**
     * The type checked membership data {data: (content of the matrix event), kind: (type hint)}
     *
     */
    membershipData: MembershipData, 
    /**
     *
     * Anonymized identity to use with the RTC backend.
     *
     * The rtcBackendIdentity is a hashed version of all the identity parts:
     * `sha256(${this.userId}|${this.deviceId}|${this.memberId})`
     *
     * It is used to anonymize the identity of the user in the RTC backend.
     */
    rtcBackendIdentity: string, 
    /**
     * The constructor will automatically create a properly tagged child logger instance.
     */
    logger?: Logger);
    /**
     * sha256(`${this.userId}|${this.deviceId}|${this.memberId}`) for sticky events (kind = rtc)
     * `${this.userId}:${this.deviceId}` for state events (kind = session)
     */
    static computeRtcBackendIdentity(matrixEvent: Pick<MatrixEvent, "getSender">, membershipData: MembershipData): Promise<string>;
    static computeRtcIdentityRaw(userId: string, deviceId: string, memberId: string): Promise<string>;
    static membershipDataFromMatrixEvent(matrixEvent: MatrixEvent): MembershipData;
    /** @deprecated use userId instead */
    get sender(): string;
    get userId(): string;
    get eventId(): string;
    /**
     * The ID of the MatrixRTC slot that this membership belongs to (format `{application}#{id}`).
     * This is computed in case SessionMembershipData is used.
     */
    get slotId(): string;
    get deviceId(): string;
    get callIntent(): RTCCallIntent | undefined;
    /**
     * Parsed `slot_id` (format `{application}#{id}`) into its components (application and id).
     */
    get slotDescription(): SlotDescription;
    get application(): string;
    get applicationData(): {
        type: string;
        [key: string]: unknown;
    };
    /** @deprecated scope is not used and will be removed in future versions. replaced by application specific types.*/
    get scope(): CallScope | undefined;
    /**
     * @deprecated renamed to `memberId`
     */
    get membershipID(): string;
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
    get memberId(): string;
    createdTs(): number;
    /**
     * Gets the absolute expiry timestamp of the membership.
     * @returns The absolute expiry time of the membership as a unix timestamp in milliseconds or undefined if not applicable
     */
    getAbsoluteExpiry(): number | undefined;
    /**
     * @returns The number of milliseconds until the membership expires or undefined if applicable
     */
    getMsUntilExpiry(): number | undefined;
    /**
     * @returns true if the membership has expired, otherwise false
     */
    isExpired(): boolean;
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
    getTransport(oldestMembership: CallMembership): Transport | undefined;
    /**
     * The focus_active filed of the session membership (m.call.member).
     * @deprecated focus_active is not used and will be removed in future versions.
     */
    getFocusActive(): LivekitFocusSelection | undefined;
    /**
     * The value of the `rtc_transports` field for RTC memberships (m.rtc.member).
     * Or the value of the `foci_preferred` field for legacy session memberships (m.call.member).
     */
    get transports(): Transport[];
    get kind(): MembershipData["kind"];
}
export {};
//# sourceMappingURL=CallMembership.d.ts.map