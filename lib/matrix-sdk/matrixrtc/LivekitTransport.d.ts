import { type Transport } from "./types.ts";
export interface LivekitTransportConfig extends Transport {
    type: "livekit";
    livekit_service_url: string;
}
export declare const isLivekitTransportConfig: (object: unknown) => object is LivekitTransportConfig;
export interface LivekitTransport extends LivekitTransportConfig {
    livekit_alias: string;
}
export declare const isLivekitTransport: (object: unknown) => object is LivekitTransport;
/**
 * @deprecated, this is just needed for the old focus active / focus fields of a call membership.
 * Not needed for new implementations.
 */
export interface LivekitFocusSelection extends Transport {
    type: "livekit";
    focus_selection: "oldest_membership" | "multi_sfu";
}
/**
 * @deprecated see LivekitFocusSelection
 */
export declare const isLivekitFocusSelection: (object: unknown) => object is LivekitFocusSelection;
//# sourceMappingURL=LivekitTransport.d.ts.map