import { type SynapseEnhancedHttpClient } from "../utils/http.ts";
import { BaseApi } from "../utils/base-api.ts";
export interface IChatroom {
    room_id: string;
    name: string;
    topic?: string;
    member_count: number;
    is_direct: boolean;
    is_encrypted: boolean;
    unread_count: number;
    last_message?: {
        content: string;
        sender: string;
        timestamp: string;
    };
    created_at: string;
    state: "active" | "archived";
}
export interface IChatroomParams {
    user_id?: string;
    state?: "active" | "archived" | "all";
    page?: number;
    limit?: number;
}
export interface IUnreadCount {
    total_unread: number;
    by_room: {
        room_id: string;
        unread: number;
    }[];
}
export interface IPagination {
    page: number;
    limit: number;
    total: number;
    has_more: boolean;
}
export interface IMessage {
    message_id: string;
    room_id: string;
    content: string;
    type: string;
    sender: string;
    timestamp: string;
    reply_to?: string;
    is_deleted: boolean;
}
export interface IMessageParams {
    limit?: number;
    before?: string;
    after?: string;
}
export interface ISearchMessagesParams {
    query: string;
    page?: number;
    limit?: number;
}
export interface IChatroomApi {
    getChatrooms(params?: IChatroomParams): Promise<IChatroom[]>;
    getUnreadCount(): Promise<IUnreadCount>;
    getChatroomDetail(roomId: string): Promise<IChatroom | null>;
    leaveChatroom(roomId: string): Promise<boolean>;
    markAsRead(roomId: string): Promise<boolean>;
    getMessages(roomId: string, params?: IMessageParams): Promise<{
        messages: IMessage[];
        has_more: boolean;
    }>;
    sendMessage(roomId: string, content: string, type?: string, replyTo?: string): Promise<IMessage>;
    deleteMessage(roomId: string, messageId: string): Promise<boolean>;
    searchMessages(roomId: string, params: ISearchMessagesParams): Promise<{
        messages: IMessage[];
        total: number;
    }>;
}
export declare class ChatroomApi extends BaseApi implements IChatroomApi {
    constructor(httpClient: SynapseEnhancedHttpClient);
    private checkRateLimit;
    /**
     * Retrieves a paginated list of chatrooms for the current user.
     *
     * @param params - Optional parameters for filtering and pagination
     * @param params.state - Filter by chatroom state (active, archived, or all)
     * @param params.page - Page number for pagination (default: 1)
     * @param params.limit - Number of items per page (default: 50, max: 1000)
     * @returns Promise resolving to array of chatrooms
     * @throws SynapseEnhancedError on API failure
     */
    getChatrooms(params?: IChatroomParams): Promise<IChatroom[]>;
    /**
     * Retrieves the total unread message count across all chatrooms.
     *
     * @returns Promise resolving to unread count object with total and per-room breakdown
     * @throws SynapseEnhancedError on API failure
     */
    getUnreadCount(): Promise<IUnreadCount>;
    /**
     * Retrieves detailed information about a specific chatroom.
     *
     * @param roomId - The Matrix room ID (e.g., "!roomid:example.com")
     * @returns Promise resolving to chatroom details or null if not found
     * @throws SynapseEnhancedError on API failure (other than not found)
     */
    getChatroomDetail(roomId: string): Promise<IChatroom | null>;
    /**
     * Leaves a chatroom, removing the user from the room members.
     *
     * @param roomId - The Matrix room ID to leave
     * @returns Promise resolving to true on success
     * @throws SynapseEnhancedError on API failure
     */
    leaveChatroom(roomId: string): Promise<boolean>;
    /**
     * Marks all messages in a chatroom as read.
     *
     * @param roomId - The Matrix room ID to mark as read
     * @returns Promise resolving to true on success
     * @throws SynapseEnhancedError on API failure
     */
    markAsRead(roomId: string): Promise<boolean>;
    /**
     * Retrieves messages from a chatroom with pagination support.
     *
     * @param roomId - The Matrix room ID to fetch messages from
     * @param params - Optional pagination parameters
     * @param params.limit - Maximum number of messages to return (default: 50)
     * @param params.before - Event ID to fetch messages before
     * @param params.after - Event ID to fetch messages after
     * @returns Promise resolving to messages array and has_more flag
     * @throws SynapseEnhancedError on API failure
     */
    getMessages(roomId: string, params?: IMessageParams): Promise<{
        messages: IMessage[];
        has_more: boolean;
    }>;
    /**
     * Sends a message to a chatroom with optional reply functionality.
     *
     * @param roomId - The Matrix room ID to send message to
     * @param content - The message content (will be sanitized for XSS prevention)
     * @param type - The message type (default: "m.text")
     * @param replyTo - Optional event ID to reply to
     * @returns Promise resolving to the sent message
     * @throws SynapseEnhancedError on API failure or invalid input
     */
    sendMessage(roomId: string, content: string, type?: string, replyTo?: string): Promise<IMessage>;
    /**
     * Deletes a message from a chatroom.
     *
     * @param roomId - The Matrix room ID containing the message
     * @param messageId - The message event ID to delete
     * @returns Promise resolving to true on success
     * @throws SynapseEnhancedError on API failure or invalid input
     */
    deleteMessage(roomId: string, messageId: string): Promise<boolean>;
    /**
     * Searches for messages in a chatroom matching a query string.
     *
     * @param roomId - The Matrix room ID to search in
     * @param params - Search parameters
     * @param params.query - The search query string (required)
     * @param params.page - Page number for pagination (default: 1)
     * @param params.limit - Maximum number of results (default: 50)
     * @returns Promise resolving to matching messages and total count
     * @throws SynapseEnhancedError on API failure or invalid input
     */
    searchMessages(roomId: string, params: ISearchMessagesParams): Promise<{
        messages: IMessage[];
        total: number;
    }>;
}
//# sourceMappingURL=chatroom.d.ts.map