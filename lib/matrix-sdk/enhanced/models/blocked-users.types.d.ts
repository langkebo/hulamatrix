export interface IBlockedUserV2 {
    user_id: string;
    blocked_at: string;
    reason?: string;
}
export interface IGetBlockedResult {
    blocked_users: string[];
    total: number;
}
export interface IAddUserToBlockedResult {
    user_id: string;
    status: string;
    total_blocked: number;
}
export interface ICheckBlockedResult {
    user_id: string;
    is_blocked: boolean;
}
export interface IRemoveBlockedResult {
    user_id: string;
    status: string;
    total_blocked: number;
}
export interface IBatchBlockUsersResult {
    results: Array<{
        user_id: string;
        private_chat_enabled: boolean;
        status: string;
    }>;
    total_blocked: number;
}
export interface IBlockedUsersApi {
    getBlocked(): Promise<IGetBlockedResult>;
    addUserToBlocked(userId: string): Promise<IAddUserToBlockedResult>;
    checkBlocked(userId: string): Promise<ICheckBlockedResult>;
    removeBlocked(userId: string): Promise<IRemoveBlockedResult>;
    batchBlockUsers(userIds: string[]): Promise<IBatchBlockUsersResult>;
}
//# sourceMappingURL=blocked-users.types.d.ts.map