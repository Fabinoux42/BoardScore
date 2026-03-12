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
    const oldColor = p.color;
    p.name = newName;
    if (selectedColor) p.color = selectedColor.style.background;

    // Mettre à jour le nom dans les données de tous les jeux
    if (oldName !== newName) {
        updatePlayerNameInGames(oldName, newName);
    }

    // Mettre à jour la couleur dans les parties en cours
    if (selectedColor && p.color !== oldColor) {
        updatePlayerColorInGames(p.name, p.color);
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

/* ── Propager un changement de couleur dans les données de jeu ── */
function updatePlayerColorInGames(name, newColor) {
    const gameKeys = ['mxt', 'skyjo', 'rami', 'uno', 'yams'];
    gameKeys.forEach(key => {
        try {
            const raw = localStorage.getItem(key + '_state');
            if (!raw) return;
            let state = JSON.parse(raw);
            let changed = false;
            if (state.players) {
                state.players.forEach(p => {
                    if (p.name === name) { p.color = newColor; changed = true; }
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


/* ═══════════════════════════════════════════
   STATS GÉNÉRALES — Constantes & charts
   ═══════════════════════════════════════════ */

/* ── Constantes modifiables facilement ── */
const CHART_BAR_INTERVAL  = 'week';    // regroupement du timeline : 'day' | 'week' | 'month'
const CHART_X_AXIS_UNIT   = 'month';   // unité des labels abscisse : 'week' | 'month'
const CHART_TIME_UNIT     = 'minute';  // unité de temps affichée   : 'minute' | 'hour'
const GAME_DURATION_MIN   = { mxt: 60, skyjo: 30, rami: 45, uno: 20, yams: 40 }; // durée estimée par jeu (min)

const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const MONTH_NAMES_SHORT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
const CHART_COLORS = ['#9b59f5', '#38bdf8', '#f5c542', '#3ddc84', '#fb7185', '#a3e635', '#f97316'];
const RANK_MEDALS = ['🥇', '🥈', '🥉'];


/* ── Utilitaire : début de semaine (lundi) ── */
function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay(); // 0=dim
    const diff = (day === 0 ? -6 : 1 - day);
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

function getMonthStart(date) {
    const d = new Date(date);
    d.setDate(1); d.setHours(0, 0, 0, 0);
    return d;
}

function getDayStart(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

function getIntervalKey(ts) {
    if (CHART_BAR_INTERVAL === 'week')  return getWeekStart(ts).getTime();
    if (CHART_BAR_INTERVAL === 'month') return getMonthStart(ts).getTime();
    return getDayStart(ts).getTime();
}

function convertTime(minutes) {
    if (CHART_TIME_UNIT === 'hour') return +(minutes / 60).toFixed(1);
    return Math.round(minutes);
}

function timeLabel() {
    return CHART_TIME_UNIT === 'hour' ? 'h' : 'min';
}


/* ── Rendu principal Stats générales ── */
function renderGeneralStats() {
    const container = document.getElementById('generalStatsList');
    if (!container) return;
    const matches = getMatches();

    if (matches.length === 0) {
        container.innerHTML = '<div class="roster-empty">Aucune partie terminée pour l\'instant.<br>Les stats apparaîtront ici après vos premières parties !</div>';
        return;
    }

    container.innerHTML =
        renderTop3HTML(matches) +
        '<div class="chart-card" id="pieChartCard">' +
        '<div class="chart-title">📅 Jours de jeu</div>' +
        '<div class="chart-sub">Répartition des parties terminées par jour de la semaine</div>' +
        '<div class="pie-wrap"><canvas id="pieChart" width="260" height="260"></canvas><div class="pie-legend" id="pieLegend"></div></div>' +
        '</div>' +
        '<div class="chart-card">' +
        '<div class="chart-title">👥 Parties terminées par joueur</div>' +
        '<div class="chart-sub">Nombre de parties auxquelles chaque joueur a participé</div>' +
        '<canvas id="playerBarChart" width="400" height="220" style="width:100%;height:auto"></canvas>' +
        '</div>' +
        '<div class="chart-card">' +
        '<div class="chart-title">📈 Activité dans le temps</div>' +
        '<div class="chart-sub">Parties par ' + CHART_BAR_INTERVAL_FR() + ' · axe gauche = parties · axe droit = temps estimé (' + timeLabel() + ')</div>' +
        '<canvas id="timelineChart" width="400" height="220" style="width:100%;height:auto"></canvas>' +
        '</div>';

    // Dessiner les charts au prochain frame (le DOM doit être rendu)
    requestAnimationFrame(() => {
        drawPieChart(matches);
        drawPlayerBarChart(matches);
        drawTimelineChart(matches);
    });
}

function CHART_BAR_INTERVAL_FR() {
    return CHART_BAR_INTERVAL === 'week' ? 'semaine' : CHART_BAR_INTERVAL === 'month' ? 'mois' : 'jour';
}


/* ── Top 3 ── */
function renderTop3HTML(matches) {
    const totalGames = matches.length;

    // Compter les victoires par joueur
    const winsMap = {};
    matches.forEach(m => {
        winsMap[m.winner] = (winsMap[m.winner] || 0) + 1;
    });

    const roster = getRoster();
    // Construire le tableau des joueurs connus avec leurs victoires
    const ranked = Object.entries(winsMap)
        .map(([name, wins]) => {
            const rp = roster.find(r => r.name === name);
            return { name, wins, color: rp ? rp.color : CHART_COLORS[0] };
        })
        .sort((a, b) => b.wins - a.wins)
        .slice(0, 3);

    if (ranked.length === 0) {
        return '<div class="roster-empty">Aucun vainqueur enregistré.</div>';
    }

    const podium = ranked.map((p, i) =>
        '<div class="podium-entry">' +
        '<span class="podium-medal">' + RANK_MEDALS[i] + '</span>' +
        '<div class="podium-avatar" style="background:' + p.color + '">' + getInitial(p.name) + '</div>' +
        '<div class="podium-info">' +
        '<div class="podium-name">' + p.name + '</div>' +
        '<div class="podium-score">' + p.wins + ' victoire' + (p.wins > 1 ? 's' : '') + ' <span class="podium-total">/ ' + totalGames + ' parties</span></div>' +
        '</div>' +
        '</div>'
    ).join('');

    return '<div class="chart-card podium-card">' +
        '<div class="chart-title">🏆 Meilleurs vainqueurs</div>' +
        '<div class="chart-sub">Tout jeux confondus · ' + totalGames + ' partie' + (totalGames > 1 ? 's' : '') + ' terminée' + (totalGames > 1 ? 's' : '') + '</div>' +
        '<div class="podium-list">' + podium + '</div>' +
        '<button class="chart-detail-btn" onclick="openTop3Modal()">📊 Détail par jeu</button>' +
        '</div>';
}


/* ── Modal Top 3 détail ── */
function openTop3Modal() {
    const matches = getMatches();
    const roster = getRoster();

    const winsMap = {};
    matches.forEach(m => { winsMap[m.winner] = (winsMap[m.winner] || 0) + 1; });

    const ranked = Object.entries(winsMap)
        .map(([name, wins]) => {
            const rp = roster.find(r => r.name === name);
            return { name, wins, color: rp ? rp.color : CHART_COLORS[0] };
        })
        .sort((a, b) => b.wins - a.wins)
        .slice(0, 3);

    let html = '';
    ranked.forEach((player, rank) => {
        const byGame = {};
        matches.forEach(m => {
            const entry = m.players.find(pl => pl.name === player.name);
            if (!entry) return;
            if (!byGame[m.game]) byGame[m.game] = { games: 0, wins: 0, totalScore: 0, best: null, worst: null };
            const bg = byGame[m.game];
            bg.games++;
            if (m.winner === player.name) bg.wins++;
            bg.totalScore += entry.score;
            if (bg.best === null || entry.score > bg.best) bg.best = entry.score;
            if (bg.worst === null || entry.score < bg.worst) bg.worst = entry.score;
        });

        let gameRows = '';
        Object.entries(byGame).forEach(([gk, bg]) => {
            const gInfo = GAME_NAMES[gk] || { name: gk, emoji: '🎮' };
            const avg = bg.games > 0 ? Math.round(bg.totalScore / bg.games) : 0;
            const wr = bg.games > 0 ? Math.round((bg.wins / bg.games) * 100) : 0;
            gameRows += '<div class="sd-game">' +
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

        html += '<div class="top3-player-block">' +
            '<div class="top3-player-header">' +
            '<span class="podium-medal">' + RANK_MEDALS[rank] + '</span>' +
            '<div class="podium-avatar sm" style="background:' + player.color + '">' + getInitial(player.name) + '</div>' +
            '<div class="top3-player-name">' + player.name + '</div>' +
            '<div class="top3-player-wins">' + player.wins + ' victoire' + (player.wins > 1 ? 's' : '') + '</div>' +
            '</div>' +
            gameRows +
            '</div>';
    });

    document.getElementById('top3Content').innerHTML = html || '<div class="roster-empty">Pas assez de données.</div>';
    document.getElementById('top3Modal').classList.add('open');
}

function closeTop3Modal(e) {
    if (e.target === document.getElementById('top3Modal')) {
        document.getElementById('top3Modal').classList.remove('open');
    }
}


/* ── Camembert : jours de la semaine ── */
function drawPieChart(matches) {
    const canvas = document.getElementById('pieChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const SIZE = 260;
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    canvas.style.width = SIZE + 'px';
    canvas.style.height = SIZE + 'px';
    ctx.scale(dpr, dpr);

    // Compter par jour
    const dayCounts = [0, 0, 0, 0, 0, 0, 0]; // 0=dim .. 6=sam
    matches.forEach(m => { dayCounts[new Date(m.date).getDay()]++; });
    const total = matches.length;

    // Filtrer les jours à 0
    const segments = dayCounts
        .map((count, i) => ({ label: DAY_NAMES[i], count, pct: total > 0 ? count / total : 0 }))
        .filter(s => s.count > 0);

    const PIE_COLORS = ['#9b59f5', '#38bdf8', '#f5c542', '#3ddc84', '#fb7185', '#a3e635', '#f97316'];
    const cx = SIZE / 2, cy = SIZE / 2, r = SIZE * 0.38, rInner = SIZE * 0.2;
    let startAngle = -Math.PI / 2;

    // Dessiner les secteurs
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const borderColor = isDark ? '#1a0a2e' : '#ffffff';

    segments.forEach((seg, i) => {
        const sweep = seg.pct * 2 * Math.PI;
        const endAngle = startAngle + sweep;
        const color = PIE_COLORS[i % PIE_COLORS.length];

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Label % à l'intérieur si segment assez grand
        if (seg.pct > 0.07) {
            const midAngle = startAngle + sweep / 2;
            const lx = cx + Math.cos(midAngle) * r * 0.65;
            const ly = cy + Math.sin(midAngle) * r * 0.65;
            ctx.fillStyle = '#fff';
            ctx.font = `bold ${Math.round(SIZE * 0.052)}px DM Sans, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(Math.round(seg.pct * 100) + '%', lx, ly);
        }

        startAngle = endAngle;
    });

    // Trou central (donut)
    ctx.beginPath();
    ctx.arc(cx, cy, rInner, 0, 2 * Math.PI);
    ctx.fillStyle = isDark ? '#12082a' : '#f0eef8';
    ctx.fill();

    // Total au centre
    ctx.fillStyle = isDark ? '#e8e0ff' : '#1a0a2e';
    ctx.font = `bold ${Math.round(SIZE * 0.085)}px Playfair Display, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(total, cx, cy - 8);
    ctx.font = `${Math.round(SIZE * 0.048)}px DM Sans, sans-serif`;
    ctx.fillStyle = isDark ? '#8b7ba8' : '#7a6a9a';
    ctx.fillText('parties', cx, cy + 12);

    // Légende
    const legend = document.getElementById('pieLegend');
    if (legend) {
        legend.innerHTML = segments.map((seg, i) =>
            '<div class="pie-legend-item">' +
            '<span class="pie-legend-dot" style="background:' + PIE_COLORS[i % PIE_COLORS.length] + '"></span>' +
            '<span class="pie-legend-label">' + seg.label + '</span>' +
            '<span class="pie-legend-pct">' + seg.count + 'x</span>' +
            '</div>'
        ).join('');
    }
}


/* ── Histogramme : parties par joueur ── */
function drawPlayerBarChart(matches) {
    const canvas = document.getElementById('playerBarChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth || 400, H = 220;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const textColor = isDark ? '#c8b8e8' : '#2d1f5e';
    const mutedColor = isDark ? '#6b5a88' : '#9a8ab8';
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

    // Compter les participations par joueur
    const countMap = {};
    const colorMap = {};
    const roster = getRoster();
    matches.forEach(m => {
        m.players.forEach(pl => {
            countMap[pl.name] = (countMap[pl.name] || 0) + 1;
            if (!colorMap[pl.name]) {
                const rp = roster.find(r => r.name === pl.name);
                colorMap[pl.name] = rp ? rp.color : CHART_COLORS[Object.keys(colorMap).length % CHART_COLORS.length];
            }
        });
    });

    const entries = Object.entries(countMap).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) return;

    const maxVal = entries[0][1];
    const PAD_L = 38, PAD_R = 16, PAD_T = 16, PAD_B = 46;
    const chartW = W - PAD_L - PAD_R;
    const chartH = H - PAD_T - PAD_B;

    // Grille horizontale
    const gridSteps = 5;
    for (let i = 0; i <= gridSteps; i++) {
        const y = PAD_T + chartH - (i / gridSteps) * chartH;
        const val = Math.round((i / gridSteps) * maxVal);
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(PAD_L, y); ctx.lineTo(W - PAD_R, y); ctx.stroke();
        ctx.fillStyle = mutedColor;
        ctx.font = `${Math.round(W * 0.028)}px DM Sans, sans-serif`;
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.fillText(val, PAD_L - 6, y);
    }

    // Barres
    const barW = Math.min(48, (chartW / entries.length) * 0.65);
    const gap = chartW / entries.length;

    entries.forEach(([name, count], i) => {
        const x = PAD_L + gap * i + gap / 2;
        const barH = maxVal > 0 ? (count / maxVal) * chartH : 0;
        const y = PAD_T + chartH - barH;
        const color = colorMap[name] || CHART_COLORS[i % CHART_COLORS.length];

        // Barre avec arrondi en haut
        ctx.fillStyle = color + 'cc';
        const rx = x - barW / 2, rr = 5;
        ctx.beginPath();
        ctx.moveTo(rx + rr, y);
        ctx.lineTo(rx + barW - rr, y);
        ctx.quadraticCurveTo(rx + barW, y, rx + barW, y + rr);
        ctx.lineTo(rx + barW, y + barH);
        ctx.lineTo(rx, y + barH);
        ctx.lineTo(rx, y + rr);
        ctx.quadraticCurveTo(rx, y, rx + rr, y);
        ctx.closePath();
        ctx.fill();

        // Valeur sur la barre
        ctx.fillStyle = textColor;
        ctx.font = `bold ${Math.round(W * 0.032)}px DM Sans, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText(count, x, y - 3);

        // Nom en abscisse (tronqué)
        const maxLabelW = gap - 4;
        const label = truncateLabel(ctx, name, maxLabelW, Math.round(W * 0.028));
        ctx.fillStyle = mutedColor;
        ctx.font = `${Math.round(W * 0.028)}px DM Sans, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(label, x, PAD_T + chartH + 8);

        // Point couleur sous le nom
        ctx.beginPath();
        ctx.arc(x, PAD_T + chartH + 5, 3, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
    });
}

function truncateLabel(ctx, text, maxW, fontSize) {
    ctx.font = fontSize + 'px DM Sans, sans-serif';
    if (ctx.measureText(text).width <= maxW) return text;
    let t = text;
    while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
    return t + '…';
}


/* ── Histogramme timeline ── */
function drawTimelineChart(matches) {
    const canvas = document.getElementById('timelineChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth || 400, H = 220;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const textColor = isDark ? '#c8b8e8' : '#2d1f5e';
    const mutedColor = isDark ? '#6b5a88' : '#9a8ab8';
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    const barColor = '#9b59f5';
    const lineColor = '#38bdf8';

    // Grouper par intervalle
    const intervalMap = {}; // key → { games, minutes }
    matches.forEach(m => {
        const key = getIntervalKey(m.date);
        if (!intervalMap[key]) intervalMap[key] = { games: 0, minutes: 0 };
        intervalMap[key].games++;
        intervalMap[key].minutes += GAME_DURATION_MIN[m.game] || 30;
    });

    if (Object.keys(intervalMap).length === 0) return;

    // Remplir les intervalles vides entre le premier et le dernier
    const keys = Object.keys(intervalMap).map(Number).sort((a, b) => a - b);
    const firstKey = keys[0], lastKey = keys[keys.length - 1];
    const allKeys = [];
    let cur = firstKey;
    while (cur <= lastKey) {
        allKeys.push(cur);
        if (CHART_BAR_INTERVAL === 'week') {
            cur += 7 * 24 * 3600 * 1000;
        } else if (CHART_BAR_INTERVAL === 'month') {
            const d = new Date(cur); d.setMonth(d.getMonth() + 1);
            cur = d.getTime();
        } else {
            cur += 24 * 3600 * 1000;
        }
    }

    const data = allKeys.map(k => ({
        key: k,
        date: new Date(k),
        games: intervalMap[k] ? intervalMap[k].games : 0,
        time: intervalMap[k] ? convertTime(intervalMap[k].minutes) : 0,
    }));

    const maxGames = Math.max(...data.map(d => d.games), 1);
    const maxTime = Math.max(...data.map(d => d.time), 1);

    const PAD_L = 34, PAD_R = 38, PAD_T = 16, PAD_B = 40;
    const chartW = W - PAD_L - PAD_R;
    const chartH = H - PAD_T - PAD_B;

    // Grille horizontale (basée sur axe gauche = games)
    const gridSteps = 4;
    for (let i = 0; i <= gridSteps; i++) {
        const y = PAD_T + chartH - (i / gridSteps) * chartH;
        const val = Math.round((i / gridSteps) * maxGames);
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(PAD_L, y); ctx.lineTo(W - PAD_R, y); ctx.stroke();
        ctx.fillStyle = mutedColor;
        ctx.font = `${Math.round(W * 0.027)}px DM Sans, sans-serif`;
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.fillText(val, PAD_L - 5, y);
    }

    // Axe droit (temps)
    for (let i = 0; i <= gridSteps; i++) {
        const y = PAD_T + chartH - (i / gridSteps) * chartH;
        const val = Math.round((i / gridSteps) * maxTime);
        ctx.fillStyle = lineColor + 'aa';
        ctx.font = `${Math.round(W * 0.027)}px DM Sans, sans-serif`;
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(val, W - PAD_R + 4, y);
    }

    // Barres
    const barW = Math.max(4, Math.min(28, (chartW / data.length) * 0.7));
    const step = chartW / data.length;

    data.forEach((d, i) => {
        const x = PAD_L + step * i + step / 2;
        if (d.games > 0) {
            const barH = (d.games / maxGames) * chartH;
            const y = PAD_T + chartH - barH;
            const rx = x - barW / 2, rr = Math.min(4, barW / 2);
            ctx.fillStyle = barColor + 'bb';
            ctx.beginPath();
            ctx.moveTo(rx + rr, y);
            ctx.lineTo(rx + barW - rr, y);
            ctx.quadraticCurveTo(rx + barW, y, rx + barW, y + rr);
            ctx.lineTo(rx + barW, y + barH);
            ctx.lineTo(rx, y + barH);
            ctx.lineTo(rx, y + rr);
            ctx.quadraticCurveTo(rx, y, rx + rr, y);
            ctx.closePath();
            ctx.fill();
        }
    });

    // Ligne de temps
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    let firstPoint = true;
    data.forEach((d, i) => {
        const x = PAD_L + step * i + step / 2;
        const y = PAD_T + chartH - (d.time / maxTime) * chartH;
        if (firstPoint) { ctx.moveTo(x, y); firstPoint = false; }
        else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Points sur la ligne
    data.forEach((d, i) => {
        if (d.time === 0) return;
        const x = PAD_L + step * i + step / 2;
        const y = PAD_T + chartH - (d.time / maxTime) * chartH;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, 2 * Math.PI);
        ctx.fillStyle = lineColor;
        ctx.fill();
    });

    // Labels abscisse (mois ou semaine selon CHART_X_AXIS_UNIT)
    let lastLabel = -1;
    data.forEach((d, i) => {
        const x = PAD_L + step * i + step / 2;
        let showLabel = false;
        let label = '';
        if (CHART_X_AXIS_UNIT === 'month') {
            const m = d.date.getMonth();
            if (m !== lastLabel) { showLabel = true; label = MONTH_NAMES_SHORT[m]; lastLabel = m; }
        } else {
            // Semaine : afficher le n° de semaine
            const wn = getWeekNumber(d.date);
            if (wn !== lastLabel) { showLabel = true; label = 'S' + wn; lastLabel = wn; }
        }
        if (showLabel) {
            ctx.fillStyle = textColor;
            ctx.font = `${Math.round(W * 0.028)}px DM Sans, sans-serif`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'top';
            ctx.fillText(label, x, PAD_T + chartH + 6);
            // Petite marque
            ctx.strokeStyle = mutedColor + '55';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(x, PAD_T + chartH); ctx.lineTo(x, PAD_T + chartH + 5); ctx.stroke();
        }
    });

    // Légende
    ctx.fillStyle = barColor;
    ctx.fillRect(PAD_L, H - 10, 10, 4);
    ctx.fillStyle = mutedColor;
    ctx.font = `${Math.round(W * 0.026)}px DM Sans, sans-serif`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('Parties', PAD_L + 14, H - 8);

    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(PAD_L + 80, H - 8); ctx.lineTo(PAD_L + 90, H - 8); ctx.stroke();
    ctx.fillStyle = mutedColor;
    ctx.fillText('Temps (' + timeLabel() + ')', PAD_L + 94, H - 8);
}

function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}


/* ── INIT ── */
renderRoster();
renderStats();
renderGeneralStats();