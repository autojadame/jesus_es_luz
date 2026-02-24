// src/main/preload.ts
import { contextBridge, ipcRenderer, IpcRendererEvent, webUtils } from 'electron';

export type Channels = 'ipc-example';

const electron = {
  ipcRenderer: {
    sendMessage(channel: Channels, args: unknown[]) {
      ipcRenderer.send(channel, args);
    },
    on(channel: Channels, func: (...args: unknown[]) => void) {
      const subscription = (_event: IpcRendererEvent, ...args: unknown[]) => func(...args);
      ipcRenderer.on(channel, subscription);
      return () => ipcRenderer.removeListener(channel, subscription);
    },
    once(channel: Channels, func: (...args: unknown[]) => void) {
      ipcRenderer.once(channel, (_event, ...args) => func(...args));
    },
  },
};

// ✅ ERB default
contextBridge.exposeInMainWorld('electron', electron);

// ✅ lo que necesita tu React (mi código)
contextBridge.exposeInMainWorld('electronAPI', {
  clipboard: {
    writeText: (text: string) => ipcRenderer.invoke('clipboard:writeText', text),
  },
  deepseek: {
    chat: (payload: any) => ipcRenderer.invoke('deepseek:chat', payload),
  },
  topmedia: {
    generateAndDownloadOne: (payload: any) =>
      ipcRenderer.invoke("topmedia:generateAndDownloadOne", payload),
  },

  files: {
    // ✅ nuevo: path seguro para un File del drop/input
    getPathForFile: (file: File) => webUtils.getPathForFile(file),

    openPath: (p: string) => ipcRenderer.invoke("files:openPath", p),
    revealInFolder: (p: string) => ipcRenderer.invoke("files:revealInFolder", p),
  },

  library: {
    saveToLibrary: (payload: any) => ipcRenderer.invoke("library:saveToLibrary", payload),
    copyToDownloads: (payload: any) => ipcRenderer.invoke("library:copyToDownloads", payload),
  },
  windowControls: {
  minimize: () => ipcRenderer.invoke("window:minimize"),
  toggleMaximize: () => ipcRenderer.invoke("window:toggleMaximize"),
  close: () => ipcRenderer.invoke("window:close"),
  isMaximized: () => ipcRenderer.invoke("window:isMaximized"),
  onMaximized: (cb: (v: boolean) => void) => {
    const handler = (_e: any, v: boolean) => cb(!!v);
    ipcRenderer.on("window:maximized", handler);
    return () => ipcRenderer.removeListener("window:maximized", handler);
  },

  // ✅ drag manual (Windows)
  dragStart: (p: { screenX: number; screenY: number }) => ipcRenderer.send("window:dragStart", p),
  dragMove: (p: { screenX: number; screenY: number }) => ipcRenderer.send("window:dragMove", p),
  dragEnd: () => ipcRenderer.send("window:dragEnd"),
},
});
