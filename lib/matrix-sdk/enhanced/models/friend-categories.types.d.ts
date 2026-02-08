export interface IFriendCategoryV2 {
    category_name: string;
    users: string[];
}
export interface IFriendCategories {
    [category_name: string]: {
        users: string[];
    };
}
export interface ISetCategoriesResult {
    categories: IFriendCategories;
    status: string;
}
export interface IGetCategoryResult {
    category_name: string;
    users: string[];
}
export interface IUpdateCategoryResult {
    category: string;
    data: {
        users: string[];
    };
    status: string;
}
export interface IDeleteCategoryResult {
    category: string;
    status: string;
}
export interface IAddUserToCategoryResult {
    category: string;
    user_id: string;
    status: string;
}
export interface IRemoveUserFromCategoryResult {
    category: string;
    user_id: string;
    status: string;
}
export interface IFriendCategoriesApi {
    getCategories(): Promise<IFriendCategories>;
    setCategories(categories: IFriendCategories): Promise<ISetCategoriesResult>;
    getCategory(categoryName: string): Promise<IGetCategoryResult>;
    updateCategory(categoryName: string, data: {
        users: string[];
    }): Promise<IUpdateCategoryResult>;
    deleteCategory(categoryName: string): Promise<IDeleteCategoryResult>;
    addUserToCategory(categoryName: string, userId: string): Promise<IAddUserToCategoryResult>;
    removeUserFromCategory(categoryName: string, userId: string): Promise<IRemoveUserFromCategoryResult>;
}
//# sourceMappingURL=friend-categories.types.d.ts.map