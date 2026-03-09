/* ═══════════════════════════════════════════
   BoardScore — menu.js
   Logique de la page d'accueil
   ═══════════════════════════════════════════ */

/* ── THEME ── */
function getTheme() {
    return localStorage.getItem('boardscore_theme') || 'dark';
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const btn = document.getElementById('themeToggle');
    if (btn) btn.textContent = theme === 'light' ? '☀️' : '🌙';
}

function toggleTheme() {
    const next = getTheme() === 'dark' ? 'light' : 'dark';
    localStorage.setItem('boardscore_theme', next);
    applyTheme(next);
}

applyTheme(getTheme());


/* ── GAMES DATA ── */
const GAMES = [
    {
        id: 'mexican-train',
        name: 'Train Mexicain',
        emoji: '🚂',
        desc: 'Dominos — pose tes tuiles sur le train central',
        tags: ['multi', 'dominos'],
        color: '#f5c542',
        bg: 'rgba(245,197,66,0.12)',
        url: 'games/mexicanTrain/index.html',
        available: true,
    },
    {
        id: 'skyjo',
        name: 'Skyjo',
        emoji: '🃏',
        desc: 'Cartes — minimise ton score en retournant des cartes',
        tags: ['multi', 'cartes'],
        color: '#38bdf8',
        bg: 'rgba(56,189,248,0.12)',
        url: 'games/skyjo/index.html',
        available: true,
    },
    {
        id: 'rami',
        name: 'Rami',
        emoji: '🃏',
        desc: 'Cartes — pose tes combinaisons et vide ta main',
        tags: ['multi', 'cartes'],
        color: '#e05c2a',
        bg: 'rgba(224,92,42,0.12)',
        url: 'games/rami/index.html',
        available: true,
    },
    {
        id: 'uno',
        name: 'Uno',
        emoji: '🎴',
        desc: 'Cartes — vide ta main le premier !',
        tags: ['multi', 'cartes'],
        color: '#fb7185',
        bg: 'rgba(251,113,133,0.12)',
        url: 'games/uno/index.html',
        available: true,
    },
    {
        id: 'yams',
        name: "Yam's",
        emoji: '🎲',
        desc: 'Dés — combinaisons et stratégie',
        tags: ['multi', 'des'],
        color: '#a3e635',
        bg: 'rgba(163,230,53,0.12)',
        url: 'games/yams/index.html',
        available: true,
    },
    {
        id: 'scrabble',
        name: 'Scrabble',
        emoji: '🔠',
        desc: 'Plateau — forme des mots et accumule les points',
        tags: ['multi', 'plateau'],
        color: '#9b59f5',
        bg: 'rgba(155,89,245,0.12)',
        url: null,
        available: false,
    },
];


/* ── FILTERS ── */
const FILTERS = [
    { id: 'all',     label: 'Tous',    emoji: '🎲' },
    { id: 'multi',   label: 'Multi',   emoji: '👥' },
    { id: 'coop',    label: 'Coop',    emoji: '🤝' },
    { id: 'solo',    label: 'Solo',    emoji: '🧍' },
    { id: 'dominos', label: 'Dominos', emoji: '🁣' },
    { id: 'cartes',  label: 'Cartes',  emoji: '🃏' },
    { id: 'des',     label: 'Dés',     emoji: '🎲' },
    { id: 'plateau', label: 'Plateau', emoji: '♟️' },
];

let activeFilter = 'all';

function renderFilters() {
    document.getElementById('filtersBar').innerHTML = FILTERS.map(f =>
        '<button class="filter-btn ' + (f.id === activeFilter ? 'active' : '') + '" onclick="setFilter(\'' + f.id + '\')">' +
        f.emoji + ' ' + f.label + '</button>'
    ).join('');
}

function setFilter(id) {
    activeFilter = id;
    renderFilters();
    filterGames();
}


/* ── RENDER ── */
function tagHtml(tag) {
    const labels = {
        multi: 'Multijoueur', coop: 'Coop', solo: 'Solo',
        dominos: 'Dominos', cartes: 'Cartes', des: 'Dés', plateau: 'Plateau'
    };
    return '<span class="tag tag-' + tag + '">' + (labels[tag] || tag) + '</span>';
}

function filterGames() {
    const search = document.getElementById('searchInput').value.trim().toLowerCase();
    const grid = document.getElementById('gamesGrid');

    const visible = GAMES.filter(g => {
        const matchFilter = activeFilter === 'all' || g.tags.includes(activeFilter);
        const matchSearch = !search ||
            g.name.toLowerCase().includes(search) ||
            g.desc.toLowerCase().includes(search) ||
            g.tags.some(t => t.includes(search));
        return matchFilter && matchSearch;
    });

    document.getElementById('gamesCount').textContent =
        visible.length + ' jeu' + (visible.length > 1 ? 'x' : '');

    if (visible.length === 0) {
        grid.innerHTML = '<div class="empty-state">' +
            '<div class="big-emoji">🔍</div>' +
            '<p>Aucun jeu ne correspond à ta recherche.<br>Essaie un autre filtre !</p>' +
            '</div>';
        return;
    }

    grid.innerHTML = visible.map(g => {
        if (!g.available) {
            return '<div class="game-card soon" style="--game-color:' + g.color + ';--game-bg:' + g.bg + '">' +
                '<span class="soon-badge">Bientôt</span>' +
                '<div class="game-card-inner">' +
                '<div class="game-icon">' + g.emoji + '</div>' +
                '<div class="game-info">' +
                '<div class="game-name">' + g.name + '</div>' +
                '<div class="game-desc">' + g.desc + '</div>' +
                '<div class="game-tags">' + g.tags.map(tagHtml).join('') + '</div>' +
                '</div></div></div>';
        }
        return '<a href="' + g.url + '" class="game-card" style="--game-color:' + g.color + ';--game-bg:' + g.bg + '">' +
            '<div class="game-card-inner">' +
            '<div class="game-icon">' + g.emoji + '</div>' +
            '<div class="game-info">' +
            '<div class="game-name">' + g.name + '</div>' +
            '<div class="game-desc">' + g.desc + '</div>' +
            '<div class="game-tags">' + g.tags.map(tagHtml).join('') + '</div>' +
            '</div>' +
            '<span class="game-arrow">→</span>' +
            '</div></a>';
    }).join('');
}


/* ── INIT ── */
renderFilters();
filterGames();

setTimeout(() => {
    const hint = document.getElementById('installHint');
    if (hint) hint.style.display = 'none';
}, 8000);


/* ── RESET DATA ── */
function confirmReset() {
    const btn = document.querySelector('.reset-btn');
    if (!btn) return;

    // Premier clic → demande de confirmation
    if (!btn.dataset.confirm) {
        btn.dataset.confirm = '1';
        btn.textContent = '⚠️ Confirmer la suppression ?';
        btn.classList.add('confirm');
        // Auto-annuler après 4 secondes
        setTimeout(() => {
            if (btn.dataset.confirm) {
                delete btn.dataset.confirm;
                btn.textContent = '🔄 Réinitialiser les données';
                btn.classList.remove('confirm');
            }
        }, 4000);
        return;
    }

    // Deuxième clic → suppression
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
            key.startsWith('mxt_') ||
            key.startsWith('skyjo_') ||
            key.startsWith('rami_') ||
            key.startsWith('uno_') ||
            key.startsWith('yams_') ||
            key === 'boardscore_theme'
        )) {
            keys.push(key);
        }
    }
    keys.forEach(k => localStorage.removeItem(k));

    btn.textContent = '✅ Données supprimées !';
    btn.classList.remove('confirm');
    btn.classList.add('done');

    setTimeout(() => location.reload(), 800);
}