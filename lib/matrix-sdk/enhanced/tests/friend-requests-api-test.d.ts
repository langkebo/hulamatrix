/**
 * Friend Requests API 测试
 */
interface TestResult {
    name: string;
    passed: boolean;
    responseTime: number;
    error?: string;
    response?: any;
}
export declare class FriendRequestsApiTests {
    private client;
    private config;
    constructor();
    runAllTests(): Promise<TestResult[]>;
    private printResults;
    private testGetReceivedRequests;
    private testGetSentRequests;
}
export {};
//# sourceMappingURL=friend-requests-api-test.d.ts.map