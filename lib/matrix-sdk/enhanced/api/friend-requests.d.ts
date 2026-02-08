import type { SynapseEnhancedHttpClient } from "../utils/http.ts";
import type { IFriendRequestV2 } from "../models/friend-requests.types.ts";
export declare class FriendRequestsApi {
    private httpClient;
    constructor(httpClient: SynapseEnhancedHttpClient);
    /**
     * Send a friend request to a user
     * POST /_synapse/enhanced/friend/request
     */
    sendFriendRequest(params: {
        target_user_id: string;
        message?: string;
    }): Promise<IFriendRequestV2>;
    /**
     * Get pending friend requests
     * GET /_synapse/enhanced/friend/requests
     */
    getFriendRequests(): Promise<IFriendRequestV2[]>;
    /**
     * Accept a friend request
     * POST /_synapse/enhanced/friend/request/{request_id}/accept
     */
    acceptFriendRequest(roomId: string): Promise<{
        room_id: string;
        status: string;
        direct_chats: Record<string, string[]>;
    }>;
    /**
     * Reject (decline) a friend request
     * POST /_synapse/enhanced/friend/request/{request_id}/decline
     */
    rejectFriendRequest(roomId: string): Promise<{
        room_id: string;
        status: string;
    }>;
}
//# sourceMappingURL=friend-requests.d.ts.map