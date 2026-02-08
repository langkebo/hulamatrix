/**
 * Blocked Users API 测试
 */
interface TestResult {
    name: string;
    passed: boolean;
    responseTime: number;
    error?: string;
    response?: any;
}
export declare class BlockedUsersApiTests {
    private client;
    private config;
    constructor();
    runAllTests(): Promise<TestResult[]>;
    private printResults;
    private testGetBlockedUsers;
    private testIsBlocked;
    private testBlockUser;
    private testUnblockUser;
}
export {};
//# sourceMappingURL=blocked-users-api-test.d.ts.map