import type { SynapseEnhancedHttpClient } from "../utils/http.ts";
import { BaseApi } from "../utils/base-api.ts";
export interface ICreatePrivateChatParams {
    target_user_id: string;
    is_encrypted?: boolean;
    ttl?: number;
}
export interface IPrivateChatListParams {
    page?: number;
    page_size?: number;
}
export interface IPrivateChatAdminDetail {
    room_id: string;
    name?: string;
    is_public: boolean;
    member_count: number;
    created_at: string;
    creator_id: string;
}
export interface IPrivateChatAdminResult {
    room_id: string;
    status: string;
}
export interface IPrivateChatListResult {
    rooms: IPrivateChatAdminDetail[];
    total: number;
    page: number;
    page_size: number;
}
export declare class PrivateChatAdminApi extends BaseApi {
    constructor(httpClient: SynapseEnhancedHttpClient);
    createPrivateChat(params: ICreatePrivateChatParams): Promise<{
        room_id: string;
        is_encrypted: boolean;
        ttl: number;
    }>;
    listPrivateChats(params?: IPrivateChatListParams): Promise<IPrivateChatListResult>;
    getPrivateChatDetail(roomId: string): Promise<IPrivateChatAdminDetail | null>;
    deletePrivateChat(roomId: string): Promise<IPrivateChatAdminResult>;
}
//# sourceMappingURL=private-chat-admin.d.ts.map