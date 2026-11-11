/* Radio Team : déclencheurs conservés du projet principal, isolés du HUD. */
const API_WS_URL = "ws://127.0.0.1:8000/ws";
const voicePort = new URLSearchParams(window.location.search).get("voicePort") || "5000";
const VOICE_URL = `http://127.0.0.1:${voicePort}`;

const TEAM = {
    0: { name: "Denise Martin", department: "Piste", role: "Directeur de course", image: "Denise.png" },
    1: { name: "Henri Dubois", department: "Météo", role: "Ingénieur météo", image: "Henri.png" },
    2: { name: "Antoine Roux", department: "Voiture", role: "Chef mécanicien", image: "Antoine.png" },
    3: { name: "Vivienne Martin", department: "Drapeaux", role: "Officiel signaux", image: "Vivienne.png" },
    4: { name: "Gerard Petit", department: "Performance", role: "Analyste télémétrie", image: "Gerard.png" },
    5: { name: "Ariane Lambert", department: "Classement", role: "Stratège timing", image: "Ariane.png" },
    6: { name: "Remy Fontaine", department: "Relatifs", role: "Gestion trafic", image: "Remy.png" },
    7: { name: "Eloise Morel", department: "Physio", role: "Coach santé", image: "Eloise.png" },
    8: { name: "Charline Durand", department: "Stratégie", role: "Planification arrêts", image: "Charline.png" },
    9: { name: "Sylvie Vasseur", department: "Mental", role: "Préparateur mental", image: "Sylvie.png" },
    10: { name: "Thierry Lefebvre", department: "Spotter", role: "Observateur piste", image: "Thierry.png" },
    11: { name: "Fabrice Dubois", department: "Carburant", role: "Ingénieur consommation", image: "Fabrice.png" }
};

const state = {
    socket: null,
    reconnectTimer: null,
    sessionKey: null,
    queue: [],
    isTalking: false,
    lastAlert: "",
    lastFlag: null,
    lastGreenAnnouncement: "",
    previousPosition: null,
    lastDuel: 0,
    finishAnnounced: false,
    lastLap: 0,
    deltaState: 0,
    lastGerard: 0,
    lastTarget: 0,
    lastAdvice: 0,
    lastPodium: 0,
    firstLapAnnounced: false,
    bestLapAnnounced: null,
    trackTemp: null,
    rain: 0,
    wind: 0,
    lastFuel: 0,
    lastTrackAnalysis: 0,
    lastIncidentCount: 0,
    lastPhysio: 0,
    lastFlagsCheck: 0,
    lastTacticsCheck: 0,
    lastLeaderboardCheck: 0,
    lastTrackCheck: 0
};

const panel = document.getElementById("team-panel");
const messageEl = document.getElementById("team-message");
const connectionEl = document.getElementById("connection");
let telemetryConnected = false;
let voiceConnected = false;

function renderConnection() {
    if (!telemetryConnected) setConnection("TÉLÉMÉTRIE HORS LIGNE", "error");
    else if (!voiceConnected) setConnection("TÉLÉMÉTRIE OK · VOIX HORS LIGNE", "error");
    else setConnection("TÉLÉMÉTRIE · VOIX OK", "connected");
}

async function checkVoiceStatus() {
    try {
        const response = await fetch(`${VOICE_URL}/status`, { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const status = await response.json();
        voiceConnected = status.ready === true && !status.error;
        if (!voiceConnected && status.error) console.error("Audio Team indisponible:", status.error);
    } catch (error) {
        voiceConnected = false;
        console.error("Serveur vocal inaccessible:", error);
    }
    renderConnection();
}

function setConnection(text, className = "") {
    connectionEl.textContent = text;
    connectionEl.className = `connection ${className}`;
}

function announce(id, text, voiceIndex = 1) {
    if (id === state.lastAlert) return;
    state.lastAlert = id;
    state.queue.push({ id, text, voiceIndex });
    if (!state.isTalking) processNextMessage();
}

async function processNextMessage() {
    if (!state.queue.length) {
        state.isTalking = false;
        return;
    }

    state.isTalking = true;
    const msg = state.queue.shift();
    const expert = TEAM[msg.voiceIndex] || TEAM[1];
    const expertImage = document.getElementById("expert-image");
    expertImage.onerror = () => {
        expertImage.onerror = null;
        expertImage.src = "assets/team/Antoine.png";
    };
    expertImage.src = `assets/team/${expert.image}`;
    document.getElementById("expert-name").textContent = expert.name.toUpperCase();
    document.getElementById("expert-department").textContent = expert.department;
    document.getElementById("expert-role").textContent = expert.role;
    messageEl.textContent = msg.text;
    panel.classList.add("active");

    try {
        const response = await fetch(`${VOICE_URL}/speak`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: msg.text, voice_index: msg.voiceIndex })
        });
        if (!response.ok) throw new Error(`Serveur vocal : HTTP ${response.status}`);
        await waitForSpeechEnd();
        await new Promise(resolve => setTimeout(resolve, 800));
    } catch (error) {
        console.error("Erreur Radio Team:", error);
        voiceConnected = false;
        renderConnection();
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    processNextMessage();
}

function queueVoiceTest() {
    announce(`VOICE_TEST_${Date.now()}`, "Test audio Team. Si tu entends ce message, la voix fonctionne.", 1);
}

async function waitForSpeechEnd() {
    const deadline = Date.now() + 120000;
    let started = false;
    while (Date.now() < deadline) {
        try {
            const response = await fetch(`${VOICE_URL}/status`);
            const status = await response.json();
            if (!status.ready) throw new Error(status.error || "Moteur audio indisponible");
            if (status.error) throw new Error(status.error);
            if (status.playing) started = true;
            else if (started) return;
        } catch (error) {
            throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 200));
    }
}

function resetSessionState() {
    state.lastAlert = "";
    state.lastFlag = null;
    state.lastGreenAnnouncement = "";
    state.previousPosition = null;
    state.lastDuel = 0;
    state.finishAnnounced = false;
    state.lastLap = 0;
    state.deltaState = 0;
    state.lastGerard = 0;
    state.lastTarget = 0;
    state.lastAdvice = 0;
    state.lastPodium = 0;
    state.firstLapAnnounced = false;
    state.bestLapAnnounced = null;
    state.trackTemp = null;
    state.rain = 0;
    state.wind = 0;
    state.lastFuel = 0;
    state.lastTrackAnalysis = 0;
    state.lastIncidentCount = 0;
    state.lastPhysio = 0;
}

function sessionInfo(data) {
    const sessionNum = Number(data.session_num ?? data.SessionNum ?? 0);
    const sessionType = data.session_type || data.sessionType || data.SessionType || "Practice";
    const sessionKey = [data.session_unique_id ?? data.session_id ?? "", sessionNum,
        sessionType, data.session_generation ?? ""].join("|");
    if (state.sessionKey !== null && state.sessionKey !== sessionKey) resetSessionState();
    state.sessionKey = sessionKey;
    return { sessionNum, sessionType };
}

function checkFlags(data, session) {
    const rawFlags = data.flags ?? data.flag ?? "None";
    const flags = (Array.isArray(rawFlags) ? rawFlags : [rawFlags]).map(flag => String(flag).toUpperCase().trim());
    const alertId = flags[flags.length - 1] || "NONE";
    if (alertId === state.lastFlag) return;
    state.lastFlag = alertId;

    const greenKey = `${session.sessionNum}-VERT`;
    if (session.sessionNum === 0 || session.sessionType === "Practice") {
        if (alertId === "VERT" && state.lastGreenAnnouncement !== greenKey) {
            announce("VOX_VERT_PRAC", "Drapeau vert. Ariane à la radio, on valide les réglages.", 5);
            state.lastGreenAnnouncement = greenKey;
        } else if (alertId === "JAUNE") announce("VOX_JAUNE", "Attention, danger ! Drapeau jaune !", 3);
        else if (alertId === "NOIRCUT") announce("VOX_JAUNE", "Petite Pénalité . attention !", 0);
        else if (alertId === "NOIRCUTPIT") announce("NOIRCUTPIT", "Attention, les commissaires t'ont à l'oeil ! Pénalité pour franchissement de la ligne continue en sortie de pit. Reste concentré, on va perdre du temps sur ce coup-là.", 10);
        else if (alertId === "MEATBALL") announce("MEATBALL", "Drapeau noir et orange ! Rentre au stand immédiatement !", 2);
        return;
    }

    if (session.sessionNum === 1 || session.sessionType === "Qualify") {
        if (alertId === "VERT" && state.lastGreenAnnouncement !== greenKey) {
            announce("VOX_VERT_QUALY", "La piste est libre. Sylvie au rapport : c'est ton tour.", 9);
            state.lastGreenAnnouncement = greenKey;
        } else if (alertId === "JAUNE") announce("VOX_JAUNE", "Attention, danger ! Drapeau jaune !", 3);
        else if (alertId === "DAMIER") announce("VOX_DAMIER_QUALY", "Drapeau à damier. Fin de la séance.", 9);
        else if (alertId === "QUALIFCASSE") announce("VOX_QUALIFCASSE", "C'est vraiment navrant pour les qualifications. Philippe, il faut la ramener", 2);
        else if (alertId === "NOIRCUT") announce("VOX_CUT", "Faut te concentrer, attention aux pénalités", 10);
        else if (alertId === "DERNIERTOUR") announce("VOX_DERNIERTOUR", "Allez, dernière chance. On est tous derrière toi, donne tout", 5);
        else if (alertId === "MEATBALL") announce("VOX_MEATBALL", "Drapeau noir et orange ! Rentre au stand immédiatement !", 2);
        return;
    }

    if (session.sessionType === "Race") {
        if (alertId === "VERT" && state.lastGreenAnnouncement !== greenKey) {
            announce("VOX_VERT", "Drapeau vert, en piste !", 3);
            state.lastGreenAnnouncement = greenKey;
        } else if (alertId === "JAUNE") announce("VOX_JAUNE", "Attention, danger ! Drapeau jaune !", 3);
        else if (alertId === "BLEU") announce("VOX_BLEU", "Drapeau bleu, laisse passer.", 6);
        else if (alertId === "DAMIER") announce("VOX_WIN", "Drapeau à damier ! C'est terminé .", 5);
        else if (alertId === "NOIRCUT") announce("VOX_WIN", "Pénalité pour avoir coupé un virage", 0);
        else if (alertId === "MEATBALL") announce("VOX_MEATBALL", "Drapeau noir et orange ! Rentre au stand immédiatement !", 2);
    }
}

function checkLeaderboard(data, now) {
    if (!Array.isArray(data.Leaderboard) || data.sessionType !== "Race") return;
    const player = data.Leaderboard.find(driver => driver.IsPlayer);
    if (!player) return;
    const position = parseInt(player.Position, 10);

    if (state.previousPosition !== null && position !== state.previousPosition) {
        const diff = state.previousPosition - position;
        if (diff >= 3) announce("RACE_HUGE_GAIN", `Ariane : Énorme ! On vient de gagner ${diff} places. On est P${position} !`, 5);
        else if (diff > 0) announce("RACE_GAIN", `Ariane : Belle manœuvre, on prend la P${position}.`, 5);
        else if (diff <= -3) announce("RACE_HUGE_LOSS", `Denise : On a perdu ${Math.abs(diff)} positions. Garde ton calme, rien n'est fini.`, 0);
        else if (diff < 0) announce("RACE_LOSS", `Denise : Une place de perdue. On redescend P${position}.`, 0);
    }

    const ahead = data.Leaderboard.find(driver => driver.Position === position - 1);
    const behind = data.Leaderboard.find(driver => driver.Position === position + 1);
    if (now - state.lastDuel > 120000) {
        if (ahead && ahead.GapInt_raw < 0.7) {
            announce("RACE_HUNT", `Remy : On est sur ses talons. Écart ${ahead.GapInt_raw.toFixed(1)}s. Attaque !`, 6);
            state.lastDuel = now;
        } else if (behind && behind.GapInt_raw < 0.6) {
            announce("RACE_DEFEND", `Remy : Danger derrière. Il est à ${behind.GapInt_raw.toFixed(1)}s. Protège ta ligne.`, 6);
            state.lastDuel = now;
        }
    }

    const flags = data.flags || "";
    if (flags.includes("Checkered") && !state.finishAnnounced) {
        if (position === 1) announce("RACE_WIN", "Ariane : P 1 ! Victoire ! Quelle performance magistrale aujourd'hui !", 5);
        else if (position <= 3) announce("RACE_PODIUM", `Ariane : Podium ! On termine P${position}. C'est un superbe résultat pour l'équipe.`, 5);
        else if (position <= 10) announce("RACE_TOP10", `Remy : On finit P${position}. C'est dans le Top 10, l'objectif est rempli.`, 6);
        else announce("RACE_FINISH", `Denise : Drapeau à damier. On termine P${position}. On range la voiture.`, 0);
        state.finishAnnounced = true;
    }
}

function randomFrom(items) { return items[Math.floor(Math.random() * items.length)]; }

function checkRelative(data, now) {
    if (!data.speed || data.speed < 40 || !Array.isArray(data.Relative)) return;
    const myIndex = data.Relative.findIndex(driver => driver.IsPlayer);
    if (myIndex < 0) return;
    const me = data.Relative[myIndex];
    const ahead = data.Relative[myIndex - 1];
    const sessionActive = data.sessionType || "Practice";
    const delta = parseFloat(data.delta_raw || 0);
    const currentLap = data.lap || 0;
    if (currentLap > state.lastLap) { state.lastLap = currentLap; state.deltaState = 0; }
    const validLap = me.LastLapTime_raw && me.LastLapTime_raw > 0;

    if (sessionActive === "Practice" && validLap && state.deltaState === 0 && delta <= -1.0) {
        announce("DELTA_GOD", randomFrom([
            "Focus ! On a plus d'une seconde d'avance. Reste sur les rails, ce tour est historique !",
            "Le delta est magnifique, plus d'une seconde d'avance. Ne change rien, trajectoires tendues !",
            "C'est le tour de la semaine ! On survole la piste là, reste fluide !",
            "Regarde-moi ce chrono ! Plus d'une seconde d'avance. Respire, c'est ton tour !"
        ]), 5);
        state.deltaState = 1;
    }

    if (sessionActive === "Practice" && delta < -0.3 && delta > -0.6 && validLap && now - state.lastGerard > 240000) {
        announce("DELTA_TECH", randomFrom([
            "On gagne du temps de manière constante dans ce secteur. Continue sur cette ligne.",
            "Les relevés sont bons. Tu améliores tes sorties de virage, le delta est au vert."
        ]), 4);
        state.lastGerard = now;
    }

    if (ahead && ahead.UserName !== "OFF TRACK") {
        const gap = parseFloat(ahead.GapRelat);
        const sameClass = ahead.CarClassID === me.CarClassID;
        if (sessionActive === "Practice" && sameClass && gap < 3.0 && gap > 0.8 && now - state.lastTarget > 120000) {
            announce("PRAC_TARGET", `Cible en vue : ${ahead.UserName} est ton lièvre. Accroche-toi !`, 6);
            state.lastTarget = now;
        }
        if (gap < 0.3 && now - state.lastAdvice > 180000) {
            announce("PRAC_COOL", "Tu es dans ses échappements. Garde de l'espace.", 5);
            state.lastAdvice = now;
        }
    }

    const position = data.Position || 0;
    if (now - state.lastPodium > 300000) {
        if (position === 1) {
            announce("POLE", "Incroyable ! On vient de prendre la pole position ! T'es le patron.", 5);
            state.lastPodium = now;
        } else if (position > 1 && position <= 3) {
            announce("PODIUM", `On tient le podium ! P${position} au classement. Reste concentré.`, 6);
            state.lastPodium = now;
        }
    }

    const bestLap = me.BestLapTime_raw || 0;
    if (sessionActive === "Practice" && validLap && !state.firstLapAnnounced) {
        announce("FIRST_LAP", randomFrom([
            "Premier chrono enregistré. C'est une bonne base de travail, on va pouvoir affiner maintenant.",
            "Le premier temps de référence est tombé. On a une base, voyons où on peut gratter des dixièmes.",
            "C'est validé. Premier tour propre, le chrono est dans la boîte."
        ]), 7);
        state.firstLapAnnounced = true;
    }

    if (validLap && (sessionActive === "Practice" || sessionActive === "Race") &&
        me.LastLapTime_raw === bestLap && bestLap > 0 && state.bestLapAnnounced !== currentLap) {
        announce("BEST_LAP", randomFrom([
            "Nouveau record personnel ! On améliore encore, la voiture est parfaitement exploitée.",
            "C'est ton meilleur tour en piste ! Ton rythme est excellent, continue sur cette lancée.",
            "Record battu ! Les data sont formelles : tu es plus rapide que jamais aujourd'hui."
        ]), 9);
        state.bestLapAnnounced = currentLap;
    }
}

function checkWeather(data, session) {
    if (session.sessionType === "Practice" || session.sessionType === "Race") {
        if (state.trackTemp !== null) {
            const delta = data.track_temp - state.trackTemp;
            if (delta >= 2) { announce("METEO_CHAUD", "La piste chauffe rapidement.", 1); state.trackTemp = data.track_temp; }
            else if (delta <= -2) { announce("METEO_FROID", "La piste refroidit rapidement.", 1); state.trackTemp = data.track_temp; }
        }
    }
    const rain = data.rain_intensity_pct || 0;
    const wind = data.wind_vel * 3.6;
    if (rain > 0 && state.rain === 0) announce("PLUIE_DEBUT", "La pluie arrive sur le circuit.", 1);
    if (rain === 0 && state.rain > 0) announce("PLUIE_FIN", "La pluie s'arrête, la piste va sécher.", 1);
    state.rain = rain;
    if (session.sessionType === "Race" && wind > 35 && state.wind <= 35) announce("VENT_FORT", "Vent fort sur le circuit, attention.", 1);
    state.wind = wind;
}

function checkTrack(data, now) {
    const lapsLeft = data.fuel_laps_est || 0;
    if (lapsLeft > 0 && now - state.lastFuel > 300000) {
        if (lapsLeft < 1.2) {
            announce("FUEL_EMERGENCY", "C'est le dernier tour ! Rentre maintenant ou on finit à pied !", 2);
            state.lastFuel = now;
        } else if (data.fuel_avg > 0 && data.fuel_last_lap > (data.fuel_avg * 1.08)) {
            announce("FUEL_BURN", "ici Antoine. On consomme trop sur ce run. Lève un peu le pied.", 2);
            state.lastFuel = now;
        }
    }

    const player = Array.isArray(data.Leaderboard) ? data.Leaderboard.find(driver => driver.IsPlayer === true) : null;
    if (player && data.leader_best_lap > 0 && player.BestLapTime_raw > 0 && now - state.lastTrackAnalysis > 600000) {
        const diff = (player.BestLapTime_raw - data.leader_best_lap).toFixed(3);
        if (diff > 0.6) {
            announce("PERF_GAP", `ici Gérard. On rend ${diff} au leader sur le meilleur tour. Travaille tes entrées de virage.`, 4);
            state.lastTrackAnalysis = now;
        }
    }

    const incidents = Number(data.incidents) || 0;
    if (incidents > state.lastIncidentCount) {
        if (incidents - state.lastIncidentCount >= 2) announce("INC_DANGER", "ici Denise. On accumule trop d'incidents. Reste entre les lignes blanches.", 0);
        state.lastIncidentCount = incidents;
    }

    if (data.avg_lap_raw > 0 && data.last_lap_raw > data.avg_lap_raw + 2.0 && now - state.lastPhysio > 900000) {
        announce("PHYSIO_ALERT", "Eloïse ici. Ton rythme chute, bois un peu et relaxe tes mains sur le volant.", 7);
        state.lastPhysio = now;
    }
}

function handleData(data) {
    if (!data || data.IsConnected === false) return;
    const now = Date.now();
    const session = sessionInfo(data);

    if (now - state.lastFlagsCheck >= 200) {
        checkFlags(data, session);
        state.lastFlagsCheck = now;
    }
    if (now - state.lastTacticsCheck >= 200) {
        checkRelative(data, now);
        state.lastTacticsCheck = now;
    }
    if (now - state.lastLeaderboardCheck >= 5000) {
        checkLeaderboard(data, now);
        state.lastLeaderboardCheck = now;
    }
    if (now - state.lastTrackCheck >= 1000) {
        checkWeather(data, session);
        checkTrack(data, now);
        state.lastTrackCheck = now;
    }
}

function connect() {
    if (state.socket && (state.socket.readyState === WebSocket.OPEN || state.socket.readyState === WebSocket.CONNECTING)) return;
    telemetryConnected = false;
    renderConnection();
    const socket = new WebSocket(API_WS_URL);
    state.socket = socket;
    socket.onopen = () => { telemetryConnected = true; renderConnection(); };
    socket.onmessage = event => {
        try {
            const data = JSON.parse(event.data);
            if (data.needs_reset || data.session_changed || data.force_reload) resetSessionState();
            handleData(data);
        } catch (error) { console.error("Données Team Voice invalides:", error); }
    };
    socket.onerror = () => { telemetryConnected = false; renderConnection(); };
    socket.onclose = () => {
        if (state.socket === socket) state.socket = null;
        telemetryConnected = false;
        renderConnection();
        if (!state.reconnectTimer) state.reconnectTimer = setTimeout(() => { state.reconnectTimer = null; connect(); }, 1500);
    };
}

window.teamControls?.onEditMode(enabled => document.body.classList.toggle("edit-mode", enabled));
window.teamControls?.onTestVoice(queueVoiceTest);
checkVoiceStatus();
setInterval(checkVoiceStatus, 3000);
connect();
