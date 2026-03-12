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
   STATISTIQUES — basées sur l'historique des fins de partie
   ═══════════════════════════════════════════ */

const GAME_NAMES = {
    mxt: { name: 'Train Mexicain', emoji: '🚂' },
    skyjo: { name: 'Skyjo', emoji: '🃏' },
    rami: { name: 'Rami', emoji: '🃏' },
    uno: { name: 'Uno', emoji: '🎴' },
    yams: { name: "Yam's", emoji: '🎲' },
};

function getMatches() {
    try { return JSON.parse(localStorage.getItem('boardscore_matches')) || []; }
    catch (e) { return []; }
}

function renderStats() {
    const roster = getRoster();
    const list = document.getElementById('statsList');
    if (!list) return;

    if (roster.length === 0) {
        list.innerHTML = '<div class="roster-empty">Ajoute des joueurs pour voir leurs stats !</div>';
        return;
    }

    const matches = getMatches();

    const playerStats = roster.map(p => {
        const stats = { name: p.name, color: p.color, games: 0, wins: 0, byGame: {} };

        matches.forEach(m => {
            const entry = m.players.find(pl => pl.name === p.name);
            if (!entry) return;

            stats.games++;
            if (m.winner === p.name) stats.wins++;

            const gk = m.game;
            if (!stats.byGame[gk]) stats.byGame[gk] = { games: 0, wins: 0, totalScore: 0, best: null };
            const bg = stats.byGame[gk];
            bg.games++;
            if (m.winner === p.name) bg.wins++;
            bg.totalScore += entry.score;
            if (bg.best === null || entry.score > bg.best) bg.best = entry.score;
        });

        return stats;
    });

    list.innerHTML = playerStats.map((s, idx) => {
        const winRate = s.games > 0 ? Math.round((s.wins / s.games) * 100) : 0;

        // Trouver le dernier match joué par ce joueur
        let lastText = '';
        const playerMatches = matches.filter(m => m.players.find(pl => pl.name === s.name));
        if (playerMatches.length > 0) {
            const last = playerMatches[playerMatches.length - 1];
            const lastEntry = last.players.find(pl => pl.name === s.name);
            const gInfo = GAME_NAMES[last.game] || { name: last.game, emoji: '🎮' };
            const won = last.winner === s.name;
            lastText = gInfo.emoji + ' ' + lastEntry.score + ' pts (' + gInfo.name + ')' + (won ? ' 🏆' : '');
        }

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
            '</div>' +
            (lastText
                ? '<div class="stat-best-row">' +
                '<span class="stat-best-text">Dernier : ' + lastText + '</span>' +
                '<button class="stat-detail-btn" onclick="openStatDetail(' + idx + ')">ℹ️</button>' +
                '</div>'
                : '<div class="stat-best-row"><span class="stat-best-text">Aucune partie terminée</span></div>') +
            '</div>';
    }).join('');
}


/* ── Modale détail stats par jeu ── */
function openStatDetail(idx) {
    const roster = getRoster();
    const matches = getMatches();
    const p = roster[idx];
    if (!p) return;

    // Calculer les stats par jeu
    const byGame = {};
    matches.forEach(m => {
        const entry = m.players.find(pl => pl.name === p.name);
        if (!entry) return;
        const gk = m.game;
        if (!byGame[gk]) byGame[gk] = { games: 0, wins: 0, totalScore: 0, best: null, worst: null };
        const bg = byGame[gk];
        bg.games++;
        if (m.winner === p.name) bg.wins++;
        bg.totalScore += entry.score;
        if (bg.best === null || entry.score > bg.best) bg.best = entry.score;
        if (bg.worst === null || entry.score < bg.worst) bg.worst = entry.score;
    });

    let html = '';
    Object.entries(byGame).forEach(([gk, bg]) => {
        const gInfo = GAME_NAMES[gk] || { name: gk, emoji: '🎮' };
        const avg = bg.games > 0 ? Math.round(bg.totalScore / bg.games) : 0;
        const wr = bg.games > 0 ? Math.round((bg.wins / bg.games) * 100) : 0;

        html += '<div class="sd-game">' +
            '<div class="sd-game-header">' + gInfo.emoji + ' ' + gInfo.name + '</div>' +
            '<div class="sd-grid">' +
            '<div class="sd-item"><span class="sd-val">' + bg.games + '</span><span class="sd-lbl">Parties</span></div>' +
            '<div class="sd-item"><span class="sd-val win">' + bg.wins + '</span><span class="sd-lbl">Victoires</span></div>' +
            '<div class="sd-item"><span class="sd-val">' + wr + '%</span><span class="sd-lbl">Win rate</span></div>' +
            '<div class="sd-item"><span class="sd-val">' + avg + '</span><span class="sd-lbl">Moy. pts</span></div>' +
            '</div>' +
            '<div class="sd-scores">' +
            '<span>Meilleur : <strong>' + bg.best + '</strong></span>' +
            '<span>Pire : <strong>' + bg.worst + '</strong></span>' +
            '</div>' +
            '</div>';
    });

    if (!html) html = '<div class="roster-empty">Aucune partie terminée pour ce joueur.</div>';

    document.getElementById('detailPlayerName').textContent = p.name;
    document.getElementById('detailContent').innerHTML = html;
    document.getElementById('detailModal').classList.add('open');
}

function closeDetailModal(e) {
    if (e.target === document.getElementById('detailModal')) {
        document.getElementById('detailModal').classList.remove('open');
    }
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