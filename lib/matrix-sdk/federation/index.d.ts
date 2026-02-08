/**
 * Federation API for Matrix server-server communication.
 *
 * This module provides methods for interacting with Matrix federation endpoints.
 * @see https://spec.matrix.org/v1.11/server-server-api/
 */
import type { ServerKeyResponse, FederationVersionResponse, PublicRoomsResponse, MakeJoinResponse, SendJoinResponse, MissingEventsRequest, MissingEventsResponse, EventAuthResponse, RoomStateResponse, RoomStateIdsResponse, BackfillRequest, TransactionResponse, DirectoryRoomLookupResponse, ProfileLookupResponse, KeyClaimRequest, KeyClaimResponse, UserKeysQueryRequest, UserKeysQueryResponse, FederationMembersResponse, RoomMembersResponse, UserDevicesResponse, RoomAuthResponse, FederationEventResponse, KeyUploadResponse, PduEvent } from "./types.ts";
/**
 * Configuration for FederationApi.
 */
export interface FederationApiConfig {
    /**
     * The base URL of the homeserver.
     */
    baseUrl: string;
    /**
     * Optional authorization token for server authentication.
     */
    accessToken?: string;
}
/**
 * Federation API class for handling federation operations.
 */
export declare class FederationApi {
    private readonly baseUrl;
    private readonly accessToken?;
    /**
     * Creates a new FederationApi instance.
     *
     * @param config - The configuration for the API.
     */
    constructor(config: FederationApiConfig);
    /**
     * Build the full URL for a federation endpoint.
     */
    private buildUrl;
    /**
     * Get request headers including authorization if available.
     */
    private getHeaders;
    /**
     * Perform a GET request to a federation endpoint.
     */
    private get;
    /**
     * Perform a POST request to a federation endpoint.
     */
    private post;
    /**
     * Perform a PUT request to a federation endpoint.
     */
    private put;
    /**
     * Get the server's public keys.
     *
     * @returns The server key response.
     * @see https://spec.matrix.org/v1.11/server-server-api/#get_matrixfederationv2server
     */
    getServerKey(): Promise<ServerKeyResponse>;
    /**
     * Query for keys from another server.
     *
     * @param serverName - The server name to query.
     * @param keyId - The key ID to query.
     * @returns The server key response.
     * @see https://spec.matrix.org/v1.11/server-server-api/#get_matrixfederationv2queryserver_namekey_id
     */
    queryKey(serverName: string, keyId: string): Promise<ServerKeyResponse>;
    /**
     * Get the federation version of the server.
     *
     * @returns The federation version response.
     * @see https://spec.matrix.org/v1.11/server-server-api/#get_matrixfederationv1version
     */
    getVersion(): Promise<FederationVersionResponse>;
    /**
     * Get public rooms from the server.
     *
     * @param limit - Optional limit on the number of rooms to return.
     * @param since - Optional pagination token.
     * @returns The public rooms response.
     * @see https://spec.matrix.org/v1.11/server-server-api/#get_matrixfederationv1publicrooms
     */
    getPublicRooms(limit?: number, since?: string): Promise<PublicRoomsResponse>;
    /**
     * Send a transaction to another server.
     *
     * @param txnId - The transaction ID.
     * @param pdus - The events to send.
     * @returns The transaction response.
     * @see https://spec.matrix.org/v1.11/server-server-api/#put_matrixfederationv1sendtxn_id
     */
    sendTransaction(txnId: string, pdus: PduEvent[]): Promise<TransactionResponse>;
    /**
     * Create a template for joining a room.
     *
     * @param roomId - The room ID to join.
     * @param userId - The user ID joining the room.
     * @returns The make join response.
     * @see https://spec.matrix.org/v1.11/server-server-api/#get_matrixfederationv1make_joinroom_iduser_id
     */
    makeJoin(roomId: string, userId: string): Promise<MakeJoinResponse>;
    /**
     * Create a template for leaving a room.
     *
     * @param roomId - The room ID to leave.
     * @param userId - The user ID leaving the room.
     * @returns The make leave response.
     * @see https://spec.matrix.org/v1.11/server-server-api/#get_matrixfederationv1make_leaveroom_iduser_id
     */
    makeLeave(roomId: string, userId: string): Promise<MakeJoinResponse>;
    /**
     * Send a join event to a room.
     *
     * @param roomId - The room ID.
     * @param eventId - The event ID.
     * @param event - The join event.
     * @returns The send join response.
     * @see https://spec.matrix.org/v1.11/server-server-api/#put_matrixfederationv1send_joinroom_idevent_id
     */
    sendJoin(roomId: string, eventId: string, event: PduEvent): Promise<SendJoinResponse>;
    /**
     * Send a leave event to a room.
     *
     * @param roomId - The room ID.
     * @param eventId - The event ID.
     * @param event - The leave event.
     * @returns The send leave response.
     * @see https://spec.matrix.org/v1.11/server-server-api/#put_matrixfederationv1send_leaveroom_idevent_id
     */
    sendLeave(roomId: string, eventId: string, event: PduEvent): Promise<TransactionResponse>;
    /**
     * Invite a user to a room.
     *
     * @param roomId - The room ID.
     * @param eventId - The event ID.
     * @param event - The invite event.
     * @returns The transaction response.
     * @see https://spec.matrix.org/v1.11/server-server-api/#put_matrixfederationv1inviteroom_idevent_id
     */
    invite(roomId: string, eventId: string, event: PduEvent): Promise<TransactionResponse>;
    /**
     * Get missing events for a room.
     *
     * @param request - The missing events request.
     * @returns The missing events response.
     * @see https://spec.matrix.org/v1.11/server-server-api/#post_matrixfederationv1get_missing_eventsroom_id
     */
    getMissingEvents(request: MissingEventsRequest): Promise<MissingEventsResponse>;
    /**
     * Get event authorization for an event.
     *
     * @param roomId - The room ID.
     * @param eventId - The event ID.
     * @returns The event auth response.
     * @see https://spec.matrix.org/v1.11/server-server-api/#get_matrixfederationv1get_event_authroom_idevent_id
     */
    getEventAuth(roomId: string, eventId: string): Promise<EventAuthResponse>;
    /**
     * Get the current state of a room.
     *
     * @param roomId - The room ID.
     * @returns The room state response.
     * @see https://spec.matrix.org/v1.11/server-server-api/#get_matrixfederationv1stateroom_id
     */
    getState(roomId: string): Promise<RoomStateResponse>;
    /**
     * Get a single event.
     *
     * @param eventId - The event ID.
     * @returns The event response.
     * @see https://spec.matrix.org/v1.11/server-server-api/#get_matrixfederationv1eventevent_id
     */
    getEvent(eventId: string): Promise<FederationEventResponse>;
    /**
     * Get the state IDs for a room.
     *
     * @param roomId - The room ID.
     * @returns The room state IDs response.
     * @see https://spec.matrix.org/v1.11/server-server-api/#get_matrixfederationv1state_idsroom_id
     */
    getStateIds(roomId: string): Promise<RoomStateIdsResponse>;
    /**
     * Query the directory for a room.
     *
     * @param roomId - The room ID.
     * @returns The directory lookup response.
     * @see https://spec.matrix.org/v1.11/server-server-api/#get_matrixfederationv1querydirectoryroomroom_id
     */
    queryDirectoryRoom(roomId: string): Promise<DirectoryRoomLookupResponse>;
    /**
     * Query the profile of a user.
     *
     * @param userId - The user ID.
     * @returns The profile lookup response.
     * @see https://spec.matrix.org/v1.11/server-server-api/#get_matrixfederationv1queryprofileuser_id
     */
    queryProfile(userId: string): Promise<ProfileLookupResponse>;
    /**
     * Backfill events for a room.
     *
     * @param request - The backfill request.
     * @returns The events.
     * @see https://spec.matrix.org/v1.11/server-server-api/#get_matrixfederationv1backfillroom_id
     */
    backfill(request: BackfillRequest): Promise<PduEvent[]>;
    /**
     * Claim one-time keys for devices.
     *
     * @param request - The key claim request.
     * @returns The key claim response.
     * @see https://spec.matrix.org/v1.11/server-server-api/#post_matrixfederationv1keysclaim
     */
    claimKeys(request: KeyClaimRequest): Promise<KeyClaimResponse>;
    /**
     * Upload device keys.
     *
     * @param deviceKeys - The device keys to upload.
     * @returns The key upload response.
     * @see https://spec.matrix.org/v1.11/server-server-api/#post_matrixfederationv1keysupload
     */
    uploadKeys(deviceKeys: Record<string, unknown>): Promise<KeyUploadResponse>;
    /**
     * Query user keys.
     *
     * @param request - The user keys query request.
     * @returns The user keys query response.
     * @see https://spec.matrix.org/v1.11/server-server-api/#post_matrixfederationv2userkeysquery
     */
    queryUserKeys(request: UserKeysQueryRequest): Promise<UserKeysQueryResponse>;
    /**
     * Exchange federation keys.
     *
     * @param request - The key exchange request.
     * @returns The key query response.
     * @see https://spec.matrix.org/v1.11/server-server-api/#post_matrixfederationv1keysquery
     */
    queryKeys(request: Record<string, unknown>): Promise<ServerKeyResponse>;
    /**
     * Get all members of a room.
     *
     * @param roomId - The room ID.
     * @returns The federation members response.
     * @see https://spec.matrix.org/v1.11/server-server-api/#get_matrixfederationv1membersroom_id
     */
    getMembers(roomId: string): Promise<FederationMembersResponse>;
    /**
     * Get joined members of a room.
     *
     * @param roomId - The room ID.
     * @returns The room members response.
     * @see https://spec.matrix.org/v1.11/server-server-api/#get_matrixfederationv1membersroom_idjoined
     */
    getJoinedMembers(roomId: string): Promise<RoomMembersResponse>;
    /**
     * Get devices for a user.
     *
     * @param userId - The user ID.
     * @returns The user devices response.
     * @see https://spec.matrix.org/v1.11/server-server-api/#get_matrixfederationv1userdevicesuser_id
     */
    getUserDevices(userId: string): Promise<UserDevicesResponse>;
    /**
     * Get room auth chain.
     *
     * @param roomId - The room ID.
     * @returns The room auth response.
     * @see https://spec.matrix.org/v1.11/server-server-api/#get_matrixfederationv1room_authroom_id
     */
    getRoomAuth(roomId: string): Promise<RoomAuthResponse>;
}
export type * from "./types.ts";
//# sourceMappingURL=index.d.ts.map