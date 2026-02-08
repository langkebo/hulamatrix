import { type MediaTrackStats } from "./media/mediaTrackStats.ts";
import { type TrackSummary } from "./callStatsReportSummary.ts";
/**
 * RTC stats object that contains common media stream statistics
 */
interface RTCMediaStreamStats extends RTCStats {
    readonly codecId?: string;
    readonly frameHeight?: number;
    readonly frameWidth?: number;
    readonly framesPerSecond?: number;
    readonly framesSent?: number;
    readonly bytesReceived?: number;
    readonly bytesSent?: number;
    readonly packetsReceived?: number;
    readonly packetsSent?: number;
    readonly packetsLost?: number;
    readonly timestamp: number;
    readonly type: string;
    readonly jitter?: number;
    readonly totalSamplesDuration?: number;
    readonly totalSamplesReceived?: number;
    readonly concealedSamples?: number;
}
export declare class TrackStatsBuilder {
    static buildFramerateResolution(trackStats: MediaTrackStats, now: RTCMediaStreamStats): void;
    static calculateSimulcastFramerate(trackStats: MediaTrackStats, now: RTCMediaStreamStats, before: RTCMediaStreamStats | undefined, layer: number): void;
    static buildCodec(report: RTCStatsReport | undefined, trackStats: MediaTrackStats, now: RTCMediaStreamStats): void;
    static buildBitrateReceived(trackStats: MediaTrackStats, now: RTCMediaStreamStats, before: RTCMediaStreamStats): void;
    static buildBitrateSend(trackStats: MediaTrackStats, now: RTCMediaStreamStats, before: RTCMediaStreamStats): void;
    static buildPacketsLost(trackStats: MediaTrackStats, now: RTCMediaStreamStats, before: RTCMediaStreamStats): void;
    private static calculateBitrate;
    static setTrackStatsState(trackStats: MediaTrackStats, transceiver: RTCRtpTransceiver | undefined): void;
    static buildTrackSummary(trackStatsList: MediaTrackStats[]): {
        audioTrackSummary: TrackSummary;
        videoTrackSummary: TrackSummary;
    };
    static buildJitter(trackStats: MediaTrackStats, statsReport: RTCMediaStreamStats): void;
    static buildAudioConcealment(trackStats: MediaTrackStats, statsReport: RTCMediaStreamStats): void;
}
export {};
//# sourceMappingURL=trackStatsBuilder.d.ts.map