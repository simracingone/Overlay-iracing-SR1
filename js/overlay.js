// ============================================================================
// iRacing Overlay
// Version : 4.1.2 (Optimisée & Stabilisée)
// Date    : 2026-08-17
//
// OBJECTIF DE CETTE VERSION
// - Détection instantanée Practice -> Qualify -> Race
// - Détection via SessionUniqueID / SessionNum / SessionType / Generation
// - PlayerCarIdx NE sert jamais à détecter une nouvelle session
// - Le paquet de transition est conservé
// - Le classement est reconstruit immédiatement
// - Le classement original est conservé
// - Aucun double WebSocket
// - Aucun double requestAnimationFrame
// - Aucun reset de lastDataReceived pendant une transition
// ============================================================================

const API_URL = "http://127.0.0.1:8000";
const VOICE_URL = "http://127.0.0.1:5000";

async function fetchData() {
    try {
        const response = await fetch(`${API_URL}/data`);
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        const data = await response.json();

        hudClassement(data);
        hudPiste(data);

    } catch (error) {
        console.error("Erreur de connexion à l'API iRacing:", error);
    }
}


/* ==========================================================================
   1. CONFIGURATION & ÉTAT GLOBAL
   ========================================================================== */

const CONFIG_TEAM = {
    "0": { "departement": "Piste", "nom": "Denise Martin", "role": "Directeur de course", "image": "Denise.png" },
    "1": { "departement": "Météo", "nom": "Henri Dubois", "role": "Ingénieur météo", "image": "Henri.png" },
    "2": { "departement": "Voiture", "nom": "Antoine Roux", "role": "Chef mécanicien", "image": "Antoine.png" },
    "3": { "departement": "Drapeaux", "nom": "Vivienne Martin", "role": "Officiel signaux", "image": "Vivienne.png" },
    "4": { "departement": "Performance", "nom": "Gerard Petit", "role": "Analyste télémétrie", "image": "Gerard.png" },
    "5": { "departement": "Classement", "nom": "Ariane Lambert", "role": "Stratège timing", "image": "Ariane.png" },
    "6": { "departement": "Relatifs", "nom": "Remy Fontaine", "role": "Gestion trafic", "image": "Remy.png" },
    "7": { "departement": "Physio", "nom": "Eloise Morel", "role": "Coach santé", "image": "Eloise.png" },
    "8": { "departement": "Stratégie", "nom": "Charline Durand", "role": "Planification arrêts", "image": "Charline.png" },
    "9": { "departement": "Mental", "nom": "Sylvie Vasseur", "role": "Préparateur mental", "image": "Sylvie.png" },
    "10": { "departement": "Spotter", "nom": "Thierry Lefebvre", "role": "Observateur piste", "image": "Thierry.png" },
    "11": { "departement": "Carburant", "nom": "Fabrice Dubois", "role": "Ingénieur consommation", "image": "Fabrice.png" }
};

let socket = null;
let lastDataReceived = null;

/* Identité de session (PlayerCarIdx exclu volontairement) */
let lastSessionID = null;
let lastSessionType = null;
let lastSessionUniqueID = null;
let lastSessionGeneration = null;

let sessionTransitionPending = false;
let socketConnecting = false;
let reconnectTimer = null;
let lastHandledSessionKey = null;

/* Timers pour la boucle de rendu */
let timers = {
    moyen: 0,
    lent: 0,
    classement: 0
};

let lastTresLent = 0;

let radioQueue = [];
let isRadioTalking = false;

let dernierFlagVocal = null;
let derniereSessionAnnoncee = "";
let alertePrioritaire = null;
let usureMini = 100;

/* Variable météo */
let info_meteo_annonce = null;

let Tactique = {
    sessionNum: 0,
    sessionType: "Practice"
};

let MemoireMeteo = {
    briefingOk: false,
    pisteTemp: null,
    pluie: 0,
    vent: 0,
    mouille: 0,
    derniereSession: null
};

let MemoireRelatif = {
    lastTimeAnalyse: 0,
    lastTimeConseille: 0
};

// Utilisation d'une structure globale unifiée
window.MemoireClassement = window.MemoireClassement || {
    posPrecedente: null,
    meilleurTourClasse: {}
};

window.MemoireTactique = window.MemoireTactique || {
    tourMessage: 0,
    etatDelta: 0,
    dernierVocalPodium: 0,
    dernierGérard: 0,
    tourDuDernierMessage: 0,
    etatDeltaAnnonce: 0,
    positionClassePrecedente: null,
    meilleurTourClasse: 9999,
    dernierCheckRelatif: 0,
    lastFlag: null,
    lastLap: 0,
    lastIncCount: 0
};

let MemoireVocale = {
    derniereAlerte: "",
    dernierTemps: 0,
    delaiMin: 2000
};

/* 60 FPS Limit */
let lastFrameTime = 0;
const fpsLimit = 60;

const RAF = {
    RAPIDE: 16,
    MOYEN: 200,
    TRES_LENT: 1000
};


/* ==========================================================================
   2. BOUCLE PRINCIPALE & WEBSOCKET
   ========================================================================== */

function fermerOverlay() {
    if (window.overlayState && typeof window.overlayState.quit === "function") {
        window.overlayState.quit();
    }
}

function connecter() {
    if (socketConnecting) {
        return;
    }

    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        return;
    }

    socketConnecting = true;
    socket = new WebSocket("ws://127.0.0.1:8000/ws");

    socket.onopen = () => {
        socketConnecting = false;
        console.log("%c🟢 WebSocket iRacing connecté", "color:#00ff88;font-weight:bold;");
    };

    socket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);

            if (data && data.needs_reset) {
                console.log("%c RESET REÇU DU SERVEUR ", "background:red;color:white;font-weight:bold;");
            }

            /* 1. ARRÊT SI PAS DE DONNÉES OU DÉCONNEXION */
            if (!data || data.IsConnected === false) {
                lastDataReceived = null;
                lastSessionID = null;
                lastSessionType = null;
                lastSessionUniqueID = null;
                lastSessionGeneration = null;
                lastHandledSessionKey = null;
                return;
            }

            /* 2. IDENTIFICATION ROBUSTE DE LA SESSION */
            const currentSessionNum = data.session_num ?? data.SessionNum ?? null;
            const currentSessionType = data.session_type ?? data.sessionType ?? data.SessionType ?? null;
            const currentSessionUniqueID = data.session_unique_id ?? data.SessionUniqueID ?? data.session_id ?? data.SessionID ?? null;
            const currentSessionGeneration = data.session_generation ?? null;

            const currentSessionKey = [
                currentSessionUniqueID ?? "",
                currentSessionNum ?? "",
                currentSessionType ?? "",
                currentSessionGeneration ?? ""
            ].join("|");

            const firstSessionPacket =
                lastSessionID === null &&
                lastSessionType === null &&
                lastSessionUniqueID === null;

            const identityChanged =
                !firstSessionPacket &&
                (
                    (currentSessionUniqueID !== null && lastSessionUniqueID !== null && currentSessionUniqueID !== lastSessionUniqueID) ||
                    (currentSessionNum !== null && lastSessionID !== null && currentSessionNum !== lastSessionID) ||
                    (currentSessionType !== null && lastSessionType !== null && currentSessionType !== lastSessionType) ||
                    (currentSessionGeneration !== null && lastSessionGeneration !== null && currentSessionGeneration !== lastSessionGeneration)
                );

            const serverReset =
                data.needs_reset === true ||
                data.session_changed === true ||
                data.force_reload === true;

            const sessionChanged =
                !firstSessionPacket &&
                currentSessionKey !== lastHandledSessionKey &&
                (identityChanged || serverReset);

            /* 3. TRANSITION DE SESSION */
            if (sessionChanged) {
                console.warn("♻️ Transition Session immédiate", {
                    from: { id: lastSessionUniqueID, num: lastSessionID, type: lastSessionType, generation: lastSessionGeneration },
                    to: { id: currentSessionUniqueID, num: currentSessionNum, type: currentSessionType, generation: currentSessionGeneration }
                });

                executerResetGlobal();
                sessionTransitionPending = true;
                lastHandledSessionKey = currentSessionKey;
            }

            if (firstSessionPacket) {
                lastHandledSessionKey = currentSessionKey;
            }

            /* 4. MÉMORISATION IDENTITÉ SESSION */
            lastSessionID = currentSessionNum;
            lastSessionType = currentSessionType;
            lastSessionUniqueID = currentSessionUniqueID;
            lastSessionGeneration = currentSessionGeneration;

            /* 5. NORMALISATION FLAGS */
            data.flag = Array.isArray(data.flags || data.flag)
                ? (data.flags || data.flag)
                : [data.flags || data.flag || "None"];

            /* 6. SYNCHRO ÉTAT SESSION */
            Tactique.sessionNum = data.session_num ?? data.SessionNum ?? 0;
            Tactique.sessionType = data.session_type ?? data.sessionType ?? data.SessionType ?? "Practice";

            /* 7. PAQUET COURANT */
            lastDataReceived = data;

            /* 8. RENDU IMMÉDIAT DE LA NOUVELLE SESSION */
            if (sessionTransitionPending) {
                if (typeof hudClassement === "function") hudClassement(data);
                if (typeof hudRelatif === "function") hudRelatif(data);
                if (typeof hudDrapeaux === "function") hudDrapeaux(data);
                if (typeof hudPneusDetail === "function") hudPneusDetail(data);

                timers.classement = performance.now();
                sessionTransitionPending = false;
            }

        } catch (e) {
            console.error("Erreur lors de la réception des données WS:", e);
        }
    };

    socket.onclose = () => {
        socketConnecting = false;
        socket = null;
        lastDataReceived = null;

        console.warn("🔌 Socket fermé. Tentative de reconnexion dans 1s...");

        if (reconnectTimer === null) {
            reconnectTimer = setTimeout(() => {
                reconnectTimer = null;
                connecter();
            }, 1000);
        }
    };

    socket.onerror = (err) => {
        console.error("❌ Erreur WebSocket:", err);
    };
}


/* ==========================================================================
   RESET GLOBAL
   ========================================================================== */

function executerResetGlobal() {
    console.log("🧹 Nettoyage global du HUD et des variables...");

    if (typeof resetCompletHUD === "function") {
        resetCompletHUD();
    }

    if (window.MemoireMeteo) {
        MemoireMeteo.briefingOk = false;
        MemoireMeteo.derniereSession = null;
    }

    if (window.MemoireTactique) {
        window.MemoireTactique.tourMessage = 0;
        window.MemoireTactique.etatDelta = 0;
        window.MemoireTactique.lastLeaderboard = [];
    }
}


/* ==========================================================================
   BOUCLE PRINCIPALE
   ========================================================================== */

function updateLoop(timestamp) {
    requestAnimationFrame(updateLoop);

    if (!lastDataReceived) {
        return;
    }

    const interval = 1000 / fpsLimit;
    const delta = timestamp - lastFrameTime;

    if (delta < interval) {
        return;
    }

    lastFrameTime = timestamp - (delta % interval);

    /* RAPIDE — 60 FPS */
    hudPerformance(lastDataReceived);

    /* MOYEN — 200 ms */
    if (timestamp - timers.moyen >= 200) {
        hudDrapeaux(lastDataReceived);
        hudPneusDetail(lastDataReceived);
        hudRelatif(lastDataReceived);
        timers.moyen = timestamp;
    }

    /* LENT — 1 seconde */
    if (timestamp - timers.lent >= 1000) {
        hudMeteo(lastDataReceived);
        hudPiste(lastDataReceived);
        timers.lent = timestamp;
    }

    /* TRÈS LENT — 5 secondes */
    if (timestamp - timers.classement >= 5000) {
        hudClassement(lastDataReceived);
        timers.classement = timestamp;
    }
}


/* ==========================================================================
   ÉCOUTEUR VISIBILITÉ
   ========================================================================== */

window.addEventListener("storage", applyVisibility);


/* ==========================================================================
   3. GESTION DES PNEUS
   ========================================================================== */

function hudPneusDetail(donnees) {
    if (!donnees || !donnees.tires) {
        return;
    }

    const mapping = {
        "LF": "fl",
        "RF": "fr",
        "LR": "rl",
        "RR": "rr"
    };

    Object.entries(mapping).forEach(([pyKey, htmlPrefix]) => {
        const pneu = donnees.tires[pyKey];
        if (!pneu) return;

        /* FREINS */
        const brakeVal = parseFloat(pneu.brake || 0);
        let brakeLabel = " bar";
        let brakePct = 0;
        const isDegres = brakeVal > 120;

        if (isDegres) {
            brakeLabel = "°";
            brakePct = Math.min(100, (brakeVal / 900) * 100);
        } else {
            brakeLabel = " bar";
            brakePct = Math.min(100, (brakeVal / 80) * 100);
        }

        const elBrakeTxt = document.getElementById(`${htmlPrefix}-temp-brake`);
        if (elBrakeTxt) {
            elBrakeTxt.textContent = Math.round(brakeVal) + brakeLabel;
            const alerte = (isDegres && brakeVal > 800) || (!isDegres && brakeVal > 70);
            elBrakeTxt.style.color = alerte ? "#ff4757" : "#ffffff";
        }

        const elBrakeBar = document.getElementById(`${htmlPrefix}-brake-bar`);
        if (elBrakeBar) {
            elBrakeBar.style.height = brakePct + "%";
            if (brakePct > 85) {
                elBrakeBar.style.backgroundColor = "#ff4757";
            } else if (brakePct > 50) {
                elBrakeBar.style.backgroundColor = "#ffa502";
            } else {
                elBrakeBar.style.backgroundColor = "#2ed573";
            }
        }

        /* PRESSION */
        const psiVal = parseFloat(pneu.press || 0);
        const elPres = document.getElementById(`${htmlPrefix}-pres`);
        if (elPres) {
            elPres.textContent = psiVal.toFixed(1);
        }

        const elPsiBar = document.getElementById(`${htmlPrefix}-psi-bar`);
        if (elPsiBar) {
            elPsiBar.style.height = Math.min(100, (psiVal / 40) * 100) + "%";
        }

        /* USURE */
        const usureVal = Math.max(0, Math.min(100, pneu.wear || 0));
        const elWearVal = document.getElementById(`${htmlPrefix}-wear-val`);
        if (elWearVal) {
            elWearVal.textContent = Math.round(usureVal) + "%";
        }

        const elWearBar = document.getElementById(`${htmlPrefix}-wear-bar`);
        if (elWearBar) {
            elWearBar.style.height = usureVal + "%";
        }

        /* TEMPÉRATURES */
        const isLeftSide = pyKey === "LF" || pyKey === "LR";
        const innerVal = isLeftSide ? pneu.temp_R : pneu.temp_L;
        const outerVal = isLeftSide ? pneu.temp_L : pneu.temp_R;
        const middleVal = pneu.temp_M;

        const elCore = document.getElementById(`${htmlPrefix}-temp-core`);
        if (elCore) {
            elCore.textContent = Math.round(middleVal) + "°";
        }

        updateZoneColor(`${htmlPrefix}-zone-i`, innerVal);
        updateZoneColor(`${htmlPrefix}-zone-m`, middleVal);
        updateZoneColor(`${htmlPrefix}-zone-o`, outerVal);

        const elImo = document.getElementById(`${htmlPrefix}-temp-imo`);
        if (elImo) {
            elImo.textContent = `${Math.round(innerVal)}|${Math.round(middleVal)}|${Math.round(outerVal)}`;
        }
    });
}


/* ==========================================================================
   COULEURS PNEUS & BARRES
   ========================================================================== */

function updateZoneColor(id, temp) {
    const el = document.getElementById(id);
    if (!el) return;

    let color = "rgba(255,255,255,0.05)";
    if (temp > 10) {
        if (temp < 60) {
            color = "#3498db";
        } else if (temp < 95) {
            color = "#2ed573";
        } else if (temp < 105) {
            color = "#ffa502";
        } else {
            color = "#ff4757";
        }
    }
    el.style.backgroundColor = color;
}

function updateBar(id, pourcent, type) {
    const el = document.getElementById(id);
    if (!el) return;

    const p = Math.max(0, Math.min(100, pourcent));
    el.style.height = p + "%";

    if (type === "frein") {
        if (p > 85) {
            el.style.backgroundColor = "#ff4757";
        } else if (p > 60) {
            el.style.backgroundColor = "#ffa502";
        } else {
            el.style.backgroundColor = "#2ed573";
        }
    }
}


/* ==========================================================================
   4. SYSTÈME AUDIO & RESET
   ========================================================================== */

function parler(id_alerte, texte, indexVoix = 1) {
    if (id_alerte === MemoireVocale.derniereAlerte) {
        return;
    }

    MemoireVocale.derniereAlerte = id_alerte;
    radioQueue.push({ texte, indexVoix });

    if (!isRadioTalking) {
        processNextMessage();
    }
}

function resetCompletHUD() {
    console.log("🔄 Reset HUD : Nettoyage complet pour nouvelle session");

    const containers = [
        "leaderboard-dynamic-container",
        "relative-dynamic-container"
    ];

    containers.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = "";
    });

    MemoireVocale.derniereAlerte = "";
    derniereSessionAnnoncee = "";
    dernierFlagVocal = null;

    const roues = ["fl", "fr", "rl", "rr"];
    roues.forEach(prefix => {
        if (document.getElementById(`${prefix}-temp-core`)) document.getElementById(`${prefix}-temp-core`).textContent = "--°";
        if (document.getElementById(`${prefix}-temp-brake`)) document.getElementById(`${prefix}-temp-brake`).textContent = "--";
        if (document.getElementById(`${prefix}-pres`)) document.getElementById(`${prefix}-pres`).textContent = "0.0";
        if (document.getElementById(`${prefix}-wear-val`)) document.getElementById(`${prefix}-wear-val`).textContent = "100%";
        if (document.getElementById(`${prefix}-temp-imo`)) document.getElementById(`${prefix}-temp-imo`).textContent = "--|--|--";

        const gauges = [`${prefix}-brake-bar`, `${prefix}-psi-bar`, `${prefix}-wear-bar`];
        gauges.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.height = "0%";
        });

        const zones = [`${prefix}-zone-i`, `${prefix}-zone-m`, `${prefix}-zone-o`];
        zones.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.backgroundColor = "rgba(255,255,255,0.05)";
        });
    });

    if (document.getElementById("perf-vitesse")) document.getElementById("perf-vitesse").textContent = "0";
    if (document.getElementById("perf-gear")) document.getElementById("perf-gear").textContent = "N";

    window.MemoireClassement = {
        posPrecedente: null,
        meilleurTourClasse: {}
    };

    MemoireRelatif = {
        lastTimeAnalyse: 0,
        lastTimeConseille: 0
    };

    window.MemoireTactique = {
        tourMessage: 0,
        etatDelta: 0,
        dernierVocalPodium: 0,
        dernierGérard: 0,
        tourDuDernierMessage: 0,
        etatDeltaAnnonce: 0,
        positionClassePrecedente: null,
        meilleurTourClasse: 9999,
        dernierCheckRelatif: 0,
        lastFlag: null,
        lastLap: 0,
        lastIncCount: 0
    };

    const containerLeaderboard = document.getElementById("leaderboard-dynamic-container");
    const containerRelative = document.getElementById("relative-drivers-list");
    if (containerLeaderboard) containerLeaderboard.innerHTML = "";
    if (containerRelative) containerRelative.innerHTML = "";

    MemoireMeteo = {
        briefingOk: false,
        pisteTemp: null,
        pluie: 0,
        vent: 0,
        mouille: 0,
        derniereSession: null
    };

    console.log("✅ HUD Nettoyé");
}


/* ==========================================================================
   5. INITIALISATION
   ========================================================================== */

function applyVisibility() {
    const modules = [
        "module-leaderboard",
        "module-relative",
        "module-strategie",
        "module-meteo",
        "module-pneus-detail"
    ];

    modules.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            const isActive = localStorage.getItem(id) !== "false";
            el.style.display = isActive ? "block" : "none";
        }
    });
}

async function processNextMessage() {
    if (radioQueue.length === 0) {
        isRadioTalking = false;
        setTimeout(() => {
            const moduleRadio = document.getElementById("module-radio-team");
            if (moduleRadio) moduleRadio.classList.remove("active");
        }, 2000);
        return;
    }

    isRadioTalking = true;
    const msg = radioQueue.shift();
    const expert = CONFIG_TEAM[msg.indexVoix.toString()] || CONFIG_TEAM["1"];
    const moduleRadio = document.getElementById("module-radio-team");

    if (moduleRadio) {
        document.getElementById("radio-img").src = `assets/team/${expert.image}`;
        document.getElementById("radio-name").textContent = expert.nom.toUpperCase();
        document.getElementById("radio-dept").textContent = expert.departement;
        document.getElementById("radio-role").textContent = expert.role;
        document.getElementById("radio-message").textContent = msg.texte;

        moduleRadio.style.display = "block";
        moduleRadio.classList.add("active");

        try {
            await fetch(`${VOICE_URL}/speak`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    text: msg.texte,
                    voice_index: msg.indexVoix
                })
            });

            await attendreFinDeParole();
            await new Promise(r => setTimeout(r, 800));

        } catch (e) {
            console.error("Erreur TTS:", e);
        }
    }

    processNextMessage();
}

function attendreFinDeParole() {
    return new Promise(resolve => {
        let aCommenceA_Parler = false;

        const verifInterval = setInterval(async () => {
            try {
                const res = await fetch(`${VOICE_URL}/status`);
                const data = await res.json();

                if (data.playing) {
                    aCommenceA_Parler = true;
                } else if (aCommenceA_Parler && !data.playing) {
                    clearInterval(verifInterval);
                    resolve();
                }
            } catch (e) {
                clearInterval(verifInterval);
                resolve();
            }
        }, 200);
    });
}


/* ==========================================================================
   6. DRAPEAUX
   ========================================================================== */

function hudDrapeaux(donnees) {
    if (!donnees || !donnees.flag) {
        return;
    }

    const MAP_FLAGS = {
        "VERT": "f-VERT",
        "JAUNE": "f-JAUNE",
        "ROUGE": "f-ROUGE",
        "BLEU": "f-BLEU",
        "BLANC": "f-BLANC",
        "VIOLET": "f-VIOLET",
        "DAMIER": "f-DAMIER",
        "GRAVIER": "f-GRAVIER",
        "MEATBALL": "f-MEATBALL",
        "STOPGO": "f-STOPGO",
        "PITPASS": "f-PITPASS",
        "AVERT": "f-AVERT",
        "NOIR": "f-NOIR"
    };

    document.querySelectorAll(".drapeau-cellule").forEach(el => el.classList.remove("actif", "vibrate"));

    const liste = Array.isArray(donnees.flag) ? donnees.flag : [donnees.flag];

    if (liste.length > 0) {
        liste.forEach(nom => {
            const key = nom.toUpperCase().trim();
            const element = document.getElementById(MAP_FLAGS[key]);

            if (element) {
                element.classList.add("actif");
                if (["JAUNE", "ROUGE", "MEATBALL"].includes(key)) {
                    element.classList.add("vibrate");
                }
            }
        });

        const flagsNormalises = liste.map(f => f.toUpperCase().trim());
        const alerteID = flagsNormalises[flagsNormalises.length - 1];

        if (alerteID === dernierFlagVocal) {
            return;
        }

        dernierFlagVocal = alerteID;

        let sessionActive = Tactique.sessionType || "Practice";
        if (Tactique.sessionNum === 0) sessionActive = "Practice";
        if (Tactique.sessionNum === 1) sessionActive = "Qualify";
        if (Tactique.sessionNum === 2) sessionActive = "Race";

        const cleVert = Tactique.sessionNum + "-VERT";

        console.log("[VOCAL]", "Session:", sessionActive, "| Flag:", alerteID);

        switch (sessionActive) {
            case "Practice":
                switch (alerteID) {
                    case "VERT":
                        if (derniereSessionAnnoncee !== cleVert) {
                            parler("VOX_VERT_PRAC", "Drapeau vert. Ariane à la radio, on valide les réglages.", 5);
                            derniereSessionAnnoncee = cleVert;
                        }
                        break;
                    case "JAUNE":
                        parler("VOX_JAUNE", "Attention, danger ! Drapeau jaune !", 3);
                        break;
                    case "NOIRCUT":
                        parler("VOX_JAUNE", "Petite Pénalité . attention !", 0);
                        break;
                    case "NOIRCUTPIT":
                        parler("NOIRCUTPIT", "Attention, les commissaires t'ont à l'oeil ! Pénalité pour franchissement de la ligne continue en sortie de pit. Reste concentré, on va perdre du temps sur ce coup-là.", 10);
                        break;
                    case "MEATBALL":
                        parler("MEATBALL", "Drapeau noir et orange ! Rentre au stand immédiatement !", 2);
                        break;
                }
                break;

            case "Qualify":
                switch (alerteID) {
                    case "VERT":
                        if (derniereSessionAnnoncee !== cleVert) {
                            parler("VOX_VERT_QUALY", "La piste est libre. Sylvie au rapport : c'est ton tour.", 9);
                            derniereSessionAnnoncee = cleVert;
                        }
                        break;
                    case "JAUNE":
                        parler("VOX_JAUNE", "Attention, danger ! Drapeau jaune !", 3);
                        break;
                    case "DAMIER":
                        parler("VOX_DAMIER_QUALY", "Drapeau à damier. Fin de la séance.", 9);
                        break;
                    case "QUALIFCASSE":
                        parler("VOX_QUALIFCASSE", "C'est vraiment navrant pour les qualifications. Philippe, il faut la ramener", 2);
                        break;
                    case "NOIRCUT":
                        parler("VOX_CUT", "Faut te concentrer, attention aux pénalités", 10);
                        break;
                    case "DERNIERTOUR":
                        parler("VOX_DERNIERTOUR", "Allez, dernière chance. On est tous derrière toi, donne tout", 5);
                        break;
                    case "MEATBALL":
                        parler("VOX_MEATBALL", "Drapeau noir et orange ! Rentre au stand immédiatement !", 2);
                        break;
                }
                break;

            case "Race":
                switch (alerteID) {
                    case "VERT":
                        if (derniereSessionAnnoncee !== cleVert) {
                            parler("VOX_VERT", "Drapeau vert, en piste !", 3);
                            derniereSessionAnnoncee = cleVert;
                        }
                        break;
                    case "JAUNE":
                        parler("VOX_JAUNE", "Attention, danger ! Drapeau jaune !", 3);
                        break;
                    case "BLEU":
                        parler("VOX_BLEU", "Drapeau bleu, laisse passer.", 6);
                        break;
                    case "DAMIER":
                        parler("VOX_WIN", "Drapeau à damier ! C'est terminé .", 5);
                        break;
                    case "NOIRCUT":
                        parler("VOX_WIN", "Pénalité pour avoir coupé un virage", 0);
                        break;
                    case "MEATBALL":
                        parler("VOX_MEATBALL", "Drapeau noir et orange ! Rentre au stand immédiatement !", 2);
                        break;
                }
                break;
        }
    }
}


/* ==========================================================================
   7. ICÔNES PILOTES
   ========================================================================== */

let driverIcons = {};

async function chargerDriverIcons() {
    try {
        const response = await fetch("data/drivers.json?v=" + Date.now());
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        driverIcons = data.drivers || {};
        console.log("🔄 Driver icons actualisés :", driverIcons);

    } catch (error) {
        console.error("❌ Erreur chargement drivers.json :", error);
    }
}

chargerDriverIcons();
setInterval(chargerDriverIcons, 30000);


/* ==========================================================================
   8. CLASSEMENT
   ========================================================================== */

function hudClassement(donnees) {
    const container = document.getElementById("leaderboard-dynamic-container");
    if (!container || !donnees.Leaderboard) {
        return;
    }

    let html = "";
    const classes = {};

    donnees.Leaderboard.forEach(p => {
        const idCl = p.CarClassID || 0;
        if (!classes[idCl]) {
            classes[idCl] = { nom: p.CarClassShortName, pilotes: [] };
        }
        classes[idCl].pilotes.push(p);
    });

    Object.keys(classes).forEach(id => {
        const cat = classes[id];
        const classIdx = id % 5;
        let pilotesAffiches = [];
        const indexJoueur = cat.pilotes.findIndex(p => p.IsPlayer);

        if (cat.pilotes.length <= 7 || indexJoueur === -1) {
            pilotesAffiches = cat.pilotes.slice(0, 7);
        } else {
            const top3 = cat.pilotes.slice(0, 3);
            const debutAutour = Math.max(0, indexJoueur - 3);
            const finAutour = Math.min(cat.pilotes.length, indexJoueur + 4);
            const autourJoueur = cat.pilotes.slice(debutAutour, finAutour);
            const ensemble = new Set([...top3, ...autourJoueur]);
            pilotesAffiches = Array.from(ensemble);
        }

        html += `
        <div class="capsule-classe">
            <div class="titre-categorie cat-color-${classIdx}" style="color: white !important; text-shadow: 1px 1px 2px #000;">
                ${cat.nom}
            </div>
            <div class="lb-table">`;

        pilotesAffiches.forEach((p, displayIndex) => {
            const driverId = String(p.UserID || "");
            const driverData = driverIcons[driverId];
            const driverIcon = driverData?.icon || "default";

            const rawCarName = p.CarName || "";
            const carNameClean = rawCarName.toLowerCase().replace(/[\s-]/g, "");
            let brandId = "";
            let brandDisplayName = "";

            const brands = [
                ["porsche", "Porsche"], ["ferrari", "Ferrari"], ["bmw", "BMW"], ["mercedes", "Mercedes"],
                ["audi", "Audi"], ["astonmartin", "Aston Martin"], ["mclaren", "McLaren"], ["lamborghini", "Lamborghini"],
                ["cadillac", "Cadillac"], ["acura", "Acura"], ["radical", "Radical"], ["ligier", "Ligier"],
                ["dallara", "Dallara"], ["lexus", "Lexus"], ["caterham", "Caterham"], ["ruf", "RUF"],
                ["pontiac", "Pontiac"], ["kia", "Kia"], ["chevrolet", "Chevrolet"], ["chevy", "Chevrolet"],
                ["ford", "Ford"], ["toyota", "Toyota"], ["buick", "Buick"], ["dodge", "Dodge"],
                ["plymouth", "Plymouth"], ["holden", "Holden"], ["worldofoutlaws", "World of Outlaws"],
                ["outlaw", "World of Outlaws"], ["usac", "USAC"], ["lucasoil", "Lucas Oil"], ["dirt", "Dirt"],
                ["legend", "Legends"], ["subaru", "Subaru"], ["volkswagen", "Volkswagen"], ["vw", "Volkswagen"],
                ["hyundai", "Hyundai"], ["honda", "Honda"], ["nissan", "Nissan"], ["williams", "Williams"],
                ["tatuus", "Tatuus"], ["ray", "Ray FF"], ["skipbarber", "Skip Barber"]
            ];

            for (const [id, name] of brands) {
                if (carNameClean.includes(id)) {
                    brandId = id;
                    brandDisplayName = name;
                    break;
                }
            }

            if (!brandDisplayName && rawCarName !== "---") {
                brandDisplayName = rawCarName.split(" ")[0];
                brandId = brandDisplayName.toLowerCase().replace(/[^a-z0-9]/g, "");
            }

            const ASSETS_VERSION = "1.0";
            const imageUrl = brandId ? `assets/brands/${brandId}.png?v=${ASSETS_VERSION}` : "";

            const lic = (p.LicString || "R").split(" ");
            const country = (p.Country || "").trim();
            const countryFallback = country ? country.substring(0, 2).toUpperCase() : "??";

            const flagHtml = country
                ? `<img class="lb-flag" src="assets/flag/${country}.png" alt="${country}" title="-           ${country}" onerror="if (this.src.indexOf('default.png') === -1) { this.src = 'assets/flag/default.png'; } else { this.style.display='none'; this.nextElementSibling.style.display='inline'; }"><span class="lb-country-fallback" style="display:none;">${countryFallback}</span>`
                : `<img class="lb-flag" src="assets/flag/default.png" alt="${country} " title=" ${country} " onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';"><span class="lb-country-fallback" style="display:none;">??</span>`;

            const posDisplay = p.Position >= 999 ? "-" : p.Position;
            let gainHtml = "";

            if (p.Position < 999) {
                if (p.Gain > 0) {
                    gainHtml = `<span style="color:#00ff00;">▲${p.Gain}</span>`;
                } else if (p.Gain < 0) {
                    gainHtml = `<span style="color:#ff4444;">▼${Math.abs(p.Gain)}</span>`;
                } else {
                    gainHtml = `<span style="color:#666;">0</span>`;
                }
            } else {
                gainHtml = `<span style="color:#666;">-</span>`;
            }

            html += `
            <div class="lb-row ${p.IsPlayer ? "is-me" : ""} ${displayIndex === 3 ? "lb-after-top3" : ""}" ${displayIndex === 3 ? 'style="border-top:2px solid rgba(255,255,255,0.28);margin-top:3px;padding-top:3px;"' : ""}>
                <div class="col-pos" style="background:white;color:black;font-weight:bold;">${posDisplay}</div>
                <div class="col-car" style="color:#aaa;">${p.CarNumber}</div>
                <div class="col-cat-bar cat-color-${classIdx}"></div>
                <div class="col-cars">
                    ${imageUrl ? `<img src="${imageUrl}" alt="${brandDisplayName}" title="${brandDisplayName}" class="car-brand-icon" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';" /><span class="brand-text-fallback">${brandDisplayName}</span>` : `<span class="brand-text-fallback">${brandDisplayName || "---"}</span>`}
                </div>
                <div class="lb-flag-container">${flagHtml}</div>
                <div class="col-name">
                    <div class="name-stack">
                        <span class="driver-name">${p.IsPlayer ? "👉 " : ""}${p.UserName}</span>
                        <span class="car-model-name">${p.CarName}</span>
                    </div>
                </div>
                <div class="col-cars">
                    <img src="data/icons/${driverIcon}.png" class="car-pilote-icon" alt="" />
                </div>
                <div class="col-gain" style="font-weight:bold;font-size:11px;">${gainHtml}</div>
                <div class="col-ir"><span class="badge-ir">${p.IR_Display}</span></div>
                <div class="col-lic"><span class="badge-lic lic-${lic[0][0]}">${lic[0][0]}</span></div>
                <div class="col-sr"><span class="badge-sr lic-${lic[0][0]}">${lic[1] || ""}</span></div>
                <div class="col-gap" style="color:#ffcc00;">${p.Gap}</div>
                <div class="col-gap" style="color:#ff9800;">${p.GapInt}</div>
                <div class="col-time chrono-fluo-${classIdx}">${p.LastLapTime || "--:--.---"}</div>
                <div class="col-time chrono-best-${classIdx}">${p.BestLapTime || "--:--.---"}</div>
            </div>`;
        });

        html += `</div></div>`;
    });

    container.innerHTML = html;

    /* LOGIQUE VOCALE INTÉGRÉE */
    const now = Date.now();
    const joueur = donnees.Leaderboard.find(p => p.IsPlayer);

    if (!joueur || donnees.sessionType !== "Race") {
        return;
    }

    const maPos = parseInt(joueur.Position);

    if (window.MemoireClassement.posPrecedente !== null && maPos !== window.MemoireClassement.posPrecedente) {
        const diff = window.MemoireClassement.posPrecedente - maPos;

        if (diff >= 3) {
            parler("RACE_HUGE_GAIN", `Ariane : Énorme ! On vient de gagner ${diff} places. On est P${maPos} !`, 5);
        } else if (diff > 0) {
            parler("RACE_GAIN", `Ariane : Belle manœuvre, on prend la P${maPos}.`, 5);
        } else if (diff <= -3) {
            parler("RACE_HUGE_LOSS", `Denise : On a perdu ${Math.abs(diff)} positions. Garde ton calme, rien n'est fini.`, 0);
        } else if (diff < 0) {
            parler("RACE_LOSS", `Denise : Une place de perdue. On redescend P${maPos}.`, 0);
        }

        window.MemoireClassement.posPrecedente = maPos;
    }

    /* DUELS */
    const devant = donnees.Leaderboard.find(p => p.Position === maPos - 1);
    const derriere = donnees.Leaderboard.find(p => p.Position === maPos + 1);

    if (now - (window.MemoireTactique.dernierDuel || 0) > 120000) {
        if (devant && devant.GapInt_raw < 0.7) {
            parler("RACE_HUNT", `Remy : On est sur ses talons. Écart ${devant.GapInt_raw.toFixed(1)}s. Attaque !`, 6);
            window.MemoireTactique.dernierDuel = now;
        } else if (derriere && derriere.GapInt_raw < 0.6) {
            parler("RACE_DEFEND", `Remy : Danger derrière. Il est à ${derriere.GapInt_raw.toFixed(1)}s. Protège ta ligne.`, 6);
            window.MemoireTactique.dernierDuel = now;
        }
    }

    /* FIN DE COURSE */
    const flag = donnees.flags || "";
    if (flag.includes("Checkered") && !window.MemoireTactique.vocalFinCourse) {
        if (maPos === 1) {
            parler("RACE_WIN", "Ariane : P 1 ! Victoire ! Quelle performance magistrale aujourd'hui !", 5);
        } else if (maPos <= 3) {
            parler("RACE_PODIUM", `Ariane : Podium ! On termine P${maPos}. C'est un superbe résultat pour l'équipe.`, 5);
        } else if (maPos <= 10) {
            parler("RACE_TOP10", `Remy : On finit P${maPos}. C'est dans le Top 10, l'objectif est rempli.`, 6);
        } else {
            parler("RACE_FINISH", `Denise : Drapeau à damier. On termine P${maPos}. On range la voiture.`, 0);
        }

        window.MemoireTactique.vocalFinCourse = true;
    }
}


/* ==========================================================================
   9. RELATIF
   ========================================================================== */

function hudRelatif(donnees) {
    const container = document.getElementById("relative-drivers-list");

    if (!container || !donnees.Relative) {
        return;
    }

    let html = '<div class="lb-table">';

    donnees.Relative.forEach(p => {

        const classIdx = p.CarClassID % 5;
        const lic = (p.LicString || "R").split(" ");

        const posDisplay =
            p.Position >= 999
                ? "-"
                : p.Position;

        /*
         * RELATIF
         * --------------------------------------------------------------
         * On affiche l'écart avec le joueur.
         *
         * SELF = joueur
         * Les autres = GapRelat
         */

        let gapDisplay = "---";

        if (p.IsPlayer) {
            gapDisplay = "SELF";
        } else if (
            p.GapRelat !== undefined &&
            p.GapRelat !== null &&
            p.GapRelat !== ""
        ) {
            gapDisplay = p.GapRelat;
        }

        /*
         * GAIN DE POSITION
         */

        let gainDisplay = "";

        if (
            !p.IsPlayer &&
            typeof p.Gain === "number" &&
            p.Gain !== 0
        ) {
            gainDisplay =
                p.Gain > 0
                    ? `+${p.Gain}`
                    : `${p.Gain}`;
        }

        /*
         * NOM DU PILOTE
         */

        const driverName =
            p.UserName || "---";

        /*
         * NUMERO DE VOITURE
         */

        const carNumber =
            p.CarNumber !== undefined
                ? p.CarNumber
                : "---";

        /*
         * DERNIER CHRONO
         */

        const lastLap =
            p.LastLapTime ||
            "--:--.---";

        /*
         * IRATING
         */

        const irDisplay =
            p.IR_Display || "IA";

        /*
         * LICENCE
         */

        const licLetter =
            lic[0]
                ? lic[0][0]
                : "R";

        const srValue =
            lic[1] || "";

        html += `
        <div class="lb-row relative-row ${p.IsPlayer ? "is-me" : ""}">

            <div
                class="col-pos"
                style="background:white;color:black;font-weight:bold;"
            >
                ${posDisplay}
            </div>

            <div
                class="col-car"
                style="color:#aaa;"
            >
                ${carNumber}
            </div>

            <div
                class="col-cat-bar cat-color-${classIdx}"
            ></div>

            <div class="col-name">
                ${driverName}
            </div>

            <div class="col-gain">
                ${gainDisplay}
            </div>

            <div class="col-ir">
                <span class="badge-ir">
                    ${irDisplay}
                </span>
            </div>

            <div class="col-lic">
                <span class="badge-lic lic-${licLetter}">
                    ${licLetter}
                </span>
            </div>

            <div class="col-sr">
                <span class="badge-sr lic-${licLetter}">
                    ${srValue}
                </span>
            </div>

            <div
                class="col-gap"
                style="
                    grid-column:span 2;
                    color:white;
                    text-align:right;
                    padding-right:15px;
                "
            >
                ${gapDisplay}
            </div>

            <div
                class="col-time chrono-fluo-${classIdx}"
            >
                ${lastLap}
            </div>

        </div>`;
    });

    container.innerHTML =
        html + "</div>";


    /* ======================================================================
       LOGIQUE VOCALE
       ====================================================================== */

    if (!donnees.speed || donnees.speed < 40) {
        return;
    }

    const now = Date.now();

    const sessionActive =
        donnees.sessionType || "Practice";

    const myIndex =
        donnees.Relative.findIndex(
            p => p.IsPlayer
        );

    if (myIndex === -1) {
        return;
    }

    const moi =
        donnees.Relative[myIndex];

    const devant =
        donnees.Relative[myIndex - 1];

    const delta =
        parseFloat(
            donnees.delta_raw || 0
        );

    const currentLap =
        donnees.lap || 0;


    /* ======================================================================
       MEMOIRE DU TOUR
       ====================================================================== */

    if (
        currentLap >
        window.MemoireTactique.tourMessage
    ) {
        window.MemoireTactique.tourMessage =
            currentLap;

        window.MemoireTactique.etatDelta =
            0;
    }


    /* ======================================================================
       CHRONO VALIDE
       ====================================================================== */

    const aUnChronoValide =
        (
            moi.LastLapTime_raw &&
            moi.LastLapTime_raw > 0
        );


    /* ======================================================================
       DELTA > 1 SECONDE
       ====================================================================== */

    if (
        sessionActive === "Practice" &&
        aUnChronoValide &&
        window.MemoireTactique.etatDelta === 0
    ) {

        if (delta <= -1.0) {

            const msgsAriane = [
                "Focus ! On a plus d'une seconde d'avance. Reste sur les rails, ce tour est historique !",
                "Le delta est magnifique, plus d'une seconde d'avance. Ne change rien, trajectoires tendues !",
                "C'est le tour de la semaine ! On survole la piste là, reste fluide !",
                "Regarde-moi ce chrono ! Plus d'une seconde d'avance. Respire, c'est ton tour !"
            ];

            parler(
                "DELTA_GOD",
                msgsAriane[
                    Math.floor(
                        Math.random() *
                        msgsAriane.length
                    )
                ],
                5
            );

            window.MemoireTactique.etatDelta =
                1;
        }
    }


    /* ======================================================================
       DELTA TECHNIQUE
       ====================================================================== */

    if (
        sessionActive === "Practice" &&
        delta < -0.3 &&
        delta > -0.6 &&
        aUnChronoValide
    ) {

        if (
            now -
            window.MemoireTactique.dernierGerard
            > 240000
        ) {

            const msgsGerard = [
                "On gagne du temps de manière constante dans ce secteur. Continue sur cette ligne.",
                "Les relevés sont bons. Tu améliores tes sorties de virage, le delta est au vert."
            ];

            parler(
                "DELTA_TECH",
                msgsGerard[
                    Math.floor(
                        Math.random() *
                        msgsGerard.length
                    )
                ],
                4
            );

            window.MemoireTactique.dernierGerard =
                now;
        }
    }


    /* ======================================================================
       PILOTE DEVANT
       ====================================================================== */

    if (
        devant &&
        devant.UserName !== "OFF TRACK"
    ) {

        const gap =
            parseFloat(
                devant.GapRelat
            );

        const memeCategorie =
            devant.CarClassID ===
            moi.CarClassID;


        /* ------------------------------------------------------------------
           CIBLE PRACTICE
           ------------------------------------------------------------------ */

        if (
            sessionActive === "Practice" &&
            memeCategorie &&
            gap < 3.0 &&
            gap > 0.8
        ) {

            if (
                now -
                MemoireRelatif.lastTimeAnalyse
                > 120000
            ) {

                parler(
                    "PRAC_TARGET",
                    `Cible en vue : ${devant.UserName} est ton lièvre. Accroche-toi !`,
                    6
                );

                MemoireRelatif.lastTimeAnalyse =
                    now;
            }
        }


        /* ------------------------------------------------------------------
           PILOTE TRES PROCHE
           ------------------------------------------------------------------ */

        if (
            gap < 0.3 &&
            now -
            MemoireRelatif.lastTimeConseille
            > 180000
        ) {

            parler(
                "PRAC_COOL",
                "Tu es dans ses échappements. Garde de l'espace.",
                5
            );

            MemoireRelatif.lastTimeConseille =
                now;
        }
    }


    /* ======================================================================
       POSITION
       ====================================================================== */

    const maPosition =
        donnees.Position || 0;


    /* ======================================================================
       PODIUM
       ====================================================================== */

    if (
        now -
        window.MemoireTactique.dernierVocalPodium
        > 300000
    ) {

        if (maPosition === 1) {

            parler(
                "POLE",
                "Incroyable ! On vient de prendre la pole position ! T'es le patron.",
                5
            );

            window.MemoireTactique.dernierVocalPodium =
                now;

        } else if (
            maPosition > 1 &&
            maPosition <= 3
        ) {

            parler(
                "PODIUM",
                `On tient le podium ! P${maPosition} au classement. Reste concentré.`,
                6
            );

            window.MemoireTactique.dernierVocalPodium =
                now;
        }
    }


    /* ======================================================================
       MEILLEUR CHRONO
       ====================================================================== */

    const monBestLap =
        moi.BestLapTime_raw || 0;


    /* ======================================================================
       PREMIER CHRONO
       ====================================================================== */

    if (
        sessionActive === "Practice" &&
        aUnChronoValide &&
        !window.MemoireTactique.premierChronoFait
    ) {

        const msgsEloiseFirst = [
            "Premier chrono enregistré. C'est une bonne base de travail, on va pouvoir affiner maintenant.",
            "Le premier temps de référence est tombé. On a une base, voyons où on peut gratter des dixièmes.",
            "C'est validé. Premier tour propre, le chrono est dans la boîte."
        ];

        parler(
            "FIRST_LAP",
            msgsEloiseFirst[
                Math.floor(
                    Math.random() *
                    msgsEloiseFirst.length
                )
            ],
            7
        );

        window.MemoireTactique.premierChronoFait =
            true;
    }


    /* ======================================================================
       NOUVEAU BEST LAP
       ====================================================================== */

    if (
        aUnChronoValide &&
        (
            sessionActive === "Practice" ||
            sessionActive === "Race"
        )
    ) {

        if (
            moi.LastLapTime_raw ===
            monBestLap &&
            monBestLap > 0 &&
            window.MemoireTactique.tourBestAnnonce !==
            currentLap
        ) {

            const msgsEloiseBest = [
                "Nouveau record personnel ! On améliore encore, la voiture est parfaitement exploitée.",
                "C'est ton meilleur tour en piste ! Ton rythme est excellent, continue sur cette lancée.",
                "Record battu ! Les data sont formelles : tu es plus rapide que jamais aujourd'hui."
            ];

            parler(
                "BEST_LAP",
                msgsEloiseBest[
                    Math.floor(
                        Math.random() *
                        msgsEloiseBest.length
                    )
                ],
                9
            );

            window.MemoireTactique.tourBestAnnonce =
                currentLap;
        }
    }
}

/* ==========================================================================
   10. MÉTÉO
   ========================================================================== */

function hudMeteo(data) {
    if (!data) return;

    if (document.getElementById("val-temp")) {
        document.getElementById("val-temp").textContent = data.air_temp.toFixed(1);
    }

    if (document.getElementById("val-piste-temp")) {
        document.getElementById("val-piste-temp").textContent = data.track_temp.toFixed(1);

        const jaugePiste = document.getElementById("jauge-piste");
        if (jaugePiste) {
            const trackPct = (data.track_temp / 60) * 100;
            jaugePiste.style.height = Math.min(Math.max(trackPct, 0), 100) + "%";
        }
    }

    if (document.getElementById("val-humidite")) {
        document.getElementById("val-humidite").textContent = data.humidity_pct;
    }

    if (document.getElementById("val-vent-vitesse")) {
        document.getElementById("val-vent-vitesse").textContent = Math.round(data.wind_vel * 3.6);
    }

    const iconDir = document.getElementById("icone-direction");
    if (iconDir) {
        iconDir.style.transform = `rotate(${data.wind_dir}deg)`;
    }

    const elRainIcon = document.getElementById("icone-pluie");
    if (elRainIcon) {
        const rainIntensity = data.rain_intensity_pct || 0;
        if (rainIntensity === 0) {
            elRainIcon.textContent = "🌞";
            elRainIcon.style.color = "#ffca28";
        } else if (rainIntensity <= 30) {
            elRainIcon.textContent = "🌤️";
            elRainIcon.style.color = "#ffffff";
        } else {
            elRainIcon.textContent = "🌧️";
            elRainIcon.style.color = "#00f2ff";
        }
    }

    const session = Tactique.sessionType || "Practice";
    const pluie = data.rain_intensity_pct || 0;
    const vent = data.wind_vel * 3.6;

    if ((session === "Practice" || session === "Race") && MemoireMeteo.pisteTemp !== null) {
        const delta = data.track_temp - MemoireMeteo.pisteTemp;

        if (delta >= 2) {
            parler("METEO_CHAUD", "La piste chauffe rapidement.", 1);
            MemoireMeteo.pisteTemp = data.track_temp;
        } else if (delta <= -2) {
            parler("METEO_FROID", "La piste refroidit rapidement.", 1);
            MemoireMeteo.pisteTemp = data.track_temp;
        }
    }

    if (pluie > 0 && MemoireMeteo.pluie === 0) {
        parler("PLUIE_DEBUT", "La pluie arrive sur le circuit.", 1);
    }

    if (pluie === 0 && MemoireMeteo.pluie > 0) {
        parler("PLUIE_FIN", "La pluie s'arrête, la piste va sécher.", 1);
    }

    MemoireMeteo.pluie = pluie;

    if (session === "Race" && vent > 35 && MemoireMeteo.vent <= 35) {
        parler("VENT_FORT", "Vent fort sur le circuit, attention.", 1);
    }

    MemoireMeteo.vent = vent;
}


/* ==========================================================================
   11. PISTE / STRATÉGIE
   ========================================================================== */

function hudPiste(data) {
    if (!data) return;

    const now = Date.now();

    if (window.MemoireTactique.dernierFuelVocal === undefined) window.MemoireTactique.dernierFuelVocal = 0;
    if (window.MemoireTactique.dernierGerardPiste === undefined) window.MemoireTactique.dernierGerardPiste = 0;
    if (window.MemoireTactique.lastIncCount === undefined) window.MemoireTactique.lastIncCount = 0;
    if (window.MemoireTactique.dernierVocalPhysio === undefined) window.MemoireTactique.dernierVocalPhysio = 0;

    /* CARBURANT */
    const elCons = document.getElementById("strat-fuel-last");
    const elLapsEst = document.getElementById("strat-fuel-laps");

    if (data.fuel_last_lap !== undefined) {
        if (elCons) {
            elCons.textContent = data.fuel_last_lap > 0 ? data.fuel_last_lap.toFixed(3) : "-.---";
        }

        if (elLapsEst) {
            const toursRestants = data.fuel_laps_est || 0;

            if (toursRestants > 0) {
                elLapsEst.textContent = toursRestants.toFixed(1);

                if (toursRestants < 2) {
                    elLapsEst.style.color = "#ff0000";
                    elLapsEst.classList.add("blink-fast");
                } else {
                    elLapsEst.style.color = "#fff";
                    elLapsEst.classList.remove("blink-fast");
                }

                if (now - window.MemoireTactique.dernierFuelVocal > 300000) {
                    if (toursRestants < 1.2) {
                        parler("FUEL_EMERGENCY", "C'est le dernier tour ! Rentre maintenant ou on finit à pied !", 2);
                        window.MemoireTactique.dernierFuelVocal = now;
                    } else if (data.fuel_avg > 0 && data.fuel_last_lap > (data.fuel_avg * 1.08)) {
                        parler("FUEL_BURN", "ici Antoine. On consomme trop sur ce run. Lève un peu le pied.", 2);
                        window.MemoireTactique.dernierFuelVocal = now;
                    }
                }
            } else {
                elLapsEst.textContent = "--";
            }
        }
    }

    /* JAUGE FUEL */
    const jFuel = document.getElementById("strat-fuel-bar");
    if (jFuel && data.fuel_pct !== undefined) {
        const pct = data.fuel_pct * 100;
        jFuel.style.height = Math.min(pct, 100) + "%";
    }

    /* CHRONOS */
    let monInfo = null;
    if (data.Leaderboard) {
        monInfo = data.Leaderboard.find(p => p.IsPlayer === true);
    }

    if (monInfo) {
        const elLast = document.getElementById("strat-last-lap");
        const elBest = document.getElementById("strat-best-lap");

        if (elLast) elLast.textContent = monInfo.LastLapTime || "--:--.---";
        if (elBest) elBest.textContent = monInfo.BestLapTime || "--:--.---";

        if (data.leader_best_lap > 0 && monInfo.BestLapTime_raw > 0 && now - window.MemoireTactique.dernierGerardPiste > 600000) {
            const diff = (monInfo.BestLapTime_raw - data.leader_best_lap).toFixed(3);
            if (diff > 0.6) {
                parler("PERF_GAP", `ici Gérard. On rend ${diff} au leader sur le meilleur tour. Travaille tes entrées de virage.`, 4);
                window.MemoireTactique.dernierGerardPiste = now;
            }
        }
    }

    /* INCIDENTS */
    const elInc = document.getElementById("strat-incidents");
    const inc = Number(data.incidents) || 0;

    if (elInc) {
        elInc.textContent = inc;
        if (inc > window.MemoireTactique.lastIncCount) {
            if ((inc - window.MemoireTactique.lastIncCount) >= 2) {
                parler("INC_DANGER", "ici Denise. On accumule trop d'incidents. Reste entre les lignes blanches.", 0);
            }
            window.MemoireTactique.lastIncCount = inc;
        }
    }

    /* JOKER */
    const labelJoker = document.getElementById("strat-joker-status");
    const blocJoker = document.getElementById("bloc-joker");

    if (labelJoker) {
        if (data.joker_state) {
            labelJoker.textContent = "NEEDED";
            if (blocJoker) blocJoker.classList.add("vibrate");
        } else {
            labelJoker.textContent = "DONE";
            if (blocJoker) blocJoker.classList.remove("vibrate");
        }
    }

    /* SESSION */
    if (document.getElementById("strat-lap-current")) {
        document.getElementById("strat-lap-current").textContent = data.lap || "--";
    }

    if (document.getElementById("strat-lap-total")) {
        document.getElementById("strat-lap-total").textContent = data.lap_total || "--";
    }

    if (document.getElementById("strat-session-time")) {
        document.getElementById("strat-session-time").textContent = data.session_time_str || "--:--:--";
    }

    /* FATIGUE */
    if (data.avg_lap_raw > 0 && data.last_lap_raw > (data.avg_lap_raw + 2.0) && now - window.MemoireTactique.dernierVocalPhysio > 900000) {
        parler("PHYSIO_ALERT", "Eloïse ici. Ton rythme chute, bois un peu et relaxe tes mains sur le volant.", 7);
        window.MemoireTactique.dernierVocalPhysio = now;
    }
}


/* ==========================================================================
   12. PERFORMANCE
   ========================================================================== */

let ÉLÉMENTS_HUD = {};

function initialiserElements() {
    ÉLÉMENTS_HUD = {
        vitesse: document.getElementById("perf-vitesse"),
        gear: document.getElementById("perf-gear"),
        rpmBar: document.getElementById("perf-rpm-bar"),
        deltaVal: document.getElementById("perf-delta-val"),
        deltaBar: document.getElementById("perf-delta-bar"),
        throttle: document.getElementById("input-throttle"),
        brake: document.getElementById("input-brake"),
        clutch: document.getElementById("input-clutch")
    };
}

function hudPerformance(data) {
    if (!data || !ÉLÉMENTS_HUD.vitesse) {
        return;
    }

    /* Vitesse */
    ÉLÉMENTS_HUD.vitesse.textContent = data.speed;

    /* Gear */
    if (ÉLÉMENTS_HUD.gear) {
        const g = data.gear;
        ÉLÉMENTS_HUD.gear.textContent = g === 0 ? "N" : (g === -1 ? "R" : g);
    }

    /* RPM */
    if (ÉLÉMENTS_HUD.rpmBar) {
        ÉLÉMENTS_HUD.rpmBar.style.width = (data.rpm_pct * 100) + "%";
    }

    /* DELTA */
    if (ÉLÉMENTS_HUD.deltaVal && ÉLÉMENTS_HUD.deltaBar) {
        ÉLÉMENTS_HUD.deltaVal.textContent = data.delta_format;

        const color = data.delta_raw <= 0 ? "#10b981" : "#ef4444";
        ÉLÉMENTS_HUD.deltaVal.style.color = color;
        ÉLÉMENTS_HUD.deltaBar.style.backgroundColor = color;

        const largeur = Math.min(Math.abs(data.delta_raw), 1) * 50;
        ÉLÉMENTS_HUD.deltaBar.style.width = largeur + "%";
        ÉLÉMENTS_HUD.deltaBar.style.left = data.delta_raw <= 0 ? (50 - largeur) + "%" : "50%";
    }

    /* Pédales */
    if (ÉLÉMENTS_HUD.throttle) {
        ÉLÉMENTS_HUD.throttle.style.height = (data.throttle * 100) + "%";
    }
    if (ÉLÉMENTS_HUD.brake) {
        ÉLÉMENTS_HUD.brake.style.height = (data.brake * 100) + "%";
    }
    if (ÉLÉMENTS_HUD.clutch) {
        ÉLÉMENTS_HUD.clutch.style.height = (data.clutch * 100) + "%";
    }
}


/* ==========================================================================
   13. INITIALISATION UNIQUE
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
    applyVisibility();
    initialiserElements();
    connecter();
    requestAnimationFrame(updateLoop);
}, { once: true });