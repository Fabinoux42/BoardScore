/* ═══════════════════════════════════════════
   BoardScore — settings.js
   Gestion des joueurs du roster et statistiques
   ═══════════════════════════════════════════ */

/* ── THEME (standalone, pas de core.js ici) ── */
function getTheme() { return localStorage.getItem('boardscore_theme') || 'dark'; }
function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    const btn = document.getElementById('themeToggle');
    if (btn) btn.textContent = t === 'light' ? '☀️' : '🌙';
}
function toggleTheme() {
    const n = getTheme() === 'dark' ? 'light' : 'dark';
    localStorage.setItem('boardscore_theme', n);
    applyTheme(n);
}
applyTheme(getTheme());


/* ═══════════════════════════════════════════
   ROSTER — Liste globale des joueurs
   Stocké dans localStorage sous "boardscore_players"
   ═══════════════════════════════════════════ */

const COLORS = [
    '#f5c542', '#e05c2a', '#38bdf8', '#3ddc84',
    '#9b59f5', '#fb7185', '#a3e635', '#f472b6'
];

function getRoster() {
    try {
        return JSON.parse(localStorage.getItem('boardscore_players')) || [];
    } catch (e) { return []; }
}

function saveRoster(roster) {
    localStorage.setItem('boardscore_players', JSON.stringify(roster));
}

function getInitial(name) {
    return name.charAt(0).toUpperCase();
}

let editIdx = -1; // index du joueur en cours d'édition


/* ── Rendu de la liste ── */
function renderRoster() {
    const roster = getRoster();
    const list = document.getElementById('rosterList');
    if (!list) return;

    if (roster.length === 0) {
        list.innerHTML = '<div class="roster-empty">Aucun joueur enregistré.<br>Ajoute-en depuis ici ou directement dans un jeu !</div>';
        return;
    }

    list.innerHTML = roster.map((p, i) =>
        '<div class="roster-card" onclick="openEditPlayer(' + i + ')">' +
        '<div class="roster-avatar" style="background:' + p.color + '">' + getInitial(p.name) + '</div>' +
        '<div class="roster-info">' +
        '<div class="roster-name">' + p.name + '</div>' +
        '</div>' +
        '<span class="roster-edit">✏️</span>' +
        '</div>'
    ).join('');
}


/* ── Ajouter un joueur ── */
function addRosterPlayer() {
    const input = document.getElementById('newRosterName');
    const name = input.value.trim();
    if (!name) return;

    const roster = getRoster();
    if (roster.find(p => p.name.toLowerCase() === name.toLowerCase())) {
        input.style.borderColor = 'var(--red)';
        setTimeout(() => input.style.borderColor = '', 800);
        return;
    }

    const color = COLORS[roster.length % COLORS.length];
    roster.push({ name, color });
    saveRoster(roster);
    input.value = '';
    renderRoster();
    renderStats();
}


/* ── Éditer un joueur ── */
function openEditPlayer(idx) {
    const roster = getRoster();
    const p = roster[idx];
    if (!p) return;

    editIdx = idx;
    document.getElementById('editName').value = p.name;
    renderEditColors(p.color);
    document.getElementById('editModal').classList.add('open');
}

function renderEditColors(selected) {
    document.getElementById('editColors').innerHTML = COLORS.map(c =>
        '<button class="color-dot ' + (c === selected ? 'selected' : '') + '" ' +
        'style="background:' + c + '" onclick="selectEditColor(\'' + c + '\')"></button>'
    ).join('');
}

function selectEditColor(color) {
    renderEditColors(color);
}

function saveEditPlayer() {
    const roster = getRoster();
    const p = roster[editIdx];
    if (!p) return;

    const newName = document.getElementById('editName').value.trim();
    if (!newName) return;

    // Vérifier doublon (sauf soi-même)
    if (roster.find((r, i) => i !== editIdx && r.name.toLowerCase() === newName.toLowerCase())) {
        document.getElementById('editName').style.borderColor = 'var(--red)';
        setTimeout(() => document.getElementById('editName').style.borderColor = '', 800);
        return;
    }

    const oldName = p.name;
    const selectedColor = document.querySelector('.color-dot.selected');
    p.name = newName;
    if (selectedColor) p.color = selectedColor.style.background;

    // Mettre à jour le nom dans les données de tous les jeux
    if (oldName !== newName) {
        updatePlayerNameInGames(oldName, newName);
    }

    saveRoster(roster);
    document.getElementById('editModal').classList.remove('open');
    renderRoster();
    renderStats();
}

function deleteEditPlayer() {
    const roster = getRoster();
    const p = roster[editIdx];
    if (!p) return;
    if (!confirm('Supprimer ' + p.name + ' du roster ?\n(Les données de jeu ne seront pas effacées)')) return;

    roster.splice(editIdx, 1);
    saveRoster(roster);
    document.getElementById('editModal').classList.remove('open');
    renderRoster();
    renderStats();
}

function closeEditModal(e) {
    if (e.target === document.getElementById('editModal')) {
        document.getElementById('editModal').classList.remove('open');
    }
}

/* ── Propager un changement de nom dans les données de jeu ── */
function updatePlayerNameInGames(oldName, newName) {
    const gameKeys = ['mxt', 'skyjo', 'rami', 'uno', 'yams'];
    gameKeys.forEach(key => {
        try {
            const raw = localStorage.getItem(key + '_state');
            if (!raw) return;
            let state = JSON.parse(raw);
            let changed = false;

            // Renommer dans players[]
            if (state.players) {
                state.players.forEach(p => {
                    if (p.name === oldName) { p.name = newName; changed = true; }
                });
            }

            // Renommer dans sheets (Yam's)
            if (state.sheets && state.sheets[oldName]) {
                state.sheets[newName] = state.sheets[oldName];
                delete state.sheets[oldName];
                changed = true;
            }

            // Renommer dans history
            if (state.history) {
                state.history.forEach(h => {
                    if (h.player === oldName) { h.player = newName; changed = true; }
                    if (h.winner === oldName) { h.winner = newName; changed = true; }
                    if (h.scores) {
                        if (h.scores[oldName] !== undefined) {
                            h.scores[newName] = h.scores[oldName];
                            delete h.scores[oldName];
                            changed = true;
                        }
                    }
                });
            }

            if (changed) localStorage.setItem(key + '_state', JSON.stringify(state));
        } catch (e) {}
    });
}


/* ═══════════════════════════════════════════
   STATISTIQUES — calculées depuis les données de jeu
   ═══════════════════════════════════════════ */

function renderStats() {
    const roster = getRoster();
    const list = document.getElementById('statsList');
    if (!list) return;

    if (roster.length === 0) {
        list.innerHTML = '<div class="roster-empty">Ajoute des joueurs pour voir leurs stats !</div>';
        return;
    }

    // Collecter les stats de tous les jeux
    const gameConfigs = [
        { key: 'mxt',   name: 'Train Mexicain', emoji: '🚂', lowestWins: true },
        { key: 'skyjo', name: 'Skyjo',          emoji: '🃏', lowestWins: true },
        { key: 'rami',  name: 'Rami',           emoji: '🃏', lowestWins: true },
        { key: 'uno',   name: 'Uno',            emoji: '🎴', lowestWins: true },
        { key: 'yams',  name: "Yam's",          emoji: '🎲', lowestWins: false },
    ];

    // Pour chaque joueur, calculer ses stats
    const playerStats = roster.map(p => {
        const stats = { name: p.name, color: p.color, games: 0, wins: 0, totalScore: 0, bestGame: null };

        gameConfigs.forEach(gc => {
            try {
                const raw = localStorage.getItem(gc.key + '_state');
                if (!raw) return;
                const state = JSON.parse(raw);
                if (!state.players) return;

                const player = state.players.find(pl => pl.name === p.name);
                if (!player) return;

                // Ce joueur est dans cette partie
                stats.games++;
                stats.totalScore += player.score;

                // Déterminer si le joueur a gagné
                const scores = state.players.map(pl => pl.score);
                const winScore = gc.lowestWins ? Math.min(...scores) : Math.max(...scores);
                if (player.score === winScore) stats.wins++;

                // Meilleur score
                if (!stats.bestGame || (gc.lowestWins ? player.score < stats.bestGame.score : player.score > stats.bestGame.score)) {
                    stats.bestGame = { game: gc.name, emoji: gc.emoji, score: player.score };
                }
            } catch (e) {}
        });

        return stats;
    });

    list.innerHTML = playerStats.map(s => {
        const avgScore = s.games > 0 ? Math.round(s.totalScore / s.games) : 0;
        const winRate = s.games > 0 ? Math.round((s.wins / s.games) * 100) : 0;

        return '<div class="stat-card">' +
            '<div class="stat-header">' +
            '<div class="roster-avatar" style="background:' + s.color + '">' + getInitial(s.name) + '</div>' +
            '<div class="stat-name">' + s.name + '</div>' +
            '</div>' +
            '<div class="stat-grid">' +
            '<div class="stat-item">' +
            '<div class="stat-value">' + s.games + '</div>' +
            '<div class="stat-label">Parties</div>' +
            '</div>' +
            '<div class="stat-item">' +
            '<div class="stat-value win">' + s.wins + '</div>' +
            '<div class="stat-label">Victoires</div>' +
            '</div>' +
            '<div class="stat-item">' +
            '<div class="stat-value">' + winRate + '%</div>' +
            '<div class="stat-label">Win rate</div>' +
            '</div>' +
            '<div class="stat-item">' +
            '<div class="stat-value">' + avgScore + '</div>' +
            '<div class="stat-label">Moy. pts</div>' +
            '</div>' +
            '</div>' +
            (s.bestGame ? '<div class="stat-best">' + s.bestGame.emoji + ' Meilleur : ' + s.bestGame.score + ' pts (' + s.bestGame.game + ')</div>' : '') +
            '</div>';
    }).join('');
}


/* ── Entrée clavier ── */
document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        const editModal = document.getElementById('editModal');
        if (editModal && editModal.classList.contains('open')) {
            saveEditPlayer();
        } else if (document.activeElement === document.getElementById('newRosterName')) {
            addRosterPlayer();
        }
    }
});


/* ── INIT ── */
renderRoster();
renderStats();