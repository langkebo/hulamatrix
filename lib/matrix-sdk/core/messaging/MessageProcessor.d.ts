import { type MatrixHttpApi } from "../../http-api/index.ts";
import type { IHttpOpts } from "../../http-api/index.ts";
import type { IRoomEvent } from "../../sync-accumulator.ts";
import type { IContent } from "../../models/event.ts";
import type { EmptyObject } from "../../@types/common.ts";
export interface MessageProcessorEvents {
    messageSent: {
        roomId: string;
        eventId: string;
        content: IContent;
    };
    messageReceived: {
        roomId: string;
        event: IRoomEvent;
    };
    error: Error;
}
export interface SendMessageOptions {
    txnId?: string;
    eventType?: string;
}
export interface GetMessagesOptions {
    from?: string;
    to?: string;
    dir?: "f" | "b";
    limit?: number;
    filter?: Record<string, unknown>;
}
export interface MessagesResponse {
    start: string;
    end: string;
    chunk: IRoomEvent[];
    state?: IRoomEvent[];
}
export interface EventContextResponse {
    start: string;
    end: string;
    events_before: IRoomEvent[];
    event: IRoomEvent;
    events_after: IRoomEvent[];
    state?: IRoomEvent[];
}
export declare class MessageProcessor {
    private http;
    private pendingMessages;
    private messageQueue;
    constructor(http: MatrixHttpApi<IHttpOpts>);
    sendMessage(roomId: string, content: IContent, options?: SendMessageOptions): Promise<string>;
    sendTextMessage(roomId: string, text: string, txnId?: string): Promise<string>;
    sendHtmlMessage(roomId: string, html: string, text: string, txnId?: string): Promise<string>;
    sendEmote(roomId: string, text: string, txnId?: string): Promise<string>;
    sendNotice(roomId: string, text: string, txnId?: string): Promise<string>;
    sendImage(roomId: string, url: string, info?: Record<string, unknown>, text?: string, txnId?: string): Promise<string>;
    sendVideo(roomId: string, url: string, info?: Record<string, unknown>, text?: string, txnId?: string): Promise<string>;
    sendAudio(roomId: string, url: string, info?: Record<string, unknown>, text?: string, txnId?: string): Promise<string>;
    sendFile(roomId: string, url: string, info?: Record<string, unknown>, text?: string, txnId?: string): Promise<string>;
    sendLocation(roomId: string, geoUri: string, text?: string, txnId?: string): Promise<string>;
    sendReaction(roomId: string, eventId: string, emoji: string, txnId?: string): Promise<string>;
    redactEvent(roomId: string, eventId: string, reason?: string, txnId?: string): Promise<string>;
    getRoomMessages(roomId: string, options?: GetMessagesOptions): Promise<MessagesResponse>;
    getEventContext(roomId: string, eventId: string, limit?: number): Promise<EventContextResponse>;
    setReadReceipt(roomId: string, eventId: string, receiptType?: "m.read" | "m.read.private"): Promise<void>;
    setReadMarkers(roomId: string, options: {
        "m_read"?: string;
        "m.fully_read"?: string;
        "m.read.private"?: string;
    }): Promise<EmptyObject>;
    setTyping(roomId: string, isTyping: boolean, timeout?: number): Promise<EmptyObject>;
    queueMessage(roomId: string, event: IRoomEvent): void;
    getQueuedMessages(roomId: string): IRoomEvent[];
    clearQueuedMessages(roomId: string): void;
    private sendEvent;
    private generateTxnId;
}
//# sourceMappingURL=MessageProcessor.d.ts.map