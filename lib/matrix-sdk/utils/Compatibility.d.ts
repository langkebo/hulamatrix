import { type MatrixHttpApi, type IHttpOpts } from "../http-api/index.ts";
export interface ServerVersion {
    name: string;
    version: string;
}
export interface ServerCapabilities {
    versions: string[];
    unstableFeatures: Record<string, boolean>;
    maxUploadSize: number;
    defaultHomeserverUrl: string;
}
export interface FeatureSupport {
    encryption: boolean;
    groups: boolean;
    roomVersion: number;
    threadSupport: boolean;
    relatedTypes: boolean;
    externalIds: boolean;
}
export interface CompatibilityResult {
    isCompatible: boolean;
    serverVersion: ServerVersion | null;
    capabilities: ServerCapabilities | null;
    features: FeatureSupport | null;
    issues: string[];
    warnings: string[];
}
export declare class Compatibility {
    private http;
    private serverVersion;
    private capabilities;
    private checked;
    constructor(http: MatrixHttpApi<IHttpOpts>);
    check(): Promise<CompatibilityResult>;
    getServerVersion(): Promise<ServerVersion | null>;
    getCapabilities(): Promise<ServerCapabilities | null>;
    isChecked(): boolean;
    isFeatureSupported(feature: keyof FeatureSupport): Promise<boolean>;
    getRequiredRoomVersion(): Promise<number>;
    validateRoomVersion(roomVersion: number): Promise<boolean>;
    private fetchServerVersion;
    private fetchCapabilities;
    private detectFeatures;
    private validateCompatibility;
    private parseVersion;
}
//# sourceMappingURL=Compatibility.d.ts.map