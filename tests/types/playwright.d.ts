declare module '@playwright/test' {
  export interface Page {
    route(pattern: any, handler: (route: any) => any): any
    [key: string]: any
  }
  export interface TestAPI {
    (name: string, fn: (opts: { page: Page }) => any): any
    beforeEach: (fn: (opts: { page: Page }) => any) => any
    afterEach: (fn: (opts: { page: Page }) => any) => any
    describe: (name: string, fn: () => any) => any
    skip: (...args: any[]) => any
  }
  export const test: TestAPI
  export const expect: any
}
