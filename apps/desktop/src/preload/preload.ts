import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

import {
  CALL_CHANNEL,
  COMMAND_CHANNEL,
  DATA_IMPORTED_CHANNEL,
  DOWNLOAD_DATA_CHANNEL,
  IMPORT_DATA_CHANNEL,
  THEME_CHANNEL,
  type MenuCommand,
  type VitaBridge,
} from "../bridge.ts";

// Sandboxed: this runs as CommonJS and may require only `electron`.
const bridge: VitaBridge = {
  call: (method, input) => ipcRenderer.invoke(CALL_CHANNEL, method, input),
  onCommand: (listener) => {
    const hear = (_event: IpcRendererEvent, command: MenuCommand) =>
      listener(command);
    ipcRenderer.on(COMMAND_CHANNEL, hear);
    return () => ipcRenderer.off(COMMAND_CHANNEL, hear);
  },
  setTheme: (theme) => ipcRenderer.send(THEME_CHANNEL, theme),
  downloadData: () => ipcRenderer.invoke(DOWNLOAD_DATA_CHANNEL),
  importData: () => ipcRenderer.invoke(IMPORT_DATA_CHANNEL),
  onDataImported: (listener) => {
    const hear = () => listener();
    ipcRenderer.on(DATA_IMPORTED_CHANNEL, hear);
    return () => ipcRenderer.off(DATA_IMPORTED_CHANNEL, hear);
  },
};

contextBridge.exposeInMainWorld("vita", bridge);
