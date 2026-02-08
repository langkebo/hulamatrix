export interface IFriendRequestV2 {
    room_id: string;
    target_user_id: string;
    status: "pending" | "accepted" | "rejected";
}
export interface ISendFriendRequestParams {
    target_user_id: string;
    message?: string;
}
export interface IAcceptFriendRequestResult {
    room_id: string;
    status: "accepted";
    direct_chats: Record<string, string[]>;
}
export interface IRejectFriendRequestResult {
    room_id: string;
    status: "rejected";
}
export interface IFriendRequestsApi {
    sendFriendRequest(params: ISendFriendRequestParams): Promise<IFriendRequestV2>;
    acceptFriendRequest(roomId: string): Promise<IAcceptFriendRequestResult>;
    rejectFriendRequest(roomId: string): Promise<IRejectFriendRequestResult>;
}
//# sourceMappingURL=friend-requests.types.d.ts.map