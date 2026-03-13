/* ═══════════════════════════════════════════
   BoardScore — time-tracker.js
   Tracke le temps réel passé sur les pages de jeu.
   À charger sur chaque page de jeu (avant le JS du jeu).

   Stockage : localStorage → "boardscore_time"
   Format   : { "2026-03-12": 3725, "2026-03-13": 180, … }
              (valeurs en secondes)
   ═══════════════════════════════════════════ */

(function () {

    const STORAGE_KEY  = 'boardscore_time';
    const SAVE_EVERY   = 4;   // secondes entre chaque écriture dans localStorage

    let   _interval    = null;
    let   _buffer      = 0;   // secondes accumulées non encore sauvegardées

    /* ── Helpers ── */
    function todayKey() {
        const d = new Date();
        return d.getFullYear() + '-'
            + String(d.getMonth() + 1).padStart(2, '0') + '-'
            + String(d.getDate()).padStart(2, '0');
    }

    function getAll() {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
        catch (e) { return {}; }
    }

    function flush() {
        if (_buffer <= 0) return;
        const data   = getAll();
        const key    = todayKey();
        data[key]    = (data[key] || 0) + _buffer;
        _buffer      = 0;
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
        catch (e) {}
    }

    /* ── Démarrer le compteur ── */
    function startTracking() {
        if (_interval) return;                   // déjà en cours
        _interval = setInterval(function () {
            _buffer++;
            if (_buffer % SAVE_EVERY === 0) {    // écriture périodique
                flush();
            }
        }, 1000);
    }

    /* ── Arrêter + sauvegarder ── */
    function stopTracking() {
        if (_interval) { clearInterval(_interval); _interval = null; }
        flush();                                 // vider le buffer immédiatement
    }

    /* ── Événements de cycle de vie ── */
    document.addEventListener('visibilitychange', function () {
        if (document.hidden) { stopTracking(); }
        else                 { startTracking(); }
    });

    // Fermeture d'onglet / navigation hors de la page
    window.addEventListener('beforeunload', stopTracking);
    window.addEventListener('pagehide',     stopTracking);

    /* ── Démarrer si la page est déjà visible ── */
    if (!document.hidden) {
        startTracking();
    }

    /* ── API publique (optionnelle) ── */
    window.BoardScoreTime = {
        getAll:    getAll,
        todayKey:  todayKey,
        getToday:  function () { return (getAll()[todayKey()] || 0); },
    };

})();