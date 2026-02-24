/* eslint global-require: off, no-console: off, promise/always-return: off */

import path from "path";
import https from "https";
import { app, BrowserWindow, shell, ipcMain, clipboard, Menu, screen } from "electron";
import { autoUpdater } from "electron-updater";
import log from "electron-log";
// ❌ MenuBuilder ya no lo usamos
// import MenuBuilder from "./menu";
import { resolveHtmlPath } from "./util";
import { DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL } from "./constants";
import { saveToLibrary, copyToDownloads } from "./libraryExport";

class AppUpdater {
  constructor() {
    log.transports.file.level = "info";
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;

ipcMain.on("ipc-example", async (event, arg) => {
  const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
  console.log(msgTemplate(arg));
  event.reply("ipc-example", msgTemplate("pong"));
});

if (process.env.NODE_ENV === "production") {
  const sourceMapSupport = require("source-map-support");
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === "development" || process.env.DEBUG_PROD === "true";

if (isDebug) {
  require("electron-debug").default();
}

const installExtensions = async () => {
  const installer = require("electron-devtools-installer");
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ["REACT_DEVELOPER_TOOLS"];

  return installer
    .default(
      extensions.map((name: string) => installer[name]),
      forceDownload
    )
    .catch(console.log);
};
ipcMain.on("window:restoreForDrag", (_evt, payload: { screenX: number; screenY: number; offsetX: number; offsetY: number }) => {
  if (!mainWindow) return;
  if (!mainWindow.isMaximized()) return;

  const { screenX, screenY, offsetX, offsetY } = payload || ({} as any);
  if (![screenX, screenY, offsetX, offsetY].every((v) => typeof v === "number")) return;

  // 1) restaura
  mainWindow.unmaximize();

  // 2) reubica ventana para que el cursor quede “en el mismo punto” de la barra
  const work = getVirtualWorkArea();

  const b = mainWindow.getBounds();

  let x = Math.round(screenX - offsetX);
  let y = Math.round(screenY - offsetY);

  // clamp a workArea
  const maxX = work.x + work.width - b.width;
  const maxY = work.y + work.height - b.height;

  x = Math.min(Math.max(x, work.x), maxX);
  y = Math.min(Math.max(y, work.y), maxY);

  mainWindow.setPosition(x, y, false);
});
let dragState:
  | {
      dx: number;
      dy: number;
      work: { x: number; y: number; width: number; height: number };
      w: number;
      h: number;
    }
  | null = null;

function getVirtualWorkArea() {
  const displays = screen.getAllDisplays();
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const d of displays) {
    const w = d.workArea; // {x,y,width,height}
    minX = Math.min(minX, w.x);
    minY = Math.min(minY, w.y);
    maxX = Math.max(maxX, w.x + w.width);
    maxY = Math.max(maxY, w.y + w.height);
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
ipcMain.on("window:dragStart", (_evt, payload: { screenX: number; screenY: number }) => {
  if (!mainWindow) return;

  const screenX = Number(payload?.screenX);
  const screenY = Number(payload?.screenY);
  if (!Number.isFinite(screenX) || !Number.isFinite(screenY)) return;

  // Virtual desktop (todas las pantallas) para permitir cruzar monitores
  const virtual = getVirtualWorkArea();

  // Display actual SOLO para calcular el “ratio” de agarre al restaurar (como Windows)
  const display = screen.getDisplayNearestPoint({ x: Math.round(screenX), y: Math.round(screenY) });
  const dw = display.workArea;

  // ✅ Si está en fullscreen, sal antes (esto bloquea el unmaximize)
  if (mainWindow.isFullScreen()) {
    mainWindow.setFullScreen(false);
  }

  // ✅ Caso maximizado: restaurar a modo ventana y preparar offsets
  if (mainWindow.isMaximized()) {
    const normal = mainWindow.getNormalBounds();
    // ratio dentro del display actual (para el “agarre” tipo Windows)
    const ratioX = dw.width > 0 ? (screenX - dw.x) / dw.width : 0.5;
    const clamped = Math.min(1, Math.max(0, ratioX));

    const dx = Math.round(normal.width * clamped);
    const dy = 18;

    let x = Math.round(screenX - dx);
    let y = Math.round(screenY - dy);

    const maxX = virtual.x + virtual.width - normal.width;
    const maxY = virtual.y + virtual.height - normal.height;

    x = Math.min(Math.max(x, virtual.x), maxX);
    y = Math.min(Math.max(y, virtual.y), maxY);

    // ✅ IMPORTANTE: aplicar bounds SOLO cuando realmente se haya “des-maximizado”
    let applied = false;
    const applyOnce = () => {
      if (applied || !mainWindow) return;
      applied = true;

      // backup: a veces sigue marcada como maximizada
      if (mainWindow.isMaximized()) mainWindow.unmaximize();

      mainWindow.setBounds({ x, y, width: normal.width, height: normal.height }, false);
    };

    // 1) intenta engancharte al evento real de unmaximize
    mainWindow.once("unmaximize", applyOnce);

    // 2) restaura (más fiable que unmaximize en Windows)
    mainWindow.restore();

    // 3) fallback: si no llega el evento, aplica tras un frame
    setTimeout(applyOnce, 32);

    dragState = { dx, dy, work: virtual, w: normal.width, h: normal.height };
    return;
  }
  // ✅ No maximizada
  const b = mainWindow.getBounds();
  const dx = Math.round(screenX - b.x);
  const dy = Math.round(screenY - b.y);
  dragState = { dx, dy, work: virtual, w: b.width, h: b.height };
});

ipcMain.on("window:dragMove", (_evt, payload: { screenX: number; screenY: number }) => {
  if (!mainWindow || !dragState) return;

  const screenX = Number(payload?.screenX);
  const screenY = Number(payload?.screenY);
  if (!Number.isFinite(screenX) || !Number.isFinite(screenY)) return;

  let x = Math.round(screenX - dragState.dx);
  let y = Math.round(screenY - dragState.dy);

  const maxX = dragState.work.x + dragState.work.width - dragState.w;
  const maxY = dragState.work.y + dragState.work.height - dragState.h;

  x = Math.min(Math.max(x, dragState.work.x), maxX);
  y = Math.min(Math.max(y, dragState.work.y), maxY);

  mainWindow.setPosition(x, y, false);
});

ipcMain.handle("library:saveToLibrary", async (_evt, payload) => {
  return await saveToLibrary(payload);
});

ipcMain.handle("library:copyToDownloads", async (_evt, payload) => {
  return await copyToDownloads(payload);
});
ipcMain.on("window:dragEnd", () => {
  dragState = null;
});
// --------------------
// DeepSeek helper
// --------------------
function httpsPostJson(
  url: string,
  payload: any,
  headers: Record<string, string>
) {
  return new Promise<string>((resolve, reject) => {
    const u = new URL(url);

    const req = https.request(
      {
        method: "POST",
        hostname: u.hostname,
        path: u.pathname + u.search,
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += String(chunk)));
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      }
    );

    req.on("error", reject);
    req.write(JSON.stringify(payload));
    req.end();
  });
}

async function deepseekChat(payload: {
  model?: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  max_tokens?: number;
  temperature?: number;
}) {
  if (!DEEPSEEK_API_KEY || DEEPSEEK_API_KEY.includes("<MI_API_KEY>")) {
    throw new Error("DEEPSEEK_API_KEY no configurada.");
  }

  const body = {
    model: payload.model ?? "deepseek-reasoner",
    messages: payload.messages ?? [],
    stream: false,
    max_tokens: payload.max_tokens ?? 2048,
    temperature: payload.temperature ?? 0,
  };

  const raw = await httpsPostJson(`${DEEPSEEK_BASE_URL}/chat/completions`, body, {
    Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
  });

  const json = JSON.parse(raw) as any;
  const content = json?.choices?.[0]?.message?.content ?? "";
  return { content };
}

// --------------------
// IPC
// --------------------
ipcMain.handle("clipboard:writeText", (_evt, text: string) => {
  clipboard.writeText(String(text ?? ""));
  return true;
});

ipcMain.handle("deepseek:chat", async (_evt, payload) => {
  return deepseekChat(payload);
});

// ✅ Window controls (frameless)
ipcMain.handle("window:minimize", () => {
  mainWindow?.minimize();
  return true;
});

ipcMain.handle("window:toggleMaximize", () => {
  if (!mainWindow) return false;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
  return true;
});

ipcMain.handle("window:close", () => {
  mainWindow?.close();
  return true;
});

ipcMain.handle("window:isMaximized", () => {
  return mainWindow?.isMaximized() ?? false;
});

// ✅ Reveal/open file (ya lo tenías)
ipcMain.handle("files:openPath", async (_evt, p: string) => {
  return shell.openPath(String(p ?? ""));
});
ipcMain.handle("files:revealInFolder", async (_evt, p: string) => {
  shell.showItemInFolder(String(p ?? ""));
  return true;
});

const createWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, "assets")
    : path.join(__dirname, "../../assets");

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  // ✅ quita el menú nativo global
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    show: false,
    width: 1024,
    height: 728,
    icon: getAssetPath("icon.png"),

    // ✅ ventana sin marco (titlebar custom)
    frame: false,

    webPreferences: {
      preload: app.isPackaged
        ? path.join(__dirname, "preload.js")
        : path.join(__dirname, "../../.erb/dll/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // ✅ por si acaso en Windows/Linux
  mainWindow.setMenuBarVisibility(false);
  mainWindow.removeMenu();

  mainWindow.loadURL(resolveHtmlPath("index.html"));

  // ✅ emitir cambios de maximizado para UI
  mainWindow.on("maximize", () => {
    mainWindow?.webContents.send("window:maximized", true);
  });
  mainWindow.on("unmaximize", () => {
    mainWindow?.webContents.send("window:maximized", false);
  });

  mainWindow.on("ready-to-show", () => {
    if (!mainWindow) throw new Error('"mainWindow" is not defined');
    if (process.env.START_MINIMIZED) mainWindow.minimize();
    else mainWindow.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // ❌ No construimos el menú
  // const menuBuilder = new MenuBuilder(mainWindow);
  // menuBuilder.buildMenu();

  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: "deny" };
  });

  // eslint-disable-next-line
  new AppUpdater();
};

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app
  .whenReady()
  .then(() => {
    createWindow();
    app.on("activate", () => {
      if (mainWindow === null) createWindow();
    });
  })
  .catch(console.log);