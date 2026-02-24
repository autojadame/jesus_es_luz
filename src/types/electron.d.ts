export {};

declare global {
  interface Window {
    electron: any;

    electronAPI: {
      clipboard: {
        writeText: (text: string) => Promise<boolean>;
      };

      deepseek: {
        chat: (payload: {
          model?: string;
          messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
          max_tokens?: number;
          temperature?: number;
        }) => Promise<{ content: string }>;
      };

      topmedia: {
        generateAndDownloadOne: (payload: {
          passageId: number;
          variant: number;
          title: string;
          lyrics: string;
          prompt?: string;
        }) => Promise<{
          passageId: number;
          variant: number;
          mp3Url?: string;
          srtUrl?: string;
          mp3Path: string;
          srtPath: string;
          lyricText?: string;
        }>;
      };


      library: {
        saveToLibrary: (payload: {
          kind: "mp3" | "srt";
          sourcePath: string;
          createdAt: number;
          songTitle: string;
        }) => Promise<{ destPath: string }>;

        copyToDownloads: (payload: {
          sourcePath: string;
        }) => Promise<{ downloadPath: string }>;
      };

      files: {
        getPathForFile: (file: File) => string;
        openPath: (p: string) => Promise<string>; // shell.openPath devuelve string error o ""
        revealInFolder: (p: string) => Promise<void>;
      };
      windowControls: {
  minimize: () => Promise<boolean>;
  toggleMaximize: () => Promise<boolean>;
  close: () => Promise<boolean>;
  isMaximized: () => Promise<boolean>;
  onMaximized: (cb: (v: boolean) => void) => () => void;

  dragStart: (p: { screenX: number; screenY: number }) => void;
  dragMove: (p: { screenX: number; screenY: number }) => void;
  dragEnd: () => void;
};
    };
  }
}