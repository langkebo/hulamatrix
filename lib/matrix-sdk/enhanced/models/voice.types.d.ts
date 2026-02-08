/**
 * Voice Messaging API Types
 * Types for voice message upload, conversion, and management
 */
/**
 * Represents a voice message with its metadata.
 */
export interface IVoiceMessage {
    /** Optional message ID */
    id?: string;
    /** URL to the voice message file */
    url: string;
    /** Duration of the voice message in seconds */
    duration: number;
    /** File size in bytes */
    size: number;
    /** MIME type of the file (e.g., audio/ogg) */
    mime_type: string;
    /** Optional waveform data for visualization */
    waveform?: number[];
}
/**
 * Configuration for voice message support.
 */
export interface IVoiceConfig {
    /** Supported audio formats */
    supported_formats: string[];
    /** Maximum duration in seconds */
    max_duration_seconds: number;
    /** Maximum file size in bytes */
    max_file_size_bytes: number;
    /** Default audio format */
    default_format: string;
    /** Default encoding quality */
    default_quality: string;
}
/**
 * Information about a voice message.
 */
export interface IVoiceInfo {
    /** URL to the voice message */
    url: string;
    /** Duration in seconds */
    duration: number;
    /** File size in bytes */
    size: number;
    /** MIME type */
    mime_type: string;
    /** Optional waveform data */
    waveform?: number[];
    /** Optional Matrix message ID */
    message_id?: string;
}
/**
 * Parameters for uploading a voice message.
 */
export interface IVoiceUploadParams {
    /** The voice message file to upload */
    file: Blob | File | ArrayBuffer;
    /** Output format (ogg, mp3, wav, m4a, opus, aac, flac) */
    format?: "ogg" | "mp3" | "wav" | "m4a" | "opus" | "aac" | "flac";
    /** Encoding quality (low, medium, high) */
    quality?: "low" | "medium" | "high";
    /** Optional filename for the upload (used for base64 upload) */
    filename?: string;
    /** Optional duration in milliseconds (used for base64 upload) */
    duration_ms?: number;
}
/**
 * Parameters for converting a voice message to a different format.
 */
export interface IVoiceConvertParams {
    /** URL of the voice message to convert */
    url: string;
    /** Target format (mp3, ogg, wav) */
    format?: "mp3" | "ogg" | "wav";
    /** Matrix message ID */
    message_id?: string;
    /** Target format (alias for format) */
    target_format?: string;
    /** Bitrate for encoding */
    bitrate?: number;
}
/**
 * Parameters for optimizing a voice message.
 */
export interface IVoiceOptimizeParams {
    /** URL of the voice message to optimize */
    url: string;
    /** Target bitrate for encoding */
    bitrate?: number;
    /** Matrix message ID */
    message_id?: string;
    /** Target file size in megabytes */
    target_size_mb?: number;
}
/**
 * Result of a voice message conversion operation.
 */
export interface IConvertResult {
    /** Response status */
    status: string;
    /** The converted voice message */
    voice_message?: IVoiceMessage;
    /** Error message if the conversion failed */
    error?: string;
}
/**
 * Result of a voice message optimization operation.
 */
export interface IOptimizeResult {
    /** Response status */
    status: string;
    /** The optimized voice message */
    voice_message?: IVoiceMessage;
    /** Error message if the optimization failed */
    error?: string;
}
export interface IVoiceUserStats {
    total_recordings: number;
    total_duration_seconds: number;
    average_duration_seconds: number;
    storage_used_bytes: number;
    most_used_format: string;
    last_activity: string;
}
/**
 * Voice Messages API interface for managing voice messages.
 */
export interface IVoiceApi {
    /**
     * Uploads a voice message.
     * @param params - The upload parameters including the file
     * @returns The uploaded voice message metadata
     */
    upload(params: IVoiceUploadParams): Promise<IVoiceMessage>;
    /**
     * Gets information about a voice message.
     * @param messageId - The Matrix message ID
     * @returns The voice message info, or null if not found
     */
    getInfo(messageId: string): Promise<IVoiceInfo | null>;
    getUserMessages(userId: string): Promise<IVoiceInfo[]>;
    getRoomMessages(roomId: string): Promise<IVoiceInfo[]>;
    getUserStats(userId: string): Promise<IVoiceUserStats>;
    /**
     * Converts a voice message to a different format.
     * @param params - The conversion parameters
     * @returns The conversion result
     */
    convert(params: IVoiceConvertParams): Promise<IConvertResult>;
    /**
     * Optimizes a voice message for file size.
     * @param params - The optimization parameters
     * @returns The optimization result
     */
    optimize(params: IVoiceOptimizeParams): Promise<IOptimizeResult>;
    /**
     * Gets the voice message configuration.
     * @returns The voice config with supported formats and limits
     */
    getConfig(): Promise<IVoiceConfig>;
    /**
     * Deletes a voice message.
     * @param messageId - The Matrix message ID
     * @returns True if deletion was successful
     */
    delete(messageId: string): Promise<boolean>;
    /**
     * Gets the download URL for a voice message.
     * @param messageId - The Matrix message ID
     * @returns The download URL
     */
    getDownloadUrl(messageId: string): string;
}
//# sourceMappingURL=voice.types.d.ts.map