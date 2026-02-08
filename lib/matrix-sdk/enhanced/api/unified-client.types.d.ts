export interface IRegisterParams {
    username: string;
    password: string;
    auth?: Record<string, unknown>;
    device_id?: string;
    initial_device_display_name?: string;
    inhibit_login?: boolean;
    admin?: boolean;
    displayname?: string;
}
export interface IRegisterResponse {
    user_id: string;
    access_token: string;
    device_id: string;
    home_server: string;
}
export interface IUnifiedLoginParams {
    type: string;
    user: string;
    password: string;
    device_id?: string;
    initial_device_display_name?: string;
}
export interface ILoginResponse {
    user_id: string;
    access_token: string;
    device_id: string;
    home_server: string;
    well_known?: {
        "m.homeserver": {
            base_url: string;
        };
        "m.identity_server"?: {
            base_url: string;
        };
    };
}
export interface IRefreshParams {
    refresh_token: string;
}
export interface IRefreshResponse {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
}
export interface IUserProfile {
    displayname?: string;
    avatar_url?: string;
}
export interface ICreateRoomParams {
    preset?: string;
    room_alias_name?: string;
    name?: string;
    topic?: string;
    invite?: string[];
    invite_3pid?: Array<Record<string, unknown>>;
    creation_content?: Record<string, unknown>;
    initial_state?: Array<Record<string, unknown>>;
    room_version?: string;
}
export interface ICreateRoomResponse {
    room_id: string;
}
export interface IRoomInfo {
    room_id: string;
    name?: string;
    topic?: string;
    num_joined_members: number;
    world_readable: boolean;
    guest_can_join: boolean;
    avatar_url?: string;
    join_rule: string;
}
export interface IPublicRoomsParams {
    limit?: number;
    since?: string;
    server?: string;
    search_term?: string;
}
export interface IPublicRoomsResponse {
    chunk: IRoomInfo[];
    next_batch?: string;
    total_room_count_estimate?: number;
}
export interface ISendMessageParams {
    msgtype: string;
    body: string;
    url?: string;
    info?: Record<string, unknown>;
}
export interface IUnifiedSendEventResponse {
    event_id: string;
}
export interface IMessagesParams {
    from: string;
    dir: string;
    limit?: number;
    to?: string;
    filter?: string;
}
export interface IMessagesResponse {
    start: string;
    end: string;
    chunk: Array<Record<string, unknown>>;
    state?: Array<Record<string, unknown>>;
}
export interface IEditMessageParams {
    "body": string;
    "msgtype": string;
    "m.new_content"?: {
        msgtype: string;
        body: string;
    };
    "m.relates_to"?: {
        rel_type: string;
        event_id: string;
    };
}
export interface IRedactParams {
    reason?: string;
}
export interface IRedactResponse {
    event_id: string;
}
export interface IUserRoomsResponse {
    joined: IRoomInfo[];
    invited: IRoomInfo[];
}
export interface IInviteParams {
    user_id: string;
    reason?: string;
}
export interface IKickBanParams {
    user_id: string;
    reason?: string;
}
export interface IJoinRoomParams {
    reason?: string;
    third_party_signed?: Record<string, unknown>;
}
export interface ILeaveRoomParams {
    reason?: string;
}
//# sourceMappingURL=unified-client.types.d.ts.map