import { contextBridge, ipcRenderer } from "electron";

import { CALL_CHANNEL, type VitaBridge } from "../bridge.ts";

// Sandboxed: this runs as CommonJS and may require only `electron`.
const bridge: VitaBridge = {
  call: (method, input) => ipcRenderer.invoke(CALL_CHANNEL, method, input),
};

contextBridge.exposeInMainWorld("vita", bridge);
