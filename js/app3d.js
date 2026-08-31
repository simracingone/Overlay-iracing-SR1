/* ==========================================================================
   1. CONFIGURATION & WEBSOCKET
   ========================================================================== */
const API_WS_URL = "ws://127.0.0.1:8000/ws";
let socket = null;
let lastData = null;

function connecter() {
    socket = new WebSocket(API_WS_URL);

    socket.onopen = () => console.log("🟢 3D WebSocket Connecté");
    socket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data && data.IsConnected !== false) lastData = data;
        } catch (e) {
            console.error(e);
        }
    };
    socket.onclose = () => setTimeout(connecter, 1000);
}

/* ==========================================================================
   2. SCÈNE THREE.JS & CAMÉRA ISOMÉTRIQUE
   ========================================================================== */
const container = document.getElementById('webgl-container');
const scene = new THREE.Scene();

// Caméra Orthographique (pour le rendu Isométrique pur sans déformation)
const aspect = window.innerWidth / window.innerHeight;
const d = 5;
const camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 1, 1000);

// Angle isométrique standard
camera.position.set(10, 10, 10);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

/* ==========================================================================
   3. ÉCLAIRAGE ET ÉLÉMENTS 3D (Châssis & Disques de Frein Incandescents)
   ========================================================================== */
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0x00ff88, 0.8);
dirLight.position.set(5, 12, 8);
scene.add(dirLight);

// Grille de fond type "Holodeck"
const grid = new THREE.GridHelper(10, 20, 0x00ff88, 0x112233);
grid.position.y = -1;
scene.add(grid);

// Création du Châssis de voiture (Style "Blueprint" épuré)
const chassisGeo = new THREE.BoxGeometry(1.8, 0.6, 3.8);
const chassisMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.8,
    roughness: 0.2,
    wireframe: false,
    transparent: true,
    opacity: 0.85
});
const chassis = new THREE.Mesh(chassisGeo, chassisMat);
scene.add(chassis);

// Contour filaire du châssis
const wireGeo = new THREE.WireframeGeometry(chassisGeo);
const wireMat = new THREE.LineBasicMaterial({ color: 0x00ff88, linewidth: 1 });
const wireframe = new THREE.LineSegments(wireGeo, wireMat);
chassis.add(wireframe);

// Création des 4 Roues et Disques de frein
const wheels = {};
const wheelPositions = {
    "LF": [-1.1, -0.1,  1.2],
    "RF": [ 1.1, -0.1,  1.2],
    "LR": [-1.1, -0.1, -1.2],
    "RR": [ 1.1, -0.1, -1.2]
};

Object.entries(wheelPositions).forEach(([key, pos]) => {
    const group = new THREE.Group();
    group.position.set(...pos);

    // Pneu
    const tireGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.35, 24);
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.rotation.z = Math.PI / 2;
    group.add(tire);

    // Disque de Frein (Incandescent grâce au material emissive)
    const brakeGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.08, 16);
    const brakeMat = new THREE.MeshStandardMaterial({
        color: 0x222222,
        emissive: 0x000000,
        emissiveIntensity: 0
    });
    const brake = new THREE.Mesh(brakeGeo, brakeMat);
    brake.rotation.z = Math.PI / 2;
    group.add(brake);

    scene.add(group);
    wheels[key] = { group, tireMat, brakeMat };
});

/* ==========================================================================
   4. BOUCLE DE RENDU 60 FPS & MISE À JOUR DYNAMIQUE
   ========================================================================== */
function animate() {
    requestAnimationFrame(animate);

    // Mouvement d'oscillation très discret pour rendre la voiture "vivante"
    chassis.position.y = Math.sin(Date.now() * 0.002) * 0.03;

    if (lastData && lastData.tires) {
        const mapping = { "LF": "fl", "RF": "fr", "LR": "rl", "RR": "rr" };

        Object.entries(mapping).forEach(([pyKey, htmlPrefix]) => {
            const dataPneu = lastData.tires[pyKey];
            const wheel3D = wheels[pyKey];

            if (!dataPneu || !wheel3D) return;

            /* 1. Température / Freins -> Gestion de l'incandescence 3D */
            const brakeVal = parseFloat(dataPneu.brake || 0);
            const isDeg = brakeVal > 120;
            let ratio = isDeg ? Math.min(1, brakeVal / 850) : Math.min(1, brakeVal / 80);

            // Couleur emissive : passe du noir à l'orange/rouge vif
            if (ratio > 0.2) {
                wheel3D.brakeMat.emissive.setHex(0xff3300);
                wheel3D.brakeMat.emissiveIntensity = ratio * 2;
            } else {
                wheel3D.brakeMat.emissive.setHex(0x000000);
                wheel3D.brakeMat.emissiveIntensity = 0;
            }

            /* 2. Mise à jour de l'overlay 2D */
            const elBrake = document.getElementById(`${htmlPrefix}-brake`);
            if (elBrake) elBrake.textContent = Math.round(brakeVal) + (isDeg ? "°C" : " bar");

            const elPres = document.getElementById(`${htmlPrefix}-pres`);
            if (elPres) elPres.textContent = parseFloat(dataPneu.press || 0).toFixed(1);
        });
    }

    renderer.render(scene, camera);
}

// Redimensionnement automatique de la fenêtre
window.addEventListener('resize', () => {
    const aspect = window.innerWidth / window.innerHeight;
    camera.left = -d * aspect;
    camera.right = d * aspect;
    camera.top = d;
    camera.bottom = -d;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Lancement
connecter();
animate();