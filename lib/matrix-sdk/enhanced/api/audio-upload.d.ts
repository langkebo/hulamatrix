import type { SynapseEnhancedHttpClient } from "../utils/http.ts";
export declare class AudioUploadApi {
    private httpClient;
    constructor(httpClient: SynapseEnhancedHttpClient);
    upload(file: File | Blob, options?: {
        filename?: string;
        contentType?: string;
    }): Promise<{
        content_uri: string;
    }>;
}
//# sourceMappingURL=audio-upload.d.ts.map