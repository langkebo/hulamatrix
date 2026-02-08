/**
 * Enhanced Friends API 功能测试
 *
 * 测试所有新增的 Friends API 方法
 */
interface TestResult {
    name: string;
    passed: boolean;
    responseTime: number;
    error?: string;
    response?: any;
}
export declare class EnhancedFriendsApiTests {
    private client;
    private config;
    constructor();
    runAllTests(): Promise<TestResult[]>;
    private printResults;
    private testGetMutualFriends;
    private testGetRecentFriends;
    private testGetFriendInteractions;
    private testGetFriendInteractionStats;
    private testSearchBlockedUsers;
    private testGetRequestTemplates;
    private testVerifyFriendship;
}
export {};
//# sourceMappingURL=enhanced-friends-api-test.d.ts.map