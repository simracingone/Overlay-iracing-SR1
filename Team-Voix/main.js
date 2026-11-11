const { app, BrowserWindow, globalShortcut, ipcMain, screen } = require("electron");
const fs = require("fs");
const path = require("path");

const appDataPath = path.join(app.getPath("appData"), "SimracingOne", "Team-Voix");
const localAppDataPath = process.env.LOCALAPPDATA || app.getPath("appData");
const sessionDataPath = path.join(localAppDataPath, "SimracingOne", "Team-Voix", "SessionData-v1");
const cachePath = path.join(localAppDataPath, "SimracingOne", "Team-Voix", "Cache-v1");
fs.mkdirSync(appDataPath, { recursive: true });
fs.mkdirSync(sessionDataPath, { recursive: true });
fs.mkdirSync(cachePath, { recursive: true });
app.setPath("userData", appDataPath);
app.setPath("sessionData", sessionDataPath);
app.setPath("cache", cachePath);

let teamWindow = null;
let editMode = false;
const statePath = path.join(app.getPath("userData"), "team-window.json");

function loadBounds() {
    try {
        const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
        const visible = screen.getAllDisplays().some(({ workArea }) =>
            state.x < workArea.x + workArea.width && state.x + state.width > workArea.x &&
            state.y < workArea.y + workArea.height && state.y + state.height > workArea.y
        );
        if (visible && Number.isFinite(state.x) && Number.isFinite(state.y)) {
            return { x: state.x, y: state.y, width: 440, height: 270 };
        }
    } catch { }

    const { workArea } = screen.getPrimaryDisplay();
    return { x: workArea.x + workArea.width - 470, y: workArea.y + 50, width: 440, height: 270 };
}

function saveBounds() {
    if (!teamWindow || teamWindow.isDestroyed()) return;
    try {
        fs.mkdirSync(path.dirname(statePath), { recursive: true });
        fs.writeFileSync(statePath, JSON.stringify(teamWindow.getBounds(), null, 2), "utf8");
    } catch (error) {
        console.error("[TEAM] Impossible de sauvegarder la fenêtre:", error.message);
    }
}

function setEditMode(enabled) {
    editMode = Boolean(enabled);
    if (!teamWindow || teamWindow.isDestroyed()) return;
    teamWindow.setIgnoreMouseEvents(!editMode, { forward: true });
    teamWindow.webContents.send("team:edit-mode", editMode);
}

function createTeamWindow() {
    teamWindow = new BrowserWindow({
        ...loadBounds(),
        frame: false,
        transparent: true,
        backgroundColor: "#00000000",
        alwaysOnTop: true,
        skipTaskbar: false,
        resizable: true,
        minWidth: 360,
        minHeight: 230,
        show: false,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            preload: path.join(__dirname, "Preload.js")
        }
    });

    teamWindow.loadFile(path.join(__dirname, "team.html"), {
        query: { voicePort: process.env.SIMRACINGONE_VOICE_PORT || "5000" }
    });
    teamWindow.once("ready-to-show", () => {
        teamWindow.show();
        setEditMode(false);
    });
    teamWindow.on("move", saveBounds);
    teamWindow.on("resize", saveBounds);
    teamWindow.on("closed", () => { teamWindow = null; });
}

app.whenReady().then(() => {
    createTeamWindow();
    ipcMain.on("team:set-edit-mode", (_event, enabled) => setEditMode(enabled));
    const toggleEditMode = () => setEditMode(!editMode);
    for (const accelerator of ["Control+Alt+M", "Control+Alt+Shift+F11"]) {
        if (!globalShortcut.register(accelerator, toggleEditMode)) {
            console.warn(`[TEAM] Raccourci indisponible : ${accelerator}`);
        }
    }
    const sendVoiceTest = () => {
        if (teamWindow && !teamWindow.isDestroyed()) teamWindow.webContents.send("team:test-voice");
    };
    for (const accelerator of ["Control+Alt+T", "Control+Alt+Shift+F10"]) {
        if (!globalShortcut.register(accelerator, sendVoiceTest)) {
            console.warn(`[TEAM] Raccourci indisponible : ${accelerator}`);
        }
    }
    globalShortcut.register("Control+Alt+Shift+F12", () => app.quit());
});

app.on("will-quit", () => globalShortcut.unregisterAll());
app.on("window-all-closed", () => app.quit());
