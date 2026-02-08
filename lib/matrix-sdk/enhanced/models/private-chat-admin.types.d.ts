export interface IPrivateChatConfig {
    private_chat_enabled: boolean;
    admin_user: string;
}
export interface IUpdateConfigResult {
    private_chat_enabled: boolean;
    status: string;
    updated_by: string;
    updated_at: number;
}
export interface IGetUserAuthResult {
    user_id: string;
    private_chat_enabled: boolean;
    checked_by: string;
}
export interface IUpdateUserAuthResult {
    user_id: string;
    private_chat_enabled: boolean;
    status: string;
    authorized_by: string;
    authorized_at: number;
}
export interface IRemoveUserAuthResult {
    user_id: string;
    private_chat_enabled: boolean;
    status: string;
    removed_by: string;
}
export interface IBatchUpdateUserAuthResult {
    results: Array<{
        user_id: string;
        private_chat_enabled: boolean;
        status: string;
        authorized_by: string;
    }>;
    total_updated: number;
}
export interface IGetEnabledUsersResult {
    private_chat_enabled: boolean;
    admin_user: string;
    note: string;
}
export interface IPrivateChatAdminApi {
    getConfig(): Promise<IPrivateChatConfig>;
    updateConfig(enabled: boolean): Promise<IUpdateConfigResult>;
    getUserAuth(userId: string): Promise<IGetUserAuthResult>;
    updateUserAuth(userId: string, enabled: boolean): Promise<IUpdateUserAuthResult>;
    removeUserAuth(userId: string): Promise<IRemoveUserAuthResult>;
    batchUpdateUserAuth(userIds: string[], enabled: boolean): Promise<IBatchUpdateUserAuthResult>;
    getEnabledUsers(): Promise<IGetEnabledUsersResult>;
}
//# sourceMappingURL=private-chat-admin.types.d.ts.map