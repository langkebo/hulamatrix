/**
 * Friends API 集成测试
 *
 * 本文档测试完整的用户流程，包括好友请求、接受、分类等
 */
interface TestResult {
    name: string;
    passed: boolean;
    responseTime: number;
    error?: string;
    response?: any;
}
export declare class FriendsApiIntegrationTests {
    private client;
    private config;
    private createdCategoryIds;
    private sentRequestIds;
    constructor();
    runAllTests(): Promise<TestResult[]>;
    private printResults;
    private testCompleteFriendRequestFlow;
    private testCategoryManagementFlow;
    private testBatchOperationsFlow;
    private testStreamingFlow;
    private cleanup;
}
export {};
//# sourceMappingURL=friends-integration-test.d.ts.map