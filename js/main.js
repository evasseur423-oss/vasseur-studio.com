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

// --- 2. Gestion du changement de page (Vues dynamiques) ---
function showView(viewId) {
    // Masquer toutes les sections de page
    document.querySelectorAll('.page-view').forEach(view => {
        view.style.display = 'none';
    });

    // Afficher la section demandée
    const targetView = document.getElementById(viewId);
    if (targetView) {
        targetView.style.display = 'block';
    }

    // Réinitialiser le menu
    if (sidebar && menuToggle) {
        sidebar.classList.remove('active');
        menuToggle.textContent = 'Menu';
    }

    // Remonter immédiatement en haut de page sans animation
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    // Réinitialiser les embeds Instagram au changement de vue
    if (window.instgrm && window.instgrm.Embeds) {
        window.instgrm.Embeds.process();
    }

    // Initialiser ou redimensionner le visualiseur 3D si une vue d'asset est active
    if (viewId.startsWith('asset-') && typeof initOrResizeViewer3D === 'function') {
        setTimeout(() => initOrResizeViewer3D(viewId), 60);
    }
}

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

// --- 5. Utilitaire de recadrage d'images carrées via Canvas ---
async function cropImageToSquare(img) {
    try {
        if (!img.complete) {
            await new Promise(resolve => {
                img.onload = resolve;
                img.onerror = resolve;
            });
        }

        const naturalW = img.naturalWidth || img.width;
        const naturalH = img.naturalHeight || img.height;
        if (!naturalW || !naturalH) return;

        // Déterminer la taille cible d'après le conteneur
        const frame = img.closest('.img-frame') || img.parentElement;
        const frameRect = frame.getBoundingClientRect();
        const displaySize = Math.max(frameRect.width, frameRect.height, 150);
        const dpr = Math.max(1, window.devicePixelRatio || 1);
        const target = Math.round(displaySize * dpr);

        const scale = Math.max(target / naturalW, target / naturalH);
        const drawW = Math.round(naturalW * scale);
        const drawH = Math.round(naturalH * scale);

        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = target;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Centrer l'image comme un object-fit: cover
        const dx = Math.round((target - drawW) / 2);
        const dy = Math.round((target - drawH) / 2);
        ctx.drawImage(img, dx, dy, drawW, drawH);

        // Utiliser JPEG pour optimiser la taille sauf si PNG avec transparence
        const mime = (/\.png$/i.test(img.src) || img.src.indexOf('data:image/png') === 0) ? 'image/png' : 'image/jpeg';
        const dataUrl = canvas.toDataURL(mime, 0.98);

        // Remplacer la source uniquement si le canvas a réussi
        img.src = dataUrl;
        img.style.objectFit = 'cover';
        if (img.decoded) img.decoded();
    } catch (e) {
        // En cas d'erreur CORS, fallback sur object-fit CSS natif
        console.warn('cropImageToSquare ignoré (CORS ou erreur) :', img.src, e.message);
    }
}

async function cropAllImagesInFrames() {
    const imgs = Array.from(document.querySelectorAll('.img-frame img'))
        .filter(img => !img.closest('.project-detail-wrapper'));
    for (const img of imgs) {
        if (img.dataset.crop === 'false') continue;
        if (img.src.startsWith('data:')) continue;
        await cropImageToSquare(img);
    }
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

// Initialisations au chargement
document.addEventListener('DOMContentLoaded', () => {
    setupInfiniteCarousels();
    setupContactForm();
});

window.addEventListener('load', () => {
    setTimeout(cropAllImagesInFrames, 250);
});

let _cropTimeout;
window.addEventListener('resize', () => {
    clearTimeout(_cropTimeout);
    _cropTimeout = setTimeout(cropAllImagesInFrames, 300);
});

