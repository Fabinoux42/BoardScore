/* ═══════════════════════════════════════════
   BoardScore — general.js
   Stats générales (page dédiée settings/general)
   ═══════════════════════════════════════════ */

/* ──────────────────────────────────────────
   CONSTANTES — modifiables facilement
   ────────────────────────────────────────── */
const CHART_BAR_INTERVAL  = 'day';     // regroupement timeline : 'day' | 'week' | 'month'
const CHART_TIME_UNIT     = 'minute';  // unité de temps        : 'minute' | 'hour'

/* ────────────────────────────────── */

const DAY_NAMES        = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const MONTH_NAMES_SHORT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
const CHART_COLORS     = ['#9b59f5', '#38bdf8', '#f5c542', '#3ddc84', '#fb7185', '#a3e635', '#f97316'];
const RANK_MEDALS      = ['🥇', '🥈', '🥉'];

const GAME_NAMES = {
    mxt:   { name: 'Train Mexicain', emoji: '🚂' },
    skyjo: { name: 'Skyjo',          emoji: '🃏' },
    rami:  { name: 'Rami',           emoji: '🃏' },
    uno:   { name: 'Uno',            emoji: '🎴' },
    yams:  { name: "Yam's",          emoji: '🎲' },
};


/* ══════════════════════════════════════════
   THÈME
   ══════════════════════════════════════════ */
// getTheme → BS.getTheme  (utils.js)

BS.applyTheme(BS.getTheme());


/* ══════════════════════════════════════════
   HELPERS DONNÉES
   ══════════════════════════════════════════ */
// getMatches → BS.getMatches  (utils.js)
// getRoster → BS.getRoster  (utils.js)
function getTimeData() {
    try { return JSON.parse(localStorage.getItem('boardscore_time')) || {}; }
    catch (e) { return {}; }
}
function dateKeyFromTs(ts) {
    const d = new Date(ts);
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
// getInitial → BS.getInitial  (utils.js)


/* ══════════════════════════════════════════
   HELPERS DATES / INTERVALLES
   ══════════════════════════════════════════ */
function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
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
    return CHART_TIME_UNIT === 'hour' ? +(minutes / 60).toFixed(1) : Math.round(minutes);
}
function timeLabel() { return CHART_TIME_UNIT === 'hour' ? 'h' : 'min'; }
function intervalFR() {
    return CHART_BAR_INTERVAL === 'week' ? 'semaine' : CHART_BAR_INTERVAL === 'month' ? 'mois' : 'jour';
}
function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/* Y-axis : calcule des steps entiers propres */
function niceSteps(maxVal) {
    if (maxVal <= 0) return 1;
    if (maxVal <= 5) return maxVal;          // 1,2,3,4,5 → autant de steps que de valeurs
    if (maxVal <= 10) return 5;
    return Math.min(8, Math.ceil(maxVal / Math.ceil(maxVal / 6)));
}


/* ══════════════════════════════════════════
   RENDU PRINCIPAL
   ══════════════════════════════════════════ */
function renderGeneralStats() {
    const container = document.getElementById('generalStatsList');
    if (!container) return;
    const matches = BS.getMatches();

    if (matches.length === 0) {
        container.innerHTML =
            '<div class="roster-empty" style="padding:40px 16px;text-align:center;color:var(--muted);font-size:0.88rem;line-height:1.6;">' +
            '🎲 Aucune partie terminée pour l\'instant.<br>Les stats apparaîtront ici après vos premières parties !</div>';
        return;
    }

    container.innerHTML =
        renderTop3HTML(matches) +
        '<div class="chart-card" id="pieChartCard">' +
        '<div class="chart-title">📅 Parties par jour de la semaine</div>' +
        '<div class="chart-sub">Nombre de parties terminées selon le jour de la semaine</div>' +
        '<div class="pie-wrap"><canvas id="pieChart" width="240" height="240"></canvas>' +
        '<div class="pie-legend" id="pieLegend"></div></div>' +
        '</div>' +
        '<div class="chart-card" id="pieDaysChartCard">' +
        '<div class="chart-title">📆 Jours de jeu distincts</div>' +
        '<div class="chart-sub">Répartition des jours calendaires où au moins une partie a été jouée</div>' +
        '<div class="pie-wrap"><canvas id="pieDaysChart" width="240" height="240"></canvas>' +
        '<div class="pie-legend" id="pieDaysLegend"></div></div>' +
        '</div>' +
        '<div class="chart-card">' +
        '<div class="chart-title">👥 Parties terminées par joueur</div>' +
        '<div class="chart-sub">Nombre de parties auxquelles chaque joueur a participé</div>' +
        '<canvas id="playerBarChart" width="400" height="220" style="width:100%;height:auto;display:block"></canvas>' +
        '</div>' +
        '<div class="chart-card">' +
        '<div class="chart-title">📈 Activité dans le temps</div>' +
        '<div class="chart-sub">Bâtonnet = nb de parties · Ligne = temps moyen de jeu par jour actif (' + timeLabel() + '). Scroll ←→ si besoin.</div>' +
        '<div class="timeline-scroll-wrap"><canvas id="timelineChart"></canvas></div>' +
        '</div>';

    requestAnimationFrame(() => {
        drawPieChart(matches);
        drawPieDaysChart(matches);
        drawPlayerBarChart(matches);
        drawTimelineChart(matches);
    });
}


/* ══════════════════════════════════════════
   TOP 3 HTML
   ══════════════════════════════════════════ */
function renderTop3HTML(matches) {
    const totalGames = matches.length;
    const winsMap = {};
    matches.forEach(m => { winsMap[m.winner] = (winsMap[m.winner] || 0) + 1; });

    const roster = BS.getRoster();
    const ranked = Object.entries(winsMap)
        .map(([name, wins]) => {
            const rp = roster.find(r => r.name === name);
            return { name, wins, color: rp ? rp.color : CHART_COLORS[0] };
        })
        .sort((a, b) => b.wins - a.wins)
        .slice(0, 3);

    if (ranked.length === 0) return '';

    const podium = ranked.map((p, i) =>
        '<div class="podium-entry">' +
        '<span class="podium-medal">' + RANK_MEDALS[i] + '</span>' +
        '<div class="podium-avatar" style="background:' + p.color + '">' + BS.getInitial(p.name) + '</div>' +
        '<div class="podium-info">' +
        '<div class="podium-name">' + p.name + '</div>' +
        '<div class="podium-score">' + p.wins + ' victoire' + (p.wins > 1 ? 's' : '') +
        ' <span class="podium-total">/ ' + totalGames + ' parties</span></div>' +
        '</div>' +
        '</div>'
    ).join('');

    return '<div class="chart-card podium-card">' +
        '<div class="chart-title">🏆 Meilleurs vainqueurs</div>' +
        '<div class="chart-sub">Tout jeux confondus · ' + totalGames + ' partie' + (totalGames > 1 ? 's' : '') +
        ' terminée' + (totalGames > 1 ? 's' : '') + '</div>' +
        '<div class="podium-list">' + podium + '</div>' +
        '<button class="chart-detail-btn" onclick="openTop3Modal()">📊 Détail par jeu</button>' +
        '</div>';
}


/* ══════════════════════════════════════════
   MODAL TOP3 — histogramme victoires par jeu
   ══════════════════════════════════════════ */
function openTop3Modal() {
    const matches = BS.getMatches();
    const roster = BS.getRoster();

    // Calculer top3 vainqueurs
    const winsMap = {};
    matches.forEach(m => { winsMap[m.winner] = (winsMap[m.winner] || 0) + 1; });
    const top3 = Object.entries(winsMap)
        .map(([name, wins]) => {
            const rp = roster.find(r => r.name === name);
            return { name, wins, color: rp ? rp.color : CHART_COLORS[0] };
        })
        .sort((a, b) => b.wins - a.wins)
        .slice(0, 3);

    if (top3.length === 0) {
        document.getElementById('top3Content').innerHTML =
            '<div class="roster-empty">Pas encore de données.</div>';
        document.getElementById('top3Modal').classList.add('open');
        return;
    }

    // Recenser tous les jeux joués par au moins un du top3
    const gamesSet = new Set();
    matches.forEach(m => {
        if (top3.find(p => p.name === m.winner || m.players.find(pl => pl.name === p.name))) {
            gamesSet.add(m.game);
        }
    });
    const gamesList = Array.from(gamesSet);

    // Pour chaque jeu, compter les victoires de chaque top3
    let html = '';
    gamesList.forEach((gk, gi) => {
        const gInfo = GAME_NAMES[gk] || { name: gk, emoji: '🎮' };
        const canvasId = 'top3chart_' + gi;

        // Compter uniquement les joueurs du top3 qui ont participé à ce jeu
        const playerData = top3.map(p => {
            let wins = 0;
            matches.forEach(m => {
                if (m.game !== gk) return;
                if (m.winner === p.name) wins++;
            });
            const played = matches.filter(m => m.game === gk && m.players.find(pl => pl.name === p.name)).length;
            return { ...p, winsInGame: wins, played };
        }).filter(p => p.played > 0); // n'afficher que ceux qui ont joué ce jeu

        if (playerData.length === 0) return;

        html += '<div class="top3-game-block">' +
            '<div class="top3-game-title">' + gInfo.emoji + ' ' + gInfo.name + '</div>' +
            '<canvas id="' + canvasId + '" width="340" height="130" style="width:100%;height:auto;display:block"></canvas>' +
            '</div>';
    });

    if (!html) html = '<div class="roster-empty">Pas assez de données.</div>';

    document.getElementById('top3Content').innerHTML = html;
    document.getElementById('top3Modal').classList.add('open');

    // Dessiner les charts après rendu DOM
    requestAnimationFrame(() => {
        gamesList.forEach((gk, gi) => {
            const canvas = document.getElementById('top3chart_' + gi);
            if (!canvas) return;

            const playerData = top3.map(p => {
                let wins = 0;
                matches.forEach(m => {
                    if (m.game === gk && m.winner === p.name) wins++;
                });
                const played = matches.filter(m => m.game === gk && m.players.find(pl => pl.name === p.name)).length;
                return { ...p, winsInGame: wins, played };
            }).filter(p => p.played > 0);

            if (playerData.length === 0) return;
            drawTop3GameChart(canvas, playerData);
        });
    });
}

function drawTop3GameChart(canvas, players) {
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth || 340, H = 130;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const textColor  = isDark ? '#c8b8e8' : '#2d1f5e';
    const mutedColor = isDark ? '#6b5a88' : '#9a8ab8';
    const gridColor  = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

    const maxWins = Math.max(...players.map(p => p.winsInGame), 1);
    const steps = niceSteps(maxWins);

    const PAD_L = 32, PAD_R = 12, PAD_T = 18, PAD_B = 38;
    const chartW = W - PAD_L - PAD_R;
    const chartH = H - PAD_T - PAD_B;

    // Grille horizontale avec steps entiers
    for (let i = 0; i <= steps; i++) {
        const val = Math.round((i / steps) * maxWins);
        const y = PAD_T + chartH - (val / maxWins) * chartH;
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(PAD_L, y); ctx.lineTo(W - PAD_R, y); ctx.stroke();
        ctx.fillStyle = mutedColor;
        ctx.font = Math.round(W * 0.032) + 'px DM Sans,sans-serif';
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.fillText(val, PAD_L - 5, y);
    }

    // Barres
    const barW = Math.min(52, (chartW / players.length) * 0.62);
    const step = chartW / players.length;

    players.forEach((p, i) => {
        const x = PAD_L + step * i + step / 2;
        const barH = (p.winsInGame / maxWins) * chartH;
        const y = PAD_T + chartH - barH;
        const rx = x - barW / 2, rr = Math.min(6, barW / 2);

        // Barre arrondie
        ctx.fillStyle = p.color + 'cc';
        if (barH > 0) {
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
        } else {
            // Petite marque si 0 victoires
            ctx.fillStyle = mutedColor + '44';
            ctx.fillRect(rx, PAD_T + chartH - 2, barW, 2);
        }

        // Valeur
        ctx.fillStyle = textColor;
        ctx.font = 'bold ' + Math.round(W * 0.036) + 'px DM Sans,sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText(p.winsInGame, x, y - 2);

        // Médaille + nom
        const medal = RANK_MEDALS[top3IndexOf(p.name)] || '';
        ctx.font = Math.round(W * 0.03) + 'px DM Sans,sans-serif';
        ctx.fillStyle = mutedColor;
        ctx.textBaseline = 'top';
        ctx.fillText(medal + ' ' + truncateLabel(ctx, p.name, step - 6, Math.round(W * 0.03)), x, PAD_T + chartH + 6);
    });
}

// Retrouver le rang d'un joueur dans le top3 global (pour la médaille)
let _top3Cache = null;
function top3IndexOf(name) {
    // On lit depuis le DOM si possible, sinon 0
    if (!_top3Cache) return 0;
    return _top3Cache.findIndex(p => p.name === name);
}

function closeTop3ModalBg(e) {
    if (e.target === document.getElementById('top3Modal')) {
        document.getElementById('top3Modal').classList.remove('open');
    }
}


/* ══════════════════════════════════════════
   CAMEMBERT : jours de la semaine
   ══════════════════════════════════════════ */
function drawPieChart(matches) {
    const canvas = document.getElementById('pieChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const SIZE = 220;
    canvas.width = SIZE * dpr; canvas.height = SIZE * dpr;
    canvas.style.width = SIZE + 'px'; canvas.style.height = SIZE + 'px';
    ctx.scale(dpr, dpr);

    const dayCounts = [0, 0, 0, 0, 0, 0, 0];
    matches.forEach(m => { dayCounts[new Date(m.date).getDay()]++; });
    const total = matches.length;

    const segments = dayCounts
        .map((count, i) => ({ label: DAY_NAMES[i], count, pct: total > 0 ? count / total : 0 }))
        .filter(s => s.count > 0);

    const PIE_COLORS = ['#9b59f5', '#38bdf8', '#f5c542', '#3ddc84', '#fb7185', '#a3e635', '#f97316'];
    const cx = SIZE / 2, cy = SIZE / 2, r = SIZE * 0.39, rInner = SIZE * 0.21;
    let startAngle = -Math.PI / 2;

    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const borderColor = isDark ? '#12082a' : '#ffffff';

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

        if (seg.pct > 0.07) {
            const midAngle = startAngle + sweep / 2;
            const lx = cx + Math.cos(midAngle) * r * 0.65;
            const ly = cy + Math.sin(midAngle) * r * 0.65;
            ctx.fillStyle = '#fff';
            ctx.font = 'bold ' + Math.round(SIZE * 0.056) + 'px DM Sans,sans-serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(Math.round(seg.pct * 100) + '%', lx, ly);
        }
        startAngle = endAngle;
    });

    // Trou central (donut)
    ctx.beginPath();
    ctx.arc(cx, cy, rInner, 0, 2 * Math.PI);
    ctx.fillStyle = isDark ? '#12082a' : '#f0eef8';
    ctx.fill();

    // Texte central
    ctx.fillStyle = isDark ? '#e8e0ff' : '#1a0a2e';
    ctx.font = 'bold ' + Math.round(SIZE * 0.09) + 'px Playfair Display,serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(total, cx, cy - 9);
    ctx.font = Math.round(SIZE * 0.05) + 'px DM Sans,sans-serif';
    ctx.fillStyle = isDark ? '#8b7ba8' : '#7a6a9a';
    ctx.fillText('parties', cx, cy + 12);

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




/* ══════════════════════════════════════════
   CAMEMBERT : jours de jeu DISTINCTS
   Compte les jours calendaires uniques (1 jeudi = 1, peu importe le nb de parties)
   ══════════════════════════════════════════ */
function drawPieDaysChart(matches) {
    const canvas = document.getElementById('pieDaysChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const SIZE = 220;
    canvas.width = SIZE * dpr; canvas.height = SIZE * dpr;
    canvas.style.width = SIZE + 'px'; canvas.style.height = SIZE + 'px';
    ctx.scale(dpr, dpr);

    // Collecter les jours calendaires distincts (une date = un jour unique)
    const uniqueDays = new Set();
    matches.forEach(m => {
        const d = new Date(m.date);
        // Clé unique : année + jour de l'année → identifie un jour calendaire précis
        const key = d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
        uniqueDays.add(key + '|' + d.getDay()); // stocker aussi le jour de semaine
    });

    // Compter par jour de semaine parmi les jours distincts
    const dayCounts = [0, 0, 0, 0, 0, 0, 0];
    uniqueDays.forEach(entry => {
        const weekDay = parseInt(entry.split('|')[1]);
        dayCounts[weekDay]++;
    });
    const totalDays = uniqueDays.size;

    const segments = dayCounts
        .map((count, i) => ({ label: DAY_NAMES[i], count, pct: totalDays > 0 ? count / totalDays : 0 }))
        .filter(s => s.count > 0);

    const PIE_COLORS = ['#9b59f5', '#38bdf8', '#f5c542', '#3ddc84', '#fb7185', '#a3e635', '#f97316'];
    const cx = SIZE / 2, cy = SIZE / 2, r = SIZE * 0.39, rInner = SIZE * 0.21;
    let startAngle = -Math.PI / 2;

    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const borderColor = isDark ? '#12082a' : '#ffffff';

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

        if (seg.pct > 0.07) {
            const midAngle = startAngle + sweep / 2;
            const lx = cx + Math.cos(midAngle) * r * 0.65;
            const ly = cy + Math.sin(midAngle) * r * 0.65;
            ctx.fillStyle = '#fff';
            ctx.font = 'bold ' + Math.round(SIZE * 0.056) + 'px DM Sans,sans-serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(Math.round(seg.pct * 100) + '%', lx, ly);
        }
        startAngle = endAngle;
    });

    // Trou central (donut)
    ctx.beginPath();
    ctx.arc(cx, cy, rInner, 0, 2 * Math.PI);
    ctx.fillStyle = isDark ? '#12082a' : '#f0eef8';
    ctx.fill();

    // Texte central
    ctx.fillStyle = isDark ? '#e8e0ff' : '#1a0a2e';
    ctx.font = 'bold ' + Math.round(SIZE * 0.09) + 'px Playfair Display,serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(totalDays, cx, cy - 9);
    ctx.font = Math.round(SIZE * 0.042) + 'px DM Sans,sans-serif';
    ctx.fillStyle = isDark ? '#8b7ba8' : '#7a6a9a';
    ctx.fillText('jours joués', cx, cy + 13);

    const legend = document.getElementById('pieDaysLegend');
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

/* ══════════════════════════════════════════
   HISTOGRAMME : parties par joueur
   ══════════════════════════════════════════ */
function drawPlayerBarChart(matches) {
    const canvas = document.getElementById('playerBarChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth || 400, H = 220;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const textColor  = isDark ? '#c8b8e8' : '#2d1f5e';
    const mutedColor = isDark ? '#6b5a88' : '#9a8ab8';
    const gridColor  = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

    const countMap = {}, colorMap = {};
    const roster = BS.getRoster();
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
    const steps = niceSteps(maxVal);

    const PAD_L = 38, PAD_R = 16, PAD_T = 18, PAD_B = 48;
    const chartW = W - PAD_L - PAD_R;
    const chartH = H - PAD_T - PAD_B;

    // Grille horizontale avec steps entiers propres
    for (let i = 0; i <= steps; i++) {
        const val = Math.round((i / steps) * maxVal);
        const y = PAD_T + chartH - (val / maxVal) * chartH;
        ctx.strokeStyle = gridColor; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(PAD_L, y); ctx.lineTo(W - PAD_R, y); ctx.stroke();
        ctx.fillStyle = mutedColor;
        ctx.font = Math.round(W * 0.028) + 'px DM Sans,sans-serif';
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.fillText(val, PAD_L - 6, y);
    }

    const barW = Math.min(48, (chartW / entries.length) * 0.65);
    const gap = chartW / entries.length;

    entries.forEach(([name, count], i) => {
        const x = PAD_L + gap * i + gap / 2;
        const barH = (count / maxVal) * chartH;
        const y = PAD_T + chartH - barH;
        const color = colorMap[name] || CHART_COLORS[i % CHART_COLORS.length];
        const rx = x - barW / 2, rr = 5;

        ctx.fillStyle = color + 'cc';
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

        // Valeur
        ctx.fillStyle = textColor;
        ctx.font = 'bold ' + Math.round(W * 0.032) + 'px DM Sans,sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText(count, x, y - 3);

        // Nom + point couleur
        ctx.beginPath();
        ctx.arc(x, PAD_T + chartH + 6, 3, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();

        ctx.fillStyle = mutedColor;
        ctx.font = Math.round(W * 0.028) + 'px DM Sans,sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(truncateLabel(ctx, name, gap - 4, Math.round(W * 0.028)), x, PAD_T + chartH + 12);
    });
}


/* ══════════════════════════════════════════
   HISTOGRAMME TIMELINE
   ══════════════════════════════════════════ */
function drawTimelineChart(matches) {
    const MIN_BAR_STEP = 28;
    const wrap   = document.querySelector('.timeline-scroll-wrap');
    const canvas = document.getElementById('timelineChart');
    if (!canvas || !wrap) return;

    const isDark     = document.documentElement.getAttribute('data-theme') !== 'light';
    const textColor  = isDark ? '#c8b8e8' : '#2d1f5e';
    const mutedColor = isDark ? '#6b5a88' : '#9a8ab8';
    const gridColor  = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    const yearColor  = isDark ? '#f5c542' : '#b8860b';
    const monthColor = isDark ? '#38bdf8' : '#1e90ff';
    const barColor   = '#9b59f5';
    const curveColor = '#fb7185';   // temps/jour  → rose
    const avgColor   = '#38bdf8';   // moyenne     → bleu pointillé

    /* ── Agréger par intervalle — temps RÉEL depuis boardscore_time ── */
    const _timeData = getTimeData();   // { 'YYYY-MM-DD': secondes }
    const intervalMap = {};
    matches.forEach(m => {
        const key = getIntervalKey(m.date);
        if (!intervalMap[key]) intervalMap[key] = { games: 0, seconds: 0, dateCovered: new Set() };
        intervalMap[key].games++;
        intervalMap[key].dateCovered.add(dateKeyFromTs(m.date));
    });
    // Sommer le temps réel pour chaque date couverte
    Object.values(intervalMap).forEach(iv => {
        iv.dateCovered.forEach(dk => { iv.seconds += (_timeData[dk] || 0); });
    });

    const keys = Object.keys(intervalMap).map(Number).sort((a, b) => a - b);
    if (keys.length === 0) return;
    const firstKey = keys[0], lastKey = keys[keys.length - 1];
    const allKeys = [];
    let cur = firstKey;
    while (cur <= lastKey) {
        allKeys.push(cur);
        if (CHART_BAR_INTERVAL === 'week')       cur += 7 * 24 * 3600 * 1000;
        else if (CHART_BAR_INTERVAL === 'month') { const d = new Date(cur); d.setMonth(d.getMonth() + 1); cur = d.getTime(); }
        else                                      cur += 24 * 3600 * 1000;
    }

    const data = allKeys.map(k => {
        const iv = intervalMap[k];
        const rawSec = iv ? iv.seconds : 0;
        const dailyTime = rawSec > 0
            ? (CHART_TIME_UNIT === 'hour' ? +(rawSec / 3600).toFixed(1) : Math.round(rawSec / 60))
            : 0;
        return { key: k, date: new Date(k), games: iv ? iv.games : 0, dailyTime };
    });

    /* ── Moyenne du temps par intervalle actif ── */
    const activePts = data.filter(d => d.dailyTime > 0);
    const avgTime   = activePts.length > 0
        ? activePts.reduce((s, d) => s + d.dailyTime, 0) / activePts.length
        : 0;

    /* ── Dimensions ── */
    const n   = data.length;
    const PAD_L = 36, PAD_R = 44, PAD_T = 20, PAD_B = 64, H = 240;
    const minW = PAD_L + PAD_R + n * MIN_BAR_STEP;
    const W    = Math.max(wrap.offsetWidth || 340, minW);
    const dpr  = window.devicePixelRatio || 1;
    canvas.width  = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const chartW = W - PAD_L - PAD_R;
    const chartH = H - PAD_T - PAD_B;
    const maxGames = Math.max(...data.map(d => d.games), 1);
    const maxTime  = Math.max(...data.map(d => d.dailyTime), avgTime, 1);
    const gSteps   = niceSteps(maxGames);
    const tSteps   = niceSteps(Math.ceil(maxTime));
    const step     = chartW / Math.max(n, 1);
    const barW     = Math.max(5, Math.min(28, step * 0.60));
    const LFS      = Math.round(H * 0.05);  // label font size
    const DAY_LTR  = ['D', 'L', 'M', 'Me', 'J', 'V', 'S'];

    const xOf  = i => PAD_L + step * i + step / 2;
    const yOfG = v => PAD_T + chartH - (v / maxGames) * chartH;
    const yOfT = v => PAD_T + chartH - (v / maxTime)  * chartH;

    /* ════════════════════════════════
       COUCHE 1 — Grille + axes
    ════════════════════════════════ */
    for (let i = 0; i <= gSteps; i++) {
        const val = Math.round((i / gSteps) * maxGames);
        const y   = yOfG(val);
        ctx.strokeStyle = gridColor; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(PAD_L, y); ctx.lineTo(W - PAD_R, y); ctx.stroke();
        ctx.fillStyle = mutedColor;
        ctx.font = LFS + 'px DM Sans,sans-serif';
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.fillText(val, PAD_L - 5, y);
    }
    for (let i = 0; i <= tSteps; i++) {
        const val = +(( i / tSteps) * maxTime).toFixed(CHART_TIME_UNIT === 'hour' ? 1 : 0);
        const y   = PAD_T + chartH - (i / tSteps) * chartH;
        ctx.fillStyle = curveColor + '99';
        ctx.font = LFS + 'px DM Sans,sans-serif';
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(val, W - PAD_R + 4, y);
    }

    /* ════════════════════════════════
       COUCHE 2 — Barres
    ════════════════════════════════ */
    data.forEach((d, i) => {
        if (d.games === 0) return;
        const x = xOf(i), bH = (d.games / maxGames) * chartH;
        const y = PAD_T + chartH - bH, rx = x - barW / 2, rr = Math.min(4, barW / 2);
        ctx.globalAlpha = 0.78; ctx.fillStyle = barColor;
        ctx.beginPath();
        ctx.moveTo(rx + rr, y); ctx.lineTo(rx + barW - rr, y);
        ctx.quadraticCurveTo(rx + barW, y, rx + barW, y + rr);
        ctx.lineTo(rx + barW, y + bH); ctx.lineTo(rx, y + bH); ctx.lineTo(rx, y + rr);
        ctx.quadraticCurveTo(rx, y, rx + rr, y);
        ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 1;
    });

    /* ════════════════════════════════
       COUCHE 3 — Marqueurs mois
    ════════════════════════════════ */
    {
        let prevMo = -1, prevYr = -1;
        data.forEach((d, i) => {
            const yr = d.date.getFullYear(), mo = d.date.getMonth();
            // Afficher dès que le mois change (y compris premier mois, peu importe l'année)
            if (mo !== prevMo && CHART_BAR_INTERVAL !== 'month') {
                const lx = xOf(i) - step / 2;
                ctx.globalAlpha = 0.8;
                ctx.strokeStyle = monthColor; ctx.lineWidth = 1.5;
                ctx.setLineDash([2, 4]);
                ctx.beginPath(); ctx.moveTo(lx, PAD_T + 24); ctx.lineTo(lx, PAD_T + chartH); ctx.stroke();
                ctx.setLineDash([]);
                ctx.globalAlpha = 1;
                // Label mois sur la ligne (décalé pour ne pas chevaucher l'année)
                const labelTop = (yr !== prevYr) ? PAD_T + 26 : PAD_T + 4;
                ctx.fillStyle = monthColor;
                ctx.font = 'bold ' + Math.round(LFS * 0.85) + 'px DM Sans,sans-serif';
                ctx.textAlign = 'left'; ctx.textBaseline = 'top';
                ctx.fillText(MONTH_NAMES_SHORT[mo], lx + 3, labelTop);
            }
            prevMo = mo; prevYr = yr;
        });
    }

    /* ════════════════════════════════
       COUCHE 4 — Marqueurs année
    ════════════════════════════════ */
    {
        let prevYr = -1;
        data.forEach((d, i) => {
            const yr = d.date.getFullYear();
            if (yr !== prevYr) {
                const lx = xOf(i) - step / 2;
                ctx.globalAlpha = 0.9;
                ctx.strokeStyle = yearColor; ctx.lineWidth = 2;
                ctx.setLineDash([4, 3]);
                ctx.beginPath(); ctx.moveTo(lx, PAD_T); ctx.lineTo(lx, PAD_T + chartH); ctx.stroke();
                ctx.setLineDash([]);
                const yrStr = '' + yr;
                ctx.font = 'bold ' + LFS + 'px DM Sans,sans-serif';
                const tw = ctx.measureText(yrStr).width;
                const pX = lx + 4, pY = PAD_T + 3, pW = tw + 10, pH = LFS + 5;
                ctx.fillStyle = isDark ? 'rgba(26,10,46,0.92)' : 'rgba(245,240,255,0.92)';
                ctx.beginPath(); ctx.roundRect(pX, pY, pW, pH, 4); ctx.fill();
                ctx.fillStyle = yearColor;
                ctx.textAlign = 'left'; ctx.textBaseline = 'top';
                ctx.fillText(yrStr, pX + 5, pY + 3);
                ctx.globalAlpha = 1;
                prevYr = yr;
            }
        });
    }

    /* ════════════════════════════════
       COUCHE 5 — Courbe temps/jour (rose)
    ════════════════════════════════ */
    const timePoints = data.map((d, i) => ({ x: xOf(i), y: yOfT(d.dailyTime), v: d.dailyTime }))
        .filter(p => p.v > 0);
    if (timePoints.length > 0) {
        // Zone de remplissage
        ctx.beginPath();
        ctx.moveTo(timePoints[0].x, timePoints[0].y);
        timePoints.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.lineTo(timePoints[timePoints.length - 1].x, PAD_T + chartH);
        ctx.lineTo(timePoints[0].x, PAD_T + chartH);
        ctx.closePath();
        ctx.globalAlpha = 0.1; ctx.fillStyle = curveColor; ctx.fill(); ctx.globalAlpha = 1;
        // Trait
        ctx.strokeStyle = curveColor; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
        ctx.setLineDash([]);
        ctx.beginPath();
        timePoints.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
        ctx.stroke();
        // Points
        timePoints.forEach(p => {
            ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, 2 * Math.PI);
            ctx.fillStyle = curveColor; ctx.fill();
            ctx.strokeStyle = isDark ? '#1a0a2e' : '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
        });
    }

    /* ════════════════════════════════
       COUCHE 6 — Ligne moyenne (bleu pointillé)
    ════════════════════════════════ */
    if (avgTime > 0) {
        const avgY  = yOfT(avgTime);
        const avgLbl = CHART_TIME_UNIT === 'hour' ? avgTime.toFixed(1) : Math.round(avgTime);
        ctx.strokeStyle = avgColor; ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]); ctx.globalAlpha = 0.9;
        ctx.beginPath(); ctx.moveTo(PAD_L, avgY); ctx.lineTo(W - PAD_R, avgY); ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha = 1;
        ctx.fillStyle = avgColor;
        ctx.font = 'bold ' + Math.round(LFS * 0.8) + 'px DM Sans,sans-serif';
        ctx.textAlign = 'right'; ctx.textBaseline = avgY > PAD_T + LFS + 4 ? 'bottom' : 'top';
        ctx.fillText('moy. ' + avgLbl + ' ' + timeLabel(), W - PAD_R - 4,
            avgY > PAD_T + LFS + 4 ? avgY - 3 : avgY + 3);
    }

    /* ════════════════════════════════
       COUCHE 7 — Labels abscisse (2 lignes)
    ════════════════════════════════ */
    {
        let prevMo = -1, prevYr = -1;
        data.forEach((d, i) => {
            const x  = xOf(i);
            const yr = d.date.getFullYear(), mo = d.date.getMonth();
            const dn = d.date.getDate(), dow = d.date.getDay();

            // Ligne 1 : label du jour
            let lbl = '';
            if (CHART_BAR_INTERVAL === 'day')        lbl = dn + ' ' + DAY_LTR[dow];
            else if (CHART_BAR_INTERVAL === 'week')   lbl = '' + dn;
            else                                       lbl = MONTH_NAMES_SHORT[mo];

            ctx.strokeStyle = mutedColor + '44'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(x, PAD_T + chartH); ctx.lineTo(x, PAD_T + chartH + 4); ctx.stroke();
            ctx.fillStyle = mutedColor;
            ctx.font = LFS + 'px DM Sans,sans-serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'top';
            ctx.fillText(lbl, x, PAD_T + chartH + 6);

            // Ligne 2 : nom du mois en bleu (seulement au changement de mois)
            if (mo !== prevMo && CHART_BAR_INTERVAL !== 'month') {
                ctx.fillStyle = monthColor;
                ctx.font = 'bold ' + LFS + 'px DM Sans,sans-serif';
                ctx.textAlign = 'center'; ctx.textBaseline = 'top';
                ctx.fillText(MONTH_NAMES_SHORT[mo], x, PAD_T + chartH + 6 + LFS + 3);
            }

            prevMo = mo; prevYr = yr;
        });
    }

    /* ════════════════════════════════
       Légende basse
    ════════════════════════════════ */
    const ly = H - 10;
    // Barres
    ctx.globalAlpha = 0.78; ctx.fillStyle = barColor;
    ctx.fillRect(PAD_L, ly - 3, 10, 6); ctx.globalAlpha = 1;
    ctx.fillStyle = mutedColor;
    ctx.font = Math.round(H * 0.046) + 'px DM Sans,sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('Parties', PAD_L + 14, ly);
    // Courbe rose
    ctx.strokeStyle = curveColor; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(PAD_L + 74, ly); ctx.lineTo(PAD_L + 84, ly); ctx.stroke();
    ctx.beginPath(); ctx.arc(PAD_L + 79, ly, 3, 0, 2 * Math.PI);
    ctx.fillStyle = curveColor; ctx.fill();
    ctx.fillStyle = mutedColor;
    ctx.fillText('Temps/jour (' + timeLabel() + ')', PAD_L + 88, ly);
    // Ligne moy bleue
    ctx.strokeStyle = avgColor; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(PAD_L + 200, ly); ctx.lineTo(PAD_L + 210, ly); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = mutedColor;
    ctx.fillText('Moyenne', PAD_L + 214, ly);
    // Marqueur année
    ctx.fillStyle = yearColor; ctx.fillRect(PAD_L + 284, ly - 3, 3, 6);
    ctx.fillStyle = mutedColor; ctx.fillText('Année', PAD_L + 292, ly);
    // Marqueur mois
    ctx.fillStyle = monthColor; ctx.fillRect(PAD_L + 344, ly - 3, 3, 6);
    ctx.fillStyle = mutedColor; ctx.fillText('Mois', PAD_L + 352, ly);
}

/* ══════════════════════════════════════════
   UTILITAIRE
   ══════════════════════════════════════════ */
function truncateLabel(ctx, text, maxW, fontSize) {
    ctx.font = fontSize + 'px DM Sans,sans-serif';
    if (ctx.measureText(text).width <= maxW) return text;
    let t = text;
    while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
    return t + '…';
}


/* ══════════════════════════════════════════
   INIT
   ══════════════════════════════════════════ */
renderGeneralStats();