/* ============================================================
   SIMRACINGONE - MAIN.JS
   ============================================================

   HISTORIQUE DES AMÉLIORATIONS
   ------------------------------------------------------------

   30/08/2026 - AJOUT HUD2
   • Nouveau raccourci CTRL + ALT + F4
   • Ouverture de hud2.html
   • HUD2 regroupe la Télémétrie Voiture + Météo/Piste/Drapeaux
   • Nouvelle fenêtre dédiée au HUD combiné

   30/08/2026 - MÉMOIRE DES FENÊTRES
   • Mémorisation automatique de la position X/Y
   • Mémorisation automatique de la largeur/hauteur
   • Restauration automatique après fermeture
   • Restauration automatique après redémarrage
   • Conservation de la taille normale même après maximisation
   • Fenêtres concernées : HUD2 / Météo / Voiture / Dashboard

   30/08/2026 - NETTOYAGE TERMINAL
   • Suppression des messages normaux inutiles
   • Conservation uniquement des erreurs importantes

   30/08/2026 - FENÊTRES HUD
   • Bordures Windows conservées
   • Fenêtres redimensionnables
   • Position et taille indépendantes pour chaque HUD

   RACCOURCIS
   ------------------------------------------------------------

   CTRL + ALT + F4  → HUD2
   CTRL + ALT + F6  → Météo / Piste / Drapeaux
   CTRL + ALT + F7  → Télémétrie Voiture
   CTRL + ALT + F8  → Dashboard Global
   CTRL + ALT + F9  → Menu de visibilité
   CTRL + ALT + F10 → Popup de réinitialisation
   CTRL + ALT + F11 → Driver Manager
   CTRL + ALT + F12 → Mode édition

   ============================================================ */


const {
    app,
    BrowserWindow,
    ipcMain,
    globalShortcut,
    screen
} = require("electron");

const path = require("path");
const fs = require("fs");


// ============================================================
// FACTEUR D'ÉCHELLE ELECTRON
// ============================================================

app.commandLine.appendSwitch(
    "force-device-scale-factor",
    "1"
);


// ============================================================
// ÉTAT GLOBAL DES FENÊTRES
// ============================================================

let mainWindow = null;

let driverManagerWindow = null;

let dashboardWindow = null;

let voitureWindow = null;

let meteoFlagPisteWindow = null;

let hud2Window = null;

let isEditMode = false;


// ============================================================
// FICHIER DE MÉMOIRE DES FENÊTRES
// ============================================================
//
// Ce fichier contient uniquement la position et la taille
// des fenêtres HUD.
//
// Il est créé automatiquement dans le dossier utilisateur
// d'Electron.
//
// ============================================================

const windowStateFile = path.join(
    app.getPath("userData"),
    "window-state.json"
);


// ============================================================
// CHARGEMENT DE LA MÉMOIRE DES FENÊTRES
// ============================================================

function chargerEtatFenêtres() {

    try {

        if (!fs.existsSync(windowStateFile)) {

            return {};

        }

        const data = JSON.parse(
            fs.readFileSync(
                windowStateFile,
                "utf8"
            )
        );

        if (
            !data ||
            typeof data !== "object"
        ) {

            return {};

        }

        return data;

    } catch (error) {

        console.error(
            "[WINDOW STATE] Erreur de lecture :",
            error.message
        );

        return {};
    }
}


// ============================================================
// MÉMOIRE EN RAM
// ============================================================

let windowStates = {};


// ============================================================
// SAUVEGARDE DE LA MÉMOIRE
// ============================================================

function sauvegarderEtatFenêtres() {

    try {

        const dossier =
            path.dirname(windowStateFile);

        if (!fs.existsSync(dossier)) {

            fs.mkdirSync(
                dossier,
                {
                    recursive: true
                }
            );
        }

        fs.writeFileSync(
            windowStateFile,
            JSON.stringify(
                windowStates,
                null,
                4
            ),
            "utf8"
        );

    } catch (error) {

        console.error(
            "[WINDOW STATE] Erreur de sauvegarde :",
            error.message
        );
    }
}


// ============================================================
// VÉRIFICATION D'UNE POSITION
// ============================================================
//
// Empêche une fenêtre d'être restaurée complètement
// hors écran après changement de résolution.
//
// ============================================================

function positionValide(bounds) {

    if (
        !bounds ||
        typeof bounds.x !== "number" ||
        typeof bounds.y !== "number" ||
        typeof bounds.width !== "number" ||
        typeof bounds.height !== "number"
    ) {

        return false;

    }


    if (
        bounds.width < 200 ||
        bounds.height < 150
    ) {

        return false;

    }


    const displays =
        screen.getAllDisplays();


    for (const display of displays) {

        const area =
            display.workArea;


        const visibleX =
            Math.max(
                bounds.x,
                area.x
            );


        const visibleY =
            Math.max(
                bounds.y,
                area.y
            );


        const visibleRight =
            Math.min(
                bounds.x + bounds.width,
                area.x + area.width
            );


        const visibleBottom =
            Math.min(
                bounds.y + bounds.height,
                area.y + area.height
            );


        const visibleWidth =
            visibleRight - visibleX;


        const visibleHeight =
            visibleBottom - visibleY;


        if (
            visibleWidth >= 100 &&
            visibleHeight >= 100
        ) {

            return true;

        }
    }


    return false;
}


// ============================================================
// OBTENIR LES BOUNDS SAUVEGARDÉS
// ============================================================

function obtenirEtatFenêtre(
    id,
    largeurDefaut,
    hauteurDefaut
) {

    const saved =
        windowStates[id];


    if (
        saved &&
        positionValide(saved)
    ) {

        return {
            x: saved.x,
            y: saved.y,
            width: saved.width,
            height: saved.height
        };

    }


    return {

        width: largeurDefaut,
        height: hauteurDefaut

    };
}


// ============================================================
// INSTALLER LA MÉMOIRE SUR UNE FENÊTRE
// ============================================================
//
// Sauvegarde automatiquement :
//
// • déplacement
// • redimensionnement
// • fermeture
//
// ============================================================

function memoriserFenêtre(
    window,
    id
) {

    if (
        !window ||
        window.isDestroyed()
    ) {

        return;

    }


    const sauvegarder = () => {

        if (
            !window ||
            window.isDestroyed()
        ) {

            return;

        }


        try {

            /*
             * getNormalBounds() est important :
             *
             * si la fenêtre est maximisée,
             * on mémorise sa vraie taille normale
             * plutôt que la taille de l'écran.
             */

            const bounds =
                window.getNormalBounds();


            windowStates[id] = {

                x: bounds.x,

                y: bounds.y,

                width: bounds.width,

                height: bounds.height

            };


            sauvegarderEtatFenêtres();

        } catch (error) {

            console.error(
                "[WINDOW STATE] Erreur :",
                error.message
            );
        }
    };


    window.on(
        "move",
        sauvegarder
    );


    window.on(
        "resize",
        sauvegarder
    );


    window.on(
        "close",
        sauvegarder
    );
}


// ============================================================
// GESTION DU FICHIER DRIVERS.JSON
// ============================================================

const driversFile = path.join(
    __dirname,
    "data",
    "drivers.json"
);


function chargerDrivers() {

    try {

        if (
            !fs.existsSync(
                driversFile
            )
        ) {

            return {
                drivers: {}
            };

        }


        const data =
            JSON.parse(
                fs.readFileSync(
                    driversFile,
                    "utf8"
                )
            );


        if (
            !data ||
            typeof data !== "object"
        ) {

            return {
                drivers: {}
            };

        }


        if (
            !data.drivers ||
            typeof data.drivers !== "object"
        ) {

            data.drivers = {};

        }


        return data;

    } catch (error) {

        console.error(
            "[DRIVER MANAGER] Erreur de lecture JSON :",
            error.message
        );

        return {
            drivers: {}
        };
    }
}


function sauvegarderDrivers(data) {

    try {

        if (
            !data ||
            typeof data !== "object"
        ) {

            return {
                success: false,
                error: "Données invalides"
            };

        }


        if (
            !data.drivers ||
            typeof data.drivers !== "object"
        ) {

            data.drivers = {};

        }


        fs.writeFileSync(
            driversFile,
            JSON.stringify(
                data,
                null,
                4
            ),
            "utf8"
        );


        return {
            success: true
        };

    } catch (error) {

        console.error(
            "[DRIVER MANAGER] Erreur de sauvegarde JSON :",
            error.message
        );

        return {
            success: false,
            error: error.message
        };
    }
}


// ============================================================
// IPC HANDLERS
// ============================================================

ipcMain.handle(
    "drivers:load",
    () => chargerDrivers()
);


ipcMain.handle(
    "drivers:save",
    (event, data) =>
        sauvegarderDrivers(data)
);


// ============================================================
// 1. OVERLAY PRINCIPAL
// ============================================================

function createWindow() {

    mainWindow = new BrowserWindow({

        width: 2560,

        height: 1440,

        frame: false,

        transparent: true,

        alwaysOnTop: true,

        skipTaskbar: true,

        backgroundColor: "#00000000",

        webPreferences: {

            contextIsolation: true,

            nodeIntegration: false,

            preload: path.join(
                __dirname,
                "preload.js"
            )
        }
    });


    mainWindow.loadFile(
        path.join(
            __dirname,
            "index.html"
        )
    );


    mainWindow.setIgnoreMouseEvents(
        true,
        {
            forward: true
        }
    );
}


// ============================================================
// 2. TÉLÉMÉTRIE VOITURE
// CTRL + ALT + F7
// ============================================================

function ouvrirVoiture() {

    if (
        voitureWindow &&
        !voitureWindow.isDestroyed()
    ) {

        voitureWindow.show();

        voitureWindow.focus();

        return;
    }


    const bounds =
        obtenirEtatFenêtre(
            "voiture",
            1200,
            800
        );


    voitureWindow =
        new BrowserWindow({

            ...bounds,

            resizable: true,

            maximizable: true,

            autoHideMenuBar: true,

            title:
                "Télémétrie Voiture - SimracingOne",

            backgroundColor:
                "#0b0e14",

            webPreferences: {

                contextIsolation: true,

                nodeIntegration: false,

                preload: path.join(
                    __dirname,
                    "preload.js"
                )
            }
        });


    voitureWindow.setMenu(null);


    memoriserFenêtre(
        voitureWindow,
        "voiture"
    );


    voitureWindow.loadFile(
        path.join(
            __dirname,
            "voiture.html"
        )
    );


    voitureWindow.on(
        "closed",
        () => {

            voitureWindow = null;

        }
    );
}


// ============================================================
// 3. DASHBOARD GLOBAL
// CTRL + ALT + F8
// ============================================================

function ouvrirDashboard() {

    if (
        dashboardWindow &&
        !dashboardWindow.isDestroyed()
    ) {

        dashboardWindow.show();

        dashboardWindow.focus();

        return;
    }


    const bounds =
        obtenirEtatFenêtre(
            "dashboard",
            1600,
            900
        );


    dashboardWindow =
        new BrowserWindow({

            ...bounds,

            resizable: true,

            maximizable: true,

            autoHideMenuBar: true,

            title:
                "Dashboard Global - SimracingOne",

            backgroundColor:
                "#070d16",

            webPreferences: {

                contextIsolation: true,

                nodeIntegration: false,

                preload: path.join(
                    __dirname,
                    "data",
                    "driver-manager-preload.js"
                )
            }
        });


    dashboardWindow.setMenu(null);


    memoriserFenêtre(
        dashboardWindow,
        "dashboard"
    );


    dashboardWindow.loadFile(
        path.join(
            __dirname,
            "dashboard.html"
        )
    );


    dashboardWindow.on(
        "closed",
        () => {

            dashboardWindow = null;

        }
    );
}


// ============================================================
// 4. DRIVER MANAGER
// CTRL + ALT + F11
// ============================================================

function ouvrirDriverManager() {

    if (
        driverManagerWindow &&
        !driverManagerWindow.isDestroyed()
    ) {

        driverManagerWindow.show();

        driverManagerWindow.focus();

        return;
    }


    driverManagerWindow =
        new BrowserWindow({

            width: 1200,

            height: 820,

            resizable: false,

            maximizable: false,

            autoHideMenuBar: true,

            title:
                "Driver Manager",

            backgroundColor:
                "#151b21",

            webPreferences: {

                contextIsolation: true,

                nodeIntegration: false,

                preload: path.join(
                    __dirname,
                    "data",
                    "driver-manager-preload.js"
                )
            }
        });


    driverManagerWindow.setMenu(null);


    driverManagerWindow.loadFile(
        path.join(
            __dirname,
            "data",
            "driver-manager.html"
        )
    );


    driverManagerWindow.on(
        "closed",
        () => {

            driverManagerWindow = null;

        }
    );
}


// ============================================================
// 5. MÉTÉO / PISTE / DRAPEAUX
// CTRL + ALT + F6
// ============================================================
//
// HTML : meteo-piste-drapeaux.html
// CSS  : css/meteo-piste-drapeaux.css
// JS   : js/meteo-piste-drapeaux.js
// IMAGE: assets/meteo-flag-piste.png
//
// DIMENSIONS ORIGINALES : 1250 × 493
//
// ============================================================

function ouvrirMeteoFlagPiste() {

    if (
        meteoFlagPisteWindow &&
        !meteoFlagPisteWindow.isDestroyed()
    ) {

        meteoFlagPisteWindow.show();

        meteoFlagPisteWindow.focus();

        return;
    }


    const htmlPath =
        path.join(
            __dirname,
            "meteo-piste-drapeaux.html"
        );


    if (
        !fs.existsSync(
            htmlPath
        )
    ) {

        console.error(
            "[HUD F6] ERREUR : meteo-piste-drapeaux.html introuvable."
        );

        return;
    }


    const bounds =
        obtenirEtatFenêtre(
            "meteo",
            1250,
            493
        );


    meteoFlagPisteWindow =
        new BrowserWindow({

            ...bounds,

            resizable: true,

            maximizable: true,

            autoHideMenuBar: true,

            title:
                "Météo / Piste / Drapeaux - SimracingOne",

            backgroundColor:
                "#050b14",

            webPreferences: {

                contextIsolation: true,

                nodeIntegration: false,

                preload: path.join(
                    __dirname,
                    "preload.js"
                )
            }
        });


    meteoFlagPisteWindow.setMenu(null);


    memoriserFenêtre(
        meteoFlagPisteWindow,
        "meteo"
    );


    /*
     * On force le zoom Chromium à 1:1
     * pour conserver les dimensions exactes
     * du HUD.
     */

    meteoFlagPisteWindow.webContents
        .setZoomFactor(1);


    try {

        meteoFlagPisteWindow.webContents
            .setVisualZoomLevelLimits(
                1,
                1
            );

    } catch (error) {

        console.error(
            "[HUD F6] Erreur verrouillage zoom :",
            error.message
        );
    }


    meteoFlagPisteWindow.loadFile(
        htmlPath
    );


    meteoFlagPisteWindow.webContents.on(
        "did-fail-load",
        (
            event,
            errorCode,
            errorDescription,
            validatedURL
        ) => {

            console.error(
                "[HUD F6] ERREUR chargement :",
                errorCode,
                errorDescription,
                validatedURL
            );

        }
    );


    meteoFlagPisteWindow.on(
        "closed",
        () => {

            meteoFlagPisteWindow = null;

        }
    );
}


// ============================================================
// 6. HUD2
// CTRL + ALT + F4
// ============================================================
//
// HUD COMBINÉ
//
// Partie haute  : VOITURE
// Partie basse  : METEO / PISTE / DRAPEAUX
//
// HTML : hud2.html
// IMAGE: assets/hud2-background.png
//
// ============================================================

function ouvrirHud2() {

    if (
        hud2Window &&
        !hud2Window.isDestroyed()
    ) {

        hud2Window.show();

        hud2Window.focus();

        return;
    }


    const htmlPath =
        path.join(
            __dirname,
            "hud2.html"
        );


    if (
        !fs.existsSync(
            htmlPath
        )
    ) {

        console.error(
            "[HUD F4] ERREUR : hud2.html introuvable."
        );

        return;
    }


    const bounds =
        obtenirEtatFenêtre(
            "hud2",
            1024,
            1365
        );


    hud2Window =
        new BrowserWindow({

            ...bounds,

            resizable: true,

            maximizable: true,

            autoHideMenuBar: true,

            title:
                "HUD2 - SimracingOne",

            backgroundColor:
                "#030611",

            webPreferences: {

                contextIsolation: true,

                nodeIntegration: false,

                preload: path.join(
                    __dirname,
                    "preload.js"
                )
            }
        });


    hud2Window.setMenu(null);


    /*
     * MÉMOIRE HUD2
     *
     * Position + taille sauvegardées
     * automatiquement.
     */

    memoriserFenêtre(
        hud2Window,
        "hud2"
    );


    hud2Window.loadFile(
        htmlPath
    );


    hud2Window.webContents.on(
        "did-fail-load",
        (
            event,
            errorCode,
            errorDescription,
            validatedURL
        ) => {

            console.error(
                "[HUD F4] ERREUR chargement :",
                errorCode,
                errorDescription,
                validatedURL
            );

        }
    );


    hud2Window.on(
        "closed",
        () => {

            hud2Window = null;

        }
    );
}


// ============================================================
// 7. MODE ÉDITION
// CTRL + ALT + F12
// ============================================================

function basculerModeEdition() {

    if (!mainWindow) {

        return;

    }


    isEditMode =
        !isEditMode;


    if (isEditMode) {

        mainWindow.setIgnoreMouseEvents(
            false
        );

        mainWindow.setFocusable(
            true
        );

        mainWindow.focus();

    } else {

        mainWindow.setIgnoreMouseEvents(
            true,
            {
                forward: true
            }
        );
    }


    mainWindow.webContents.send(
        "toggle-edit-mode",
        isEditMode
    );
}


// ============================================================
// INITIALISATION ELECTRON
// ============================================================

app.whenReady().then(() => {

    /*
     * Chargement de la mémoire des fenêtres
     * avant leur création.
     */

    windowStates =
        chargerEtatFenêtres();


    createWindow();


    // ========================================================
    // CTRL + ALT + F4
    // HUD2
    // ========================================================

    globalShortcut.register(
        "CommandOrControl+Alt+F4",
        () => {

            ouvrirHud2();

        }
    );


    // ========================================================
    // CTRL + ALT + F6
    // MÉTÉO / PISTE / DRAPEAUX
    // ========================================================

    globalShortcut.register(
        "CommandOrControl+Alt+F6",
        () => {

            ouvrirMeteoFlagPiste();

        }
    );


    // ========================================================
    // CTRL + ALT + F7
    // VOITURE
    // ========================================================

    globalShortcut.register(
        "CommandOrControl+Alt+F7",
        () => {

            ouvrirVoiture();

        }
    );


    // ========================================================
    // CTRL + ALT + F8
    // DASHBOARD GLOBAL
    // ========================================================

    globalShortcut.register(
        "CommandOrControl+Alt+F8",
        () => {

            ouvrirDashboard();

        }
    );


    // ========================================================
    // CTRL + ALT + F9
    // MENU DE VISIBILITÉ
    // ========================================================

    globalShortcut.register(
        "CommandOrControl+Alt+F9",
        () => {

            if (mainWindow) {

                mainWindow.webContents.send(
                    "toggle-visibility-menu"
                );

            }

        }
    );


    // ========================================================
    // CTRL + ALT + F10
    // POPUP DE RÉINITIALISATION
    // ========================================================

    globalShortcut.register(
        "CommandOrControl+Alt+F10",
        () => {

            if (mainWindow) {

                mainWindow.webContents.send(
                    "show-reset-popup"
                );

            }

        }
    );


    // ========================================================
    // CTRL + ALT + F11
    // DRIVER MANAGER
    // ========================================================

    globalShortcut.register(
        "CommandOrControl+Alt+F11",
        () => {

            ouvrirDriverManager();

        }
    );


    // ========================================================
    // CTRL + ALT + F12
    // MODE ÉDITION
    // ========================================================

    globalShortcut.register(
        "CommandOrControl+Alt+F12",
        () => {

            basculerModeEdition();

        }
    );

});


// ============================================================
// FERMETURE PROPRE
// ============================================================

app.on(
    "will-quit",
    () => {

        /*
         * Dernière sauvegarde de sécurité.
         */

        sauvegarderEtatFenêtres();


        globalShortcut.unregisterAll();

    }
);


// ============================================================
// FERMETURE DES FENÊTRES
// ============================================================

app.on(
    "window-all-closed",
    () => {

        if (
            process.platform !== "darwin"
        ) {

            app.quit();

        }

    }
);