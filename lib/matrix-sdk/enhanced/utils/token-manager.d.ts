export interface TokenInfo {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: number;
    tokenType?: string;
}
export interface TokenRefreshCallback {
    (newToken: string): Promise<void>;
}
export interface TokenConfig {
    refreshIntervalMs?: number;
    earlyRefreshThresholdMs?: number;
    enableAutoRefresh?: boolean;
}
export declare class TokenManager {
    private readonly _accessToken;
    private readonly _refreshToken?;
    private readonly _expiresAt?;
    private readonly _tokenType?;
    private readonly _refreshCallback?;
    private readonly _config;
    private _isRefreshing;
    private _refreshPromise?;
    constructor(info: TokenInfo, refreshCallback?: TokenRefreshCallback, config?: TokenConfig);
    get accessToken(): string;
    get refreshToken(): string | undefined;
    get tokenType(): string;
    get expiresAt(): number | undefined;
    get isExpired(): boolean;
    get needsRefresh(): boolean;
    get canRefresh(): boolean;
    get isRefreshing(): boolean;
    get authorizationHeader(): string;
    refreshIfNeeded(): Promise<void>;
    private executeRefresh;
    static isTokenExpired(expiresAt?: number, thresholdMs?: number): boolean;
    static parseTokenExpiration(expiresIn: number): number;
    getTokenInfo(): Omit<TokenInfo, "accessToken" | "refreshToken">;
    clone(refreshCallback?: TokenRefreshCallback): TokenManager;
}
export declare function createAuthHeaders(tokenManager: TokenManager): Headers;
export declare function parseTokenFromResponse(response: {
    access_token?: string;
    expires_in?: number;
    token_type?: string;
}): TokenInfo;
//# sourceMappingURL=token-manager.d.ts.map