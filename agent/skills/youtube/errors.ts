export class YouTubeVideoUnavailableError extends Error {
  constructor(videoId: string) {
    super(`Video "${videoId}" is unavailable or not playable.`);
    this.name = "YouTubeVideoUnavailableError";
  }
}

export class YouTubeTooManyRequestsError extends Error {
  constructor() {
    super("YouTube rate-limited the request (captcha detected). Try again later.");
    this.name = "YouTubeTooManyRequestsError";
  }
}

export class YouTubeTranscriptDisabledError extends Error {
  constructor(videoId: string) {
    super(`Transcript is disabled for video "${videoId}".`);
    this.name = "YouTubeTranscriptDisabledError";
  }
}

export class YouTubeTranscriptNotAvailableError extends Error {
  constructor(videoId: string) {
    super(`No transcript found for video "${videoId}".`);
    this.name = "YouTubeTranscriptNotAvailableError";
  }
}

export class YouTubeTranscriptLanguageNotAvailableError extends Error {
  constructor(videoId: string, lang: string) {
    super(`Transcript in language "${lang}" not available for video "${videoId}".`);
    this.name = "YouTubeTranscriptLanguageNotAvailableError";
  }
}

export class YouTubeInvalidVideoIdError extends Error {
  constructor(input: string) {
    super(`Could not extract a valid video ID from "${input}".`);
    this.name = "YouTubeInvalidVideoIdError";
  }
}
