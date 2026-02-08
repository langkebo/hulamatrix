import type { SynapseEnhancedHttpClient } from "../utils/http.ts";
export declare class BlockedUsersApi {
    private httpClient;
    constructor(httpClient: SynapseEnhancedHttpClient);
    getBlocked(): Promise<{
        blocked_users: string[];
        total: number;
    }>;
    addUserToBlocked(userId: string): Promise<{
        user_id: string;
        status: string;
        total_blocked: number;
    }>;
    checkBlocked(userId: string): Promise<{
        user_id: string;
        is_blocked: boolean;
    }>;
    removeBlocked(userId: string): Promise<{
        user_id: string;
        status: string;
        total_blocked: number;
    }>;
    batchBlockUsers(userIds: string[]): Promise<{
        results: Array<{
            user_id: string;
            is_blocked: boolean;
            status: string;
        }>;
        total_updated: number;
    }>;
}
//# sourceMappingURL=blocked-users.d.ts.map