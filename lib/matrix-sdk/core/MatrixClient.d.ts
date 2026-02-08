import { MatrixHttpApi, type IHttpOpts } from "../http-api/index.ts";
import type { IKeyValueStore } from "../store/KeyValueStore.ts";
import { AuthManager } from "./auth/AuthManager.ts";
import { SyncManager, type SyncManagerOptions } from "./sync/SyncManager.ts";
import { CryptoManager } from "./crypto/CryptoManager.ts";
import { MessageProcessor } from "./messaging/MessageProcessor.ts";
import { RoomManager } from "./rooms/RoomManager.ts";
export interface MatrixClientOptions extends IHttpOpts {
    store: IKeyValueStore;
    syncOptions?: SyncManagerOptions;
}
export declare class MatrixClient {
    readonly auth: AuthManager;
    readonly sync: SyncManager;
    readonly crypto: CryptoManager;
    readonly messaging: MessageProcessor;
    readonly rooms: RoomManager;
    readonly http: MatrixHttpApi<IHttpOpts>;
    readonly store: IKeyValueStore;
    constructor(options: MatrixClientOptions);
    start(): Promise<void>;
    stop(): Promise<void>;
    login(username: string, password: string): Promise<void>;
    logout(): Promise<void>;
    logoutAll(): Promise<void>;
    getAccessToken(): string | null;
    getUserId(): string | null;
    isLoggedIn(): boolean;
    isSyncing(): boolean;
    getSyncToken(): string | null;
}
//# sourceMappingURL=MatrixClient.d.ts.map