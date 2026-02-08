import { type SynapseEnhancedHttpClient } from "../utils/http.ts";
import { BaseApi } from "../utils/base-api.ts";
export declare class FriendsVerificationApi extends BaseApi {
    constructor(httpClient: SynapseEnhancedHttpClient);
    removeFriend(friendId: string): Promise<boolean>;
}
//# sourceMappingURL=friends-verification.d.ts.map