import type { IKeyValueStore } from "../storage/KeyValueStore.ts";
export interface SecureKeyEntry {
    keyId: string;
    keyData: string;
    algorithm: string;
    createdAt: number;
    expiresAt?: number;
}
export interface SecureKeyOptions {
    encryptionKey?: string;
    keyLifetime?: number;
}
export declare class SecureKeyManager {
    private store;
    private keys;
    private encryptionKey;
    private keyLifetime;
    constructor(store: IKeyValueStore, options?: SecureKeyOptions);
    storeKey(keyId: string, keyData: string, algorithm: string, ttl?: number): Promise<void>;
    getKey(keyId: string): Promise<string | null>;
    deleteKey(keyId: string): Promise<void>;
    listKeys(algorithm?: string): Promise<SecureKeyEntry[]>;
    rotateKey(keyId: string, newKeyData: string): Promise<void>;
    cleanupExpiredKeys(): Promise<number>;
    clearAllKeys(): Promise<void>;
    getKeyCount(): number;
    hasKey(keyId: string): boolean;
    private encrypt;
    private decrypt;
    private generateEncryptionKey;
    private saveKey;
    private loadKeys;
    private listStoredKeys;
}
//# sourceMappingURL=SecureKeyManager.d.ts.map