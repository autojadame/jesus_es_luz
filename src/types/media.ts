export type MediaAsset = {
  provider: "topmediai";
  variant: number;        // 1..N
  createdAt: number;

  mp3Url?: string;
  srtUrl?: string;

  mp3Path: string;
  srtPath: string;
  mediaAsset?: MediaAsset;
};