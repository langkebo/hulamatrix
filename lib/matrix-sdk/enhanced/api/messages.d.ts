import { type SynapseEnhancedHttpClient } from "../utils/http.ts";
import { BaseApi } from "../utils/base-api.ts";
export interface IMessageSearchResult {
    message_id: string;
    room_id: string;
    sender_id: string;
    content: string;
    message_type: string;
    timestamp: string;
    relevance_score?: number;
}
export interface IMessageSearchParams {
    user_id: string;
    query: string;
    limit?: number;
    room_id?: string;
}
export interface IPaginationResult<T> {
    items: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        has_more: boolean;
    };
}
export declare class MessagesApi extends BaseApi {
    constructor(httpClient: SynapseEnhancedHttpClient);
    /**
     * Sanitize search query to prevent injection attacks
     * @param query - The raw search query
     * @returns Sanitized query string
     */
    private sanitizeSearchQuery;
    /**
     * Search messages for a user
     */
    searchMessages(params: IMessageSearchParams): Promise<IMessageSearchResult[]>;
    /**
     * Search messages with pagination
     */
    searchMessagesWithPagination(params: IMessageSearchParams & {
        page?: number;
        limit?: number;
    }): Promise<IPaginationResult<IMessageSearchResult>>;
    /**
     * Search messages in a specific room
     */
    searchMessagesInRoom(roomId: string, userId: string, query: string, limit?: number): Promise<IMessageSearchResult[]>;
    /**
     * Get recent messages for a user
     */
    getRecentMessages(userId: string, limit?: number): Promise<IMessageSearchResult[]>;
}
//# sourceMappingURL=messages.d.ts.map