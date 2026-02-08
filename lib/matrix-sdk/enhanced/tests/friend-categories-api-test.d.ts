/**
 * Friend Categories API 测试
 */
interface TestResult {
    name: string;
    passed: boolean;
    responseTime: number;
    error?: string;
    response?: any;
}
export declare class FriendCategoriesApiTests {
    private client;
    private config;
    constructor();
    runAllTests(): Promise<TestResult[]>;
    private printResults;
    private testGetCategories;
    private testCreateCategory;
    private testDeleteCategory;
}
export {};
//# sourceMappingURL=friend-categories-api-test.d.ts.map