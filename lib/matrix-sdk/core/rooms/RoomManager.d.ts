import { type MatrixHttpApi, type IHttpOpts } from "../../http-api/index.ts";
import type { IKeyValueStore } from "../../store/KeyValueStore.ts";
import type { IRoomEvent, IStateEvent } from "../../sync-accumulator.ts";
import type { IContent } from "../../models/event.ts";
import type { EmptyObject } from "../../@types/common.ts";
export interface RoomManagerEvents {
    roomCreated: {
        roomId: string;
    };
    roomJoined: {
        roomId: string;
    };
    roomLeft: {
        roomId: string;
    };
    roomInvited: {
        roomId: string;
    };
    error: Error;
}
export interface CreateRoomOptions {
    room_alias_name?: string;
    name?: string;
    topic?: string;
    invite?: string[];
    invite_3pid?: Array<{
        id_server: string;
        medium: string;
        address: string;
    }>;
    visibility?: "public" | "private";
    preset?: "private_chat" | "public_chat" | "trusted_private_chat" | "custom";
    room_version?: string;
    creation_content?: IContent;
    initial_state?: IStateEvent[];
    power_level_content_override?: IContent;
}
export interface RoomStateResponse {
    events: IStateEvent[];
}
export interface RoomMembersResponse {
    chunk: IRoomEvent[];
}
export interface PublicRoomsResponse {
    chunk: Array<{
        room_id: string;
        name?: string;
        topic?: string;
        num_joined_members: number;
        world_readable?: boolean;
        guest_can_join?: boolean;
        avatar_url?: string;
    }>;
    next_batch: string;
    prev_batch: string;
    total_room_count_estimate: number;
}
export interface RoomDirectoryVisibilityResponse {
    visibility: "public" | "private";
}
export declare class RoomManager {
    private http;
    private store;
    private rooms;
    constructor(http: MatrixHttpApi<IHttpOpts>, store: IKeyValueStore);
    createRoom(options?: CreateRoomOptions): Promise<{
        room_id: string;
    }>;
    joinRoom(roomIdOrAlias: string, viaServers?: string[]): Promise<{
        room_id: string;
    }>;
    joinRoomById(roomId: string, viaServers?: string[]): Promise<{
        room_id: string;
    }>;
    leave(roomId: string): Promise<void>;
    forget(roomId: string): Promise<void>;
    invite(roomId: string, userId: string): Promise<void>;
    inviteByEmail(roomId: string, email: string): Promise<void>;
    kick(roomId: string, userId: string, reason?: string): Promise<EmptyObject>;
    ban(roomId: string, userId: string, reason?: string): Promise<EmptyObject>;
    unban(roomId: string, userId: string): Promise<EmptyObject>;
    getRoomState(roomId: string, eventType?: string, stateKey?: string): Promise<RoomStateResponse>;
    setRoomState(roomId: string, eventType: string, content: IContent, stateKey?: string): Promise<{
        event_id: string;
    }>;
    getRoomMembers(roomId: string): Promise<RoomMembersResponse>;
    getJoinedMembers(roomId: string): Promise<{
        joined: Record<string, Record<string, unknown>>;
    }>;
    getRoomDirectoryVisibility(roomId: string): Promise<RoomDirectoryVisibilityResponse>;
    setRoomDirectoryVisibility(roomId: string, visibility: "public" | "private"): Promise<EmptyObject>;
    getPublicRooms(options?: {
        limit?: number;
        since?: string;
        server?: string;
        filter?: {
            generic_search_term?: string;
            room_types?: string[];
        };
    }): Promise<PublicRoomsResponse>;
    reportEvent(roomId: string, eventId: string, score: number, reason: string): Promise<EmptyObject>;
    getRoom(roomId: string): RoomData | undefined;
    getRooms(): RoomData[];
    getJoinedRooms(): RoomData[];
    isJoined(roomId: string): boolean;
    updateRoomData(roomId: string, data: Partial<RoomData>): void;
    private saveRooms;
    private loadRooms;
}
export interface RoomData {
    roomId: string;
    joined: boolean;
    membership: "join" | "leave" | "ban" | "invite";
    name?: string;
    topic?: string;
    avatar?: string;
    createdAt?: number;
    joinedAt?: number;
    leftAt?: number;
    lastEvent?: IRoomEvent;
}
//# sourceMappingURL=RoomManager.d.ts.map