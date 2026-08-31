const { contextBridge, ipcRenderer } = require("electron");

let currentEditMode = false;

contextBridge.exposeInMainWorld("overlayState", {

    // =========================================================
    // DONNÉES iRACING
    // CODE EXISTANT
    // =========================================================

    onData: (callback) =>
        ipcRenderer.on(
            "iracing-data",
            (event, data) => callback(data)
        ),


    // =========================================================
    // MODE ÉDITION
    // CODE EXISTANT
    // =========================================================

    getEditMode: () => currentEditMode,

    setEditMode: (value) => {

        currentEditMode = value;

        ipcRenderer.send(
            "toggle-edit-mode",
            value
        );

    },


    // =========================================================
    // QUITTER
    // CODE EXISTANT
    // =========================================================

    quit: () =>
        ipcRenderer.send("quit-app"),


    // =========================================================
    // RACCOURCIS CLAVIER
    // CODE EXISTANT
    // =========================================================

    onToggleEditMode: (callback) =>
        ipcRenderer.on(
            "toggle-edit-mode",
            (event, value) => callback(value)
        ),

    onShowResetPopup: (callback) =>
        ipcRenderer.on(
            "show-reset-popup",
            () => callback()
        ),

    onToggleVisibilityMenu: (callback) =>
        ipcRenderer.on(
            "toggle-visibility-menu",
            () => callback()
        ),


    // =========================================================
    // AJOUT AOUT 2026 - DRIVER MANAGER
    // Gestion de data/drivers.json
    // =========================================================

    drivers: {

        // Charger le JSON
        load: () =>
            ipcRenderer.invoke(
                "drivers:load"
            ),


        // Sauvegarder le JSON
        save: (data) =>
            ipcRenderer.invoke(
                "drivers:save",
                data
            )

    }

});