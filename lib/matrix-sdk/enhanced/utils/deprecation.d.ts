export interface DeprecationOptions {
    /** @deprecated Use messageId instead */
    method?: string;
    messageId?: string;
    /** @deprecated Use removalDate instead */
    removedIn?: string;
    removalDate?: string;
    /** @deprecated Use replacedBy instead */
    alternative?: string;
    replacedBy?: string;
    since?: string;
    migrationGuide?: string;
    severity?: "low" | "medium" | "high";
}
export declare function registerDeprecation(options: DeprecationOptions): void;
//# sourceMappingURL=deprecation.d.ts.map