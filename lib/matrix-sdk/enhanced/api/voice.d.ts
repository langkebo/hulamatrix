import { type SynapseEnhancedHttpClient } from "../utils/http.ts";
import type { IVoiceMessage, IVoiceInfo, IVoiceUploadParams, IVoiceConvertParams, IVoiceOptimizeParams, IConvertResult, IOptimizeResult, IVoiceUserStats } from "../models/types.ts";
import { BaseApi } from "../utils/base-api.ts";
export interface IVoiceConfig {
    supported_formats: string[];
    max_duration_seconds: number;
    max_file_size_bytes: number;
    default_format: string;
    default_quality: string;
    features: {
        conversion: boolean;
        optimization: boolean;
        premium: string[];
    };
}
export declare class VoiceApi extends BaseApi {
    constructor(httpClient: SynapseEnhancedHttpClient);
    /**
     * Get voice configuration
     */
    getConfig(): Promise<IVoiceConfig>;
    /**
     * Upload and process a voice message
     *
     * Supports two upload protocols:
     * 1. Multipart/form-data (standard Matrix)
     * 2. JSON base64 (Synapse Rust)
     *
     * The protocol is automatically selected based on the backend profile.
     */
    upload(params: IVoiceUploadParams): Promise<IVoiceMessage>;
    /**
     * Convert File/Blob to ArrayBuffer
     */
    private fileToBuffer;
    /**
     * Convert ArrayBuffer to base64 string
     * @param buffer - The ArrayBuffer to convert
     * @returns Base64 encoded string
     * @throws SynapseEnhancedError if buffer size exceeds limit
     */
    private bufferToBase64;
    /**
     * Get MIME type for audio format
     */
    private getMimeType;
    /**
     * Get voice message info
     */
    getInfo(messageId: string): Promise<IVoiceInfo | null>;
    /**
     * Convert voice message to another format
     */
    convert(params: IVoiceConvertParams): Promise<IConvertResult>;
    /**
     * Optimize voice message file size
     */
    optimize(params: IVoiceOptimizeParams): Promise<IOptimizeResult>;
    delete(messageId: string): Promise<boolean>;
    getUserMessages(userId: string): Promise<IVoiceInfo[]>;
    getRoomMessages(roomId: string): Promise<IVoiceInfo[]>;
    getUserStats(userId: string): Promise<IVoiceUserStats>;
    getDownloadUrl(messageId: string): string;
}
//# sourceMappingURL=voice.d.ts.map