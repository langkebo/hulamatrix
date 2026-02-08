import { type SynapseEnhancedHttpClient } from "../utils/http.ts";
import type { IBlockedUser } from "../models/types.ts";
import { BaseApi } from "../utils/base-api.ts";
export declare class FriendsBlockApi extends BaseApi {
    constructor(httpClient: SynapseEnhancedHttpClient);
    getBlockedUsers(): Promise<IBlockedUser[]>;
    blockUser(targetId: string, reason?: string): Promise<boolean>;
    unblockUser(targetId: string): Promise<boolean>;
    isBlocked(userId: string): Promise<boolean>;
}
//# sourceMappingURL=friends-block.d.ts.map