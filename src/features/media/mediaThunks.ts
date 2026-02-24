/*import type { AppDispatch, RootState } from "@/app/store";
import { attachMediaToLatestByPassage } from "@/features/history/historySlice";
import type { MediaAsset } from "@/types/media";

export function generateAudioOne(params: {
  passageId: number;
  title: string;
  lyrics: string;
  prompt?: string;
  variant: number;
}) {
  return async (dispatch: AppDispatch, _getState: () => RootState) => {
    const out = await window.electronAPI.topmedia.generateAndDownloadOne(params);

    const asset: MediaAsset = {
      provider: "topmediai",
      variant: out.variant,
      createdAt: Date.now(),
      mp3Url: out.mp3Url,
      srtUrl: out.srtUrl,
      mp3Path: out.mp3Path,
      srtPath: out.srtPath,
    };

    dispatch(attachMediaToLatestByPassage({ passageId: out.passageId, asset }));
    return asset;
  };
}*/