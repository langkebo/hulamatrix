import { type MatrixHttpApi } from "../../http-api/index.ts";
import type { IHttpOpts } from "../../http-api/index.ts";
import type { IKeyValueStore } from "../../store/KeyValueStore.ts";
import type { MatrixEvent } from "../../models/event.ts";
export interface SyncManagerEvents {
    sync: {
        nextBatch: string;
    };
    event: MatrixEvent;
    error: Error;
    stateChange: string;
}
export interface SyncManagerOptions {
    initialSyncLimit?: number;
    filter?: string | Record<string, unknown>;
}
export declare class SyncManager {
    private http;
    private store;
    private options;
    private syncToken;
    private isSyncing;
    private syncTimeout;
    private syncInterval;
    constructor(http: MatrixHttpApi<IHttpOpts>, store: IKeyValueStore, options?: SyncManagerOptions);
    start(): Promise<void>;
    stop(): Promise<void>;
    sync(): Promise<void>;
    getSyncToken(): string | null;
    isRunning(): boolean;
    setSyncToken(token: string): void;
    setSyncTimeout(timeout: number): void;
    setFilter(filter: string | Record<string, unknown>): Promise<void>;
    private loadSyncToken;
    private saveSyncToken;
}
//# sourceMappingURL=SyncManager.d.ts.map