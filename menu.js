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


/* ── GAMES DATA — chargé depuis common/games-registry.js ── */
const GAMES = window.GAMES_REGISTRY;

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


/* ── INFO MODAL ── */
function openInfoModal() {
    document.getElementById('infoModal').classList.add('open');
}
function closeInfoModal(e) {
    if (e.target === document.getElementById('infoModal')) {
        document.getElementById('infoModal').classList.remove('open');
    }
}


/* ── RESET MODAL ── */
function openResetModal() {
    // Remettre tous les boutons à leur état initial
    ['resetGames', 'resetPlayers', 'resetAll'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.dataset.confirm = '';
            btn.classList.remove('confirming', 'done');
            // Restaurer le contenu original
            renderResetBtn(id);
        }
    });
    document.getElementById('resetModal').classList.add('open');
}
function closeResetModal(e) {
    if (e.target === document.getElementById('resetModal')) {
        document.getElementById('resetModal').classList.remove('open');
    }
}

const RESET_BTN_CONTENT = {
    games: {
        icon: '🎮',
        title: 'Données de jeu',
        sub: 'Parties en cours + historique des victoires<br><em>Les joueurs enregistrés sont conservés</em>',
        confirmTitle: '⚠️ Confirmer ?',
        confirmSub: 'Les parties et les statistiques des parties seront effacées'
    },
    players: {
        icon: '👥',
        title: 'Joueurs enregistrés',
        sub: 'Supprime les joueurs enregistrés et leurs statistiques<br><em>Les parties en cours sont conservées</em>',
        confirmTitle: '⚠️ Confirmer ?',
        confirmSub: 'Tous tes joueurs enregistrés et statistiques seront supprimés'
    },
    all: {
        icon: '💥',
        title: 'Tout réinitialiser',
        sub: 'Efface absolument toutes les données',
        confirmTitle: '⚠️ Confirmer ?',
        confirmSub: 'Toutes les données seront définitivement effacées'
    }
};

function renderResetBtn(type) {
    const btn = document.getElementById('reset' + type.charAt(0).toUpperCase() + type.slice(1));
    if (!btn) return;
    const c = RESET_BTN_CONTENT[type];
    btn.innerHTML =
        '<span class="ro-icon">' + c.icon + '</span>' +
        '<div class="ro-text">' +
        '<div class="ro-title">' + c.title + '</div>' +
        '<div class="ro-sub">' + c.sub + '</div>' +
        '</div>';
}

let resetTimers = {};

function doReset(type) {
    const idMap = { games: 'resetGames', players: 'resetPlayers', all: 'resetAll' };
    const btn = document.getElementById(idMap[type]);
    if (!btn) return;

    // Premier clic → demande confirmation
    if (!btn.dataset.confirm) {
        btn.dataset.confirm = '1';
        btn.classList.add('confirming');
        const c = RESET_BTN_CONTENT[type];
        btn.innerHTML =
            '<span class="ro-icon">⚠️</span>' +
            '<div class="ro-text">' +
            '<div class="ro-title">' + c.confirmTitle + '</div>' +
            '<div class="ro-sub">' + c.confirmSub + '</div>' +
            '</div>';

        // Auto-annuler après 4s
        clearTimeout(resetTimers[type]);
        resetTimers[type] = setTimeout(() => {
            if (btn.dataset.confirm) {
                btn.dataset.confirm = '';
                btn.classList.remove('confirming');
                renderResetBtn(type);
            }
        }, 4000);
        return;
    }

    // Deuxième clic → suppression effective
    clearTimeout(resetTimers[type]);

    const GAME_KEYS = window.GAME_KEYS.map(k => k + '_');
    const PLAYER_KEYS = ['boardscore_players'];
    const MATCH_KEYS = ['boardscore_matches'];
    const OTHER_KEYS = ['boardscore_theme'];

    const toDelete = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        const isGame = GAME_KEYS.some(p => key.startsWith(p)) || MATCH_KEYS.includes(key);
        const isPlayer = PLAYER_KEYS.includes(key);
        const isOther = OTHER_KEYS.includes(key);

        if (type === 'all' && (isGame || isPlayer || isOther)) toDelete.push(key);
        else if (type === 'games' && (isGame)) toDelete.push(key);
        else if (type === 'players' && (isPlayer)) toDelete.push(key);
    }

    toDelete.forEach(k => localStorage.removeItem(k));

    btn.dataset.confirm = '';
    btn.classList.remove('confirming');
    btn.classList.add('done');
    btn.innerHTML =
        '<span class="ro-icon">✅</span>' +
        '<div class="ro-text">' +
        '<div class="ro-title">Supprimé !</div>' +
        '<div class="ro-sub">Les données ont bien été effacées</div>' +
        '</div>';

    setTimeout(() => {
        document.getElementById('resetModal').classList.remove('open');
        location.reload();
    }, 900);
}