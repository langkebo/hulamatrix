import type { IKeyValueStore } from "../store/KeyValueStore.ts";
import type { IDeviceKeys } from "../@types/crypto.ts";
export type VerificationStatus = "unverified" | "verifying" | "verified" | "blocked";
export interface DeviceInfo {
    deviceId: string;
    userId: string;
    keys: IDeviceKeys;
    displayName?: string;
    lastSeenIp?: string;
    lastSeenTs?: number;
    trustLevel: "unverified" | "verified" | "blocked";
}
export interface VerificationRequest {
    requestId: string;
    deviceId: string;
    userId: string;
    status: VerificationStatus;
    timestamp: number;
    methods: string[];
}
export interface DeviceVerificationOptions {
    autoVerifyTrusted?: boolean;
    verificationTimeout?: number;
}
export declare class DeviceVerification {
    private store;
    private devices;
    private verificationRequests;
    private autoVerifyTrusted;
    private verificationTimeout;
    constructor(store: IKeyValueStore, options?: DeviceVerificationOptions);
    getDevice(userId: string, deviceId: string): Promise<DeviceInfo | null>;
    getDevices(userId: string): Promise<DeviceInfo[]>;
    verifyDevice(userId: string, deviceId: string): Promise<void>;
    blockDevice(userId: string, deviceId: string): Promise<void>;
    unverifyDevice(userId: string, deviceId: string): Promise<void>;
    startVerification(userId: string, deviceId: string, methods: string[]): Promise<string>;
    confirmVerification(requestId: string, verified: boolean): Promise<void>;
    cancelVerification(requestId: string): Promise<void>;
    getVerificationRequest(requestId: string): VerificationRequest | null;
    getVerificationRequests(userId?: string): VerificationRequest[];
    updateDeviceKeys(userId: string, deviceId: string, keys: IDeviceKeys): Promise<void>;
    deleteDevice(userId: string, deviceId: string): Promise<void>;
    cleanupExpiredRequests(): Promise<number>;
    getDeviceCount(userId?: string): number;
    getVerifiedDeviceCount(userId?: string): number;
    private autoVerifyDevice;
    private isDeviceTrusted;
    private getDeviceKey;
    private generateRequestId;
    private saveDevice;
    private saveVerificationRequest;
    private loadDevices;
    private listStoredDeviceKeys;
}
//# sourceMappingURL=DeviceVerification.d.ts.map