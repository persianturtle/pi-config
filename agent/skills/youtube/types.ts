/** A single transcript segment with start time and text. */
export interface TranscriptSegment {
  offset: number; // seconds from start
  duration: number; // segment length in seconds
  text: string;
}

/** Video metadata returned from the player API. */
export interface VideoDetails {
  videoId: string;
  title: string;
  author: string;
  channelId: string;
  lengthSeconds: number;
  viewCount: number;
  description: string;
  keywords: string[];
  isLiveContent: boolean;
}

/** Full result containing both metadata and transcript segments. */
export interface TranscriptResult {
  videoDetails: VideoDetails;
  segments: TranscriptSegment[];
}

/** Available caption track info. */
export interface CaptionTrack {
  languageCode: string;
  name: string | { originalString: string };
  trackUri: string;
  baseUrl: string;
  vssId: string;
}
