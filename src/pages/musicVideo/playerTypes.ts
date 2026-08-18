export interface IMusicVideoPlayerHandle {
    seek(positionSeconds: number): void;
}

export interface IMusicVideoPlayerProps {
    source: IPlugin.IMusicVideoSource;
    paused: boolean;
    onLoadStart?: () => void;
    onLoad?: (data: { duration: number }) => void;
    onProgress?: (data: { currentTime: number; duration: number }) => void;
    onBuffer?: (isBuffering: boolean) => void;
    onEnd?: () => void;
    onError?: (data: { code: string }) => void;
}
