/** Backwards-compatibility hack to expose `log` to applications that might still be relying on it. */
interface LoggerWithLogMethod extends Logger {
    /**
     * Output debug message to the logger.
     *
     * @param msg - Data to log.
     *
     * @deprecated prefer {@link Logger.debug}.
     */
    log(...msg: unknown[]): void;
}
/** Logger interface used within the js-sdk codebase */
export interface Logger extends BaseLogger {
    /**
     * Create a child logger.
     *
     * This child will use the `methodFactory` of the parent, so any log extensions applied to the parent
     * at the time of calling `getChild` will be applied to the child as well.
     * It will NOT apply changes to the parent's `methodFactory` after the child was created.
     * Those changes need to be applied to the child manually.
     *
     * @param namespace - name to add to the current logger to generate the child. Some implementations of `Logger`
     *    use this as a prefix; others use a different mechanism.
     */
    getChild(namespace: string): Logger;
}
/** The basic interface for a logger which doesn't support children */
export interface BaseLogger {
    /**
     * Output trace message to the logger, with stack trace.
     *
     * @param msg - Data to log.
     */
    trace(...msg: unknown[]): void;
    /**
     * Output debug message to the logger.
     *
     * @param msg - Data to log.
     */
    debug(...msg: unknown[]): void;
    /**
     * Output info message to the logger.
     *
     * @param msg - Data to log.
     */
    info(...msg: unknown[]): void;
    /**
     * Output warn message to the logger.
     *
     * @param msg - Data to log.
     */
    warn(...msg: unknown[]): void;
    /**
     * Output error message to the logger.
     *
     * @param msg - Data to log.
     */
    error(...msg: unknown[]): void;
}
/**
 * Drop-in replacement for `console` using {@link https://www.npmjs.com/package/loglevel|loglevel}.
 * Can be tailored down to specific use cases if needed.
 *
 * @deprecated avoid the use of this unless you are the constructor of `MatrixClient`: you should be using the logger
 *    associated with `MatrixClient`.
 */
export declare const logger: LoggerWithLogMethod;
/**
 * A "span" for grouping related log lines together.
 *
 * The current implementation just adds the name at the start of each log line.
 *
 * This offers a lighter-weight alternative to 'child' loggers returned by {@link Logger#getChild}. In particular,
 * it's not possible to apply individual filters to the LogSpan such as setting the verbosity level. On the other hand,
 * no reference to the LogSpan is retained in the logging framework, so it is safe to make lots of them over the course
 * of an application's life and just drop references to them when the job is done.
 */
export declare class LogSpan implements BaseLogger {
    private readonly parent;
    private readonly name;
    constructor(parent: BaseLogger, name: string);
    trace(...msg: unknown[]): void;
    debug(...msg: unknown[]): void;
    info(...msg: unknown[]): void;
    warn(...msg: unknown[]): void;
    error(...msg: unknown[]): void;
}
/**
 * A simplification of the `Debugger` type exposed by the `debug` library. We reimplement the bits we need here
 * to avoid a dependency on `debug`.
 */
interface Debugger {
    (formatter: unknown, ...args: unknown[]): void;
    extend: (namespace: string, delimiter?: string) => Debugger;
}
/**
 * A `Logger` instance, suitable for use in {@link ICreateClientOpts.logger}, which will write to the `debug` library.
 *
 * @example
 * ```js
 *     import debug from "debug";
 *
 *     const client = createClient({
 *         baseUrl: homeserverUrl,
 *         userId: userId,
 *         accessToken: "akjgkrgjs",
 *         deviceId: "xzcvb",
 *         logger: new DebugLogger(debug(`matrix-js-sdk:${userId}`)),
 *     });
 * ```
 */
export declare class DebugLogger implements Logger {
    private debugInstance;
    constructor(debugInstance: Debugger);
    trace(...msg: unknown[]): void;
    debug(...msg: unknown[]): void;
    info(...msg: unknown[]): void;
    warn(...msg: unknown[]): void;
    error(...msg: unknown[]): void;
    getChild(namespace: string): DebugLogger;
    private debugWithPrefix;
}
export {};
//# sourceMappingURL=logger.d.ts.map