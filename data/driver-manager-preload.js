const {
  contextBridge,
  ipcRenderer
} = require("electron");

contextBridge.exposeInMainWorld(
  "overlayState",
  {

    drivers: {

      load: () => {
        return ipcRenderer.invoke(
          "drivers:load"
        );
      },

      save: (data) => {
        return ipcRenderer.invoke(
          "drivers:save",
          data
        );
      }

    }

  }
);