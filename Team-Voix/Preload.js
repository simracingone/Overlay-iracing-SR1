const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("teamControls", {
    onEditMode: (callback) => ipcRenderer.on("team:edit-mode", (_event, enabled) => callback(enabled)),
    onTestVoice: (callback) => ipcRenderer.on("team:test-voice", () => callback()),
    setEditMode: (enabled) => ipcRenderer.send("team:set-edit-mode", enabled)
});
