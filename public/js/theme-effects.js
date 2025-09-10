// Theme Effects - Background Beams & Comet Cards
// Add this script to all pages for consistent styling

// Background Beams HTML
const backgroundBeamsHTML = `
<div class="background-beams">
    <svg viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="beam1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#18CCFC;stop-opacity:0.8" />
                <stop offset="50%" style="stop-color:#6344F5;stop-opacity:0.4" />
                <stop offset="100%" style="stop-color:#AE48FF;stop-opacity:0.2" />
            </linearGradient>
            <linearGradient id="beam2" x1="100%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:#AE48FF;stop-opacity:0.6" />
                <stop offset="50%" style="stop-color:#18CCFC;stop-opacity:0.3" />
                <stop offset="100%" style="stop-color:#6344F5;stop-opacity:0.1" />
            </linearGradient>
            <linearGradient id="beam3" x1="50%" y1="0%" x2="50%" y2="100%">
                <stop offset="0%" style="stop-color:#6344F5;stop-opacity:0.7" />
                <stop offset="50%" style="stop-color:#AE48FF;stop-opacity:0.5" />
                <stop offset="100%" style="stop-color:#18CCFC;stop-opacity:0.2" />
            </linearGradient>
        </defs>
        <path class="beam-path beam-path-1" d="M0,200 Q250,100 500,300 T1000,150" stroke="url(#beam1)" stroke-width="2" fill="none" />
        <path class="beam-path beam-path-2" d="M0,600 Q300,400 600,700 T1000,500" stroke="url(#beam2)" stroke-width="3" fill="none" />
        <path class="beam-path beam-path-3" d="M200,0 Q400,250 600,200 Q800,150 1000,400" stroke="url(#beam3)" stroke-width="2" fill="none" />
    </svg>
</div>`;

// Initialize background beams
function initBackgroundBeams() {
    if (!document.querySelector('.background-beams')) {
        document.body.insertAdjacentHTML('afterbegin', backgroundBeamsHTML);
    }
}

// Comet Card 3D Effect
function initCometCards() {
    const cards = document.querySelectorAll('.comet-card');
    
    cards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            const rotateX = (y - centerY) / centerY * -17.5;
            const rotateY = (x - centerX) / centerX * 17.5;
            
            const translateX = (x - centerX) / centerX * 20;
            const translateY = (y - centerY) / centerY * -20;
            
            card.style.setProperty('--rotate-x', `${rotateX}deg`);
            card.style.setProperty('--rotate-y', `${rotateY}deg`);
            card.style.setProperty('--translate-x', `${translateX}px`);
            card.style.setProperty('--translate-y', `${translateY}px`);
            card.style.setProperty('--mouse-x', `${(x / rect.width) * 100}%`);
            card.style.setProperty('--mouse-y', `${(y / rect.height) * 100}%`);
        });
        
        card.addEventListener('mouseleave', () => {
            card.style.setProperty('--rotate-x', '0deg');
            card.style.setProperty('--rotate-y', '0deg');
            card.style.setProperty('--translate-x', '0px');
            card.style.setProperty('--translate-y', '0px');
        });
    });
}

// Auto-add comet-card class to common card elements
function autoAddCometCards() {
    const cardSelectors = [
        '.stat-card',
        '.monthly-card',
        '.analytics-card',
        '.auth-card',
        '.reading-form',
        '.voucher-form',
        '.filters',
        '.stats-summary'
    ];
    
    cardSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
            if (!el.classList.contains('comet-card')) {
                el.classList.add('comet-card');
            }
        });
    });
}

// Initialize all theme effects
function initThemeEffects() {
    initBackgroundBeams();
    autoAddCometCards();
    initCometCards();
}

// Run on DOM content loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initThemeEffects);
} else {
    initThemeEffects();
}