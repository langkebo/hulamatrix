import { BaseApi } from "../utils/base-api.ts";
import { type SynapseEnhancedHttpClient } from "../utils/http.ts";
import type { IFriend } from "../models/types.ts";
export interface IFriendsResponse {
    friends: IFriend[];
    total: number;
    page: number;
    limit: number;
}
export declare class FriendsBasicApi extends BaseApi {
    constructor(httpClient: SynapseEnhancedHttpClient);
    getFriends(params?: {
        category?: string;
        page?: number;
        limit?: number;
    }): Promise<IFriendsResponse>;
    getFriend(friendId: string): Promise<IFriend | null>;
    checkFriendship(otherUserId: string): Promise<boolean>;
    setRemark(friendId: string, remark: string): Promise<boolean>;
    deleteFriend(friendId: string): Promise<boolean>;
}
//# sourceMappingURL=friends-basic.d.ts.map