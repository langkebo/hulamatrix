export interface TestConfig {
    baseUrl: string;
    accessToken: string;
    apiPrefix: string;
    timeout: number;
}
export declare const defaultConfig: TestConfig;
export declare function getTestConfig(): TestConfig;
export declare function skipIfMissingEnv(...vars: string[]): void;
//# sourceMappingURL=test-config.d.ts.map