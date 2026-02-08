export interface IKeyValueStore {
    setItem(key: string, value: unknown): Promise<void>;
    getItem<T>(key: string): Promise<T | null>;
    deleteItem(key: string): Promise<void>;
}
export declare class MemoryKeyValueStore implements IKeyValueStore {
    private data;
    constructor();
    setItem(key: string, value: unknown): Promise<void>;
    getItem<T>(key: string): Promise<T | null>;
    deleteItem(key: string): Promise<void>;
}
export declare class LocalStorageKeyValueStore implements IKeyValueStore {
    private localStorage;
    constructor(localStorage: Storage);
    setItem(key: string, value: unknown): Promise<void>;
    getItem<T>(key: string): Promise<T | null>;
    deleteItem(key: string): Promise<void>;
}
//# sourceMappingURL=KeyValueStore.d.ts.map