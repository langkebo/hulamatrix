export declare class InputValidator {
    private static readonly SANITIZE_PATTERN;
    private static readonly SQL_INJECTION_PATTERN;
    private static readonly SCRIPT_PATTERN;
    static isValidUserId(userId: string): boolean;
    static isValidRoomId(roomId: string): boolean;
    static isValidEventId(eventId: string): boolean;
    static isValidDeviceId(deviceId: string): boolean;
    static isValidBase64(data: string, validateLength?: boolean): boolean;
    static isValidHex(data: string): boolean;
    static sanitizeString(input: string, maxLength?: number): string;
    static sanitizeObject<T extends Record<string, unknown>>(obj: T, depth?: number): T;
    private static sanitizeArray;
    static checkForSqlInjection(input: string): boolean;
    static sanitizeForHtml(input: string): string;
    static validatePaginationParams(params?: {
        from?: string;
        to?: string;
        limit?: number;
    }): void;
    static validateDisplayName(displayName: string): string;
    static validateRoomAlias(alias: string): string;
    static escapeShellChars(input: string): string;
    /**
     * Validates an IPv4 address
     * @param ip - The IP address string to validate
     * @returns True if valid IPv4 format, false otherwise
     */
    static isValidIPv4(ip: string): boolean;
    /**
     * Validates an IPv6 address
     * @param ip - The IP address string to validate
     * @returns True if valid IPv6 format, false otherwise
     */
    static isValidIPv6(ip: string): boolean;
    /**
     * Validates an IP address (IPv4 or IPv6)
     * @param ip - The IP address string to validate
     * @returns True if valid IP format, false otherwise
     */
    static isValidIpAddress(ip: string): boolean;
    /**
     * Validates an IP address and returns the normalized form
     * @param ip - The IP address string to validate and normalize
     * @returns The normalized IP address
     * @throws SynapseEnhancedError if IP address is invalid
     */
    static validateIpAddress(ip: string): string;
}
export declare function assertValidUserId(userId: string): asserts userId is string;
export declare function assertValidRoomId(roomId: string): asserts roomId is string;
export declare function assertValidEventId(eventId: string): asserts eventId is string;
export interface StringValidationOptions {
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
}
export interface NumberValidationOptions {
    min?: number;
    max?: number;
    integer?: boolean;
}
export interface ArrayValidationOptions {
    minLength?: number;
    maxLength?: number;
    itemValidator?: (item: unknown) => boolean | ValidationResult;
}
export interface ValidationResult {
    valid: boolean;
    error?: string;
}
export declare function validateServerName(serverName: string): string;
export interface ObjectFieldValidationOptions {
    required?: boolean;
    validator?: (value: unknown) => boolean | ValidationResult;
}
export interface ObjectValidationOptions {
    [field: string]: ObjectFieldValidationOptions;
}
export declare function validateString(input: unknown, name: string, options?: StringValidationOptions): string;
export declare function validateNumber(input: unknown, name: string, options?: NumberValidationOptions): number;
export declare function validateBoolean(input: unknown, name: string): boolean;
export declare function validateArray<T>(input: unknown, name: string, options?: ArrayValidationOptions): T[];
export declare function validateObject(input: unknown, name: string, options?: ObjectValidationOptions): Record<string, unknown>;
export declare function validateUserId(userId: string): ValidationResult;
export declare function validateRoomId(roomId: string): ValidationResult;
export declare function validateEventId(eventId: string): ValidationResult;
export interface PaginationParams {
    limit?: number;
    page?: number;
    cursor?: string;
}
export declare function validatePaginationParams(params?: PaginationParams): PaginationParams;
export declare function validateMessageId(messageId: string): ValidationResult;
export declare function sanitizeContent(content: unknown, options?: {
    maxLength?: number;
}): string;
/**
 * Asserts that a value is a valid IP address (IPv4 or IPv6)
 * @param ip - The IP address to validate
 * @throws SynapseEnhancedError if IP address is invalid
 */
export declare function assertValidIpAddress(ip: string): asserts ip is string;
/**
 * Validates an IP address and returns a validation result
 * @param ip - The IP address to validate
 * @returns Validation result with valid flag and optional error message
 */
export declare function validateIpAddress(ip: string): ValidationResult;
//# sourceMappingURL=validator.d.ts.map