import { type SynapseEnhancedHttpClient } from "../utils/http.ts";
import type { IPrivateChatApi, ICreateSession, IPrivateSession, ISendMessage, IPrivateMessage, IPaginationParams, IUnreadCount, ISearchMessagesParams, ISessionStatistics, IChatroomDetail, IChatroomFile, IVoiceMessageItem } from "../models/types.ts";
import { BaseApi } from "../utils/base-api.ts";
export declare class PrivateChatApi extends BaseApi implements IPrivateChatApi {
    constructor(httpClient: SynapseEnhancedHttpClient);
    createSession(params: ICreateSession): Promise<string>;
    getSessions(userId?: string): Promise<IPrivateSession[]>;
    getSessionDetail(sessionId: string): Promise<IPrivateSession | null>;
    closeSession(sessionId: string, userId: string): Promise<boolean>;
    sendMessage(params: ISendMessage): Promise<string>;
    getMessages(sessionId: string, params?: IPaginationParams): Promise<IPrivateMessage[]>;
    markAsRead(messageId: string, userId: string): Promise<boolean>;
    getUnreadCount(): Promise<IUnreadCount>;
    searchMessages(params: ISearchMessagesParams): Promise<IPrivateMessage[]>;
    /**
     * Search private chat sessions by query.
     *
     * @param params - Search parameters.
     * @param params.query - The search query string.
     * @param params.limit - Maximum number of results to return.
     * @param params.userId - Optional user ID to filter by.
     * @returns Promise resolving to an array of matching sessions.
     */
    searchSessions(params: {
        query: string;
        limit?: number;
        userId?: string;
    }): Promise<IPrivateSession[]>;
    getSessionStatistics(sessionId: string): Promise<ISessionStatistics>;
    getChatroomDetail(roomId: string): Promise<IChatroomDetail | null>;
    leaveChatroom(roomId: string): Promise<boolean>;
    muteChatroom(roomId: string, mute: boolean): Promise<boolean>;
    deleteMessage(_roomId: string, messageId: string): Promise<boolean>;
    getFiles(roomId: string): Promise<IChatroomFile[]>;
    getVoiceMessages(roomId: string): Promise<IVoiceMessageItem[]>;
}
//# sourceMappingURL=private-chat.d.ts.map