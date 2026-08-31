"use strict";

const API_WS_URL = "ws://127.0.0.1:8000/ws";
let socket = null;

/* =========================================================
   OUTILS
   ========================================================= */

function el(id) {
    return document.getElementById(id);
}

function safeNum(v, def = 0) {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : def;
}

function fixerValeur(id, valeur) {
    const element = el(id);
    if (!element) return;

    const cible =
        element.querySelector(".weather-value, .dynamic-value") ||
        element;

    if (cible) {
        cible.textContent = valeur;
    }
}

/* =========================================================
   DRAPEAUX
   ========================================================= */

const LISTE_DRAPEAUX = [
    "vert",
    "jaune",
    "rouge",
    "bleu",
    "blanc",
    "debris",
    "damier",
    "pneus",
    "meatball",
    "stop-go",
    "pit",
    "avertissement"
];

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

function basculerDrapeau(idDrapeau, actif) {
    const element = el("drapeau-" + idDrapeau);
    if (!element) return;

    element.classList.toggle("actif", Boolean(actif));
}

function reinitialiserDrapeaux() {
    LISTE_DRAPEAUX.forEach(id => {
        basculerDrapeau(id, false);
    });
}

function mettreAJourDrapeaux(donnees) {

    reinitialiserDrapeaux();

    if (donnees === undefined || donnees === null) {
        return;
    }

    /* -----------------------------------------------------
       FORMAT NUMÉRIQUE iRACING
       ----------------------------------------------------- */

    if (typeof donnees === "number") {

        if (donnees & iracingFlags.green) {
            basculerDrapeau("vert", true);
        }

        if (
            donnees &
            (
                iracingFlags.yellow |
                iracingFlags.yellowWaving |
                iracingFlags.caution |
                iracingFlags.cautionWaving
            )
        ) {
            basculerDrapeau("jaune", true);
        }

        if (donnees & iracingFlags.red) {
            basculerDrapeau("rouge", true);
        }

        if (donnees & iracingFlags.blue) {
            basculerDrapeau("bleu", true);
        }

        if (donnees & iracingFlags.white) {
            basculerDrapeau("blanc", true);
        }

        if (donnees & iracingFlags.debris) {
            basculerDrapeau("debris", true);
        }

        if (donnees & iracingFlags.checkered) {
            basculerDrapeau("damier", true);
        }

        if (
            donnees &
            (
                iracingFlags.black |
                iracingFlags.disqualify
            )
        ) {
            basculerDrapeau("meatball", true);
        }

        if (
            donnees &
            (
                iracingFlags.servicable |
                iracingFlags.repair
            )
        ) {
            basculerDrapeau("pneus", true);
        }

        return;
    }

    /* -----------------------------------------------------
       FORMAT TEXTE
       ----------------------------------------------------- */

    const texte = Array.isArray(donnees)
        ? donnees.join(" ").toUpperCase()
        : String(donnees).toUpperCase();

    if (
        texte.includes("GO") ||
        texte.includes("GREEN") ||
        texte.includes("LIBRE")
    ) {
        basculerDrapeau("vert", true);
    }

    if (
        texte.includes("DANGER") ||
        texte.includes("YELLOW")
    ) {
        basculerDrapeau("jaune", true);
    }

    if (
        texte.includes("DISQUALIFICATION") ||
        texte.includes("RED")
    ) {
        basculerDrapeau("rouge", true);
    }

    if (
        texte.includes("DÉPASSEMENT") ||
        texte.includes("DEPASSEMENT") ||
        texte.includes("BLUE")
    ) {
        basculerDrapeau("bleu", true);
    }

    if (
        texte.includes("LAST LAP") ||
        texte.includes("WHITE")
    ) {
        basculerDrapeau("blanc", true);
    }

    if (
        texte.includes("FULL YELLOW") ||
        texte.includes("DEBRIS")
    ) {
        basculerDrapeau("debris", true);
    }

    if (
        texte.includes("FIN DE COURSE") ||
        texte.includes("CHECKERED")
    ) {
        basculerDrapeau("damier", true);
    }

    if (
        texte.includes("ADHÉRENCE") ||
        texte.includes("ADHERENCE") ||
        texte.includes("TIRES")
    ) {
        basculerDrapeau("pneus", true);
    }

    if (
        texte.includes("MEATBALL") ||
        texte.includes("REPAIR")
    ) {
        basculerDrapeau("meatball", true);
    }

    if (texte.includes("STOP")) {
        basculerDrapeau("stop-go", true);
    }

    if (texte.includes("PIT")) {
        basculerDrapeau("pit", true);
    }

    if (
        texte.includes("WARN") ||
        texte.includes("AVERTISSEMENT")
    ) {
        basculerDrapeau("avertissement", true);
    }
}

/* =========================================================
   JAUGES MÉTÉO
   ========================================================= */

function ajusterJauge(idBarre, valeur, min, max) {

    const barre = el(idBarre);
    if (!barre) return;

    const ratio = Math.min(
        Math.max(
            (valeur - min) / (max - min),
            0
        ),
        1
    );

    barre.style.transform = `scaleX(${ratio})`;
}

function ajusterBoussole(angleDegres) {

    const aiguille = el("boussole-aiguille");
    if (!aiguille) return;

    aiguille.style.transform =
        `rotate(${angleDegres}deg)`;
}

/* =========================================================
   TEMPÉRATURES PNEUS
   ========================================================= */

function getTempColor(temp) {

    temp = safeNum(temp);

    if (temp < 50) return "#008cff";
    if (temp < 65) return "#00eaff";
    if (temp < 75) return "#00ff66";
    if (temp < 85) return "#2ed573";
    if (temp < 95) return "#ffff00";
    if (temp < 105) return "#ff9500";
    if (temp < 115) return "#ff4757";

    return "#ff003c";
}

function getTireSurfaceTemps(pneu, isLeft) {

    let tempO = 0;
    let tempM = 0;
    let tempI = 0;

    if (Array.isArray(pneu.temp)) {

        const t0 = safeNum(pneu.temp[0]);
        const t1 = safeNum(pneu.temp[1]);
        const t2 = safeNum(pneu.temp[2]);

        tempO = isLeft ? t0 : t2;
        tempM = t1;
        tempI = isLeft ? t2 : t0;

    } else {

        const rawL = safeNum(
            pneu.temp_L ??
            pneu.temp_O ??
            pneu.tempL ??
            pneu.tempLeft ??
            pneu.outer
        );

        const rawM = safeNum(
            pneu.temp_M ??
            pneu.temp_C ??
            pneu.tempM ??
            pneu.tempC ??
            pneu.tempMiddle ??
            pneu.middle ??
            pneu.center
        );

        const rawR = safeNum(
            pneu.temp_R ??
            pneu.temp_I ??
            pneu.tempR ??
            pneu.tempRight ??
            pneu.inner
        );

        tempO = isLeft ? rawL : rawR;
        tempM = rawM;
        tempI = isLeft ? rawR : rawL;
    }

    return {
        outer: tempO,
        middle: tempM,
        inner: tempI
    };
}

/* =========================================================
   MISE À JOUR DU HUD
   ========================================================= */

function updateHUD(d) {

    if (!d) return;

    /* =====================================================
       1. DRAPEAUX
       ===================================================== */

    const champDrapeaux =
        d.SessionFlags ??
        d.sessionFlags ??
        d.flag ??
        d.flags ??
        d.Flag ??
        d.Flags;

    mettreAJourDrapeaux(champDrapeaux);

    /* =====================================================
       2. FREINS & PNEUS
       ===================================================== */

    const tires =
        d.tires ||
        d.Tyres ||
        d.tyres ||
        d;

    if (tires) {

        const mapping = {
            LF: "fl",
            RF: "fr",
            LR: "rl",
            RR: "rr"
        };

        Object.entries(mapping).forEach(
            ([pyKey, id]) => {

                const pneu =
                    tires[pyKey] ||
                    tires[pyKey.toLowerCase()] ||
                    tires[pyKey.toUpperCase()];

                if (!pneu) return;

                /* -------------------------------
                   Température frein
                   ------------------------------- */

                const bVal = safeNum(
                    pneu.brake ??
                    pneu.brakeTemp ??
                    pneu.brake_temperature
                );

                const elBrake =
                    el(`${id}-brake-val`);

                if (elBrake) {
                    elBrake.textContent =
                        Math.round(bVal);
                }

                /* -------------------------------
                   Arc frein
                   ------------------------------- */

                const arcEl =
                    el(`arc-${id}`);

                if (arcEl) {

                    let r = 0;
                    let g = 255;
                    let b = 0;

                    if (bVal < 35) {
                        r = 0;
                        g = 255;
                        b = 255;
                    } else if (bVal < 65) {
                        r = 255;
                        g = 255;
                        b = 0;
                    } else {
                        r = 255;
                        g = 0;
                        b = 0;
                    }

                    arcEl.style.stroke =
                        `rgb(${r}, ${g}, ${b})`;

                    let brakePress = safeNum(
                        pneu.brakePressure ??
                        pneu.brake_press ??
                        pneu.brakeInput ??
                        pneu.brake
                    );

                    if (brakePress <= 1) {
                        brakePress *= 100;
                    }

                    brakePress =
                        Math.min(
                            100,
                            Math.max(0, brakePress)
                        );

                    arcEl.style.strokeDasharray =
                        `${brakePress} ${100 - brakePress}`;

                    arcEl.style.strokeDashoffset = "0";
                }

                /* -------------------------------
                   Températures O / M / I
                   ------------------------------- */

                const isLeft =
                    id === "fl" ||
                    id === "rl";

                const temps =
                    getTireSurfaceTemps(
                        pneu,
                        isLeft
                    );

                const sO =
                    el(`${id}-strip-o`);

                const sM =
                    el(`${id}-strip-m`);

                const sI =
                    el(`${id}-strip-i`);

                if (sO) {
                    sO.style.backgroundColor =
                        getTempColor(temps.outer);
                }

                if (sM) {
                    sM.style.backgroundColor =
                        getTempColor(temps.middle);
                }

                if (sI) {
                    sI.style.backgroundColor =
                        getTempColor(temps.inner);
                }

                /* -------------------------------
                   Température moyenne
                   ------------------------------- */

                const avgTemp =
                    Math.round(
                        (
                            temps.outer +
                            temps.middle +
                            temps.inner
                        ) / 3
                    );

                const elAvg =
                    el(`${id}-temp-avg`);

                if (elAvg) {
                    elAvg.textContent = avgTemp;
                }

                /* -------------------------------
                   Pression
                   ------------------------------- */

                const rawPress = safeNum(
                    pneu.pressure ??
                    pneu.press ??
                    pneu.psi
                );

                const psiVal =
                    rawPress > 50
                        ? rawPress * 0.145038
                        : rawPress;

                const elPsi =
                    el(`${id}-psi-val`);

                if (elPsi) {
                    elPsi.textContent =
                        psiVal.toFixed(1);
                }

                /* -------------------------------
                   Usure
                   ------------------------------- */

                const wearRaw =
                    pneu.wear;

                let wearPct = 0;

                if (Array.isArray(wearRaw)) {

                    const avgW =
                        (
                            safeNum(wearRaw[0]) +
                            safeNum(wearRaw[1]) +
                            safeNum(wearRaw[2])
                        ) / 3;

                    wearPct =
                        avgW <= 1
                            ? avgW * 100
                            : avgW;

                } else if (
                    wearRaw !== undefined &&
                    wearRaw !== null
                ) {

                    const w =
                        safeNum(wearRaw);

                    wearPct =
                        w <= 1
                            ? w * 100
                            : w;
                }

                wearPct =
                    Math.min(
                        100,
                        Math.max(0, wearPct)
                    );

                const elWearBar =
                    el(`${id}-wear-bar`);

                const elWearTxt =
                    el(`${id}-wear-val`);

                if (elWearBar) {
                    elWearBar.style.width =
                        wearPct + "%";
                }

                if (elWearTxt) {
                    elWearTxt.textContent =
                        Math.round(wearPct) + "%";
                }
            }
        );
    }

    /* =====================================================
       3. INPUTS
       ===================================================== */

    const inp =
        d.inputs ||
        d;

    if (inp) {

        function setInput(id, rawVal) {

            let val =
                safeNum(rawVal);

            if (
                val > 0 &&
                val <= 1
            ) {
                val *= 100;
            }

            const pct =
                Math.min(
                    100,
                    Math.max(0, val)
                );

            const f =
                el(`fill-${id}`);

            const t =
                el(`txt-${id}`);

            if (f) {
                f.style.height =
                    pct + "%";
            }

            if (t) {
                t.textContent =
                    Math.round(pct) + "%";
            }
        }

        setInput(
            "clutch",
            inp.clutch ?? inp.Clutch
        );

        setInput(
            "throttle",
            inp.throttle ?? inp.Throttle
        );

        setInput(
            "brake",
            inp.brake ?? inp.Brake
        );
    }

    /* =====================================================
       4. CONDITIONS
       ===================================================== */

    const eng =
        d.engine ||
        d.conditions ||
        d;

    if (eng) {

        function setCond(
            id,
            val,
            minVal,
            maxVal
        ) {

            const v =
                safeNum(val);

            const txt =
                el(`val-${id}`);

            const bar =
                el(`bar-${id}`);

            if (txt) {

                txt.textContent =
                    (
                        id === "fuel" ||
                        id === "battery"
                    )
                        ? v.toFixed(1)
                        : Math.round(v);
            }

            if (bar) {

                const pct =
                    Math.min(
                        100,
                        Math.max(
                            0,
                            (
                                (v - minVal) /
                                (maxVal - minVal)
                            ) * 100
                        )
                    );

                bar.style.width =
                    pct + "%";
            }
        }

        const fuel =
            eng.fuel ??
            eng.FuelLevel ??
            eng.fuel_level ??
            eng.fuel_pct;

        const maxFuel =
            eng.maxFuel ??
            eng.FuelCapacity ??
            50;

        setCond(
            "fuel",
            fuel,
            0,
            maxFuel
        );

        const water =
            eng.waterTemp ??
            eng.WaterTemp ??
            eng.engineWaterTemp ??
            eng.water_temp ??
            eng.WaterTempC ??
            eng.water;

        setCond(
            "water",
            water,
            60,
            120
        );

        const battery =
            eng.battery ??
            eng.Voltage ??
            eng.VoltageDC ??
            eng.voltage ??
            eng.voltage_dc;

        setCond(
            "battery",
            battery,
            11,
            15
        );

        const oil =
            eng.oilTemp ??
            eng.OilTemp ??
            eng.engineOilTemp ??
            eng.oil_temp ??
            eng.OilTempC ??
            eng.oil;

        setCond(
            "oil",
            oil,
            60,
            150
        );
    }

    /* =====================================================
       5. PERFORMANCES
       ===================================================== */

    const perf =
        d.perf ||
        d;

    if (perf) {

        const spd =
            el("val-speed");

        if (spd) {

            spd.textContent =
                Math.round(
                    safeNum(
                        perf.speed ??
                        perf.Speed
                    )
                );
        }

        const rpmVal =
            safeNum(
                perf.rpm ??
                perf.RPM
            );

        const maxRpm =
            safeNum(
                perf.maxRpm ??
                perf.MaxRPM,
                9000
            );

        const rpm =
            el("val-rpm");

        const rpmBar =
            el("fill-rpm");

        if (rpm) {
            rpm.textContent =
                Math.round(rpmVal);
        }

        if (rpmBar) {
            rpmBar.style.width =
                Math.min(
                    100,
                    (rpmVal / maxRpm) * 100
                ) + "%";
        }

        const gear =
            el("val-gear");

        if (gear) {

            const g =
                safeNum(
                    perf.gear ??
                    perf.Gear
                );

            gear.textContent =
                g === 0
                    ? "N"
                    : g === -1
                        ? "R"
                        : g;
        }

        const delta =
            safeNum(
                perf.delta ??
                perf.LapDeltaToSessionBestLap
            );

        const delEl =
            el("val-delta");

        const trdEl =
            el("val-trend");

        if (delEl) {

            delEl.textContent =
                (
                    delta >= 0
                        ? "+"
                        : ""
                ) +
                delta.toFixed(3);

            delEl.style.color =
                delta <= 0
                    ? "#2ed573"
                    : "#ff4757";
        }

        if (trdEl) {

            trdEl.textContent =
                delta <= 0
                    ? "↗"
                    : "↘";

            trdEl.style.color =
                delta <= 0
                    ? "#2ed573"
                    : "#ff4757";
        }
    }

    /* =====================================================
       6. MÉTÉO
       ===================================================== */

    if (d.air_temp !== undefined) {

        const val =
            Number(d.air_temp);

        fixerValeur(
            "meteo-air",
            val.toFixed(1)
        );

        ajusterJauge(
            "jauge-barre-air",
            val,
            -20,
            60
        );
    }

    if (d.wind_dir !== undefined) {

        const angle =
            Math.round(
                d.wind_dir
            );

        fixerValeur(
            "meteo-direction",
            angle
        );

        ajusterBoussole(angle);
    }

    if (d.humidity_pct !== undefined) {

        const val =
            Math.round(
                d.humidity_pct
            );

        fixerValeur(
            "meteo-humidite",
            val
        );

        ajusterJauge(
            "jauge-barre-humidite",
            val,
            0,
            100
        );
    }

    if (d.wind_vel !== undefined) {

        const val =
            Math.round(
                d.wind_vel * 3.6
            );

        fixerValeur(
            "meteo-vent",
            val
        );

        ajusterJauge(
            "jauge-barre-vent",
            val,
            0,
            50
        );
    }

    if (d.track_temp !== undefined) {

        const val =
            Number(d.track_temp);

        fixerValeur(
            "meteo-piste",
            val.toFixed(1)
        );

        ajusterJauge(
            "jauge-barre-piste",
            val,
            0,
            60
        );
    }

    if (
        d.rain_intensity_pct !== undefined
    ) {

        const val =
            Math.round(
                d.rain_intensity_pct
            );

        fixerValeur(
            "meteo-pluie",
            val
        );

        ajusterJauge(
            "jauge-barre-pluie",
            val,
            0,
            100
        );
    }

    /* =====================================================
       7. PISTE
       ===================================================== */

    if (
        d.last_lap_raw !== undefined
    ) {
        fixerValeur(
            "piste-dernier-tour",
            d.last_lap_raw
        );
    }

    if (
        d.best_lap_raw !== undefined
    ) {
        fixerValeur(
            "piste-meilleur-tour",
            d.best_lap_raw
        );
    }

    if (
        d.lap !== undefined
    ) {
        fixerValeur(
            "piste-tours",
            `${d.lap} / ${d.lap_total || "--"}`
        );
    }

    if (
        d.session_time_str
    ) {
        fixerValeur(
            "piste-temps-session",
            d.session_time_str
        );
    }

    if (
        d.fuel_last_lap !== undefined
    ) {
        fixerValeur(
            "piste-consommation",
            Number(
                d.fuel_last_lap
            ).toFixed(2)
        );
    }

    if (
        d.fuel_laps_est !== undefined
    ) {
        fixerValeur(
            "piste-tours-restants",
            Math.round(
                d.fuel_laps_est
            )
        );
    }

    if (
        d.incidents !== undefined
    ) {
        fixerValeur(
            "piste-incidents",
            d.incidents
        );
    }

    if (
        d.joker_state !== undefined
    ) {
        fixerValeur(
            "piste-joker",
            d.joker_state
                ? "REQUIRED"
                : "OK"
        );
    }
}

/* =========================================================
   CONNEXION WEBSOCKET
   ========================================================= */

function connecter() {

    socket =
        new WebSocket(API_WS_URL);

    socket.onopen = () => {

        console.log(
            "🟢 iRacing HUD Live Connecté"
        );
    };

    socket.onmessage = (e) => {

        try {

            const data =
                JSON.parse(e.data);

            if (data) {
                updateHUD(data);
            }

        } catch (err) {

            console.error(
                "Erreur JSON :",
                err
            );
        }
    };

    socket.onclose = () => {

        console.warn(
            "🔴 WebSocket fermé — reconnexion..."
        );

        setTimeout(
            connecter,
            1000
        );
    };

    socket.onerror = (err) => {

        console.error(
            "Erreur WebSocket :",
            err
        );
    };
}

/* =========================================================
   INITIALISATION
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        reinitialiserDrapeaux();
        connecter();
    }
);