import type { MatrixHttpApi, IHttpOpts } from "../../http-api/index.ts";
import type { IKeyValueStore } from "../../store/KeyValueStore.ts";
import type { ILoginFlowsResponse, LoginRequest, LoginResponse } from "../../@types/auth.ts";
import type { EmptyObject } from "../../@types/common.ts";
export interface AuthManagerEvents {
    login: LoginResponse;
    logout: void;
    error: Error;
}
export interface WhoamiResponse {
    user_id: string;
    is_guest: boolean;
    device_id?: string;
}
export type IdServerUnbindResult = "no-support" | "success";
export type LoginTokenPostResponse = {
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token?: string;
    user_id: string;
    device_id?: string;
};
export type SSOAction = "redirect" | "fail";
export type AuthDict = Record<string, unknown>;
export declare class AuthManager {
    private http;
    private store;
    private accessToken;
    private refreshToken;
    private userId;
    private expiresAt;
    constructor(http: MatrixHttpApi<IHttpOpts>, store: IKeyValueStore);
    loginFlows(): Promise<ILoginFlowsResponse>;
    loginRequest(data: LoginRequest): Promise<LoginResponse>;
    loginWithPassword(user: string, password: string): Promise<LoginResponse>;
    loginWithToken(token: string): Promise<LoginResponse>;
    logout(stopClient?: boolean): Promise<void>;
    logoutAll(stopClient?: boolean): Promise<void>;
    deactivateAccount(auth?: AuthDict, erase?: boolean): Promise<{
        id_server_unbind_result: IdServerUnbindResult;
    }>;
    requestLoginToken(auth?: AuthDict): Promise<LoginTokenPostResponse>;
    getFallbackAuthUrl(loginType: string, authSessionId: string): string;
    getSsoLoginUrl(redirectUrl: string, loginType?: string, idpId?: string, action?: SSOAction): string;
    getCasLoginUrl(redirectUrl: string): string;
    setPassword(authDict: AuthDict, newPassword: string, logoutDevices?: boolean): Promise<EmptyObject>;
    get3PIDs(): Promise<Record<string, unknown>>;
    add3PID(clientSecret: string, sid: string, auth?: AuthDict, idServer?: string, bind?: boolean): Promise<EmptyObject>;
    delete3PID(medium: string, address: string, idServer?: string): Promise<EmptyObject>;
    unbind3PID(medium: string, address: string, idServer?: string): Promise<EmptyObject>;
    whoami(): Promise<WhoamiResponse>;
    getAccessToken(): string | null;
    getUserId(): string | null;
    isLoggedIn(): boolean;
    refreshAccessToken(): Promise<void>;
    private saveCredentials;
    private loadCredentials;
    private clearCredentials;
}
//# sourceMappingURL=AuthManager.d.ts.map