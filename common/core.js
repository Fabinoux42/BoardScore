/* ═══════════════════════════════════════════════════════════════
   BoardScore — core.js
   Module partagé entre tous les jeux.
   Chaque jeu importe ce fichier puis appelle BoardScore.create(config).

   Usage dans un jeu :
   ─────────────────────────────────────────────────────────────
   <script src="../../common/core.js"></script>
   <script src="skyjo.js"></script>

   // skyjo.js
   const game = BoardScore.create({
       key: 'skyjo',
       defaultState: { players: [], round: 1, history: [] },
       onRender(state)  { … },           // rendu spécifique
       onNextRound(state) { … },         // hook après incrément round (optionnel)
       onRemovePlayer(state, idx) { … }, // hook après suppression (optionnel)
       buildBadgeText(state, scored) { … }, // texte personnalisé du badge (optionnel)
       buildPlayerCard(p, i, extras) { … }, // HTML complet de la card (optionnel)
       getPlayerCardExtras(p, i, state) { … }, // classes + attributs custom (optionnel)
       buildHistoryItem(h) { … },        // HTML du contenu historique (optionnel)
       buildWinnerPodium(sorted) { … },  // HTML podium custom (optionnel)
       checkGameEnd(state) { … },        // retourne true si partie terminée
   });
   ═══════════════════════════════════════════════════════════════ */

const BoardScore = (() => {

    /* ─── CONSTANTES PARTAGÉES ─── */
    const COLORS = ['#f5c542','#e05c2a','#3ddc84','#9b59f5','#38bdf8','#fb7185','#a3e635','#f97316'];

    /* ─── UTILS ─── */
    function getInitial(name) {
        return name.trim().charAt(0).toUpperCase();
    }

    function $(id) {
        return document.getElementById(id);
    }


    /* ═══════════════════════════════════════════
       ROSTER SYNC — ajoute auto les joueurs au roster global
       ═══════════════════════════════════════════ */
    function syncToRoster(name, color) {
        try {
            const roster = JSON.parse(localStorage.getItem('boardscore_players')) || [];
            if (roster.find(p => p.name.toLowerCase() === name.toLowerCase())) return;
            roster.push({ name, color });
            localStorage.setItem('boardscore_players', JSON.stringify(roster));
        } catch (e) {}
    }


    /* ═══════════════════════════════════════════
       MATCH HISTORY — enregistre chaque fin de partie
       Stocké dans localStorage sous "boardscore_matches"
       (La fonction trackMatchResult est dans create() car elle utilise config.key)
       ═══════════════════════════════════════════ */


    /* ═══════════════════════════════════════════
       create(config)  —  Factory principale
       ═══════════════════════════════════════════ */
    function create(config) {

        /* ── State ── */
        let state = { ...config.defaultState };

        // New-game modal state (interne)
        let ngMode = 'same';
        let ngKeepSet = new Set();
        let ngNewPlayers = [];

        /* ── Persistence ── */
        function save() {
            try {
                const payload = config.onSerialize
                    ? config.onSerialize(state)
                    : state;
                localStorage.setItem(config.key + '_state', JSON.stringify(payload));
            } catch(e) {}
        }

        function load() {
            try {
                const raw = localStorage.getItem(config.key + '_state');
                if (raw) {
                    let parsed = JSON.parse(raw);
                    if (config.onDeserialize) parsed = config.onDeserialize(parsed);
                    state = { ...state, ...parsed };
                }
            } catch(e) {}
        }

        /* ── Match tracking ── */
        function trackMatchResult(sorted, winner) {
            try {
                const matches = JSON.parse(localStorage.getItem('boardscore_matches')) || [];
                matches.push({
                    game: config.key,
                    date: Date.now(),
                    winner: winner.name,
                    players: sorted.map(p => ({ name: p.name, score: p.score })),
                });
                localStorage.setItem('boardscore_matches', JSON.stringify(matches));
            } catch (e) {}
        }

        /* ── Players ── */
        function addPlayer() {
            const input = $('newPlayerName');
            const name = input.value.trim();
            if (!name) return;
            if (state.players.find(p => p.name.toLowerCase() === name.toLowerCase())) {
                input.style.borderColor = 'var(--red)';
                setTimeout(() => input.style.borderColor = '', 800);
                return;
            }
            const idx = state.players.length % COLORS.length;
            const color = COLORS[idx];
            state.players.push({ name, score: 0, color });
            input.value = '';

            // Sync auto vers le roster global
            syncToRoster(name, color);

            save(); render();
        }

        function removePlayer(idx) {
            if (!confirm('Supprimer ' + state.players[idx].name + ' ?')) return;
            state.players.splice(idx, 1);
            if (config.onRemovePlayer) config.onRemovePlayer(state, idx);
            save(); render();
        }

        /* ── Round helpers ── */
        function roundHasScores() {
            return state.history.some(h => h.round === state.round);
        }

        /* ── Render principal ── */
        function render() {
            renderPlayers();
            renderHistory();
            renderBadge();
            renderProgress();

            const btnNext = document.querySelector('.btn-next');
            if (btnNext) btnNext.style.opacity = roundHasScores() ? '1' : '0.4';

            // Hook de rendu spécifique au jeu
            if (config.onRender) config.onRender(state);
        }

        /* ── Progress bar ── */
        function renderProgress() {
            const wrap = $('progressWrap');
            const bar  = $('progressBar');
            const lbl  = $('progressLabel');
            if (!wrap || !bar || !lbl) return;

            if (state.players.length === 0) { wrap.style.display = 'none'; return; }
            const maxScore = Math.max(...state.players.map(p => p.score));
            if (maxScore <= 0) { wrap.style.display = 'none'; return; }
            wrap.style.display = 'block';

            // Le jeu peut fournir sa propre logique de progress (ex: limite configurable, infini…)
            if (config.renderProgress) {
                config.renderProgress(state, { wrap, bar, lbl, maxScore });
                return;
            }

            // Fallback : si scoreLimit est dans le state, on l'utilise
            const limit = state.scoreLimit || config.scoreLimit;
            if (!limit) { wrap.style.display = 'none'; return; }
            const pct = Math.min(100, (maxScore / limit) * 100);
            bar.style.width = pct + '%';
            lbl.textContent = 'max ' + maxScore + ' / ' + limit;
        }

        /* ── Badge ── */
        function renderBadge() {
            const badge = $('roundBadge');
            if (!badge) return;
            const scored = roundHasScores();

            if (config.buildBadgeText) {
                badge.textContent = config.buildBadgeText(state, scored);
            } else {
                badge.textContent = (scored ? '✅ ' : '⏳ ') + 'Manche ' + state.round;
            }
            badge.style.background = scored ? 'var(--green)' : 'var(--accent)';
            badge.style.color = scored ? '#0d2e1a' : '#1a0a2e';
        }

        /* ── Player Cards ── */
        function renderPlayers() {
            const list = $('playersList');
            if (!list) return;

            if (state.players.length === 0) {
                const emoji = config.emptyEmoji || '🃏';
                list.innerHTML = '<div class="empty-state"><div class="emoji">' + emoji + '</div>' +
                    '<p>Aucun joueur encore.<br>Ajoute des joueurs pour commencer !</p></div>';
                return;
            }

            const sortFn = config.highestWins
                ? (a, b) => b.score - a.score
                : (a, b) => a.score - b.score;
            const sorted = [...state.players].sort(sortFn);
            const leader = sorted[0];
            const rounds = state.history.length;

            list.innerHTML = state.players.map((p, i) => {
                // Infos de base
                const isLeader = p.name === leader.name && rounds > 0;

                // Le jeu peut enrichir avec ses propres classes/flags
                const extras = config.getPlayerCardExtras
                    ? config.getPlayerCardExtras(p, i, state, { isLeader, rounds })
                    : {};

                const isDanger = extras.isDanger || false;
                const cardClass = (extras.cardClass || '') +
                    (isLeader ? ' leader' : '') +
                    (isDanger ? ' danger' : '');
                const scoreClass = extras.scoreClass || '';
                const afterName = extras.afterName || '';

                const roundsText = rounds > 0
                    ? rounds + ' manche' + (rounds > 1 ? 's' : '') + ' jouée' + (rounds > 1 ? 's' : '')
                    : 'Prêt à jouer';

                return '<div class="player-card ' + cardClass.trim() + '" style="--player-color:' + p.color + '">' +
                    '<div class="player-avatar" style="background:' + p.color + '">' + getInitial(p.name) + '</div>' +
                    '<div class="player-info">' +
                    '<div class="player-name">' + p.name + afterName + '</div>' +
                    '<div class="player-details">' + roundsText + '</div>' +
                    '</div>' +
                    '<div><div class="player-score ' + scoreClass + '">' + p.score + '</div>' +
                    '<div class="score-label">points</div></div>' +
                    '<div class="player-actions">' +
                    '<div class="btn-icon danger" onclick="game.removePlayer(' + i + ')">🗑</div>' +
                    '</div>' +
                    '</div>';
            }).join('');
        }

        /* ── History ── */
        function renderHistory() {
            const section = $('historySection');
            const list = $('historyList');
            if (!section || !list) return;

            if (state.history.length === 0) {
                section.style.display = 'none';
                return;
            }
            section.style.display = 'block';

            list.innerHTML = [...state.history].reverse().map(h => {
                // Le jeu fournit le contenu de chaque item historique
                if (config.buildHistoryItem) {
                    return config.buildHistoryItem(h);
                }
                // Fallback générique
                const header = '<div class="history-item-header">' +
                    '<span class="history-round-num">Manche ' + h.round + '</span></div>';
                const scores = '<div class="history-scores">' +
                    Object.entries(h.scores).map(([name, pts]) => {
                        const prefix = pts >= 0 ? '+' : '';
                        return '<span class="h-score"><strong>' + name + '</strong>: ' +
                            '<span class="val">' + prefix + pts + '</span></span>';
                    }).join('') + '</div>';
                return '<div class="history-item">' + header + scores + '</div>';
            }).join('');
        }

        /* ── Round Error ── */
        function showRoundError(msg) {
            let el = $('roundError');
            if (!el) {
                el = document.createElement('div');
                el.id = 'roundError';
                el.style.cssText = 'background:rgba(255,85,85,0.12);border:1px solid rgba(255,85,85,0.35);' +
                    'border-radius:10px;padding:9px 14px;font-size:0.8rem;color:var(--red);' +
                    'text-align:center;margin:10px 16px 0;animation:fadeIn 0.25s ease;';
                const header = document.querySelector('header');
                if (header) header.insertAdjacentElement('afterend', el);
            }
            el.textContent = msg;
            clearTimeout(el._timer);
            el._timer = setTimeout(() => el.remove(), 3500);
        }

        /* ── Next Round ── */
        function nextRound() {
            if (state.players.length === 0) return;
            if (!roundHasScores()) {
                showRoundError('⚠️ Saisis les scores de la manche ' + state.round + ' avant de continuer !');
                const btnScore = document.querySelector('.btn-score');
                if (btnScore) {
                    btnScore.style.transform = 'scale(1.06)';
                    setTimeout(() => btnScore.style.transform = '', 200);
                }
                return;
            }
            state.round++;
            if (config.onNextRound) config.onNextRound(state);
            save(); render();
            window.scrollTo({ top: 0, behavior: 'smooth' });

            // Vérifier fin de partie
            if (config.checkGameEnd && config.checkGameEnd(state)) {
                setTimeout(() => showWinner(), 400);
            }
        }

        /* ── Winner Screen ── */
        function showWinner() {
            const sortFn = config.highestWins
                ? (a, b) => b.score - a.score
                : (a, b) => a.score - b.score;
            const sorted = [...state.players].sort(sortFn);
            const winner = sorted[0];

            // Enregistrer la fin de partie dans l'historique global
            trackMatchResult(sorted, winner);

            const nameEl = $('winnerName');
            const scoreEl = $('winnerScore');
            const podiumEl = $('winnerPodium');
            const screen = $('winnerScreen');

            if (nameEl) nameEl.textContent = winner.name;
            if (scoreEl) scoreEl.textContent = winner.score + ' points';

            if (podiumEl) {
                if (config.buildWinnerPodium) {
                    podiumEl.innerHTML = config.buildWinnerPodium(sorted);
                } else {
                    const medals = ['🥇', '🥈', '🥉'];
                    podiumEl.innerHTML = sorted.map((p, i) =>
                        '<div class="podium-row">' +
                        '<span class="podium-rank">' + (medals[i] || (i + 1) + '.') + '</span>' +
                        '<span class="podium-name">' + p.name + '</span>' +
                        '<span class="podium-pts">' + p.score + ' pts</span>' +
                        '</div>'
                    ).join('');
                }
            }

            if (screen) screen.classList.add('show');
        }

        function openNewGameFromWinner() {
            const screen = $('winnerScreen');
            if (screen) screen.classList.remove('show');
            openNewGameModal();
        }


        /* ═══════════════════════════════════════════
           NEW GAME MODAL  —  100% partagé
           ═══════════════════════════════════════════ */
        function openNewGameModal(initialMode) {
            ngMode = initialMode || 'same';
            ngKeepSet = new Set(state.players.map((_, i) => i));
            ngNewPlayers = [];

            renderNgModeCards();
            renderNgKeepList();
            renderNgNewList();

            // Appliquer le mode initial (afficher la bonne section)
            const keepSection = $('ng-keep-section');
            const newSection = $('ng-new-section');
            if (keepSection) keepSection.style.display = ngMode === 'same' ? 'block' : 'none';
            if (newSection)  newSection.style.display  = ngMode === 'new'  ? 'block' : 'none';

            // Hook pour sections supplémentaires (domino set, dealer, score limit…)
            if (config.onOpenNewGameModal) config.onOpenNewGameModal(state);

            $('newGameModal').classList.add('open');
        }

        function closeNewGameModal() {
            $('newGameModal').classList.remove('open');
        }

        function selectPlayerMode(mode) {
            ngMode = mode;
            renderNgModeCards();
            const keepSection = $('ng-keep-section');
            const newSection = $('ng-new-section');
            if (keepSection) keepSection.style.display = mode === 'same' ? 'block' : 'none';
            if (newSection)  newSection.style.display  = mode === 'new'  ? 'block' : 'none';

            if (config.onSelectPlayerMode) config.onSelectPlayerMode(mode, ngKeepSet, ngNewPlayers);
        }

        function renderNgModeCards() {
            const same = $('cc-same');
            const nw = $('cc-new');
            if (same) same.classList.toggle('selected', ngMode === 'same');
            if (nw) nw.classList.toggle('selected', ngMode === 'new');
        }

        function renderNgKeepList() {
            const list = $('ngKeepList');
            if (!list) return;
            if (state.players.length === 0) {
                list.innerHTML = '<div style="color:var(--muted);font-size:0.85rem;padding:8px 0">Aucun joueur dans la partie actuelle.</div>';
                return;
            }
            list.innerHTML = state.players.map((p, i) =>
                '<div class="keep-player-row ' + (ngKeepSet.has(i) ? 'checked' : '') + '" onclick="game.toggleKeepPlayer(' + i + ')">' +
                '<div class="kp-avatar" style="background:' + p.color + '">' + getInitial(p.name) + '</div>' +
                '<div class="kp-name">' + p.name + '</div>' +
                '<div class="kp-check">' + (ngKeepSet.has(i) ? '✅' : '⬜') + '</div>' +
                '</div>'
            ).join('');
        }

        function toggleKeepPlayer(i) {
            if (ngKeepSet.has(i)) ngKeepSet.delete(i); else ngKeepSet.add(i);
            renderNgKeepList();
            if (config.onToggleKeepPlayer) config.onToggleKeepPlayer(ngKeepSet);
        }

        function renderNgNewList() {
            const list = $('ngNewList');
            if (!list) return;

            let html = '';

            // Roster quick-pick : joueurs enregistrés pas encore ajoutés
            try {
                const roster = JSON.parse(localStorage.getItem('boardscore_players')) || [];
                const available = roster.filter(r => !ngNewPlayers.find(n => n.toLowerCase() === r.name.toLowerCase()));
                if (available.length > 0) {
                    html += '<div class="ng-roster-pick">';
                    html += '<div class="ng-roster-label">Joueurs enregistrés</div>';
                    html += '<div class="ng-roster-chips">';
                    available.forEach(r => {
                        html += '<button class="ng-roster-chip" onclick="game.ngAddFromRoster(\'' + r.name.replace(/'/g, "\\'") + '\')">' +
                            '<span class="ng-chip-dot" style="background:' + r.color + '"></span>' + r.name +
                            '</button>';
                    });
                    html += '</div></div>';
                }
            } catch (e) {}

            // Liste des joueurs ajoutés
            if (ngNewPlayers.length === 0) {
                html += '<div style="color:var(--muted);font-size:0.82rem;padding:4px 0 8px">Aucun joueur ajouté.</div>';
            } else {
                html += ngNewPlayers.map((p, i) =>
                    '<div class="new-player-row">' +
                    '<div class="np-avatar" style="background:' + COLORS[i % COLORS.length] + '">' + getInitial(p) + '</div>' +
                    '<div class="np-name">' + p + '</div>' +
                    '<div class="np-remove" onclick="game.ngRemovePlayer(' + i + ')">✕</div>' +
                    '</div>'
                ).join('');
            }

            list.innerHTML = html;
        }

        function ngAddFromRoster(name) {
            if (ngNewPlayers.find(n => n.toLowerCase() === name.toLowerCase())) return;
            ngNewPlayers.push(name);
            renderNgNewList();
            if (config.onNgPlayersChanged) config.onNgPlayersChanged(ngNewPlayers);
        }

        function ngAddPlayer() {
            const input = $('ngNewPlayerInput');
            const name = input.value.trim();
            if (!name) return;
            if (ngNewPlayers.find(n => n.toLowerCase() === name.toLowerCase())) {
                input.style.borderColor = 'var(--red)';
                setTimeout(() => input.style.borderColor = '', 800);
                return;
            }
            ngNewPlayers.push(name);
            input.value = '';
            renderNgNewList();
            if (config.onNgPlayersChanged) config.onNgPlayersChanged(ngNewPlayers);
        }

        function ngRemovePlayer(i) {
            ngNewPlayers.splice(i, 1);
            renderNgNewList();
            if (config.onNgPlayersChanged) config.onNgPlayersChanged(ngNewPlayers);
        }

        function confirmNewGame() {
            let newPlayers = [];
            if (ngMode === 'same') {
                newPlayers = state.players.filter((_, i) => ngKeepSet.has(i)).map(p => ({ ...p, score: 0 }));
                if (newPlayers.length === 0) { alert('Sélectionne au moins un joueur !'); return; }
            } else {
                if (ngNewPlayers.length === 0) { alert('Ajoute au moins un joueur !'); return; }
                newPlayers = ngNewPlayers.map((name, i) => ({ name, score: 0, color: COLORS[i % COLORS.length] }));
            }

            state.players = newPlayers;
            state.round = 1;
            state.history = [];

            // Sync tous les nouveaux joueurs vers le roster
            newPlayers.forEach(p => syncToRoster(p.name, p.color));

            // Hook pour données custom (dealerIdx, dominoMax, scoreLimit…)
            if (config.onConfirmNewGame) config.onConfirmNewGame(state);

            $('newGameModal').classList.remove('open');
            save(); render();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        /* ── Modal Helpers ── */
        function closeBgModal(e, id) {
            if (e.target.id === id) $(id).classList.remove('open');
        }

        /* ── Score modal helper : stepScore ── */
        function stepScore(identifier, delta, opts) {
            // identifier peut être un name (string) ou un index (number)
            let idx;
            if (typeof identifier === 'string') {
                idx = state.players.findIndex(p => p.name === identifier);
            } else {
                idx = identifier;
            }
            const inp = $('inp_' + idx);
            if (!inp) return;
            const min = (opts && opts.min !== undefined) ? opts.min : -Infinity;
            const newVal = Math.max(min, (parseInt(inp.value) || 0) + delta);
            inp.value = newVal;
            // Mettre à jour tempScores si présent
            if (state.tempScores && typeof identifier === 'string') {
                state.tempScores[identifier] = newVal;
            }
            return newVal;
        }


        /* ═══════════════════════════════════════════
           Enter key bindings
           ═══════════════════════════════════════════ */
        function initKeyBindings() {
            const mainInput = $('newPlayerName');
            if (mainInput) {
                mainInput.addEventListener('keydown', e => {
                    if (e.key === 'Enter') addPlayer();
                });
            }
            document.addEventListener('keydown', e => {
                if (e.key === 'Enter') {
                    const ngInput = $('ngNewPlayerInput');
                    if (document.activeElement === ngInput) ngAddPlayer();
                }
            });
        }


        /* ═══════════════════════════════════════════
           INIT
           ═══════════════════════════════════════════ */
        function init() {
            const isFirstVisit = !localStorage.getItem(config.key + '_state');
            load();
            initKeyBindings();
            render();

            // Première visite → ouvrir la modale new game en mode "nouveaux joueurs"
            if (isFirstVisit) {
                setTimeout(() => {
                    openNewGameModal('new');
                }, 200);
            }
        }


        /* ═══════════════════════════════════════════
           API publique de l'instance
           ═══════════════════════════════════════════ */
        const instance = {
            // State
            getState()        { return state; },
            setState(patch)   { Object.assign(state, patch); },
            save,
            render,

            // Players
            addPlayer,
            removePlayer,

            // Rounds
            roundHasScores,
            nextRound,
            showRoundError,

            // Winner
            showWinner,
            openNewGameFromWinner,

            // New Game Modal
            openNewGameModal,
            closeNewGameModal,
            selectPlayerMode,
            toggleKeepPlayer,
            ngAddPlayer,
            ngAddFromRoster,
            ngRemovePlayer,
            confirmNewGame,
            getNgMode()       { return ngMode; },
            getNgKeepSet()    { return ngKeepSet; },
            getNgNewPlayers() { return ngNewPlayers; },

            // Modals
            closeBgModal,

            // Score helpers
            stepScore,

            // Init
            init,
        };

        return instance;
    }


    /* ═══════════════════════════════════════════
       THEME
       ═══════════════════════════════════════════ */
    function getTheme() {
        return localStorage.getItem('boardscore_theme') || 'dark';
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        const btn = $('themeToggle');
        if (btn) btn.textContent = theme === 'light' ? '☀️' : '🌙';
    }

    function toggleTheme() {
        const next = getTheme() === 'dark' ? 'light' : 'dark';
        localStorage.setItem('boardscore_theme', next);
        applyTheme(next);
    }

    // Appliquer le thème immédiatement au chargement
    applyTheme(getTheme());


    /* ═══════════════════════════════════════════
       MODAL CLOSE BUTTONS
       Injecte un bouton ✕ dans chaque modale
       ═══════════════════════════════════════════ */
    document.addEventListener('DOMContentLoaded', function() {
        document.querySelectorAll('.modal-overlay .modal').forEach(function(modal) {
            const overlay = modal.parentElement;
            if (!overlay || !overlay.classList.contains('modal-overlay')) return;

            // Créer le bouton fermer
            const btn = document.createElement('button');
            btn.className = 'modal-close-btn';
            btn.textContent = '✕';
            btn.setAttribute('aria-label', 'Fermer');
            btn.addEventListener('click', function() {
                overlay.classList.remove('open');
            });

            // Insérer avant le premier enfant de la modale
            modal.insertBefore(btn, modal.firstChild);
        });
    });


    /* ═══════════════════════════════════════════
       API publique du module
       ═══════════════════════════════════════════ */
    return {
        COLORS,
        getInitial,
        $,
        create,
        toggleTheme,
    };

})();