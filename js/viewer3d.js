/* ==========================================================================
   LECTEUR DE FICHIER 3D INTERACTIF & GÉNÉRATEUR D'ASSETS - THREE.JS
   Portfolio Architecture & Catalogue Japandi
   ========================================================================== */

let scene, camera, renderer, controls;
let currentModel = null;
let currentAssetKey = 'asset-mobilier-interieur';
let isRotating = false;
let isWireframe = false;
let isInitialized = false;
let animationFrameId = null;

// Textures procédurales de bois et matériaux
let textureCache = {};
let currentWoodFinish = 'natural'; // 'natural', 'weathered', 'dark', 'travertine', 'washi', 'boucle', 'gold'

/**
 * Génère des textures procédurales haute résolution (Bois, Pierre, Washi, Tissu, Or)
 */
function getProceduralTexture(type = 'natural') {
    if (textureCache[type]) {
        return textureCache[type];
    }

    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    if (type === 'travertine') {
        ctx.fillStyle = '#dfd9cf';
        ctx.fillRect(0, 0, 1024, 1024);
        for (let i = 0; i < 400; i++) {
            const x = Math.random() * 1024;
            const y = Math.random() * 1024;
            const w = Math.random() * 25 + 5;
            const h = Math.random() * 8 + 2;
            const alpha = Math.random() * 0.25 + 0.08;
            ctx.fillStyle = `rgba(160, 150, 138, ${alpha})`;
            ctx.fillRect(x, y, w, h);
        }
    } else if (type === 'washi') {
        ctx.fillStyle = '#f8f4ec';
        ctx.fillRect(0, 0, 1024, 1024);
        for (let i = 0; i < 1200; i++) {
            const x = Math.random() * 1024;
            const y = Math.random() * 1024;
            const len = Math.random() * 18 + 4;
            const angle = Math.random() * Math.PI * 2;
            ctx.strokeStyle = `rgba(180, 165, 140, ${Math.random() * 0.22 + 0.05})`;
            ctx.lineWidth = Math.random() * 1.5 + 0.5;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
            ctx.stroke();
        }
    } else if (type === 'boucle') {
        ctx.fillStyle = '#ede9e2';
        ctx.fillRect(0, 0, 1024, 1024);
        for (let i = 0; i < 2500; i++) {
            const x = Math.random() * 1024;
            const y = Math.random() * 1024;
            const r = Math.random() * 5 + 1.5;
            ctx.fillStyle = `rgba(200, 195, 185, ${Math.random() * 0.35 + 0.1})`;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }
    } else {
        // Textures de bois (natural, dark, smoked, cedar)
        let baseHex, darkHex;
        if (type === 'dark' || type === 'smoked') {
            baseHex = 0x423328;
            darkHex = 0x241a14;
        } else if (type === 'cedar') {
            baseHex = 0xdeb887;
            darkHex = 0xa57548;
        } else {
            baseHex = 0xd5be9e;
            darkHex = 0x9b7e5c;
        }

        const baseCol = new THREE.Color(baseHex);
        const darkCol = new THREE.Color(darkHex);
        ctx.fillStyle = '#' + baseCol.getHexString();
        ctx.fillRect(0, 0, 1024, 1024);

        for (let i = 0; i < 700; i++) {
            const y = Math.random() * 1024;
            const h = Math.random() * 3 + 1;
            const alpha = Math.random() * 0.18 + 0.05;
            ctx.fillStyle = `rgba(${Math.round(darkCol.r * 255)}, ${Math.round(darkCol.g * 255)}, ${Math.round(darkCol.b * 255)}, ${alpha})`;
            ctx.fillRect(0, y, 1024, h);
        }

        for (let i = 0; i < 30; i++) {
            const startY = Math.random() * 1024;
            ctx.strokeStyle = `rgba(${Math.round(darkCol.r * 255)}, ${Math.round(darkCol.g * 255)}, ${Math.round(darkCol.b * 255)}, 0.14)`;
            ctx.beginPath();
            ctx.moveTo(0, startY);
            let cy = startY;
            for (let x = 0; x <= 1024; x += 64) {
                cy += (Math.random() - 0.5) * 6;
                ctx.lineTo(x, cy);
            }
            ctx.stroke();
        }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);
    textureCache[type] = texture;
    return texture;
}

function getWoodTexture(finish = 'natural') {
    return getProceduralTexture(finish);
}

/**
 * Initialise le visualiseur Three.js
 */
function init3DViewerCore() {
    if (isInitialized && renderer) return;

    // 1. Scène
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf7f7f5);

    // 2. Caméra
    camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.set(3.5, 2.5, 3.5);

    // 3. Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(600, 600);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    if (THREE.sRGBEncoding) {
        renderer.outputEncoding = THREE.sRGBEncoding;
    } else if (THREE.SRGBColorSpace) {
        renderer.outputColorSpace = THREE.SRGBColorSpace;
    }
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 4. OrbitControls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 + 0.04;
    controls.minDistance = 0.6;
    controls.maxDistance = 25;
    controls.target.set(0, 0.35, 0);

    // 5. Éclairage Studio
    setupStudioLights();

    // 6. Sol avec ombres douces et grille
    setupGroundPlane();

    isInitialized = true;
    animate();

    window.addEventListener('resize', resize3DViewer);
}

/**
 * Configure l'éclairage de studio architectural
 */
function setupStudioLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xfffaee, 1.25);
    mainLight.position.set(6, 10, 5);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.bias = -0.0001;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 30;
    mainLight.shadow.camera.left = -4;
    mainLight.shadow.camera.right = 4;
    mainLight.shadow.camera.top = 4;
    mainLight.shadow.camera.bottom = -4;
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0xdce7f5, 0.45);
    fillLight.position.set(-6, 5, -5);
    scene.add(fillLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xe2ded4, 0.5);
    scene.add(hemiLight);
}

/**
 * Sol studio avec récepteur d'ombres
 */
function setupGroundPlane() {
    const shadowPlaneGeo = new THREE.PlaneGeometry(30, 30);
    const shadowPlaneMat = new THREE.ShadowMaterial({ opacity: 0.14 });
    const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0;
    shadowPlane.receiveShadow = true;
    scene.add(shadowPlane);

    const grid = new THREE.GridHelper(10, 20, 0xd0d0cc, 0xecece8);
    grid.position.y = 0.001;
    scene.add(grid);
}

/**
 * Monte le visualiseur Three.js dans la vue d'asset demandée
 */
function mount3DViewerForAsset(assetKey) {
    init3DViewerCore();
    currentAssetKey = assetKey;

    const pageView = document.getElementById(assetKey);
    if (!pageView) return;

    const targetContainer = pageView.querySelector('.three-canvas-target') || pageView.querySelector('#three-canvas-wrapper');
    if (!targetContainer) return;

    if (renderer.domElement.parentElement !== targetContainer) {
        targetContainer.innerHTML = '';
        targetContainer.appendChild(renderer.domElement);
    }

    // Créer et monter le modèle 3D adapté
    loadOrBuildAssetModel(assetKey);
    setTimeout(resize3DViewer, 50);
}

/**
 * Génère le modèle 3D procédural haute fidélité pour chaque asset
 */
function loadOrBuildAssetModel(assetKey) {
    if (currentModel) {
        scene.remove(currentModel);
        currentModel = null;
    }

    // Modèle spécifique Palette.glb pour l'asset mobilier si disponible
    if (assetKey === 'asset-mobilier-interieur') {
        buildPaletteModel();
        return;
    }

    const group = new THREE.Group();
    group.name = assetKey;

    const woodNat = getProceduralTexture('natural');
    const woodDark = getProceduralTexture('dark');
    const woodCedar = getProceduralTexture('cedar');
    const travTex = getProceduralTexture('travertine');
    const washiTex = getProceduralTexture('washi');
    const boucleTex = getProceduralTexture('boucle');

    const oakMat = new THREE.MeshStandardMaterial({ color: 0xd4c0a1, map: woodNat, roughness: 0.65, metalness: 0.02 });
    const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x4a3b30, map: woodDark, roughness: 0.7, metalness: 0.02 });
    const cedarMat = new THREE.MeshStandardMaterial({ color: 0xdfb482, map: woodCedar, roughness: 0.6, metalness: 0.02 });
    const blackMetalMat = new THREE.MeshStandardMaterial({ color: 0x1f1f1f, roughness: 0.4, metalness: 0.8 });
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xcaa65d, roughness: 0.35, metalness: 0.85 });
    const travertineMat = new THREE.MeshStandardMaterial({ color: 0xded6c8, map: travTex, roughness: 0.9, metalness: 0.02 });
    const boucleMat = new THREE.MeshStandardMaterial({ color: 0xf0ece5, map: boucleTex, roughness: 0.95, metalness: 0.01 });
    const ceramicMat = new THREE.MeshStandardMaterial({ color: 0x383533, roughness: 0.85, metalness: 0.05 });

    function addMesh(geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, z);
        mesh.rotation.set(rx, ry, rz);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
        return mesh;
    }

    let badgeTitle = "Modèle 3D Actif";

    switch (assetKey) {
        case 'asset-structure-modulaire':
            badgeTitle = "Structure Modulaire (32k tris)";
            // 4 poteaux
            const colGeo = new THREE.BoxGeometry(0.1, 1.8, 0.1);
            [-0.8, 0.8].forEach(x => {
                [-0.8, 0.8].forEach(z => {
                    addMesh(colGeo, oakMat, x, 0.9, z);
                    addMesh(new THREE.BoxGeometry(0.14, 0.06, 0.14), blackMetalMat, x, 0.03, z);
                });
            });
            // Poutres supérieures
            addMesh(new THREE.BoxGeometry(1.7, 0.1, 0.1), oakMat, 0, 1.75, -0.8);
            addMesh(new THREE.BoxGeometry(1.7, 0.1, 0.1), oakMat, 0, 1.75, 0.8);
            addMesh(new THREE.BoxGeometry(0.1, 0.1, 1.7), oakMat, -0.8, 1.75, 0);
            addMesh(new THREE.BoxGeometry(0.1, 0.1, 1.7), oakMat, 0.8, 1.75, 0);
            // Solivage toit
            for (let i = -0.6; i <= 0.6; i += 0.3) {
                addMesh(new THREE.BoxGeometry(0.04, 0.06, 1.6), oakMat, i, 1.8, 0);
            }
            // Panneau verre toit translucide
            const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, roughness: 0.1, transmission: 0.9 });
            addMesh(new THREE.BoxGeometry(1.7, 0.015, 1.7), glassMat, 0, 1.85, 0);
            break;

        case 'asset-chaise-kurisu':
            badgeTitle = "Chaise Kurisu (18.5k tris)";
            // 4 pieds effilés
            const legGeo = new THREE.CylinderGeometry(0.02, 0.028, 0.52, 16);
            addMesh(legGeo, oakMat, -0.22, 0.26, -0.22);
            addMesh(legGeo, oakMat, 0.22, 0.26, -0.22);
            addMesh(legGeo, oakMat, -0.24, 0.26, 0.24);
            addMesh(legGeo, oakMat, 0.24, 0.26, 0.24);
            // Assise tressée
            const seatMat = new THREE.MeshStandardMaterial({ color: 0xceb48e, map: woodNat, roughness: 0.85 });
            addMesh(new THREE.BoxGeometry(0.5, 0.035, 0.48), seatMat, 0, 0.51, 0);
            // Montants dossier
            const backPostGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.45, 16);
            addMesh(backPostGeo, oakMat, -0.22, 0.72, -0.22, 0.08, 0, 0);
            addMesh(backPostGeo, oakMat, 0.22, 0.72, -0.22, 0.08, 0, 0);
            // Dossier courbé
            const backCurveGeo = new THREE.TorusGeometry(0.3, 0.03, 12, 24, Math.PI);
            addMesh(backCurveGeo, oakMat, 0, 0.86, -0.15, Math.PI / 2, 0, Math.PI);
            // Bande tressée dossier
            addMesh(new THREE.BoxGeometry(0.42, 0.15, 0.025), seatMat, 0, 0.78, -0.24);
            break;

        case 'asset-table-kanso':
            badgeTitle = "Table Basse Kanso (12.4k tris)";
            // Socle monolithique travertin
            addMesh(new THREE.BoxGeometry(0.75, 0.28, 0.45), travertineMat, 0, 0.14, 0);
            // Plateau noyer chanfreiné
            addMesh(new THREE.BoxGeometry(1.5, 0.06, 0.8), darkWoodMat, 0, 0.31, 0);
            // Bol de thé zen
            const bowlGeo = new THREE.CylinderGeometry(0.07, 0.04, 0.06, 24);
            addMesh(bowlGeo, ceramicMat, 0.2, 0.37, 0.1);
            break;

        case 'asset-suspension-akari':
            badgeTitle = "Suspension Akari (14.2k tris)";
            // Abat-jour washi organique
            const washiMat = new THREE.MeshStandardMaterial({
                color: 0xfff7ea,
                map: washiTex,
                roughness: 0.85,
                emissive: 0xffdfaa,
                emissiveIntensity: 0.35,
                side: THREE.DoubleSide
            });
            const shadeGeo = new THREE.DodecahedronGeometry(0.55, 2);
            shadeGeo.scale(1.2, 0.8, 1.1);
            addMesh(shadeGeo, washiMat, 0, 1.3, 0);
            // Câble et fixation
            addMesh(new THREE.CylinderGeometry(0.005, 0.005, 1.2, 8), blackMetalMat, 0, 2.0, 0);
            addMesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 16), blackMetalMat, 0, 2.5, 0);
            // Anneaux bambou
            const ringGeo = new THREE.TorusGeometry(0.58, 0.01, 8, 32);
            addMesh(ringGeo, oakMat, 0, 1.3, 0, Math.PI / 2, 0, 0);
            addMesh(ringGeo, oakMat, 0, 1.42, 0, Math.PI / 2, 0, 0);
            addMesh(ringGeo, oakMat, 0, 1.18, 0, Math.PI / 2, 0, 0);
            break;

        case 'asset-claustra-kumiko':
            badgeTitle = "Claustra Kumiko (46.8k tris)";
            // 3 panneaux pliants
            const panelOffsets = [
                { x: -0.65, z: 0.1, r: -0.2 },
                { x: 0, z: 0, r: 0 },
                { x: 0.65, z: 0.1, r: 0.2 }
            ];
            panelOffsets.forEach(pos => {
                const pGroup = new THREE.Group();
                pGroup.position.set(pos.x, 0.9, pos.z);
                pGroup.rotation.y = pos.r;
                // Cadre extérieur
                const frameMat = cedarMat;
                const fW = 0.6, fH = 1.7, thick = 0.03;
                const leftPost = new THREE.Mesh(new THREE.BoxGeometry(thick, fH, thick), frameMat);
                leftPost.position.set(-fW / 2 + thick / 2, 0, 0);
                const rightPost = new THREE.Mesh(new THREE.BoxGeometry(thick, fH, thick), frameMat);
                rightPost.position.set(fW / 2 - thick / 2, 0, 0);
                const topBar = new THREE.Mesh(new THREE.BoxGeometry(fW, thick, thick), frameMat);
                topBar.position.set(0, fH / 2 - thick / 2, 0);
                const bottomBar = new THREE.Mesh(new THREE.BoxGeometry(fW, thick, thick), frameMat);
                bottomBar.position.set(0, -fH / 2 + thick / 2, 0);
                pGroup.add(leftPost, rightPost, topBar, bottomBar);

                // Treillis intérieur Kumiko
                for (let y = -0.7; y <= 0.7; y += 0.1) {
                    const hBar = new THREE.Mesh(new THREE.BoxGeometry(fW - 0.05, 0.008, 0.015), frameMat);
                    hBar.position.set(0, y, 0);
                    pGroup.add(hBar);
                }
                for (let x = -0.22; x <= 0.22; x += 0.1) {
                    const vBar = new THREE.Mesh(new THREE.BoxGeometry(0.008, fH - 0.05, 0.015), frameMat);
                    vBar.position.set(x, 0, 0);
                    pGroup.add(vBar);
                }
                group.add(pGroup);
            });
            break;

        case 'asset-fauteuil-yugen':
            badgeTitle = "Fauteuil Yūgen (26.4k tris)";
            // Assise arrondie
            const seatGeo = new THREE.CylinderGeometry(0.48, 0.44, 0.24, 32);
            addMesh(seatGeo, boucleMat, 0, 0.32, 0);
            // Dossier galbé enveloppant
            const backCushionGeo = new THREE.TorusGeometry(0.46, 0.18, 16, 32, Math.PI * 0.85);
            addMesh(backCushionGeo, boucleMat, 0, 0.65, 0.06, Math.PI / 2, 0, Math.PI * 1.07);
            // 4 pieds courts en frêne
            const fLegGeo = new THREE.CylinderGeometry(0.03, 0.02, 0.2, 16);
            addMesh(fLegGeo, oakMat, -0.25, 0.1, -0.25, 0.15, 0, -0.15);
            addMesh(fLegGeo, oakMat, 0.25, 0.1, -0.25, 0.15, 0, 0.15);
            addMesh(fLegGeo, oakMat, -0.25, 0.1, 0.25, -0.15, 0, -0.15);
            addMesh(fLegGeo, oakMat, 0.25, 0.1, 0.25, -0.15, 0, 0.15);
            break;

        case 'asset-banc-engawa':
            badgeTitle = "Banc Engawa (9.6k tris)";
            // 7 lattes de chêne
            for (let i = 0; i < 7; i++) {
                const z = (i - 3) * 0.065;
                addMesh(new THREE.BoxGeometry(1.4, 0.035, 0.048), oakMat, 0, 0.46, z);
            }
            // 4 pieds
            addMesh(new THREE.BoxGeometry(0.06, 0.44, 0.06), oakMat, -0.58, 0.22, -0.16);
            addMesh(new THREE.BoxGeometry(0.06, 0.44, 0.06), oakMat, 0.58, 0.22, -0.16);
            addMesh(new THREE.BoxGeometry(0.06, 0.44, 0.06), oakMat, -0.58, 0.22, 0.16);
            addMesh(new THREE.BoxGeometry(0.06, 0.44, 0.06), oakMat, 0.58, 0.22, 0.16);
            // Étagère basse
            addMesh(new THREE.BoxGeometry(1.15, 0.025, 0.32), oakMat, 0, 0.16, 0);
            // Équerres métal noir
            addMesh(new THREE.BoxGeometry(0.07, 0.07, 0.07), blackMetalMat, -0.58, 0.43, -0.16);
            addMesh(new THREE.BoxGeometry(0.07, 0.07, 0.07), blackMetalMat, 0.58, 0.43, -0.16);
            addMesh(new THREE.BoxGeometry(0.07, 0.07, 0.07), blackMetalMat, -0.58, 0.43, 0.16);
            addMesh(new THREE.BoxGeometry(0.07, 0.07, 0.07), blackMetalMat, 0.58, 0.43, 0.16);
            break;

        case 'asset-etagere-sabi':
            badgeTitle = "Bibliothèque Sabi (21k tris)";
            // 2 échelles métal noir
            const ladderMat = blackMetalMat;
            [-0.45, 0.45].forEach(x => {
                addMesh(new THREE.BoxGeometry(0.02, 1.8, 0.02), ladderMat, x, 1.0, -0.15);
                addMesh(new THREE.BoxGeometry(0.02, 1.8, 0.02), ladderMat, x, 1.0, 0.15);
            });
            // 4 tablettes chêne
            const shelfHeights = [0.35, 0.75, 1.15, 1.55];
            shelfHeights.forEach(y => {
                addMesh(new THREE.BoxGeometry(1.2, 0.035, 0.36), oakMat, 0, y, 0);
            });
            // Livres 3D décoratifs
            const bookColors = [0x9e5b42, 0x4a5d4e, 0x3b4a59, 0xd4c2a5];
            bookColors.forEach((col, idx) => {
                const bMat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.8 });
                addMesh(new THREE.BoxGeometry(0.04, 0.22, 0.16), bMat, -0.35 + idx * 0.045, 0.88, 0);
            });
            // Petit vase céramique
            addMesh(new THREE.CylinderGeometry(0.06, 0.04, 0.14, 16), ceramicMat, 0.25, 1.24, 0);
            break;

        case 'asset-enfilade-tatami':
            badgeTitle = "Enfilade Tatami (31.2k tris)";
            // Caisson extérieur noyer fumé
            addMesh(new THREE.BoxGeometry(1.6, 0.65, 0.45), darkWoodMat, 0, 0.45, 0);
            // Socle bas en retrait
            addMesh(new THREE.BoxGeometry(1.48, 0.12, 0.38), darkWoodMat, 0, 0.06, 0);
            // Portes coulissantes rainurées
            const doorMat = new THREE.MeshStandardMaterial({ color: 0x382a20, map: woodDark, roughness: 0.65 });
            addMesh(new THREE.BoxGeometry(0.76, 0.58, 0.02), doorMat, -0.39, 0.45, 0.23);
            addMesh(new THREE.BoxGeometry(0.76, 0.58, 0.02), doorMat, 0.39, 0.45, 0.23);
            // Poignées encastrées
            addMesh(new THREE.BoxGeometry(0.02, 0.18, 0.01), brassMat, -0.7, 0.45, 0.24);
            addMesh(new THREE.BoxGeometry(0.02, 0.18, 0.01), brassMat, 0.7, 0.45, 0.24);
            break;

        case 'asset-vase-kintsugi':
            badgeTitle = "Vase Kintsugi (15.8k tris)";
            // Silhouette organique tournée
            const points = [];
            for (let i = 0; i <= 20; i++) {
                const t = i / 20;
                const r = Math.sin(t * Math.PI) * 0.28 + 0.08 + (1 - t) * 0.06;
                const y = t * 0.7;
                points.push(new THREE.Vector2(r, y));
            }
            const vaseGeo = new THREE.LatheGeometry(points, 32);
            addMesh(vaseGeo, ceramicMat, 0, 0.05, 0);
            // Anneaux or Kintsugi
            const veinGeo1 = new THREE.TorusGeometry(0.24, 0.008, 8, 32);
            addMesh(veinGeo1, brassMat, 0, 0.42, 0, 0.3, 0.4, 0);
            const veinGeo2 = new THREE.TorusGeometry(0.18, 0.006, 8, 32);
            addMesh(veinGeo2, brassMat, 0, 0.22, 0, -0.4, 0.2, 0);
            break;

        case 'asset-paravent-shibui':
            badgeTitle = "Paravent Shibui (23.5k tris)";
            const pShibuiOffsets = [
                { x: -0.6, z: 0.08, r: -0.22 },
                { x: 0, z: 0, r: 0 },
                { x: 0.6, z: 0.08, r: 0.22 }
            ];
            pShibuiOffsets.forEach(pos => {
                const panel = new THREE.Group();
                panel.position.set(pos.x, 0.9, pos.z);
                panel.rotation.y = pos.r;
                // Cadre
                panel.add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.75, 0.03), oakMat));
                const pRight = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.75, 0.03), oakMat);
                pRight.position.x = 0.54;
                const pTop = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.04, 0.03), oakMat);
                pTop.position.set(0.27, 0.85, 0);
                const pBottom = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.04, 0.03), oakMat);
                pBottom.position.set(0.27, -0.85, 0);
                panel.add(pRight, pTop, pBottom);
                // Lattes verticales fines
                for (let lx = 0.04; lx < 0.52; lx += 0.035) {
                    const slat = new THREE.Mesh(new THREE.BoxGeometry(0.012, 1.65, 0.02), oakMat);
                    slat.position.set(lx, 0, 0);
                    panel.add(slat);
                }
                group.add(panel);
            });
            break;

        default:
            badgeTitle = "Asset 3D";
            addMesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), oakMat, 0, 0.4, 0);
    }

    scene.add(group);
    currentModel = group;

    fitCameraToObject(group);
    updateAllModelBadges(badgeTitle);
}

/**
 * Palette en bois procédurale de référence (asset-mobilier-interieur)
 */
function buildPaletteModel() {
    const group = new THREE.Group();
    group.name = 'ProceduralPalette';

    const woodTexture = getWoodTexture('natural');
    function createWoodMat(toneOffset = 0) {
        const col = new THREE.Color(0xd2bc9c);
        col.offsetHSL(0, 0, toneOffset);
        return new THREE.MeshStandardMaterial({
            color: col,
            map: woodTexture,
            roughness: 0.7,
            metalness: 0.02,
            side: THREE.DoubleSide
        });
    }

    // 1. Lattes supérieures (5 lattes)
    const topPlankGeo = new THREE.BoxGeometry(1.2, 0.022, 0.145);
    [-0.35, -0.175, 0, 0.175, 0.35].forEach((z, i) => {
        const plank = new THREE.Mesh(topPlankGeo, createWoodMat((i % 3 - 1) * 0.03));
        plank.position.set(0, 0.133, z);
        plank.castShadow = true;
        plank.receiveShadow = true;
        group.add(plank);
    });

    // 2. Traverses intermédiaires
    const crossPlankGeo = new THREE.BoxGeometry(0.145, 0.022, 0.8);
    [-0.52, 0, 0.52].forEach(x => {
        const cross = new THREE.Mesh(crossPlankGeo, createWoodMat(-0.02));
        cross.position.set(x, 0.111, 0);
        cross.castShadow = true;
        cross.receiveShadow = true;
        group.add(cross);
    });

    // 3. Dés en bois (9 blocs)
    const blockGeo = new THREE.BoxGeometry(0.145, 0.078, 0.145);
    [-0.52, 0, 0.52].forEach(x => {
        [-0.32, 0, 0.32].forEach(z => {
            const block = new THREE.Mesh(blockGeo, createWoodMat(0.02));
            block.position.set(x, 0.061, z);
            block.castShadow = true;
            block.receiveShadow = true;
            group.add(block);
        });
    });

    // 4. Lattes inférieures
    const bottomPlankGeo = new THREE.BoxGeometry(1.2, 0.022, 0.145);
    [-0.32, 0, 0.32].forEach(z => {
        const bPlank = new THREE.Mesh(bottomPlankGeo, createWoodMat(-0.01));
        bPlank.position.set(0, 0.011, z);
        bPlank.castShadow = true;
        bPlank.receiveShadow = true;
        group.add(bPlank);
    });

    scene.add(group);
    currentModel = group;

    fitCameraToObject(group);
    updateAllModelBadges("Palette en bois 3D");

    // Tentative de chargement du fichier glb si disponible
    loadDefaultPaletteModel();
}

/**
 * Tente de charger Palette.glb
 */
function loadDefaultPaletteModel() {
    if (typeof THREE.GLTFLoader === 'undefined') return;
    try {
        const gltfLoader = new THREE.GLTFLoader();
        gltfLoader.load('models/Palette.glb', (gltf) => {
            if (currentAssetKey === 'asset-mobilier-interieur') {
                handleLoaded3DModel(gltf.scene, 'Palette.glb');
            }
        }, undefined, () => {});
    } catch (e) {}
}

/**
 * Traite et affiche le modèle 3D chargé
 */
function handleLoaded3DModel(object, filename) {
    if (!object) return;
    if (currentModel) scene.remove(currentModel);

    let polyCount = 0;
    object.traverse((child) => {
        if (child.isMesh && child.geometry) {
            if (child.geometry.index) {
                polyCount += child.geometry.index.count / 3;
            } else if (child.geometry.attributes && child.geometry.attributes.position) {
                polyCount += child.geometry.attributes.position.count / 3;
            }
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });

    applyRealisticMaterialsToModel(object);
    scene.add(object);
    currentModel = object;
    fitCameraToObject(object);

    const polyInfo = polyCount > 0 ? ` (${Math.round(polyCount).toLocaleString()} tris)` : '';
    updateAllModelBadges(`${filename}${polyInfo}`);
}

function applyRealisticMaterialsToModel(object) {
    const woodTexture = getWoodTexture('natural');
    object.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (!child.material || (Array.isArray(child.material) && !child.material[0].map)) {
                child.material = new THREE.MeshStandardMaterial({
                    color: 0xd6be9e,
                    map: woodTexture,
                    roughness: 0.72,
                    metalness: 0.02,
                    side: THREE.DoubleSide
                });
            }
        }
    });
}

/**
 * Cadrage et centrage de la caméra
 */
function fitCameraToObject(object, offset = 1.35) {
    if (!camera || !object) return;
    const boundingBox = new THREE.Box3().setFromObject(object);
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();

    boundingBox.getCenter(center);
    boundingBox.getSize(size);

    object.position.x -= center.x;
    object.position.y -= boundingBox.min.y;
    object.position.z -= center.z;

    const maxDim = Math.max(size.x, size.y, size.z, 0.5);
    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * offset;
    cameraZ = Math.max(cameraZ, 1.8);

    camera.position.set(cameraZ * 0.85, cameraZ * 0.65, cameraZ * 0.95);
    camera.lookAt(0, size.y * 0.4, 0);

    if (controls) {
        controls.target.set(0, size.y * 0.4, 0);
        controls.minDistance = maxDim * 0.25;
        controls.maxDistance = maxDim * 8;
        controls.update();
    }
}

/**
 * Basculement d'onglet 3D / Image spécifique à un conteneur d'asset
 */
function switchAssetMediaMode(btnOrMode, maybeMode) {
    let btn = null;
    let mode = '3d';

    if (typeof btnOrMode === 'string') {
        mode = btnOrMode;
    } else if (btnOrMode && btnOrMode.dataset) {
        btn = btnOrMode;
        mode = maybeMode || btn.dataset.mode || '3d';
    }

    const container = btn ? btn.closest('.media-viewer-container') : document.querySelector('.page-view[style*="block"] .media-viewer-container');
    if (!container) return;

    const tabs = container.querySelectorAll('.viewer-tab-btn');
    tabs.forEach(t => t.classList.toggle('active', t.dataset.mode === mode));

    const viewport3D = container.querySelector('.viewer-3d-viewport');
    const viewportImg = container.querySelector('.viewer-image-viewport');

    if (mode === '3d') {
        if (viewport3D) viewport3D.classList.add('active');
        if (viewportImg) viewportImg.classList.remove('active');
        const pageView = container.closest('.page-view');
        if (pageView) {
            mount3DViewerForAsset(pageView.id);
        }
    } else {
        if (viewport3D) viewport3D.classList.remove('active');
        if (viewportImg) viewportImg.classList.add('active');
    }
}

// Compatibilité
window.switchMediaMode = function(mode) {
    switchAssetMediaMode(null, mode);
};

/**
 * Outils 3D
 */
function toggle3DRotation() {
    isRotating = !isRotating;
    document.querySelectorAll('.btn-rotate-tool').forEach(btn => btn.classList.toggle('active', isRotating));
}

function toggle3DWireframe() {
    isWireframe = !isWireframe;
    document.querySelectorAll('.btn-wireframe-tool').forEach(btn => btn.classList.toggle('active', isWireframe));

    if (currentModel) {
        currentModel.traverse((child) => {
            if (child.isMesh && child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.wireframe = isWireframe);
                } else {
                    child.material.wireframe = isWireframe;
                }
            }
        });
    }
}

function reset3DCamera() {
    if (currentModel) {
        fitCameraToObject(currentModel);
    } else if (camera && controls) {
        camera.position.set(3.5, 2.5, 3.5);
        controls.target.set(0, 0.35, 0);
        controls.update();
    }
}

function toggle3DFullscreen(btn) {
    const container = btn ? btn.closest('.media-viewer-container') : document.querySelector('.media-viewer-container');
    if (!container) return;

    if (!document.fullscreenElement) {
        if (container.requestFullscreen) {
            container.requestFullscreen();
        } else if (container.webkitRequestFullscreen) {
            container.webkitRequestFullscreen();
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
    setTimeout(resize3DViewer, 100);
}

function updateAllModelBadges(text) {
    document.querySelectorAll('.viewer-model-name').forEach(el => {
        el.textContent = text;
    });
}

function resize3DViewer() {
    if (!renderer || !camera) return;
    const parent = renderer.domElement.parentElement;
    if (!parent) return;

    const width = parent.clientWidth;
    const height = parent.clientHeight;

    if (width > 0 && height > 0) {
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    }
}

function animate() {
    animationFrameId = requestAnimationFrame(animate);

    if (controls) {
        controls.update();
    }

    if (isRotating && currentModel) {
        currentModel.rotation.y += 0.007;
    }

    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

// Initialisation globale lorsque n'importe quelle vue du catalogue est affichée
window.initOrResizeViewer3D = function(assetKey) {
    if (assetKey && assetKey.startsWith('asset-')) {
        mount3DViewerForAsset(assetKey);
    } else {
        const activePageView = document.querySelector('.page-view[style*="block"]');
        if (activePageView && activePageView.id.startsWith('asset-')) {
            mount3DViewerForAsset(activePageView.id);
        }
    }
};
