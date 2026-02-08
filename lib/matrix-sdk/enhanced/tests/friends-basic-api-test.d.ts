/**
 * Friends Basic API 测试
 */
interface TestResult {
    name: string;
    passed: boolean;
    responseTime: number;
    error?: string;
    response?: any;
}
export declare class FriendsBasicApiTests {
    private client;
    private config;
    constructor();
    runAllTests(): Promise<TestResult[]>;
    private printResults;
    private testGetFriends;
    private testGetFriend;
    private testCheckFriendship;
    private testSetRemark;
}
export {};
//# sourceMappingURL=friends-basic-api-test.d.ts.map