/**
 * Friends V2 API Tests
 */
interface TestResult {
    name: string;
    passed: boolean;
    responseTime: number;
    error?: string;
    response?: any;
}
export declare class FriendsApiTests {
    private client;
    private config;
    constructor();
    runAllTests(): Promise<TestResult[]>;
    private printResults;
    private testGetFriends;
    private testGetCategories;
    private testSearchUsers;
    private testGetPendingRequests;
    private testGetStatistics;
}
export {};
//# sourceMappingURL=friends-api-test.d.ts.map