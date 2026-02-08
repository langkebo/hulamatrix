/**
 * Media API for uploading, downloading, and managing media files.
 *
 * This module provides methods for interacting with the Matrix Content Repository API.
 * @see https://spec.matrix.org/v1.11/client-server-api/#matrix-content-repository
 */
import { type ContentType } from "./@types/content.ts";
/**
 * Response from a successful media upload.
 */
export interface MediaUploadResponse {
    /**
     * The MXC URI for the uploaded content.
     */
    content_uri: string;
}
/**
 * Parameters for uploading media.
 */
export interface MediaUploadOptions {
    /**
     * The content type of the file being uploaded.
     * Defaults to application/octet-stream if not specified.
     */
    contentType?: ContentType;
    /**
     * The filename to set for the upload.
     */
    filename?: string;
}
/**
 * Media configuration response from the homeserver.
 */
export interface MediaConfigResponse {
    /**
     * The maximum size of an upload in bytes.
     */
    "m.upload.size"?: number;
}
/**
 * Media API class for handling media operations.
 */
export declare class MediaApi {
    private readonly baseUrl;
    private readonly accessToken?;
    /**
     * Creates a new MediaApi instance.
     *
     * @param baseUrl - The base URL of the homeserver.
     * @param accessToken - The access token for authenticated requests.
     */
    constructor(baseUrl: string, accessToken?: string | undefined);
    /**
     * Upload media to the content repository.
     *
     * @param file - The file data as a Buffer, Blob, or string.
     * @param options - Optional upload parameters.
     * @returns Promise resolving to the content URI of the uploaded file.
     * @see https://spec.matrix.org/v1.11/client-server-api/#post_matrixmediav3upload
     */
    upload(file: Buffer | Blob | string, options?: MediaUploadOptions): Promise<MediaUploadResponse>;
    /**
     * Download media from the content repository.
     *
     * @param serverName - The homeserver name (e.g., "matrix.org").
     * @param mediaId - The media ID.
     * @param allowRedirects - Whether to allow redirects. Defaults to true.
     * @returns Promise resolving to the media data as a Blob.
     * @see https://spec.matrix.org/v1.11/client-server-api/#get_matrixmediav3downloadservernamemediaid
     */
    download(serverName: string, mediaId: string, allowRedirects?: boolean): Promise<Blob>;
    /**
     * Download media as an ArrayBuffer.
     *
     * @param serverName - The homeserver name (e.g., "matrix.org").
     * @param mediaId - The media ID.
     * @param allowRedirects - Whether to allow redirects. Defaults to true.
     * @returns Promise resolving to the media data as an ArrayBuffer.
     */
    downloadAsArrayBuffer(serverName: string, mediaId: string, allowRedirects?: boolean): Promise<ArrayBuffer>;
    /**
     * Download media as a data URL.
     *
     * @param serverName - The homeserver name (e.g., "matrix.org").
     * @param mediaId - The media ID.
     * @param allowRedirects - Whether to allow redirects. Defaults to true.
     * @returns Promise resolving to the media data as a base64 data URL.
     */
    downloadAsDataUrl(serverName: string, mediaId: string, allowRedirects?: boolean): Promise<string>;
    /**
     * Get a thumbnail for media.
     *
     * @param serverName - The homeserver name (e.g., "matrix.org").
     * @param mediaId - The media ID.
     * @param width - The desired width of the thumbnail.
     * @param height - The desired height of the thumbnail.
     * @param method - The resize method ("crop" or "scale"). Defaults to "scale".
     * @param allowRedirects - Whether to allow redirects. Defaults to true.
     * @returns Promise resolving to the thumbnail data as a Blob.
     * @see https://spec.matrix.org/v1.11/client-server-api/#get_matrixmediav3thumbnailservernamemediaid
     */
    getThumbnail(serverName: string, mediaId: string, width: number, height: number, method?: "crop" | "scale", allowRedirects?: boolean): Promise<Blob>;
    /**
     * Get a thumbnail as a data URL.
     *
     * @param serverName - The homeserver name (e.g., "matrix.org").
     * @param mediaId - The media ID.
     * @param width - The desired width of the thumbnail.
     * @param height - The desired height of the thumbnail.
     * @param method - The resize method ("crop" or "scale"). Defaults to "scale".
     * @param allowRedirects - Whether to allow redirects. Defaults to true.
     * @returns Promise resolving to the thumbnail data as a base64 data URL.
     */
    getThumbnailAsDataUrl(serverName: string, mediaId: string, width: number, height: number, method?: "crop" | "scale", allowRedirects?: boolean): Promise<string>;
    /**
     * Get the media configuration from the homeserver.
     *
     * @returns Promise resolving to the media configuration.
     * @see https://spec.matrix.org/v1.11/client-server-api/#get_matrixmediav1config
     */
    getConfig(): Promise<MediaConfigResponse>;
    /**
     * Get the maximum upload size configured on the homeserver.
     *
     * @returns Promise resolving to the maximum upload size in bytes, or null if not configured.
     */
    getMaxUploadSize(): Promise<number | null>;
}
//# sourceMappingURL=media-api.d.ts.map