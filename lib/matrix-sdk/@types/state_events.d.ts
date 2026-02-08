import { type RoomType } from "./event.ts";
import { type GuestAccess, type HistoryVisibility, type JoinRule, type RestrictedAllowType } from "./partials.ts";
import { type ImageInfo } from "./media.ts";
import { type PolicyRecommendation } from "../models/invites-ignorer.ts";
export interface RoomCanonicalAliasEventContent {
    alias?: string;
    alt_aliases?: string[];
}
export interface RoomCreateEventContent {
    "creator"?: string;
    "m.federate"?: boolean;
    "predecessor"?: {
        event_id: string;
        room_id: string;
    };
    "room_version"?: string;
    "type"?: RoomType;
}
export interface RoomJoinRulesEventContent {
    join_rule: JoinRule;
    allow?: {
        room_id: string;
        type: RestrictedAllowType;
    }[];
}
export interface RoomMemberEventContent {
    avatar_url?: string;
    displayname?: string;
    is_direct?: boolean;
    join_authorised_via_users_server?: string;
    membership: "invite" | "join" | "knock" | "leave" | "ban";
    reason?: string;
    third_party_invite?: {
        display_name: string;
        signed: {
            mxid: string;
            token: string;
            ts: number;
        };
    };
}
export interface RoomThirdPartyInviteEventContent {
    display_name: string;
    key_validity_url: string;
    public_key: string;
    public_keys: {
        key_validity_url?: string;
        public_key: string;
    }[];
}
export interface RoomPowerLevelsEventContent extends Record<string, unknown> {
    ban?: number;
    events?: {
        [eventType: string]: number;
    };
    events_default?: number;
    invite?: number;
    kick?: number;
    notifications?: {
        room?: number;
    };
    redact?: number;
    state_default?: number;
    users?: {
        [userId: string]: number;
    };
    users_default?: number;
}
export interface RoomNameEventContent extends Record<string, unknown> {
    name: string;
}
export interface RoomTopicEventContent extends Record<string, unknown> {
    topic: string | undefined | null;
}
export interface RoomAvatarEventContent extends Record<string, unknown> {
    url?: string;
    info?: Omit<ImageInfo, "thumbnail_file">;
}
export interface RoomPinnedEventsEventContent extends Record<string, unknown> {
    pinned: string[];
}
export interface RoomEncryptionEventContent extends Record<string, unknown> {
    "algorithm": "m.megolm.v1.aes-sha2";
    "io.element.msc4362.encrypt_state_events"?: boolean;
    "rotation_period_ms"?: number;
    "rotation_period_msgs"?: number;
}
export interface RoomHistoryVisibilityEventContent extends Record<string, unknown> {
    history_visibility: HistoryVisibility;
}
export interface RoomGuestAccessEventContent extends Record<string, unknown> {
    guest_access: GuestAccess;
}
export interface RoomServerAclEventContent extends Record<string, unknown> {
    allow?: string[];
    allow_ip_literals?: boolean;
    deny?: string[];
}
export interface RoomTombstoneEventContent extends Record<string, unknown> {
    body: string;
    replacement_room: string;
}
export interface SpaceChildEventContent extends Record<string, unknown> {
    order?: string;
    suggested?: boolean;
    via?: string[];
}
export interface SpaceParentEventContent extends Record<string, unknown> {
    canonical?: boolean;
    via?: string[];
}
export interface PolicyRuleEventContent {
    entity: string;
    reason: string;
    recommendation: PolicyRecommendation;
}
export interface RoomPolicyContent {
    via: string;
    public_key: string;
}
//# sourceMappingURL=state_events.d.ts.map