import { type MatrixHttpApi, type IHttpOpts } from "../http-api/index.ts";
import type { IKeyValueStore } from "../store/KeyValueStore.ts";
import type { ISyncResponse, IRoomEvent } from "../sync-accumulator.ts";
export interface IncrementalSyncOptions {
    batchSize?: number;
    maxBackoff?: number;
    initialBackoff?: number;
}
export interface RoomSyncState {
    prevBatch: string;
    events: IRoomEvent[];
    state: Map<string, IRoomEvent>;
}
export interface ISyncStateData {
    next_batch: string;
    account_data?: {
        events: IRoomEvent[];
    };
    presence?: {
        events: IRoomEvent[];
    };
    rooms?: {
        invite?: Record<string, {
            invite_state: {
                events: IRoomEvent[];
            };
        }>;
        join?: Record<string, {
            timeline: {
                events: IRoomEvent[];
            };
            state: {
                events: IRoomEvent[];
            };
        }>;
        leave?: Record<string, {
            timeline: {
                events: IRoomEvent[];
            };
            state: {
                events: IRoomEvent[];
            };
        }>;
    };
}
export declare class IncrementalSyncManager {
    private http;
    private store;
    private syncToken;
    private roomStates;
    private pendingEvents;
    private backoff;
    private maxBackoff;
    private batchSize;
    constructor(http: MatrixHttpApi<IHttpOpts>, store: IKeyValueStore, options?: IncrementalSyncOptions);
    syncOnce(since?: string, timeout?: number): Promise<Partial<ISyncResponse>>;
    syncIncremental(roomId: string, limit?: number): Promise<IRoomEvent[]>;
    getSyncToken(): string | null;
    setSyncToken(token: string): void;
    getRoomState(roomId: string): RoomSyncState | undefined;
    getPendingEvents(roomId: string): IRoomEvent[];
    clearRoomState(roomId: string): void;
    clearAllStates(): void;
    getBackoff(): number;
    resetBackoff(): void;
    private processSyncResponse;
    private processJoinedRoom;
    private processInvitedRoom;
    private processLeftRoom;
    private saveState;
    private loadState;
    private saveRoomState;
}
//# sourceMappingURL=IncrementalSyncManager.d.ts.map