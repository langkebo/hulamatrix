import { type MatrixHttpApi, type IHttpOpts } from "../../http-api/index.ts";
import type { IKeyValueStore } from "../../store/KeyValueStore.ts";
import type { IDeviceKeys, IOneTimeKey } from "../../@types/crypto.ts";
import type { KeyBackupInfo } from "../../crypto-api/keybackup.ts";
export interface CryptoManagerEvents {
    keysUploaded: void;
    keysClaimed: void;
    keyBackupCreated: string;
    keyBackupRestored: void;
    error: Error;
}
export interface UploadKeysOptions {
    deviceKeys?: IDeviceKeys;
    oneTimeKeys?: Record<string, IOneTimeKey>;
    fallbackKeys?: Record<string, IOneTimeKey>;
}
export interface QueryKeysRequest {
    device_keys: Record<string, string[]>;
    timeout?: number;
    token?: string;
}
export interface ClaimKeysRequest {
    one_time_keys: Record<string, Record<string, string>>;
    timeout?: number;
}
export declare class CryptoManager {
    private http;
    private store;
    private deviceKeys;
    private oneTimeKeys;
    private keyBackupVersion;
    constructor(http: MatrixHttpApi<IHttpOpts>, store: IKeyValueStore);
    uploadKeys(options: UploadKeysOptions): Promise<{
        one_time_key_counts: Record<string, number>;
    }>;
    queryKeys(request: QueryKeysRequest): Promise<{
        device_keys: Record<string, Record<string, IDeviceKeys>>;
        failures: Record<string, Record<string, Record<string, unknown>>>;
    }>;
    claimKeys(request: ClaimKeysRequest): Promise<{
        one_time_keys: Record<string, Record<string, IOneTimeKey>>;
        failures: Record<string, Record<string, Record<string, unknown>>>;
    }>;
    getKeyChanges(fromToken: string, toToken: string): Promise<{
        changed: string[];
        left: string[];
    }>;
    uploadKeySignatures(body: Record<string, Record<string, Record<string, Record<string, unknown>>>>): Promise<void>;
    getDeviceKey(userId: string, deviceId: string): Promise<IDeviceKeys | undefined>;
    getUserKeys(userIds: string[]): Promise<Record<string, Record<string, IDeviceKeys>>>;
    getStoredDeviceKey(userId: string, deviceId: string): IDeviceKeys | undefined;
    getStoredOneTimeKey(keyId: string): IOneTimeKey | undefined;
    clearDeviceKey(userId: string, deviceId: string): void;
    clearOneTimeKey(keyId: string): void;
    createKeyBackup(_version: string, algorithm: string, authData: Record<string, unknown>): Promise<Record<string, unknown>>;
    getKeyBackup(version?: string): Promise<KeyBackupInfo | null>;
    updateKeyBackup(version: string, versionData: Partial<KeyBackupInfo>): Promise<KeyBackupInfo>;
    deleteKeyBackup(version?: string): Promise<void>;
    uploadRoomKeyBackup(version: string, roomId: string, sessionId: string, data: Record<string, unknown>): Promise<void>;
    uploadRoomKeysBackup(version: string, rooms: Record<string, Record<string, Record<string, unknown>>>): Promise<void>;
    getRoomKeyBackup(version: string, roomId: string, sessionId: string): Promise<Record<string, unknown>>;
    getRoomKeysBackup(version: string): Promise<Record<string, Record<string, Record<string, unknown>>>>;
    deleteRoomKeyBackup(version: string, roomId?: string, sessionId?: string): Promise<void>;
    getKeyBackupVersion(): string | null;
    private saveKeys;
    private loadKeys;
}
//# sourceMappingURL=CryptoManager.d.ts.map