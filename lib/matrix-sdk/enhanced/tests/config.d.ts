export interface TestConfig {
    server: {
        baseUrl: string;
        accessToken: string;
        apiPrefix: string;
    };
    test: {
        timeout: number;
        retries: number;
        concurrent: number;
        iterations: number;
    };
    logging: {
        level: "debug" | "info" | "warn" | "error";
        file?: string;
    };
}
export declare const DEFAULT_TEST_CONFIG: TestConfig;
export declare function loadTestConfig(overrides?: Partial<TestConfig>): TestConfig;
export declare function validateConfig(config: TestConfig): {
    valid: boolean;
    errors: string[];
};
//# sourceMappingURL=config.d.ts.map