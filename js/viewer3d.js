/* ==========================================================================
   LECTEUR DE FICHIER 3D INTERACTIF - GLTF / GLB / FBX
   Portfolio Architecture & Catalogue Japandi
   ========================================================================== */

let scene, camera, renderer, controls;
let currentModel = null;
let defaultDemoGroup = null;
let isRotating = false;
let isWireframe = false;
let isInitialized = false;
let animationFrameId = null;

// Textures procédurales de bois pour matériaux réalistes
let woodTextureCache = {};
let currentWoodFinish = 'natural'; // 'natural', 'weathered', 'dark'

/**
 * Génère une texture de bois procédurale haute résolution (Grain, fibres, cernes)
 */
function getWoodTexture(finish = 'natural') {
    if (woodTextureCache[finish]) {
        return woodTextureCache[finish];
    }

    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    let baseColorHex, darkColorHex;
    if (finish === 'weathered') {
        baseColorHex = 0xb5a99a; // Bois vieilli / patine grise
        darkColorHex = 0x766c60;
    } else if (finish === 'dark') {
        baseColorHex = 0x4a3b32; // Noyer sombre
        darkColorHex = 0x2c221c;
    } else {
        baseColorHex = 0xd5be9e; // Pin clair naturel / Palette neuve
        darkColorHex = 0x9b7e5c;
    }

    const baseColor = new THREE.Color(baseColorHex);
    const darkColor = new THREE.Color(darkColorHex);

    // Fond de base
    ctx.fillStyle = '#' + baseColor.getHexString();
    ctx.fillRect(0, 0, 1024, 1024);

    // Fibres longitudinales fines
    for (let i = 0; i < 750; i++) {
        const y = Math.random() * 1024;
        const h = Math.random() * 3 + 1;
        const alpha = Math.random() * 0.18 + 0.05;
        ctx.fillStyle = `rgba(${Math.round(darkColor.r * 255)}, ${Math.round(darkColor.g * 255)}, ${Math.round(darkColor.b * 255)}, ${alpha})`;
        ctx.fillRect(0, y, 1024, h);
    }

    // Lignes de cernes ondulées
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 35; i++) {
        const startY = Math.random() * 1024;
        ctx.strokeStyle = `rgba(${Math.round(darkColor.r * 255)}, ${Math.round(darkColor.g * 255)}, ${Math.round(darkColor.b * 255)}, 0.15)`;
        ctx.beginPath();
        ctx.moveTo(0, startY);
        let cy = startY;
        for (let x = 0; x <= 1024; x += 64) {
            cy += (Math.random() - 0.5) * 6;
            ctx.lineTo(x, cy);
        }
        ctx.stroke();
    }

    // Noeuds discrets
    for (let k = 0; k < 2; k++) {
        const kx = Math.random() * 700 + 150;
        const ky = Math.random() * 700 + 150;
        const grad = ctx.createRadialGradient(kx, ky, 3, kx, ky, 36);
        grad.addColorStop(0, `rgba(${Math.round(darkColor.r * 255 * 0.65)}, ${Math.round(darkColor.r * 255 * 0.65)}, ${Math.round(darkColor.b * 255 * 0.65)}, 0.4)`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(kx, ky, 28, 10, Math.PI / 16, 0, Math.PI * 2);
        ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);

    woodTextureCache[finish] = texture;
    return texture;
}

/**
 * Initialise le visualiseur 3D Three.js dans le conteneur carré
 */
function init3DViewer() {
    const container = document.getElementById('three-canvas-wrapper');
    if (!container) return;

    if (isInitialized) {
        resize3DViewer();
        return;
    }

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 600;

    // 1. Scène
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf7f7f5);

    // 2. Caméra
    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(3.5, 2.5, 3.5);

    // 3. Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    if (THREE.sRGBEncoding) {
        renderer.outputEncoding = THREE.sRGBEncoding;
    } else if (THREE.SRGBColorSpace) {
        renderer.outputColorSpace = THREE.SRGBColorSpace;
    }
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 4. OrbitControls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 + 0.04;
    controls.minDistance = 0.8;
    controls.maxDistance = 20;
    controls.target.set(0, 0.25, 0);

    // 5. Éclairage Studio
    setupStudioLights();

    // 6. Sol avec ombres douces et grille
    setupGroundPlane();

    // 7. Modèle de secours (Palette procédurale en attendant le chargement du GLB/GLTF)
    createProceduralPaletteDemo();

    // 8. Boucle d'animation
    isInitialized = true;
    animate();

    window.addEventListener('resize', resize3DViewer);

    // 9. Chargement automatique prioritaire de Palette.glb / Palette.gltf
    loadDefaultPaletteModel();
}

/**
 * Configure un éclairage de studio architectural chaleureux
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
 * Sol studio avec récepteur d'ombres douces
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
 * Crée une palette en bois 3D procédurale (Euro-pallet standard)
 * Utilisée immédiatement pour avoir un rendu visuel instantané
 */
function createProceduralPaletteDemo() {
    if (defaultDemoGroup) {
        scene.remove(defaultDemoGroup);
    }

    defaultDemoGroup = new THREE.Group();
    defaultDemoGroup.name = 'ProceduralPalette';

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
    const zPositions = [-0.35, -0.175, 0, 0.175, 0.35];

    zPositions.forEach((z, i) => {
        const plank = new THREE.Mesh(topPlankGeo, createWoodMat((i % 3 - 1) * 0.03));
        plank.position.set(0, 0.133, z);
        plank.castShadow = true;
        plank.receiveShadow = true;
        defaultDemoGroup.add(plank);
    });

    // 2. Traverses intermédiaires (3 traverses perpendiculaires)
    const crossPlankGeo = new THREE.BoxGeometry(0.145, 0.022, 0.8);
    const xPositions = [-0.52, 0, 0.52];

    xPositions.forEach((x, i) => {
        const cross = new THREE.Mesh(crossPlankGeo, createWoodMat(-0.02));
        cross.position.set(x, 0.111, 0);
        cross.castShadow = true;
        cross.receiveShadow = true;
        defaultDemoGroup.add(cross);
    });

    // 3. Dés en bois (9 blocs de fixation)
    const blockGeo = new THREE.BoxGeometry(0.145, 0.078, 0.145);
    xPositions.forEach(x => {
        [-0.32, 0, 0.32].forEach(z => {
            const block = new THREE.Mesh(blockGeo, createWoodMat(0.02));
            block.position.set(x, 0.061, z);
            block.castShadow = true;
            block.receiveShadow = true;
            defaultDemoGroup.add(block);
        });
    });

    // 4. Lattes inférieures (3 lattes de semelle)
    const bottomPlankGeo = new THREE.BoxGeometry(1.2, 0.022, 0.145);
    [-0.32, 0, 0.32].forEach(z => {
        const bPlank = new THREE.Mesh(bottomPlankGeo, createWoodMat(-0.01));
        bPlank.position.set(0, 0.011, z);
        bPlank.castShadow = true;
        bPlank.receiveShadow = true;
        defaultDemoGroup.add(bPlank);
    });

    scene.add(defaultDemoGroup);
    currentModel = defaultDemoGroup;
    updateModelBadge("Palette 3D");
}

/**
 * Tente de charger automatiquement models/Palette.glb ou models/Palette.gltf
 */
function loadDefaultPaletteModel() {
    const candidates = [
        'models/Palette.glb',
        'models/Palette.gltf',
        'models/palette.glb',
        'models/palette.gltf',
        'models/Palette.fbx'
    ];

    if (typeof THREE.GLTFLoader === 'undefined') {
        setTimeout(loadDefaultPaletteModel, 100);
        return;
    }

    if (window.location.protocol.startsWith('http')) {
        let loaded = false;
        for (const path of candidates) {
            if (loaded) break;
            fetch(path, { method: 'HEAD' })
                .then(res => {
                    if (res.ok && !loaded) {
                        loaded = true;
                        const filename = path.split('/').pop();
                        if (path.toLowerCase().endsWith('.glb') || path.toLowerCase().endsWith('.gltf')) {
                            loadGLTFData(path, filename);
                        } else if (path.toLowerCase().endsWith('.fbx') && typeof THREE.FBXLoader !== 'undefined') {
                            loadFBXData(path, filename);
                        }
                    }
                })
                .catch(() => {});
        }
    } else {
        // Mode local file://
        try {
            const gltfLoader = new THREE.GLTFLoader();
            gltfLoader.load(
                'models/Palette.glb',
                (gltf) => handleLoaded3DModel(gltf.scene, 'Palette.glb'),
                undefined,
                () => {
                    // Si Palette.glb n'est pas encore présent, essayer Palette.fbx
                    if (typeof THREE.FBXLoader !== 'undefined') {
                        try {
                            const fbxLoader = new THREE.FBXLoader();
                            fbxLoader.load(
                                'models/Palette.fbx',
                                (fbx) => handleLoaded3DModel(fbx, 'Palette.fbx'),
                                undefined,
                                () => {
                                    updateModelBadge("Palette 3D");
                                }
                            );
                        } catch (e) {}
                    }
                }
            );
        } catch (e) {}
    }
}

/**
 * Ajuste et applique des matériaux PBR bois réalistes sur le modèle 3D
 */
function applyRealisticMaterialsToModel(object) {
    const woodTexture = getWoodTexture(currentWoodFinish);
    let meshIndex = 0;

    object.traverse((child) => {
        if (child.isMesh) {
            meshIndex++;
            child.castShadow = true;
            child.receiveShadow = true;

            if (child.geometry) {
                child.geometry.computeVertexNormals();
            }

            // Vérifier si le modèle glTF a déjà ses propres textures intégrées
            let hasValidTextureMap = false;
            if (child.material) {
                const m = Array.isArray(child.material) ? child.material[0] : child.material;
                if (m.map && m.map.image) {
                    hasValidTextureMap = true;
                }
            }

            if (!hasValidTextureMap) {
                // Remplacement automatique par un shader bois texturé
                const toneVariation = ((meshIndex % 7) - 3) * 0.025;
                let baseCol;
                if (currentWoodFinish === 'weathered') {
                    baseCol = new THREE.Color(0xb2a696);
                } else if (currentWoodFinish === 'dark') {
                    baseCol = new THREE.Color(0x524238);
                } else {
                    baseCol = new THREE.Color(0xd6be9e);
                }
                baseCol.offsetHSL(0, 0, toneVariation);

                child.material = new THREE.MeshStandardMaterial({
                    color: baseCol,
                    map: woodTexture,
                    roughness: 0.72,
                    metalness: 0.02,
                    side: THREE.DoubleSide,
                    vertexColors: false
                });
            } else {
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.forEach(mat => {
                    mat.side = THREE.DoubleSide;
                    mat.vertexColors = false;
                    if (mat.color && (mat.color.r < 0.08 && mat.color.g < 0.08 && mat.color.b < 0.08)) {
                        mat.color.setHex(0xffffff);
                    }
                    mat.needsUpdate = true;
                });
            }
        }
    });
}

/**
 * Cadrage et centrage parfait de la caméra sur le modèle 3D
 */
function fitCameraToObject(object, offset = 1.35) {
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
    cameraZ = Math.max(cameraZ, 2.0);

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
 * Traite et affiche le modèle 3D chargé
 */
function handleLoaded3DModel(object, filename) {
    if (!object) {
        showViewerLoading(false);
        return;
    }

    if (currentModel) {
        scene.remove(currentModel);
    }
    if (defaultDemoGroup && defaultDemoGroup !== currentModel) {
        scene.remove(defaultDemoGroup);
    }

    let polyCount = 0;
    object.traverse((child) => {
        if (child.isMesh && child.geometry) {
            if (child.geometry.index) {
                polyCount += child.geometry.index.count / 3;
            } else if (child.geometry.attributes && child.geometry.attributes.position) {
                polyCount += child.geometry.attributes.position.count / 3;
            }
        }
    });

    applyRealisticMaterialsToModel(object);

    scene.add(object);
    currentModel = object;

    fitCameraToObject(object);

    showViewerLoading(false);

    const polyInfo = polyCount > 0 ? ` (${Math.round(polyCount).toLocaleString()} triangles)` : '';
    updateModelBadge(`${filename}${polyInfo}`);
}

/**
 * Charge un fichier GLB / GLTF (Format Web Standard Haute Performance)
 */
function loadGLTFData(data, filename = "Palette.glb") {
    showViewerLoading(true, `Chargement GLTF : ${filename}...`);

    try {
        if (!THREE.GLTFLoader) {
            throw new Error("GLTFLoader n'est pas encore disponible.");
        }

        const loader = new THREE.GLTFLoader();

        if (typeof data === 'string') {
            loader.load(
                data,
                (gltf) => handleLoaded3DModel(gltf.scene, filename),
                (xhr) => {
                    if (xhr.lengthComputable && xhr.total > 0) {
                        const percent = Math.round((xhr.loaded / xhr.total) * 100);
                        updateLoadingProgress(`Chargement : ${percent}%`);
                    }
                },
                (error) => {
                    console.error("Erreur de chargement GLTF :", error);
                    showViewerLoading(false);
                }
            );
        } else {
            // Parsing direct depuis ArrayBuffer (Drag & Drop ou File Input)
            loader.parse(
                data,
                '',
                (gltf) => handleLoaded3DModel(gltf.scene, filename),
                (error) => {
                    console.error("Erreur parsing GLTF :", error);
                    showViewerLoading(false);
                    alert(`Erreur de lecture GLTF : ${error.message || error}`);
                }
            );
        }
    } catch (e) {
        console.error("Erreur lors de la lecture du GLTF :", e);
        showViewerLoading(false);
        alert(`Erreur de lecture GLTF : ${e.message}`);
    }
}

/**
 * Charge un fichier FBX
 */
function loadFBXData(data, filename = "Palette.fbx") {
    showViewerLoading(true, `Chargement FBX : ${filename}...`);

    try {
        if (!THREE.FBXLoader) {
            throw new Error("FBXLoader n'est pas disponible.");
        }

        const loader = new THREE.FBXLoader();

        if (typeof data === 'string') {
            loader.load(
                data,
                (fbx) => handleLoaded3DModel(fbx, filename),
                (xhr) => {
                    if (xhr.lengthComputable && xhr.total > 0) {
                        const percent = Math.round((xhr.loaded / xhr.total) * 100);
                        updateLoadingProgress(`Chargement : ${percent}%`);
                    }
                },
                (error) => {
                    console.error("Erreur de chargement FBX :", error);
                    showViewerLoading(false);
                }
            );
        } else {
            const loadedObject = loader.parse(data, '');
            handleLoaded3DModel(loadedObject, filename);
        }
    } catch (e) {
        console.error("Erreur lors de la lecture du FBX :", e);
        showViewerLoading(false);
    }
}

/**
 * Charge un fichier OBJ
 */
function loadOBJData(data, filename = "modele.obj") {
    showViewerLoading(true, `Chargement OBJ : ${filename}...`);
    try {
        const loader = new THREE.OBJLoader();
        if (typeof data === 'string') {
            loader.load(data, (obj) => handleLoaded3DModel(obj, filename), undefined, () => showViewerLoading(false));
        } else {
            const textDecoder = new TextDecoder();
            const text = typeof data === 'string' ? data : textDecoder.decode(data);
            const obj = loader.parse(text);
            handleLoaded3DModel(obj, filename);
        }
    } catch (e) {
        console.error("Erreur OBJ :", e);
        showViewerLoading(false);
    }
}

/**
 * Change de mode : 3D ou Photo Rendu
 */
function switchMediaMode(mode) {
    const viewport3D = document.getElementById('viewer-3d-viewport');
    const viewportImg = document.getElementById('viewer-image-viewport');
    const tabs = document.querySelectorAll('.viewer-tab-btn');

    tabs.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    if (mode === '3d') {
        if (viewport3D) viewport3D.classList.add('active');
        if (viewportImg) viewportImg.classList.remove('active');
        init3DViewer();
        resize3DViewer();
    } else {
        if (viewport3D) viewport3D.classList.remove('active');
        if (viewportImg) viewportImg.classList.add('active');
    }
}

/**
 * Bascule la rotation automatique 360°
 */
function toggle3DRotation() {
    isRotating = !isRotating;
    const btn = document.getElementById('btn-rotate');
    if (btn) btn.classList.toggle('active', isRotating);
}

/**
 * Bascule le mode filaire (Wireframe)
 */
function toggle3DWireframe() {
    isWireframe = !isWireframe;
    const btn = document.getElementById('btn-wireframe');
    if (btn) btn.classList.toggle('active', isWireframe);

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

/**
 * Réinitialise la caméra
 */
function reset3DCamera() {
    if (currentModel) {
        fitCameraToObject(currentModel);
    } else if (camera && controls) {
        camera.position.set(3.5, 2.5, 3.5);
        controls.target.set(0, 0.25, 0);
        controls.update();
    }
}

/**
 * Plein Écran
 */
function toggle3DFullscreen() {
    const container = document.getElementById('furniture-3d-container');
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

/**
 * Badge de statut
 */
function updateModelBadge(text) {
    const badgeText = document.getElementById('viewer-model-name');
    if (badgeText) {
        badgeText.textContent = text;
    }
}

/**
 * Indicateur de chargement
 */
function showViewerLoading(show, message = "Chargement...") {
    const overlay = document.getElementById('viewer-loading');
    const textEl = overlay ? overlay.querySelector('.viewer-loading-text') : null;
    if (overlay) {
        overlay.style.display = show ? 'flex' : 'none';
        if (textEl) textEl.textContent = message;
    }
}

function updateLoadingProgress(message) {
    const overlay = document.getElementById('viewer-loading');
    const textEl = overlay ? overlay.querySelector('.viewer-loading-text') : null;
    if (textEl) textEl.textContent = message;
}

/**
 * Redimensionnement
 */
function resize3DViewer() {
    if (!renderer || !camera) return;
    const container = document.getElementById('three-canvas-wrapper');
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    if (width > 0 && height > 0) {
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    }
}

/**
 * Boucle de rendu principale
 */
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

// Initialisation globale lorsque la vue du catalogue mobilier est ouverte
window.initOrResizeViewer3D = function() {
    const pageView = document.getElementById('asset-mobilier-interieur');
    if (pageView && pageView.style.display !== 'none') {
        setTimeout(() => {
            init3DViewer();
            resize3DViewer();
        }, 50);
    }
};
