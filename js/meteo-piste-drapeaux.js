"use strict";

function el(id) {
    return document.getElementById(id);
}

function fixerValeur(id, valeur) {
    const element = el(id);
    if (!element) return;
    const cible = element.querySelector(".weather-value, .dynamic-value") || element;
    if (cible) cible.textContent = valeur;
}

function basculerDrapeau(idDrapeau, actif) {
    const caseElement = el("drapeau-" + idDrapeau);
    if (!caseElement) return;
    caseElement.classList.toggle("actif", Boolean(actif));
}

const LISTE_DRAPEAUX = [
    "vert", "jaune", "rouge",
    "bleu", "blanc", "debris",
    "damier", "pneus", "meatball",
    "stop-go", "pit", "avertissement"
];

function reinitialiserDrapeaux() {
    LISTE_DRAPEAUX.forEach(id => basculerDrapeau(id, false));
}

const iracingFlags = {
    checkered: 0x0001,
    white: 0x0002,
    green: 0x0004,
    yellow: 0x0008,
    red: 0x0010,
    blue: 0x0020,
    debris: 0x0040,
    yellowWaving: 0x0080,
    caution: 0x0100,
    cautionWaving: 0x0200,
    black: 0x0400,
    disqualify: 0x0800,
    servicable: 0x1000,
    furled: 0x20000,
    repair: 0x40000
};

function mettreAJourDrapeaux(donnees) {
    reinitialiserDrapeaux();
    if (donnees === undefined || donnees === null) return;

    if (typeof donnees === "number") {
        if (donnees & iracingFlags.green) basculerDrapeau("vert", true);
        if (donnees & (iracingFlags.yellow | iracingFlags.yellowWaving | iracingFlags.caution | iracingFlags.cautionWaving)) basculerDrapeau("jaune", true);
        if (donnees & iracingFlags.red) basculerDrapeau("rouge", true);
        if (donnees & iracingFlags.blue) basculerDrapeau("bleu", true);
        if (donnees & iracingFlags.white) basculerDrapeau("blanc", true);
        if (donnees & iracingFlags.debris) basculerDrapeau("debris", true);
        if (donnees & iracingFlags.checkered) basculerDrapeau("damier", true);
        if (donnees & (iracingFlags.black | iracingFlags.disqualify)) basculerDrapeau("meatball", true);
        if (donnees & (iracingFlags.servicable | iracingFlags.repair)) basculerDrapeau("pneus", true);
        return;
    }

    const texte = Array.isArray(donnees) ? donnees.join(" ").toUpperCase() : String(donnees).toUpperCase();

    if (texte.includes("GO") || texte.includes("GREEN") || texte.includes("LIBRE")) basculerDrapeau("vert", true);
    if (texte.includes("DANGER") || texte.includes("YELLOW")) basculerDrapeau("jaune", true);
    if (texte.includes("DISQUALIFICATION") || texte.includes("RED")) basculerDrapeau("rouge", true);
    if (texte.includes("DÉPASSEMENT") || texte.includes("BLUE")) basculerDrapeau("bleu", true);
    if (texte.includes("LAST LAP") || texte.includes("WHITE")) basculerDrapeau("blanc", true);
    if (texte.includes("FULL YELLOW") || texte.includes("DEBRIS")) basculerDrapeau("debris", true);
    if (texte.includes("FIN DE COURSE") || texte.includes("CHECKERED")) basculerDrapeau("damier", true);
    if (texte.includes("ADHÉRENCE") || texte.includes("TIRES")) basculerDrapeau("pneus", true);
    if (texte.includes("MEATBALL") || texte.includes("REPAIR")) basculerDrapeau("meatball", true);
    if (texte.includes("STOP")) basculerDrapeau("stop-go", true);
    if (texte.includes("PIT")) basculerDrapeau("pit", true);
    if (texte.includes("WARN") || texte.includes("AVERTISSEMENT")) basculerDrapeau("avertissement", true);
}

function ajusterJauge(idBarre, valeur, min, max) {
    const barre = el(idBarre);
    if (!barre) return;
    const ratio = Math.min(Math.max((valeur - min) / (max - min), 0), 1);
    barre.style.transform = `scaleX(${ratio})`;
}

function ajusterBoussole(angleDegres) {
    const aiguille = el("boussole-aiguille");
    if (!aiguille) return;
    aiguille.style.transform = `rotate(${angleDegres}deg)`;
}

function mettreAJourIHM(donnees) {
    if (!donnees) return;

    // Drapeaux
    const champDrapeaux = donnees.SessionFlags ?? donnees.flag ?? donnees.flags ?? donnees.Flag ?? donnees.Flags;
    mettreAJourDrapeaux(champDrapeaux);

    // Météo & Jauges
    if (donnees.air_temp !== undefined) {
        const val = Number(donnees.air_temp);
        fixerValeur("meteo-air", val.toFixed(1));
        ajusterJauge("jauge-barre-air", val, -20, 60);
    }
    if (donnees.wind_dir !== undefined) {
        const angle = Math.round(donnees.wind_dir);
        fixerValeur("meteo-direction", angle);
        ajusterBoussole(angle);
    }
    if (donnees.humidity_pct !== undefined) {
        const val = Math.round(donnees.humidity_pct);
        fixerValeur("meteo-humidite", val);
        ajusterJauge("jauge-barre-humidite", val, 0, 100);
    }
    if (donnees.wind_vel !== undefined) {
        const val = Math.round(donnees.wind_vel * 3.6);
        fixerValeur("meteo-vent", val);
        ajusterJauge("jauge-barre-vent", val, 0, 50);
    }
    if (donnees.track_temp !== undefined) {
        const val = Number(donnees.track_temp);
        fixerValeur("meteo-piste", val.toFixed(1));
        ajusterJauge("jauge-barre-piste", val, 0, 60);
    }
    if (donnees.rain_intensity_pct !== undefined) {
        const val = Math.round(donnees.rain_intensity_pct);
        fixerValeur("meteo-pluie", val);
        ajusterJauge("jauge-barre-pluie", val, 0, 100);
    }

    // Piste
    if (donnees.last_lap_raw !== undefined) fixerValeur("piste-dernier-tour", donnees.last_lap_raw);
    if (donnees.best_lap_raw !== undefined) fixerValeur("piste-meilleur-tour", donnees.best_lap_raw);
    if (donnees.lap !== undefined) fixerValeur("piste-tours", `${donnees.lap} / ${donnees.lap_total || '--'}`);
    if (donnees.session_time_str) fixerValeur("piste-temps-session", donnees.session_time_str);
    if (donnees.fuel_last_lap !== undefined) fixerValeur("piste-consommation", Number(donnees.fuel_last_lap).toFixed(2));
    if (donnees.fuel_laps_est !== undefined) fixerValeur("piste-tours-restants", Math.round(donnees.fuel_laps_est));
    if (donnees.incidents !== undefined) fixerValeur("piste-incidents", donnees.incidents);
    if (donnees.joker_state !== undefined) fixerValeur("piste-joker", donnees.joker_state ? "REQUIRED" : "OK");
}

let socket = null;
function connecterWebSocket() {
    socket = new WebSocket("ws://127.0.0.1:8000/ws");
    
    socket.onmessage = (e) => {
        try {
            mettreAJourIHM(JSON.parse(e.data));
        } catch (err) {
            console.error("Erreur parsing JSON WS :", err);
        }
    };
    
    socket.onclose = () => {
        setTimeout(connecterWebSocket, 1000);
    };

    socket.onerror = (err) => {
        console.error("Erreur WebSocket :", err);
    };
}

reinitialiserDrapeaux();
connecterWebSocket();