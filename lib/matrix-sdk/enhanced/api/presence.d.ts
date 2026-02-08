import { type SynapseEnhancedHttpClient } from "../utils/http.ts";
import type { IPresenceApi, IPresenceStatus, ISetPresence, IStatusResponse } from "../models/types.ts";
import { BaseApi } from "../utils/base-api.ts";
export declare class PresenceApi extends BaseApi implements IPresenceApi {
    constructor(httpClient: SynapseEnhancedHttpClient);
    getStatus(userId: string): Promise<IPresenceStatus>;
    setStatus(params: ISetPresence): Promise<IStatusResponse>;
    getPresence(userId: string): Promise<IPresenceStatus>;
    updatePresence(userId: string, presence: string, statusMsg?: string): Promise<void>;
}
//# sourceMappingURL=presence.d.ts.map