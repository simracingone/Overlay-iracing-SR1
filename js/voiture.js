const API_WS_URL = "ws://127.0.0.1:8000/ws";
let socket = null;

/* =========================================================
   1. CONNEXION WEBSOCKET
   ========================================================= */
function connecter() {
    socket = new WebSocket(API_WS_URL);

    socket.onopen = () => {
        console.log("🟢 iRacing HUD Live Connecté");
    };

    socket.onmessage = (e) => {
        try {
            const data = JSON.parse(e.data);
            if (data) updateHUD(data);
        } catch (err) {
            console.error("Erreur JSON :", err);
        }
    };

    socket.onclose = () => {
        console.warn("🔴 WebSocket fermé — reconnexion...");
        setTimeout(connecter, 1000);
    };

    socket.onerror = (err) => {
        console.error("Erreur WebSocket :", err);
    };
}

/* =========================================================
   2. OUTILS & CALCULS
   ========================================================= */
function safeNum(v, def = 0) {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : def;
}

// Couleurs de température des pneus selon iRacing
function getTempColor(temp) {
    temp = safeNum(temp);

    if (temp < 50) return "#008cff"; // Bleu (Froid)
    if (temp < 65) return "#00eaff"; // Cyan
    if (temp < 75) return "#00ff66"; // Vert clair
    if (temp < 85) return "#2ed573"; // Vert optimal
    if (temp < 95) return "#ffff00"; // Jaune
    if (temp < 105) return "#ff9500"; // Orange
    if (temp < 115) return "#ff4757"; // Rouge
    return "#ff003c";                 // Surchauffe
}

// Récupération des bandes Outer / Middle / Inner
function getTireSurfaceTemps(pneu, isLeft) {
    let tempO = 0, tempM = 0, tempI = 0;

    if (Array.isArray(pneu.temp)) {
        const t0 = safeNum(pneu.temp[0]);
        const t1 = safeNum(pneu.temp[1]);
        const t2 = safeNum(pneu.temp[2]);
        tempO = isLeft ? t0 : t2;
        tempM = t1;
        tempI = isLeft ? t2 : t0;
    } else {
        const rawL = safeNum(pneu.temp_L ?? pneu.temp_O ?? pneu.tempL ?? pneu.tempLeft ?? pneu.outer);
        const rawM = safeNum(pneu.temp_M ?? pneu.temp_C ?? pneu.tempM ?? pneu.tempC ?? pneu.tempMiddle ?? pneu.middle ?? pneu.center);
        const rawR = safeNum(pneu.temp_R ?? pneu.temp_I ?? pneu.tempR ?? pneu.tempRight ?? pneu.inner);

        tempO = isLeft ? rawL : rawR;
        tempM = rawM;
        tempI = isLeft ? rawR : rawL;
    }

    return { outer: tempO, middle: tempM, inner: tempI };
}

/* =========================================================
   3. MISE À JOUR GLOBAL DU HUD
   ========================================================= */
function updateHUD(d) {

    /* --- 1. FREINS & PNEUS --- */
    const tires = d.tires || d.Tyres || d.tyres || d;

    if (tires) {
        const mapping = { LF: "fl", RF: "fr", LR: "rl", RR: "rr" };

        Object.entries(mapping).forEach(([pyKey, id]) => {
            const pneu = tires[pyKey] || tires[pyKey.toLowerCase()] || tires[pyKey.toUpperCase()];
            if (!pneu) return;

            // Température des freins
            const bVal = safeNum(pneu.brake ?? pneu.brakeTemp ?? pneu.brake_temperature);
            const elBrake = document.getElementById(`${id}-brake-val`);
            if (elBrake) elBrake.textContent = Math.round(bVal);

            // Arcs SVG des freins
            const arcEl = document.getElementById(`arc-${id}`);
            if (arcEl) {
                let r = 0, g = 255, b = 0;
                if (bVal < 35) { r = 0; g = 255; b = 255; }
                else if (bVal < 65) { r = 255; g = 255; b = 0; }
                else { r = 255; g = 0; b = 0; }
                arcEl.style.stroke = `rgb(${r}, ${g}, ${b})`;

                let brakePress = safeNum(pneu.brakePressure ?? pneu.brake_press ?? pneu.brakeInput ?? pneu.brake);
                if (brakePress <= 1) brakePress *= 100;
                brakePress = Math.min(100, Math.max(0, brakePress));

                arcEl.style.strokeDasharray = `${brakePress} ${100 - brakePress}`;
                arcEl.style.strokeDashoffset = "0";
            }

            // Bandes de température pneus (OMI)
            const isLeft = (id === "fl" || id === "rl");
            const temps = getTireSurfaceTemps(pneu, isLeft);

            const sO = document.getElementById(`${id}-strip-o`);
            const sM = document.getElementById(`${id}-strip-m`);
            const sI = document.getElementById(`${id}-strip-i`);
            if (sO) sO.style.backgroundColor = getTempColor(temps.outer);
            if (sM) sM.style.backgroundColor = getTempColor(temps.middle);
            if (sI) sI.style.backgroundColor = getTempColor(temps.inner);

            // Température moyenne
            const avgTemp = Math.round((temps.outer + temps.middle + temps.inner) / 3);
            const elAvg = document.getElementById(`${id}-temp-avg`);
            if (elAvg) elAvg.textContent = avgTemp;

            // Pression (conversion kPa / Bar vers PSI si nécessaire)
            let rawPress = safeNum(pneu.pressure ?? pneu.press ?? pneu.psi);
            let psiVal = rawPress > 50 ? rawPress * 0.145038 : rawPress;
            const elPsi = document.getElementById(`${id}-psi-val`);
            if (elPsi) elPsi.textContent = psiVal.toFixed(1);

            // Usure
            let wearRaw = pneu.wear;
            let wearPct = 0;
            if (Array.isArray(wearRaw)) {
                const avgW = (safeNum(wearRaw[0]) + safeNum(wearRaw[1]) + safeNum(wearRaw[2])) / 3;
                wearPct = avgW <= 1 ? avgW * 100 : avgW;
            } else if (wearRaw !== undefined && wearRaw !== null) {
                const w = safeNum(wearRaw);
                wearPct = w <= 1 ? w * 100 : w;
            }
            wearPct = Math.min(100, Math.max(0, wearPct));

            const elWearBar = document.getElementById(`${id}-wear-bar`);
            const elWearTxt = document.getElementById(`${id}-wear-val`);
            if (elWearBar) elWearBar.style.width = wearPct + "%";
            if (elWearTxt) elWearTxt.textContent = Math.round(wearPct) + "%";
        });
    }

    /* --- 2. INPUTS (PÉDALES) --- */
    const inp = d.inputs || d;
    if (inp) {
        function setInput(id, rawVal) {
            let val = safeNum(rawVal);
            if (val > 0 && val <= 1) val *= 100;
            const pct = Math.min(100, Math.max(0, val));

            const f = document.getElementById(`fill-${id}`);
            const t = document.getElementById(`txt-${id}`);
            if (f) f.style.height = pct + "%";
            if (t) t.textContent = Math.round(pct) + "%";
        }

        setInput("clutch", inp.clutch ?? inp.Clutch);
        setInput("throttle", inp.throttle ?? inp.Throttle);
        setInput("brake", inp.brake ?? inp.Brake);
    }

/* --- 3. CONDITIONS (MOTEUR & FLUIDES) --- */
    const eng = d.engine || d.conditions || d;
    if (eng) {
        function setCond(id, val, minVal, maxVal) {
            const v = safeNum(val);
            const txt = document.getElementById(`val-${id}`);
            const bar = document.getElementById(`bar-${id}`);

            if (txt) {
                txt.textContent = (id === "fuel" || id === "battery") ? v.toFixed(1) : Math.round(v);
            }

            if (bar) {
                const pct = Math.min(100, Math.max(0, ((v - minVal) / (maxVal - minVal)) * 100));
                bar.style.width = pct + "%";
            }
        }

        // CARBURANT
        const fuel = eng.fuel ?? eng.FuelLevel ?? eng.fuel_level ?? eng.fuel_pct;
        const maxFuel = eng.maxFuel ?? eng.FuelCapacity ?? 50;
        setCond("fuel", fuel, 0, maxFuel);

        // TEMP. EAU (Scan de toutes les clés d'APIs iRacing / Pyirsdk courantes)
        const water = eng.waterTemp ?? eng.WaterTemp ?? eng.engineWaterTemp ?? eng.water_temp ?? eng.WaterTempC ?? eng.water;
        setCond("water", water, 60, 120);

        // BATTERIE
        const battery = eng.battery ?? eng.Voltage ?? eng.VoltageDC ?? eng.voltage ?? eng.voltage_dc;
        setCond("battery", battery, 11, 15);

        // TEMP. HUILE
        const oil = eng.oilTemp ?? eng.OilTemp ?? eng.engineOilTemp ?? eng.oil_temp ?? eng.OilTempC ?? eng.oil;
        setCond("oil", oil, 60, 150);
    }

    /* --- 4. PERFORMANCES --- */
    const perf = d.perf || d;
    if (perf) {
        const spd = document.getElementById("val-speed");
        if (spd) spd.textContent = Math.round(safeNum(perf.speed ?? perf.Speed));

        const rpmVal = safeNum(perf.rpm ?? perf.RPM);
        const maxRpm = safeNum(perf.maxRpm ?? perf.MaxRPM, 9000);
        const rpm = document.getElementById("val-rpm");
        const rpmBar = document.getElementById("fill-rpm");

        if (rpm) rpm.textContent = Math.round(rpmVal);
        if (rpmBar) rpmBar.style.width = Math.min(100, (rpmVal / maxRpm) * 100) + "%";

        const gear = document.getElementById("val-gear");
        if (gear) {
            const g = safeNum(perf.gear ?? perf.Gear);
            gear.textContent = g === 0 ? "N" : g === -1 ? "R" : g;
        }

        const delta = safeNum(perf.delta ?? perf.LapDeltaToSessionBestLap);
        const delEl = document.getElementById("val-delta");
        const trdEl = document.getElementById("val-trend");

        if (delEl) {
            delEl.textContent = (delta >= 0 ? "+" : "") + delta.toFixed(3);
            delEl.style.color = delta <= 0 ? "#2ed573" : "#ff4757";
        }

        if (trdEl) {
            trdEl.textContent = delta <= 0 ? "↗" : "↘";
            trdEl.style.color = delta <= 0 ? "#2ed573" : "#ff4757";
        }
    }
}





document.addEventListener("DOMContentLoaded", connecter);