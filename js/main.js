/* ==========================================================================
   PORTFOLIO ARCHITECTURE & 3D ASSETS - JAVASCRIPT PRINCIPAL
   ========================================================================== */

// --- 1. Gestion du Menu latéral ---
const menuToggle = document.getElementById('menu-toggle');
const sidebar = document.getElementById('sidebar');

if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('active');
        menuToggle.textContent = sidebar.classList.contains('active') ? 'Fermer' : 'Menu';
    });
}

// --- 2. Gestion du changement de page (Vues dynamiques & Navigation History API) ---
const viewAliases = {
    'asset-chaise-kurisu': 'asset-unique-01',
    'asset-table-kanso': 'asset-unique-02',
    'asset-banc-engawa': 'asset-unique-03',
    'asset-suspension-akari': 'asset-unique-29',
    'asset-claustra-kumiko': 'asset-unique-28',
    'asset-fauteuil-yugen': 'asset-unique-27',
    'asset-etagere-sabi': 'asset-unique-18',
    'asset-enfilade-tatami': 'asset-unique-17',
    'asset-vase-kintsugi': 'asset-unique-30',
    'asset-paravent-shibui': 'asset-unique-31',
    'asset-structure-modulaire': 'asset-unique-20',
    'asset-mobilier-interieur': 'asset-unique-06'
};

// État de navigation et mémorisation des positions de défilement
let currentViewId = 'view-home';
let navigationDepth = 0;
const viewScrollPositions = {};

function showView(viewId, options = {}) {
    // 1. Redirection des anciens liens / alias
    if (viewAliases[viewId]) {
        viewId = viewAliases[viewId];
    }

    const targetView = document.getElementById(viewId);
    if (!targetView) {
        console.warn('Vue introuvable :', viewId);
        return;
    }

    // 2. Sauvegarder la position de défilement de l'ancienne vue
    if (currentViewId && currentViewId !== viewId) {
        try {
            viewScrollPositions[currentViewId] = window.scrollY || document.documentElement.scrollTop || 0;
        } catch (e) {}
    }

    // 3. AFFICHAGE IMMÉDIAT ET GARANTI DU DOM (S'exécute toujours en premier sans bloquer)
    document.querySelectorAll('.page-view').forEach(view => {
        view.style.display = 'none';
    });
    targetView.style.display = 'block';

    // 4. Réinitialiser le menu latéral
    if (sidebar && menuToggle) {
        sidebar.classList.remove('active');
        menuToggle.textContent = 'Menu';
    }

    // 5. Gestion propre du défilement
    const shouldRestoreScroll = options.restoreScroll || options.fromPopState;
    if (shouldRestoreScroll && viewScrollPositions[viewId] !== undefined) {
        const savedY = viewScrollPositions[viewId];
        requestAnimationFrame(() => {
            window.scrollTo(0, savedY);
            document.documentElement.scrollTop = savedY;
            document.body.scrollTop = savedY;
        });
    } else {
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
    }

    // 6. Mettre à jour l'identifiant courant
    const previousViewId = currentViewId;
    currentViewId = viewId;

    // 7. Embeds Instagram
    if (window.instgrm && window.instgrm.Embeds) {
        try { window.instgrm.Embeds.process(); } catch (e) {}
    }

    // 8. Configuration d'affichage des médias (Photo HD par défaut pour les fiches 3D)
    if (viewId === 'project-pallet-3d') {
        // Le visualiseur 3D de la page EPAL est activé à la demande (on-click) pour ne pas ralentir l'ouverture de la page.
        // Si l'utilisateur l'a déjà lancé au cours de sa session, on relance le rendu Three.js.
        if (typeof isPalletViewerLaunched !== 'undefined' && isPalletViewerLaunched) {
            if (typeof start3DViewer === 'function') {
                start3DViewer();
            }
        } else {
            if (typeof stop3DViewer === 'function') {
                stop3DViewer();
            }
        }
    } else if (viewId.startsWith('asset-')) {
        const container = targetView.querySelector('.media-viewer-container');
        if (container) {
            const tabs = container.querySelectorAll('.viewer-tab-btn');
            tabs.forEach(t => t.classList.toggle('active', t.dataset.mode === 'image'));
            const vp3D = container.querySelector('.viewer-3d-viewport');
            const vpImg = container.querySelector('.viewer-image-viewport');
            if (vp3D) vp3D.classList.remove('active');
            if (vpImg) vpImg.classList.add('active');
        }
        // Par défaut sur une fiche asset, la photo est affichée : on stoppe la 3D pour préserver le GPU
        if (typeof stop3DViewer === 'function') {
            stop3DViewer();
        }
    } else {
        // Toutes les autres vues (accueil, projets, etc.) : arrêter immédiatement la boucle Three.js
        if (typeof stop3DViewer === 'function') {
            stop3DViewer();
        }
        if (typeof isRotating !== 'undefined' && isRotating) {
            isRotating = false;
            document.querySelectorAll('.btn-rotate-tool').forEach(btn => btn.classList.remove('active'));
        }
    }

    if (viewId === 'project-half-above-the-sea') {
        if (typeof initHalfSeaTideDiagram === 'function') {
            initHalfSeaTideDiagram();
        }
    }

    // 9. MISE À JOUR SÉCURISÉE DE L'HISTORIQUE (protégée contre les restrictions file:// et webviews)
    const pushHistory = options.pushHistory !== false;
    const replaceHistory = options.replaceHistory === true;
    const fromPopState = options.fromPopState === true;

    if (!fromPopState) {
        const targetHash = '#' + viewId;
        try {
            if (replaceHistory) {
                if (window.history && window.history.replaceState) {
                    window.history.replaceState({ viewId: viewId }, '', targetHash);
                }
            } else if (pushHistory) {
                navigationDepth++;
                if (window.history && window.history.pushState) {
                    window.history.pushState({ viewId: viewId, previousViewId: previousViewId }, '', targetHash);
                }
            }
        } catch (historyErr) {
            // Repli sécurisé : mise à jour de l'ancre si pushState échoue
            try {
                if (window.location.hash !== targetHash) {
                    window.location.hash = targetHash;
                }
            } catch (hashErr) {}
        }
    }
}

// Fonction de retour arrière intelligent
function goBack(fallbackViewId = 'view-catalogue') {
    try {
        if (navigationDepth > 0 && window.history && window.history.length > 1) {
            window.history.back();
            return;
        }
    } catch (e) {}
    showView(fallbackViewId, { restoreScroll: true });
}
window.goBack = goBack;

// Écouteur pour la flèche retour et suivant du navigateur (popstate & hashchange)
function handleHistoryNav(e) {
    let targetViewId = e && e.state && e.state.viewId;
    if (!targetViewId) {
        const hash = (window.location.hash || '').replace('#', '').trim();
        targetViewId = hash ? (viewAliases[hash] || hash) : 'view-home';
    }

    if (targetViewId && targetViewId !== currentViewId) {
        if (navigationDepth > 0) {
            navigationDepth--;
        }
        showView(targetViewId, { fromPopState: true, restoreScroll: true, pushHistory: false });
    }
}

window.addEventListener('popstate', handleHistoryNav);
window.addEventListener('hashchange', handleHistoryNav);

// Interception des clics sur tous les boutons "Retour" du site pour assurer un retour propre
document.addEventListener('click', (e) => {
    const backBtn = e.target.closest('.back-button');
    if (!backBtn) return;

    e.preventDefault();
    e.stopPropagation();

    const isProduct = !!backBtn.closest('.fab-product-view');
    const fallback = isProduct ? 'view-catalogue' : 'view-projets-grid';
    goBack(fallback);
}, true);

// Liens de navigation du menu latéral : empêcher tout comportement par défaut '#' intempestif
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
        });
    });
});

// Clic sur le logo pour revenir à l'accueil proprement
const siteLogo = document.querySelector('.site-logo');
if (siteLogo) {
    siteLogo.addEventListener('click', (e) => {
        e.preventDefault();
        showView('view-home');
    });
}

// --- 2b. Filtrage dynamique du catalogue d'assets 3D ---
function filterCatalogue(category, btn) {
    document.querySelectorAll('.catalogue-filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    const items = document.querySelectorAll('#catalogue-items-grid .grid-item');
    items.forEach(item => {
        if (category === 'all' || item.dataset.category === category) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

function filterAndShowCategory(category) {
    showView('view-catalogue');
    const btn = document.querySelector(`.catalogue-filter-btn[onclick*="'${category}'"]`);
    filterCatalogue(category, btn);
}

// Fonction de bascule de photo via les miniatures dans le visualiseur
function switchViewerThumb(thumbBtn, imgSrc) {
    if (!thumbBtn) return;
    const container = thumbBtn.closest('.ecommerce-media') || thumbBtn.closest('.media-viewer-container') || thumbBtn.closest('.ecommerce-media-column') || thumbBtn.closest('.viewer-container') || thumbBtn.closest('.ecommerce-layout');
    if (!container) return;
    const mainImg = container.querySelector('.viewer-image-viewport img');
    if (mainImg) {
        mainImg.src = imgSrc;
    }
    const imgTab = container.querySelector('.viewer-tab-btn[data-mode="image"]') || container.querySelector('.viewer-tab-btn[data-mode="photo"]');
    if (imgTab && typeof switchAssetMediaMode === 'function') {
        switchAssetMediaMode(imgTab, imgTab.dataset.mode || 'photo');
    }
    container.querySelectorAll('.viewer-thumb-btn').forEach(btn => btn.classList.remove('active'));
    thumbBtn.classList.add('active');
}
window.switchViewerThumb = switchViewerThumb;
window.switchAssetPhoto = switchViewerThumb;

// --- 3. Défilement fluide vers le contact depuis n'importe quelle vue ---
function scrollToContact() {
    showView('view-home');
    setTimeout(() => {
        const contactSection = document.getElementById('contact-section');
        if (contactSection) {
            contactSection.scrollIntoView({ behavior: 'smooth' });
        }
    }, 150);
}

// --- 4. Navigation interne des carrousels indépendants ---
const slidesState = {
    'projets-carousel': 1,
    'catalogue-carousel': 1
};

function setupInfiniteCarousels() {
    document.querySelectorAll('.carousel-column').forEach(carousel => {
        // Ignorer les carrousels désactivés / en chantier
        if (carousel.classList.contains('under-construction')) return;

        const slidesContainer = carousel.querySelector('.carousel-slides');
        if (!slidesContainer) return;

        const slides = Array.from(slidesContainer.querySelectorAll('.carousel-item'));
        if (slides.length < 2) return;

        const firstClone = slides[0].cloneNode(true);
        const lastClone = slides[slides.length - 1].cloneNode(true);
        firstClone.dataset.carouselClone = 'true';
        lastClone.dataset.carouselClone = 'true';

        slidesContainer.insertBefore(lastClone, slides[0]);
        slidesContainer.appendChild(firstClone);
        slidesContainer.style.transform = 'translateX(-100%)';

        slidesContainer.addEventListener('transitionend', () => {
            const realTotal = slides.length;
            const currentPosition = slidesState[carousel.id];
            if (currentPosition !== 0 && currentPosition !== realTotal + 1) return;

            slidesContainer.style.transition = 'none';
            slidesState[carousel.id] = currentPosition === 0 ? realTotal : 1;
            slidesContainer.style.transform = `translateX(${slidesState[carousel.id] * -100}%)`;
            void slidesContainer.offsetWidth;
            slidesContainer.style.transition = '';
        });
    });
}

function moveSlide(carouselId, direction) {
    const carousel = document.getElementById(carouselId);
    if (!carousel || carousel.classList.contains('under-construction')) return;

    const slidesContainer = carousel.querySelector('.carousel-slides');
    if (!slidesContainer) return;

    if (slidesState[carouselId] === undefined) {
        slidesState[carouselId] = 1;
    }

    slidesState[carouselId] += direction;
    const offset = slidesState[carouselId] * -100;
    slidesContainer.style.transform = `translateX(${offset}%)`;
}

// --- 5. Recadrage d'images (Géré à 100% de manière fluide par le CSS natif via aspect-ratio et object-fit) ---
function cropAllImagesInFrames() {
    // Remplacé par le CSS natif GPU-accéléré (.img-frame { aspect-ratio: 1/1; } .img-frame img { object-fit: cover; })
    // Évite le gel du thread JavaScript et la conversion lourde en Canvas Base64.
}

// --- 6. Gestionnaire du Formulaire de Contact ---
function escapeContactHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function setupContactForm() {
    const form = document.getElementById('contact-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = document.getElementById('contact-submit-btn');
        const btnText = submitBtn ? submitBtn.querySelector('.btn-text') : null;
        const btnLoader = submitBtn ? submitBtn.querySelector('.btn-loader') : null;
        const feedback = document.getElementById('contact-form-feedback');

        const nameInput = document.getElementById('contact-name');
        const emailInput = document.getElementById('contact-email');
        const messageInput = document.getElementById('contact-message');

        const name = nameInput ? nameInput.value.trim() : '';
        const email = emailInput ? emailInput.value.trim() : '';
        const message = messageInput ? messageInput.value.trim() : '';

        if (!name || !email || !message) {
            if (feedback) {
                feedback.className = 'contact-feedback error';
                feedback.style.display = 'block';
                feedback.textContent = 'Veuillez renseigner tous les champs obligatoires.';
            }
            return;
        }

        // État de chargement
        if (submitBtn) submitBtn.disabled = true;
        if (btnText) btnText.style.display = 'none';
        if (btnLoader) btnLoader.style.display = 'inline-block';
        if (feedback) feedback.style.display = 'none';

        try {
            const formData = new FormData(form);
            const response = await fetch('https://formsubmit.co/ajax/evasseur423@gmail.com', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json'
                },
                body: formData
            });

            const data = await response.json();

            if (response.ok && data.success !== 'false') {
                form.reset();
                if (feedback) {
                    feedback.className = 'contact-feedback success';
                    feedback.style.display = 'block';
                    feedback.innerHTML = `<strong>Merci ${escapeContactHtml(name)} !</strong> Votre message a bien été transmis. Enzo Vasseur vous répondra très rapidement.`;
                }
                if (btnText) {
                    btnText.textContent = 'Message envoyé ✓';
                    btnText.style.display = 'inline-block';
                }
                if (btnLoader) btnLoader.style.display = 'none';

                setTimeout(() => {
                    if (submitBtn) submitBtn.disabled = false;
                    if (btnText) btnText.textContent = 'Envoyer le message';
                }, 5000);
            } else {
                throw new Error(data.message || "Erreur lors de l'envoi");
            }
        } catch (error) {
            console.warn('Erreur transmission formulaire :', error);
            if (feedback) {
                feedback.className = 'contact-feedback error';
                feedback.style.display = 'block';
                const mailtoUrl = `mailto:evasseur423@gmail.com?subject=${encodeURIComponent('Contact Studio - ' + name)}&body=${encodeURIComponent(message + '\n\n---\nExpéditeur : ' + name + ' (' + email + ')')}`;
                feedback.innerHTML = `L'envoi automatique a rencontré une difficulté réseau.<br><a href="${mailtoUrl}" class="contact-mailto-fallback">Cliquez ici pour ouvrir directement votre messagerie email</a>`;
            }
            if (submitBtn) submitBtn.disabled = false;
            if (btnText) {
                btnText.textContent = 'Réessayer';
                btnText.style.display = 'inline-block';
            }
            if (btnLoader) btnLoader.style.display = 'none';
        }
    });
}

// Initialisation du routeur au chargement initial (support direct des URL avec ancre #)
function initRouter() {
    let initialView = 'view-home';
    try {
        const hash = (window.location.hash || '').replace('#', '').trim();
        if (hash) {
            const resolved = viewAliases[hash] || hash;
            if (document.getElementById(resolved)) {
                initialView = resolved;
            }
        }
    } catch (e) {}

    // Rendre la vue initiale visible et initialiser l'état d'historique en toute sécurité
    showView(initialView, { pushHistory: false, replaceHistory: true, restoreScroll: false });
}

// Initialisations au chargement
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initRouter();
        setupInfiniteCarousels();
        setupContactForm();
    });
} else {
    initRouter();
    setupInfiniteCarousels();
    setupContactForm();
}



/* ==========================================================================
   MODULE INTERACTIF COMPACT : SCHÉMA COUPE TECHNIQUE DE MARÉE (HALF ABOVE THE SEA)
   ========================================================================== */

let halfSeaAnimInterval = null;
let halfSeaAnimDirection = 1;

function updateHalfSeaTide(val) {
    const slider = document.getElementById('half-sea-tide-slider');
    const valDisplay = document.getElementById('half-sea-tide-val');
    const statusBadge = document.getElementById('half-sea-status-badge');
    const waterRect = document.getElementById('half-sea-water-rect');
    const waterSurface = document.getElementById('half-sea-water-surface');
    const floatingStructure = document.getElementById('half-sea-floating-structure');
    const floatingBoat = document.getElementById('half-sea-floating-boat');

    if (!slider || !waterRect || !floatingStructure) return;

    val = parseFloat(val);
    if (valDisplay) valDisplay.textContent = Math.round(val) + '%';

    // Bornes de marée en Y SVG (viewBox 0 0 960 430)
    const WATER_Y_MIN = 345; // Basse mer (0%)
    const WATER_Y_MAX = 225; // Pleine mer (100%)
    const WATER_DELTA = WATER_Y_MIN - WATER_Y_MAX; // 120px d'amplitude (2.8m réels)

    // 1. Niveau de l'eau
    const waterY = WATER_Y_MIN - (val / 100) * WATER_DELTA;
    waterRect.setAttribute('y', waterY);
    waterRect.setAttribute('height', 430 - waterY);

    if (waterSurface) {
        const waveD = `M 0 ${waterY} Q 60 ${waterY - 2}, 120 ${waterY} T 240 ${waterY} T 360 ${waterY} T 480 ${waterY} T 600 ${waterY} T 720 ${waterY} T 840 ${waterY} T 960 ${waterY}`;
        waterSurface.setAttribute('d', waveD);
    }

    // 2. Déplacement de la pirogue (flotte directement avec la surface de l'eau dès 0%)
    if (floatingBoat) {
        const boatDeltaY = - ((val / 100) * WATER_DELTA);
        floatingBoat.style.transform = `translateY(${boatDeltaY}px)`;
    }

    // 3. Mouvement de la structure amphibie (pavillon)
    // De 0% à 30% : posée sur pilotis de repos (deltaY = 0)
    // Au-delà de 30% : flottaison active par poussée d'Archimède synchronisée avec la marée
    if (val <= 30) {
        floatingStructure.style.transform = 'translateY(0px)';
        if (statusBadge) {
            statusBadge.textContent = "Appui sur pilotis (BM)";
            statusBadge.className = "half-sea-status-badge status-resting";
        }
    } else {
        const riseRatio = (val - 30) / 70; // 0 à 1 entre 30% et 100%
        const structureDeltaY = - (riseRatio * (WATER_DELTA * 0.70));
        floatingStructure.style.transform = `translateY(${structureDeltaY}px)`;

        if (statusBadge) {
            const metersRise = ((val - 30) / 70 * 2.1).toFixed(2);
            statusBadge.textContent = `Flottaison active (+${metersRise}m)`;
            statusBadge.className = "half-sea-status-badge status-floating";
        }
    }
}

function setHalfSeaTide(val, btn) {
    stopHalfSeaTideCycle();
    const slider = document.getElementById('half-sea-tide-slider');
    if (slider) slider.value = val;
    updateHalfSeaTide(val);

    document.querySelectorAll('.half-sea-btn-mini').forEach(b => {
        if (b.id !== 'half-sea-play-cycle-btn') b.classList.remove('active');
    });
    if (btn) btn.classList.add('active');
}

function toggleHalfSeaTideCycle() {
    const playBtn = document.getElementById('half-sea-play-cycle-btn');
    const slider = document.getElementById('half-sea-tide-slider');
    if (!slider) return;

    if (halfSeaAnimInterval) {
        stopHalfSeaTideCycle();
    } else {
        if (playBtn) {
            playBtn.textContent = "⏸ Pause";
            playBtn.classList.add('active');
        }
        halfSeaAnimInterval = setInterval(() => {
            let current = parseFloat(slider.value);
            current += halfSeaAnimDirection * 0.6;
            if (current >= 100) {
                current = 100;
                halfSeaAnimDirection = -1;
            } else if (current <= 0) {
                current = 0;
                halfSeaAnimDirection = 1;
            }
            slider.value = current;
            updateHalfSeaTide(current);
        }, 30);
    }
}

function stopHalfSeaTideCycle() {
    if (halfSeaAnimInterval) {
        clearInterval(halfSeaAnimInterval);
        halfSeaAnimInterval = null;
    }
    const playBtn = document.getElementById('half-sea-play-cycle-btn');
    if (playBtn) {
        playBtn.textContent = "▶ Cycle auto";
        playBtn.classList.remove('active');
    }
}

function initHalfSeaTideDiagram() {
    const slider = document.getElementById('half-sea-tide-slider');
    const wrapper = document.getElementById('half-sea-svg-wrapper');
    const tooltip = document.getElementById('half-sea-diagram-tooltip');

    if (slider) {
        slider.addEventListener('input', (e) => {
            stopHalfSeaTideCycle();
            updateHalfSeaTide(e.target.value);
            document.querySelectorAll('.half-sea-btn-mini').forEach(b => {
                if (b.id !== 'half-sea-play-cycle-btn') b.classList.remove('active');
            });
        });
    }

    if (wrapper && tooltip) {
        wrapper.querySelectorAll('.half-sea-interactive-part').forEach(part => {
            part.addEventListener('mousemove', (e) => {
                const tipText = part.getAttribute('data-tooltip');
                if (!tipText) return;

                const rect = wrapper.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                tooltip.innerHTML = tipText;
                tooltip.style.left = x + 'px';
                tooltip.style.top = y + 'px';
                tooltip.style.opacity = '1';
            });

            part.addEventListener('mouseleave', () => {
                tooltip.style.opacity = '0';
            });
        });
    }

    updateHalfSeaTide(0);
}

window.updateHalfSeaTide = updateHalfSeaTide;
window.setHalfSeaTide = setHalfSeaTide;
window.toggleHalfSeaTideCycle = toggleHalfSeaTideCycle;
window.stopHalfSeaTideCycle = stopHalfSeaTideCycle;
window.initHalfSeaTideDiagram = initHalfSeaTideDiagram;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHalfSeaTideDiagram);
} else {
    initHalfSeaTideDiagram();
}
