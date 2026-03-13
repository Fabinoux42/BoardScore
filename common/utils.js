/* ═══════════════════════════════════════════════════════════════
   BoardScore — utils.js
   Utilitaires partagés entre les pages qui ne chargent pas core.js
   (menu, settings, settings/general).

   Expose window.BS (namespace léger) avec :
     BS.getTheme()       → 'dark' | 'light'
     BS.applyTheme(t)    → applique data-theme + met à jour le bouton
     BS.toggleTheme()    → bascule et sauvegarde
     BS.getInitial(name) → première lettre en majuscule
     BS.getRoster()      → tableau de joueurs depuis localStorage
     BS.getMatches()     → tableau de parties depuis localStorage
   ═══════════════════════════════════════════════════════════════ */

window.BS = {

    getTheme() {
        return localStorage.getItem('boardscore_theme') || 'dark';
    },

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        const btn = document.getElementById('themeToggle');
        if (btn) btn.textContent = theme === 'light' ? '☀️' : '🌙';
    },

    toggleTheme() {
        const next = this.getTheme() === 'dark' ? 'light' : 'dark';
        localStorage.setItem('boardscore_theme', next);
        this.applyTheme(next);
    },

    getInitial(name) {
        return name.trim().charAt(0).toUpperCase();
    },

    getRoster() {
        try { return JSON.parse(localStorage.getItem('boardscore_players')) || []; }
        catch (e) { return []; }
    },

    getMatches() {
        try { return JSON.parse(localStorage.getItem('boardscore_matches')) || []; }
        catch (e) { return []; }
    },

};

// Appliquer le thème immédiatement au chargement
BS.applyTheme(BS.getTheme());

// Exposer toggleTheme() globalement pour les onclick="toggleTheme()" dans le HTML
window.toggleTheme = () => BS.toggleTheme();