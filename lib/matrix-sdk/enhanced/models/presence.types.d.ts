/**
 * Presence API Types
 * Types for user presence status management
 */
/**
 * Represents a user's presence status.
 */
export interface IPresenceStatus {
    /** The Matrix user ID */
    user_id: string;
    /** Presence state: online, offline, or unavailable */
    presence: "online" | "offline" | "unavailable";
    /** Optional status message */
    status_msg?: string;
    /** Time in milliseconds since the user was last active */
    last_active_ago?: number;
    /** Time of the last status update */
    last_status_update?: number;
}
/**
 * Parameters for setting a user's presence status.
 */
export interface ISetPresence {
    /** The Matrix user ID */
    user_id: string;
    /** The presence status to set */
    status: string;
    /** Optional status message */
    status_msg?: string;
}
/**
 * Response from presence status operations.
 */
export interface IStatusResponse {
    /** Response status */
    status: string;
    /** Error message if the request failed */
    error?: string;
}
/**
 * Presence API interface for managing user presence status.
 */
export interface IPresenceApi {
    /**
     * Gets the presence status for a user.
     * @param userId - The Matrix user ID
     * @returns The user's presence status
     */
    getStatus(userId: string): Promise<IPresenceStatus>;
    /**
     * Sets the presence status for a user.
     * @param params - The presence parameters including user ID and status
     * @returns The status response
     */
    setStatus(params: ISetPresence): Promise<{
        status: string;
    }>;
    /**
     * Gets the presence status for a user (alias for getStatus).
     * @param userId - The Matrix user ID
     * @returns The user's presence status
     */
    getPresence(userId: string): Promise<IPresenceStatus>;
    /**
     * Updates the presence status for a user.
     * @param userId - The Matrix user ID
     * @param presence - The presence status to set
     * @param statusMsg - Optional status message
     */
    updatePresence(userId: string, presence: string, statusMsg?: string): Promise<void>;
}
//# sourceMappingURL=presence.types.d.ts.map