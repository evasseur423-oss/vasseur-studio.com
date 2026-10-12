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

    // 3. Renderer (alpha: false pour garantir un canvas opaque sans interférence DOM)
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(600, 600);
    // Optimisation mobile/retina : ratio max 1.5 pour garantir fluidité 60fps
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
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
    start3DViewer();

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
    mainLight.shadow.mapSize.width = 1024;
    mainLight.shadow.mapSize.height = 1024;
    mainLight.shadow.bias = -0.0001;
    mainLight.shadow.normalBias = 0.02;
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
    if (!assetKey || assetKey.startsWith('asset-pack-')) return;
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
    start3DViewer();
    resize3DViewer();
    requestAnimationFrame(resize3DViewer);
    setTimeout(resize3DViewer, 50);
    setTimeout(resize3DViewer, 150);
}

/**
/**
 * Charge un fichier 3D personnalisé (si data-model="..." est renseigné dans le HTML) ou génère le modèle procédural
 */
// Table de correspondance exacte des modèles 3D pour immuniser le site contre les fautes de frappe et la casse Linux
const ASSET_EXACT_MODELS = {
    'asset-unique-01': 'models/Sofa 1.glb',
    'asset-unique-02': 'models/Sofa 2.glb',
    'asset-unique-03': 'models/Sofa 3.glb',
    'asset-unique-04': 'models/Sofa 4.glb',
    'asset-unique-05': 'models/Sofa 5.glb',
    'asset-unique-06': 'models/Sofa 6.glb',
    'asset-unique-07': 'models/Bed 1.glb',
    'asset-unique-08': 'models/Bed 2.glb',
    'asset-unique-09': 'models/Single Bed 1.glb',
    'asset-unique-10': 'models/Single Bed 2.glb',
    'asset-unique-11': 'models/Bench 1.glb',
    'asset-unique-12': 'models/Bench 2.glb',
    'asset-unique-13': 'models/Chair 1.glb',
    'asset-unique-14': 'models/Chair 2.glb',
    'asset-unique-15': 'models/High Chair 1.glb',
    'asset-unique-16': 'models/Large Bench 1.glb',
    'asset-unique-17': 'models/Lounge 1.glb',
    'asset-unique-18': 'models/Lounge 2.glb',
    'asset-unique-19': 'models/Large Lounge 1.glb',
    'asset-unique-20': 'models/Large Lounge 2.glb',
    'asset-unique-21': 'models/XXL Lounge 1.glb',
    'asset-unique-22': 'models/XXL Lounge 2.glb',
    'asset-unique-23': 'models/Long chair 1.glb',
    'asset-unique-24': 'models/Long Chair 2.glb',
    'asset-unique-25': 'models/Table 1.glb',
    'asset-unique-26': 'models/Table 2.glb',
    'asset-unique-27': 'models/Low Table 1.glb',
    'asset-unique-28': 'models/Low Table 2.glb',
    'asset-unique-29': 'models/Desk table 1.glb',
    'asset-unique-30': 'models/Big Table 1.glb',
    'asset-unique-31': 'models/Big Table 2.glb',
    'project-pallet-3d': 'models/Sofa 1.glb'
};

function loadOrBuildAssetModel(assetKey) {
    if (currentModel) {
        scene.remove(currentModel);
        currentModel = null;
    }

    if (assetKey === 'asset-mobilier-interieur' || assetKey === 'project-pallet-3d') {
        const pageView = document.getElementById(assetKey);
        const customPath = pageView ? pageView.getAttribute('data-model') : '';
        const targetPath = (customPath && customPath.trim() !== '') ? customPath.trim() : 'models/Sofa 1.glb';
        loadExternal3DFile(targetPath, assetKey, () => {
            buildPaletteModel();
        });
        return;
    }

    // Détection d'un fichier 3D externe (.glb, .gltf, .obj, .fbx)
    const pageView = document.getElementById(assetKey);
    let customModelPath = '';
    if (pageView) {
        customModelPath = pageView.getAttribute('data-model') || 
            (pageView.querySelector('.three-canvas-target') && pageView.querySelector('.three-canvas-target').getAttribute('data-model')) ||
            (pageView.querySelector('.viewer-3d-viewport') && pageView.querySelector('.viewer-3d-viewport').getAttribute('data-model')) || '';
    }

    // Résolution sécurisée : dictionnaire garanti puis data-model
    const exactPath = ASSET_EXACT_MODELS[assetKey];
    const finalPath = exactPath || (customModelPath ? customModelPath.trim() : '');

    if (finalPath) {
        // Si ce modèle est déjà en cache pour cette vue, on l'affiche directement
        if (currentModel && currentModel.userData && currentModel.userData.sourcePath === finalPath) {
            fitCameraToObject(currentModel);
            return;
        }

        loadExternal3DFile(finalPath, assetKey, () => {
            // En cas d'erreur réseau, fallback élégant sur le modèle procédural
            buildProceduralAssetModel(assetKey);
        });
        return;
    }

    // Aucun fichier spécifié : affichage du modèle 3D procédural
    buildProceduralAssetModel(assetKey);
}

/**
 * Génère le modèle 3D procédural haute fidélité pour chaque asset
 */
function buildProceduralAssetModel(assetKey) {
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
    const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, roughness: 0.1, transmission: 0.9 });
    const cushionMat = new THREE.MeshStandardMaterial({ color: 0xe6dfd5, roughness: 0.9, metalness: 0.02 });

    function addMesh(geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, z);
        mesh.rotation.set(rx, ry, rz);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
        return mesh;
    }

    // Fonctions de construction réutilisables
    function makeChair(cx = 0, cz = 0, ry = 0, mat = oakMat) {
        const cGroup = new THREE.Group();
        cGroup.position.set(cx, 0, cz);
        cGroup.rotation.y = ry;
        const legGeo = new THREE.CylinderGeometry(0.018, 0.024, 0.5, 12);
        [-0.2, 0.2].forEach(x => {
            [-0.2, 0.2].forEach(z => {
                const leg = new THREE.Mesh(legGeo, mat);
                leg.position.set(x, 0.25, z);
                cGroup.add(leg);
            });
        });
        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.03, 0.46), mat);
        seat.position.set(0, 0.51, 0);
        const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.035, 0.42), cushionMat);
        cushion.position.set(0, 0.535, 0);
        cGroup.add(seat, cushion);
        // Dossier
        [-0.2, 0.2].forEach(x => {
            const bp = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.4, 12), mat);
            bp.position.set(x, 0.71, -0.2);
            cGroup.add(bp);
        });
        const back = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.16, 0.02), mat);
        back.position.set(0, 0.82, -0.2);
        cGroup.add(back);
        group.add(cGroup);
        return cGroup;
    }

    function makeStool(cx = 0, cz = 0, mat = oakMat) {
        const sGroup = new THREE.Group();
        sGroup.position.set(cx, 0, cz);
        const legGeo = new THREE.CylinderGeometry(0.016, 0.022, 0.75, 12);
        [-0.16, 0.16].forEach(x => {
            [-0.16, 0.16].forEach(z => {
                const leg = new THREE.Mesh(legGeo, mat);
                leg.position.set(x, 0.375, z);
                sGroup.add(leg);
            });
        });
        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.04, 0.38), mat);
        seat.position.set(0, 0.77, 0);
        const footrest = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.015, 0.36), blackMetalMat);
        footrest.position.set(0, 0.25, 0);
        sGroup.add(seat, footrest);
        group.add(sGroup);
        return sGroup;
    }

    let badgeTitle = "Modèle 3D Actif";

    // Modèles Uniques
    if (assetKey === 'asset-unique-01' || assetKey === 'asset-chaise-kurisu') {
        badgeTitle = "Canapé modulaire en palettes de bois";
        buildPaletteModel();
        return;
    } else if (assetKey === 'asset-unique-02' || assetKey === 'asset-table-kanso') {
        badgeTitle = "Fauteuil individuel en palettes avec coussins";
        addMesh(new THREE.BoxGeometry(0.7, 0.26, 0.45), travertineMat, 0, 0.13, 0);
        addMesh(new THREE.BoxGeometry(1.4, 0.05, 0.75), darkWoodMat, 0, 0.28, 0);
        addMesh(new THREE.BoxGeometry(1.36, 0.01, 0.71), glassMat, 0, 0.31, 0);
        addMesh(new THREE.CylinderGeometry(0.07, 0.04, 0.06, 24), ceramicMat, 0.2, 0.35, 0.1);
    } else if (assetKey === 'asset-unique-03' || assetKey === 'asset-banc-engawa') {
        badgeTitle = "Canapé modulaire 3 places en palettes avec coussins";
        [-0.6, 0.6].forEach(x => {
            addMesh(new THREE.BoxGeometry(0.08, 0.65, 0.8), darkWoodMat, x, 0.325, 0);
        });
        addMesh(new THREE.BoxGeometry(1.3, 0.06, 0.7), oakMat, 0, 0.35, 0);
        addMesh(new THREE.BoxGeometry(1.24, 0.1, 0.64), cushionMat, 0, 0.42, 0);
        const back = addMesh(new THREE.BoxGeometry(1.24, 0.35, 0.08), cushionMat, 0, 0.68, -0.28, 0.18, 0, 0);
    } else if (assetKey === 'asset-unique-04') {
        badgeTitle = "Canapé d'angle en L en palettes avec coussins";
        [-0.32, 0.32].forEach(x => {
            [-0.32, 0.32].forEach(z => {
                addMesh(new THREE.BoxGeometry(0.05, 1.02, 0.05), blackMetalMat, x, 0.51, z);
            });
        });
        addMesh(new THREE.BoxGeometry(0.78, 0.02, 0.78), blackMetalMat, 0, 0.3, 0);
        addMesh(new THREE.BoxGeometry(0.85, 0.04, 0.85), cedarMat, 0, 1.04, 0);
        addMesh(new THREE.BoxGeometry(0.82, 0.01, 0.82), glassMat, 0, 1.065, 0);
    } else if (assetKey === 'asset-unique-05') {
        badgeTitle = "Module de canapé sans accoudoirs en palettes avec coussins";
        [-0.36, 0.36].forEach(x => {
            addMesh(new THREE.BoxGeometry(0.05, 0.55, 0.85), oakMat, x, 0.275, 0);
        });
        addMesh(new THREE.BoxGeometry(0.66, 0.12, 0.65), boucleMat, 0, 0.32, 0.05, -0.15, 0, 0);
        addMesh(new THREE.BoxGeometry(0.66, 0.55, 0.12), boucleMat, 0, 0.58, -0.22, 0.25, 0, 0);
    } else if (assetKey === 'asset-unique-06') {
        badgeTitle = "Méridienne / Chaise longue en palettes avec coussins";
        addMesh(new THREE.BoxGeometry(1.7, 0.25, 2.1), oakMat, 0, 0.125, 0);
        addMesh(new THREE.BoxGeometry(1.55, 0.22, 1.95), cushionMat, 0, 0.32, 0);
        addMesh(new THREE.BoxGeometry(1.7, 0.75, 0.1), darkWoodMat, 0, 0.45, -1.02);
        [-0.4, 0.4].forEach(x => {
            addMesh(new THREE.BoxGeometry(0.5, 0.08, 0.35), boucleMat, x, 0.46, -0.7);
        });
    } else if (assetKey === 'asset-unique-07') {
        badgeTitle = "Bureau de Travail Studio (12.8k tris)";
        [-0.65, 0.65].forEach(x => {
            addMesh(new THREE.BoxGeometry(0.04, 0.72, 0.65), blackMetalMat, x, 0.36, 0);
        });
        addMesh(new THREE.BoxGeometry(1.5, 0.04, 0.75), darkWoodMat, 0, 0.74, 0);
        addMesh(new THREE.BoxGeometry(1.46, 0.01, 0.71), glassMat, 0, 0.765, 0);
        addMesh(new THREE.BoxGeometry(0.35, 0.4, 0.55), oakMat, 0.48, 0.48, 0);
    } else if (assetKey === 'asset-unique-08') {
        badgeTitle = "Tabouret Haut de Bar (7.6k tris)";
        makeStool(0, 0, oakMat);
    } else if (assetKey === 'asset-unique-09') {
        badgeTitle = "Bain de Soleil Transat Réglable (15.1k tris)";
        addMesh(new THREE.BoxGeometry(0.65, 0.15, 1.95), cedarMat, 0, 0.12, 0);
        addMesh(new THREE.BoxGeometry(0.62, 0.08, 1.25), cushionMat, 0, 0.22, 0.3);
        addMesh(new THREE.BoxGeometry(0.62, 0.08, 0.65), cushionMat, 0, 0.35, -0.6, 0.35, 0, 0);
    } else if (assetKey === 'asset-unique-10') {
        badgeTitle = "Banquette Lounge Inclinable (13.9k tris)";
        addMesh(new THREE.BoxGeometry(1.5, 0.18, 0.8), oakMat, 0, 0.09, 0);
        addMesh(new THREE.BoxGeometry(1.45, 0.14, 0.72), cushionMat, 0, 0.24, 0);
        addMesh(new THREE.BoxGeometry(1.45, 0.35, 0.12), cushionMat, 0, 0.45, -0.3, 0.15, 0, 0);
    } else if (assetKey === 'asset-unique-11') {
        badgeTitle = "Canapé Droit 2 Places (18.5k tris)";
        addMesh(new THREE.BoxGeometry(1.65, 0.22, 0.85), darkWoodMat, 0, 0.11, 0);
        addMesh(new THREE.BoxGeometry(1.45, 0.18, 0.75), boucleMat, 0, 0.28, 0.02);
        addMesh(new THREE.BoxGeometry(1.45, 0.45, 0.18), boucleMat, 0, 0.52, -0.32);
        [-0.78, 0.78].forEach(x => {
            addMesh(new THREE.BoxGeometry(0.12, 0.45, 0.85), darkWoodMat, x, 0.32, 0);
        });
    } else if (assetKey === 'asset-unique-12') {
        badgeTitle = "Fauteuil Club Large (12.4k tris)";
        addMesh(new THREE.BoxGeometry(0.92, 0.2, 0.85), oakMat, 0, 0.1, 0);
        addMesh(new THREE.BoxGeometry(0.72, 0.18, 0.7), cushionMat, 0, 0.28, 0.02);
        addMesh(new THREE.BoxGeometry(0.72, 0.45, 0.16), cushionMat, 0, 0.52, -0.32);
        [-0.42, 0.42].forEach(x => {
            addMesh(new THREE.BoxGeometry(0.12, 0.45, 0.85), oakMat, x, 0.32, 0);
        });
    } else if (assetKey === 'asset-unique-13') {
        badgeTitle = "Canapé Linéaire 3 Places XXL (24.8k tris)";
        addMesh(new THREE.BoxGeometry(2.35, 0.22, 0.85), darkWoodMat, 0, 0.11, 0);
        addMesh(new THREE.BoxGeometry(2.15, 0.18, 0.75), boucleMat, 0, 0.28, 0.02);
        addMesh(new THREE.BoxGeometry(2.15, 0.45, 0.18), boucleMat, 0, 0.52, -0.32);
        [-1.12, 1.12].forEach(x => {
            addMesh(new THREE.BoxGeometry(0.12, 0.45, 0.85), darkWoodMat, x, 0.32, 0);
        });
    } else if (assetKey === 'asset-unique-14') {
        badgeTitle = "Canapé d'Angle Méridienne (31.2k tris)";
        addMesh(new THREE.BoxGeometry(2.4, 0.2, 0.85), darkWoodMat, 0, 0.1, 0);
        addMesh(new THREE.BoxGeometry(0.85, 0.2, 1.1), darkWoodMat, 0.77, 0.1, 0.95);
        addMesh(new THREE.BoxGeometry(2.2, 0.18, 0.75), cushionMat, 0, 0.26, 0);
        addMesh(new THREE.BoxGeometry(0.75, 0.18, 1.0), cushionMat, 0.77, 0.26, 0.9);
        addMesh(new THREE.BoxGeometry(2.3, 0.42, 0.15), cushionMat, 0, 0.5, -0.32);
    } else if (assetKey === 'asset-unique-15') {
        badgeTitle = "Méridienne Lounge Basse (16.7k tris)";
        addMesh(new THREE.BoxGeometry(1.85, 0.16, 0.8), cedarMat, 0, 0.08, 0);
        addMesh(new THREE.BoxGeometry(1.8, 0.14, 0.75), boucleMat, 0, 0.22, 0);
        addMesh(new THREE.BoxGeometry(0.2, 0.38, 0.75), boucleMat, -0.8, 0.42, 0);
    } else if (assetKey === 'asset-unique-16') {
        badgeTitle = "Table à Manger 6 Places (11.6k tris)";
        [-0.85, 0.85].forEach(x => {
            [-0.38, 0.38].forEach(z => {
                addMesh(new THREE.BoxGeometry(0.07, 0.72, 0.07), oakMat, x, 0.36, z);
            });
        });
        addMesh(new THREE.BoxGeometry(2.0, 0.05, 0.95), oakMat, 0, 0.74, 0);
    } else if (assetKey === 'asset-unique-17' || assetKey === 'asset-enfilade-tatami') {
        badgeTitle = "Enfilade Basse Tatami (17.9k tris)";
        addMesh(new THREE.BoxGeometry(1.8, 0.5, 0.45), darkWoodMat, 0, 0.32, 0);
        [-0.8, 0.8].forEach(x => {
            addMesh(new THREE.BoxGeometry(0.04, 0.12, 0.35), blackMetalMat, x, 0.06, 0);
        });
        for (let x = -0.75; x <= 0.75; x += 0.08) {
            addMesh(new THREE.BoxGeometry(0.02, 0.4, 0.015), oakMat, x, 0.32, 0.23);
        }
    } else if (assetKey === 'asset-unique-18' || assetKey === 'asset-etagere-sabi') {
        badgeTitle = "Étagère Murale Sabi (13.4k tris)";
        [-0.5, 0.5].forEach(x => {
            addMesh(new THREE.BoxGeometry(0.03, 1.6, 0.28), blackMetalMat, x, 0.8, 0);
        });
        [0.2, 0.6, 1.0, 1.4].forEach(y => {
            addMesh(new THREE.BoxGeometry(1.2, 0.03, 0.3), cedarMat, 0, y, 0);
        });
    } else if (assetKey === 'asset-unique-19') {
        badgeTitle = "Lit Plateforme King Size XXL (27.5k tris)";
        addMesh(new THREE.BoxGeometry(2.3, 0.2, 2.3), darkWoodMat, 0, 0.1, 0);
        addMesh(new THREE.BoxGeometry(1.9, 0.24, 2.0), cushionMat, 0, 0.3, 0);
        addMesh(new THREE.BoxGeometry(2.4, 0.8, 0.12), cedarMat, 0, 0.48, -1.1);
        [-1.0, 1.0].forEach(x => {
            addMesh(new THREE.BoxGeometry(0.35, 0.18, 0.35), darkWoodMat, x, 0.12, -0.6);
        });
    } else if (assetKey === 'asset-unique-20' || assetKey === 'asset-structure-modulaire') {
        badgeTitle = "Structure Modulaire Pavillon (32k tris)";
        [-0.8, 0.8].forEach(x => {
            [-0.8, 0.8].forEach(z => {
                addMesh(new THREE.BoxGeometry(0.1, 1.8, 0.1), oakMat, x, 0.9, z);
                addMesh(new THREE.BoxGeometry(0.14, 0.06, 0.14), blackMetalMat, x, 0.03, z);
            });
        });
        addMesh(new THREE.BoxGeometry(1.7, 0.1, 0.1), oakMat, 0, 1.75, -0.8);
        addMesh(new THREE.BoxGeometry(1.7, 0.1, 0.1), oakMat, 0, 1.75, 0.8);
        addMesh(new THREE.BoxGeometry(0.1, 0.1, 1.7), oakMat, -0.8, 1.75, 0);
        addMesh(new THREE.BoxGeometry(0.1, 0.1, 1.7), oakMat, 0.8, 1.75, 0);
        for (let i = -0.6; i <= 0.6; i += 0.3) {
            addMesh(new THREE.BoxGeometry(0.04, 0.06, 1.6), oakMat, i, 1.8, 0);
        }
    } else if (assetKey === 'asset-unique-21') {
        badgeTitle = "Chaise Droite Dossier Haut (9.1k tris)";
        makeChair(0, 0, 0, darkWoodMat);
    } else if (assetKey === 'asset-unique-22') {
        badgeTitle = "Table Basse Ronde Double Plateau (12.2k tris)";
        addMesh(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 32), oakMat, 0, 0.38, 0);
        addMesh(new THREE.CylinderGeometry(0.35, 0.35, 0.02, 32), glassMat, 0, 0.2, 0);
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 2) {
            addMesh(new THREE.CylinderGeometry(0.018, 0.018, 0.38, 12), blackMetalMat, Math.cos(a) * 0.35, 0.19, Math.sin(a) * 0.35);
        }
    } else if (assetKey === 'asset-unique-23') {
        badgeTitle = "Banquette d'Entrée Engawa (11.5k tris)";
        addMesh(new THREE.BoxGeometry(1.2, 0.04, 0.4), cedarMat, 0, 0.44, 0);
        addMesh(new THREE.BoxGeometry(1.1, 0.02, 0.36), cedarMat, 0, 0.15, 0);
        [-0.52, 0.52].forEach(x => {
            [-0.15, 0.15].forEach(z => {
                addMesh(new THREE.CylinderGeometry(0.018, 0.018, 0.44, 12), darkWoodMat, x, 0.22, z);
            });
        });
    } else if (assetKey === 'asset-unique-24') {
        badgeTitle = "Mange-Debout Bistrot Épuré (8.9k tris)";
        addMesh(new THREE.CylinderGeometry(0.35, 0.35, 0.03, 32), oakMat, 0, 1.03, 0);
        addMesh(new THREE.CylinderGeometry(0.04, 0.04, 1.0, 16), blackMetalMat, 0, 0.51, 0);
        addMesh(new THREE.CylinderGeometry(0.24, 0.24, 0.02, 32), blackMetalMat, 0, 0.01, 0);
    } else if (assetKey === 'asset-unique-25') {
        badgeTitle = "Lit Simple Gigogne (17.3k tris)";
        addMesh(new THREE.BoxGeometry(1.05, 0.24, 2.05), oakMat, 0, 0.12, 0);
        addMesh(new THREE.BoxGeometry(0.95, 0.2, 1.95), cushionMat, 0, 0.32, 0);
        addMesh(new THREE.BoxGeometry(0.08, 0.55, 2.05), darkWoodMat, -0.5, 0.35, 0);
    } else if (assetKey === 'asset-unique-26') {
        badgeTitle = "Transat Double Spa (19.4k tris)";
        addMesh(new THREE.BoxGeometry(1.35, 0.15, 1.95), darkWoodMat, 0, 0.12, 0);
        [-0.32, 0.32].forEach(x => {
            addMesh(new THREE.BoxGeometry(0.6, 0.08, 1.25), cushionMat, x, 0.22, 0.3);
            addMesh(new THREE.BoxGeometry(0.6, 0.08, 0.65), cushionMat, x, 0.35, -0.6, 0.35, 0, 0);
        });
    } else if (assetKey === 'asset-unique-27' || assetKey === 'asset-fauteuil-yugen') {
        badgeTitle = "Fauteuil Lounge Yūgen (15.8k tris)";
        addMesh(new THREE.CylinderGeometry(0.42, 0.42, 0.22, 32), boucleMat, 0, 0.24, 0);
        const back = addMesh(new THREE.TorusGeometry(0.38, 0.14, 16, 32, Math.PI), boucleMat, 0, 0.48, -0.05, Math.PI / 2, 0, 0);
        [-0.25, 0.25].forEach(x => {
            [-0.25, 0.25].forEach(z => {
                addMesh(new THREE.CylinderGeometry(0.016, 0.022, 0.16, 12), brassMat, x, 0.08, z);
            });
        });
    } else if (assetKey === 'asset-unique-28' || assetKey === 'asset-claustra-kumiko') {
        badgeTitle = "Claustra Kumiko (21.6k tris)";
        addMesh(new THREE.BoxGeometry(0.9, 1.9, 0.05), cedarMat, 0, 0.95, 0);
        for (let i = 0.2; i < 1.8; i += 0.18) {
            addMesh(new THREE.BoxGeometry(0.8, 0.015, 0.02), oakMat, 0, i, 0);
        }
    } else if (assetKey === 'asset-unique-29' || assetKey === 'asset-suspension-akari') {
        badgeTitle = "Suspension Luminaire Akari (8.2k tris)";
        const washiMat = new THREE.MeshStandardMaterial({ color: 0xfff7ea, map: washiTex, roughness: 0.85, emissive: 0xffdfaa, emissiveIntensity: 0.2 });
        addMesh(new THREE.SphereGeometry(0.35, 24, 24), washiMat, 0, 0.85, 0);
        addMesh(new THREE.CylinderGeometry(0.005, 0.005, 0.9, 8), blackMetalMat, 0, 1.4, 0);
        addMesh(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 16), brassMat, 0, 1.85, 0);
    } else if (assetKey === 'asset-unique-30' || assetKey === 'asset-vase-kintsugi') {
        badgeTitle = "Vase Céramique Kintsugi (6.7k tris)";
        addMesh(new THREE.CylinderGeometry(0.12, 0.08, 0.45, 32), ceramicMat, 0, 0.23, 0);
        addMesh(new THREE.TorusGeometry(0.125, 0.008, 12, 32), brassMat, 0, 0.32, 0, Math.PI / 2);
    } else if (assetKey === 'asset-unique-31' || assetKey === 'asset-paravent-shibui') {
        badgeTitle = "Paravent Shibui Tri-Volets (23.5k tris)";
        [-0.55, 0, 0.55].forEach((x, idx) => {
            const rot = (idx === 0 ? -0.2 : (idx === 2 ? 0.2 : 0));
            addMesh(new THREE.BoxGeometry(0.5, 1.7, 0.03), oakMat, x, 0.85, (idx === 1 ? -0.05 : 0.05), 0, rot, 0);
        });
    }

    // Sets Mobilier Prêts à l'Emploi
    else if (assetKey === 'asset-set-01') {
        badgeTitle = "Set Salle à Manger Table & 6 Chaises (58k tris)";
        // Grande table
        addMesh(new THREE.BoxGeometry(1.8, 0.05, 0.9), oakMat, 0, 0.72, 0);
        [-0.75, 0.75].forEach(x => {
            [-0.35, 0.35].forEach(z => {
                addMesh(new THREE.BoxGeometry(0.06, 0.7, 0.06), oakMat, x, 0.35, z);
            });
        });
        // 6 Chaises autour de la table
        [-0.5, 0, 0.5].forEach(x => {
            makeChair(x, -0.65, 0, oakMat);
            makeChair(x, 0.65, Math.PI, oakMat);
        });
    } else if (assetKey === 'asset-set-02') {
        badgeTitle = "Set Mange-Debout & 4 Tabourets (38.5k tris)";
        addMesh(new THREE.BoxGeometry(0.8, 0.04, 0.8), cedarMat, 0, 1.02, 0);
        [-0.3, 0.3].forEach(x => {
            [-0.3, 0.3].forEach(z => {
                addMesh(new THREE.BoxGeometry(0.04, 1.0, 0.04), blackMetalMat, x, 0.5, z);
            });
        });
        makeStool(-0.55, 0, oakMat);
        makeStool(0.55, 0, oakMat);
        makeStool(0, -0.55, oakMat);
        makeStool(0, 0.55, oakMat);
    } else if (assetKey === 'asset-set-03') {
        badgeTitle = "Set Salon Lounge Duo (41k tris)";
        addMesh(new THREE.BoxGeometry(1.1, 0.04, 0.6), travertineMat, 0, 0.22, 0);
        makeChair(-0.75, 0, Math.PI / 2, darkWoodMat);
        makeChair(0.75, 0, -Math.PI / 2, darkWoodMat);
    } else if (assetKey === 'asset-set-04') {
        badgeTitle = "Set Banquette Lounge & Table Basse (36k tris)";
        addMesh(new THREE.BoxGeometry(1.5, 0.16, 0.75), oakMat, 0, 0.08, -0.4);
        addMesh(new THREE.BoxGeometry(1.45, 0.14, 0.7), cushionMat, 0, 0.22, -0.4);
        addMesh(new THREE.BoxGeometry(0.8, 0.04, 0.8), darkWoodMat, 0, 0.18, 0.45);
    } else if (assetKey === 'asset-set-05') {
        badgeTitle = "Set Espace Bureau & Siège Studio (29.5k tris)";
        addMesh(new THREE.BoxGeometry(1.3, 0.04, 0.65), oakMat, 0, 0.72, 0);
        [-0.55, 0.55].forEach(x => {
            addMesh(new THREE.BoxGeometry(0.04, 0.7, 0.55), blackMetalMat, x, 0.35, 0);
        });
        makeChair(0, 0.42, Math.PI, oakMat);
    } else if (assetKey === 'asset-set-06') {
        badgeTitle = "Set Balcon Bistrot Table & 2 Chaises (26k tris)";
        addMesh(new THREE.CylinderGeometry(0.38, 0.38, 0.03, 32), cedarMat, 0, 0.72, 0);
        addMesh(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 16), blackMetalMat, 0, 0.35, 0);
        makeChair(-0.55, 0, Math.PI / 2, oakMat);
        makeChair(0.55, 0, -Math.PI / 2, oakMat);
    } else if (assetKey === 'asset-set-07') {
        badgeTitle = "Set Salon Méridienne & Table Verre (46k tris)";
        addMesh(new THREE.BoxGeometry(1.8, 0.18, 0.8), darkWoodMat, 0, 0.09, -0.4);
        addMesh(new THREE.BoxGeometry(0.8, 0.18, 0.9), darkWoodMat, 0.5, 0.09, 0.45);
        addMesh(new THREE.BoxGeometry(1.7, 0.16, 0.7), boucleMat, 0, 0.25, -0.4);
        addMesh(new THREE.BoxGeometry(0.7, 0.16, 0.8), boucleMat, 0.5, 0.25, 0.45);
        addMesh(new THREE.BoxGeometry(0.8, 0.02, 0.5), glassMat, -0.3, 0.18, 0.4);
    } else if (assetKey === 'asset-set-08') {
        badgeTitle = "Set Solarium Duo Transats & Guéridon (37k tris)";
        [-0.45, 0.45].forEach(x => {
            addMesh(new THREE.BoxGeometry(0.58, 0.14, 1.8), cedarMat, x, 0.1, 0);
            addMesh(new THREE.BoxGeometry(0.54, 0.08, 1.15), cushionMat, x, 0.2, 0.3);
            addMesh(new THREE.BoxGeometry(0.54, 0.08, 0.6), cushionMat, x, 0.3, -0.55, 0.35, 0, 0);
        });
        addMesh(new THREE.CylinderGeometry(0.18, 0.18, 0.28, 24), travertineMat, 0, 0.14, 0);
    } else {
        badgeTitle = "Modèle 3D Japandi (" + assetKey + ")";
        addMesh(new THREE.BoxGeometry(0.8, 0.5, 0.8), oakMat, 0, 0.25, 0);
        addMesh(new THREE.BoxGeometry(0.75, 0.1, 0.75), cushionMat, 0, 0.55, 0);
    }

    scene.add(group);
    currentModel = group;

    fitCameraToObject(group);
    updateAllModelBadges(badgeTitle);
}

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
}

// Instance partagée de DRACOLoader pour décompresser les maillages GLB optimisés
let dracoLoaderInstance = null;
let isDracoLoading = false;
let dracoLoadCallbacks = [];

function getDRACOLoader() {
    if (!dracoLoaderInstance && typeof THREE !== 'undefined' && typeof THREE.DRACOLoader !== 'undefined') {
        try {
            dracoLoaderInstance = new THREE.DRACOLoader();
            // CDN officiel Google pour les décodeurs Draco WebAssembly / JS
            dracoLoaderInstance.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.4.3/');
            dracoLoaderInstance.setDecoderConfig({ type: 'js' });
        } catch (e) {
            console.warn('[Viewer3D] Impossible d\'initialiser DRACOLoader:', e);
        }
    }
    return dracoLoaderInstance;
}

/**
 * Garantit que DRACOLoader est chargé, même s'il n'était pas dans le HTML initial
 */
function ensureDRACOLoader(callback) {
    if (typeof THREE !== 'undefined' && typeof THREE.DRACOLoader !== 'undefined') {
        if (callback) callback(getDRACOLoader());
        return;
    }

    if (callback) dracoLoadCallbacks.push(callback);
    if (isDracoLoading) return;
    isDracoLoading = true;

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/DRACOLoader.js';
    script.onload = () => {
        isDracoLoading = false;
        const draco = getDRACOLoader();
        const cbs = dracoLoadCallbacks.slice();
        dracoLoadCallbacks = [];
        cbs.forEach(cb => {
            try { cb(draco); } catch (e) { console.error(e); }
        });
    };
    script.onerror = (err) => {
        isDracoLoading = false;
        console.warn('[Viewer3D] Échec du chargement dynamique de DRACOLoader.js', err);
        const cbs = dracoLoadCallbacks.slice();
        dracoLoadCallbacks = [];
        cbs.forEach(cb => {
            try { cb(null); } catch (e) { console.error(e); }
        });
    };
    document.head.appendChild(script);
}

/**
 * Charge un fichier 3D externe (.glb, .gltf, .obj, .fbx) spécifié dans data-model="..."
 */
function loadExternal3DFile(filePath, assetKey, onFallback) {
    const filename = filePath.split('/').pop().split('\\').pop();
    const ext = filename.split('.').pop().toLowerCase();

    updateAllModelBadges(`Chargement de ${filename}...`);

    const onLoadSuccess = (loadedSceneOrObject) => {
        if (currentAssetKey !== assetKey) return; // Si la page a changé entre-temps
        handleLoaded3DModel(loadedSceneOrObject, filename, filePath);
    };

    const onLoadError = (error) => {
        console.warn(`[Viewer3D] Impossible de charger "${filePath}", utilisation du modèle 3D par défaut.`, error);
        if (currentAssetKey === assetKey) {
            if (typeof onFallback === 'function') {
                onFallback();
            }
        }
    };

    try {
        const cleanUrl = encodeURI(filePath).replace(/%2520/g, '%20');
        if ((ext === 'glb' || ext === 'gltf') && typeof THREE.GLTFLoader !== 'undefined') {
            ensureDRACOLoader((dracoLoader) => {
                const loader = new THREE.GLTFLoader();
                if (dracoLoader) {
                    loader.setDRACOLoader(dracoLoader);
                }
                loader.load(cleanUrl, (gltf) => {
                    onLoadSuccess(gltf.scene || gltf.scenes[0]);
                }, (xhr) => {
                    if (xhr.lengthComputable && xhr.total > 0 && currentAssetKey === assetKey) {
                        const percent = Math.round((xhr.loaded / xhr.total) * 100);
                        updateAllModelBadges(`Chargement ${filename} (${percent}%)...`);
                    }
                }, onLoadError);
            });
        } else if (ext === 'obj' && typeof THREE.OBJLoader !== 'undefined') {
            const loader = new THREE.OBJLoader();
            loader.load(cleanUrl, onLoadSuccess, undefined, onLoadError);
        } else if (ext === 'fbx' && typeof THREE.FBXLoader !== 'undefined') {
            const loader = new THREE.FBXLoader();
            loader.load(cleanUrl, onLoadSuccess, undefined, onLoadError);
        } else {
            console.warn(`[Viewer3D] Format "${ext}" non supporté pour "${filePath}". Formats acceptés : .glb, .gltf, .obj, .fbx`);
            onLoadError(new Error('Format non supporté'));
        }
    } catch (err) {
        onLoadError(err);
    }
}

/**
 * Tente de charger Palette.glb (compatibilité historique)
 */
function loadDefaultPaletteModel() {
    if (typeof THREE.GLTFLoader === 'undefined') return;
    try {
        const gltfLoader = new THREE.GLTFLoader();
        gltfLoader.load('models/Palette.glb', (gltf) => {
            if (currentAssetKey === 'asset-mobilier-interieur') {
                handleLoaded3DModel(gltf.scene, 'Palette.glb', 'models/Palette.glb');
            }
        }, undefined, () => {});
    } catch (e) {}
}

/**
 * Traite et affiche le modèle 3D chargé
 */
function handleLoaded3DModel(object, filename, filePath = '') {
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

            // Correction automatique des matériaux pour éliminer les bugs de transparence (alphaMode: BLEND de Blender)
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach((mat) => {
                if (!mat) return;

                const matName = (mat.name || '').toLowerCase();
                const isGlass = matName.includes('glass') || matName.includes('verre') || matName.includes('vitre');
                const isDecal = matName.includes('epal') || matName.includes('stamp') || matName.includes('logo') || matName.includes('decal');
                const isFabric = matName.includes('fabric') || matName.includes('tissu') || matName.includes('coussin') || matName.includes('cotton') || matName.includes('seat');

                if (isGlass) {
                    // Véritable verre transparent
                    mat.transparent = true;
                    mat.opacity = mat.opacity < 1 ? mat.opacity : 0.35;
                    mat.depthWrite = false;
                } else if (isDecal) {
                    // Logo / Sticker découpé (ex: marquage EPAL) avec découpe alpha nette sans bug de tri
                    mat.transparent = true;
                    mat.alphaTest = 0.3;
                    mat.depthWrite = true;
                    mat.depthTest = true;
                    mat.side = THREE.DoubleSide;
                    child.renderOrder = 1;
                } else {
                    // Objets solides (Tissus, Coussins, Bois, Métal, Cuir, etc.)
                    // Blender exporte souvent alphaMode="BLEND" sur les textures même quand l'objet est 100% opaque.
                    // On force l'opacité et l'écriture dans le Z-Buffer pour éliminer toute transparence indésirable.
                    mat.transparent = false;
                    mat.depthWrite = true;
                    mat.depthTest = true;
                    mat.alphaTest = 0;
                    mat.opacity = 1.0;
                    // DoubleSide indispensable pour les coussins/tissus dont certaines normales ou plis sont tournés vers l'intérieur
                    mat.side = THREE.DoubleSide;
                    mat.shadowSide = THREE.FrontSide;
                    child.renderOrder = 0;

                    if (isFabric) {
                        // Les tissus et coussins doivent être doux et mats : éliminer tout metalness parasite
                        mat.metalness = 0.0;
                        if (mat.roughness === undefined || mat.roughness < 0.75) {
                            mat.roughness = 0.85;
                        }
                    }
                }

                // Filtrage anisotrope pour un rendu net des textures sous tous les angles
                if (mat.map && renderer) {
                    mat.map.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
                }
                mat.needsUpdate = true;
            });
        }
    });

    object.userData = object.userData || {};
    object.userData.sourcePath = filePath;

    scene.add(object);
    currentModel = object;
    fitCameraToObject(object);

    const polyInfo = polyCount > 0 ? ` (${Math.round(polyCount).toLocaleString()} tris)` : '';
    updateAllModelBadges(`${filename}${polyInfo}`);
}

function applyRealisticMaterialsToModel(object) {
    const woodTexture = getProceduralTexture('natural');
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
        start3DViewer();
        resize3DViewer();
        setTimeout(resize3DViewer, 50);
        setTimeout(resize3DViewer, 150);
    } else {
        if (viewport3D) viewport3D.classList.remove('active');
        if (viewportImg) viewportImg.classList.add('active');
        stop3DViewer();
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

    const width = parent.clientWidth || parent.offsetWidth || (parent.parentElement ? parent.parentElement.clientWidth : 0);
    const height = parent.clientHeight || parent.offsetHeight || width;

    if (width > 0 && height > 0) {
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    }
}

let isAnimating = false;

function start3DViewer() {
    if (isAnimating) return;
    isAnimating = true;
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    animate();
}

function stop3DViewer() {
    isAnimating = false;
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}
window.start3DViewer = start3DViewer;
window.stop3DViewer = stop3DViewer;

function animate() {
    if (!isAnimating) return;
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
    if (assetKey && assetKey.startsWith('asset-pack-')) return;
    if (assetKey && (assetKey.startsWith('asset-') || assetKey === 'project-pallet-3d')) {
        mount3DViewerForAsset(assetKey);
    } else {
        const activePageView = document.querySelector('.page-view[style*="block"]');
        if (activePageView && (activePageView.id.startsWith('asset-') || activePageView.id === 'project-pallet-3d') && !activePageView.id.startsWith('asset-pack-')) {
            mount3DViewerForAsset(activePageView.id);
        }
    }
};

/**
 * Changement de modèle interactif dans la section Projet EPAL 3D
 */
function switchPallet3DModel(modelPath, btn, modelName) {
    const palletView = document.getElementById('project-pallet-3d');
    if (!palletView) return;

    palletView.setAttribute('data-model', modelPath);

    if (btn) {
        document.querySelectorAll('.pallet-model-picker-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }

    const titleEl = document.querySelector('.viewer-model-name');
    if (titleEl) {
        if (modelName) {
            titleEl.textContent = modelName;
        } else if (btn) {
            titleEl.textContent = btn.textContent.trim() + ' 3D';
        }
    }

    mount3DViewerForAsset('project-pallet-3d');

    const filename = modelPath.split('/').pop().replace(/\.glb$/i, '');
    updateAllModelBadges(filename);
}
window.switchPallet3DModel = switchPallet3DModel;

