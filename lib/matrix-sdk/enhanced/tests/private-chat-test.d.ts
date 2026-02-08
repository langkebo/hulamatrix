/**
 * Private Chat V2 API Tests
 */
interface TestResult {
    name: string;
    passed: boolean;
    responseTime: number;
    error?: string;
    response?: any;
}
export declare class PrivateChatApiTests {
    private client;
    private config;
    private createdSessionId;
    private creatorId?;
    constructor();
    runAllTests(): Promise<TestResult[]>;
    private printResults;
    private testCreateSession;
    private testGetSessions;
    private testSendMessage;
    private testGetMessages;
    private testGetUnreadCount;
    private testCloseSession;
}
export {};
//# sourceMappingURL=private-chat-test.d.ts.map