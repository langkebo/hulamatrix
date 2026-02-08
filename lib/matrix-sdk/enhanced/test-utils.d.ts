import { type SynapseEnhancedHttpClient } from "./utils/http.ts";
import type { IFriend, IFriendCategory, IFriendRequest, IBlockedUser, IPaginationParams } from "./models/types.ts";
export type MockHttpClient = jest.Mocked<SynapseEnhancedHttpClient> & {
    setResponse: <T>(data: T) => void;
};
export interface MockResponse<T> {
    data: T;
    status: number;
}
export declare function createMockHttpClient(): MockHttpClient;
export declare function createMockHttpClientInstance(): MockHttpClient;
export declare function createMockFriend(overrides?: Partial<IFriend>): IFriend;
export declare function createMockFriendList(count?: number): IFriend[];
export declare function createMockFriendCategory(overrides?: Partial<IFriendCategory>): IFriendCategory;
export declare function createMockFriendRequest(overrides?: Partial<IFriendRequest>): IFriendRequest;
export declare function createMockFriendRequestList(count?: number): IFriendRequest[];
export declare function createMockBlockedUser(overrides?: Partial<IBlockedUser>): IBlockedUser;
export declare function createMockPaginationParams(overrides?: Partial<IPaginationParams>): IPaginationParams;
export declare function createMockSuccessResponse<T>(data: T): MockResponse<T>;
export declare function createMockErrorResponse(message: string, status?: number): MockResponse<{
    status: string;
    error: string;
}>;
export declare function setupMockRequest<T>(mock: jest.Mock, data: T): void;
export declare function setupMockError(mock: jest.Mock, message: string, status?: number): void;
//# sourceMappingURL=test-utils.d.ts.map