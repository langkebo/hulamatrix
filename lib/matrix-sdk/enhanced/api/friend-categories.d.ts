import type { SynapseEnhancedHttpClient } from "../utils/http.ts";
import type { IFriendCategoryV2 } from "../models/friend-categories.types.ts";
export declare class FriendCategoriesApi {
    private httpClient;
    constructor(httpClient: SynapseEnhancedHttpClient);
    getCategories(): Promise<{
        categories: Record<string, IFriendCategoryV2>;
    }>;
    setCategories(categories: Record<string, {
        users: string[];
    }>): Promise<{
        categories: Record<string, {
            users: string[];
        }>;
        status: string;
    }>;
    getCategory(categoryName: string): Promise<{
        category: string;
        users: string[];
    }>;
    updateCategory(categoryName: string, data: {
        users: string[];
    }): Promise<{
        category_name: string;
        data: {
            users: string[];
        };
        status: string;
    }>;
    deleteCategory(categoryName: string): Promise<{
        category_name: string;
        status: string;
    }>;
    addUserToCategory(categoryName: string, userId: string): Promise<{
        category_name: string;
        user_id: string;
        status: string;
    }>;
    removeUserFromCategory(categoryName: string, userId: string): Promise<{
        category_name: string;
        user_id: string;
        status: string;
    }>;
}
//# sourceMappingURL=friend-categories.d.ts.map