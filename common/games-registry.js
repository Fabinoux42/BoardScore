/* ═══════════════════════════════════════════════════════════════
   BoardScore — games-registry.js
   Source unique de vérité pour tous les jeux.

   Pour ajouter un jeu :
     1. Ajoute une entrée dans GAMES_REGISTRY ci-dessous
     2. Crée le dossier games/<dossier>/ avec index.html + .js + .css
   C'est tout — menu, stats, export/import se mettent à jour seuls.

   Champs :
     key        {string}   Clé localStorage (ex: 'mxt' → 'mxt_state')
     name       {string}   Nom affiché
     emoji      {string}   Emoji du jeu
     desc       {string}   Description courte pour la carte menu
     tags       {string[]} Filtres ('multi','cartes','dominos','des','plateau','coop','solo')
     color      {string}   Couleur principale (hex)
     bg         {string}   Fond de la carte (rgba semi-transparent)
     url        {string|null} Chemin relatif depuis la racine, null si pas encore dispo
     available  {boolean}  false → carte "bientôt" grisée dans le menu
   ═══════════════════════════════════════════════════════════════ */

window.GAMES_REGISTRY = [
    {
        key:       'mxt',
        name:      'Train Mexicain',
        emoji:     '🚂',
        desc:      'Dominos — pose tes tuiles sur le train central',
        tags:      ['multi', 'dominos'],
        color:     '#f5c542',
        bg:        'rgba(245,197,66,0.12)',
        url:       'games/mexicanTrain/index.html',
        available: true,
    },
    {
        key:       'skyjo',
        name:      'Skyjo',
        emoji:     '🃏',
        desc:      'Cartes — minimise ton score en retournant des cartes',
        tags:      ['multi', 'cartes'],
        color:     '#38bdf8',
        bg:        'rgba(56,189,248,0.12)',
        url:       'games/skyjo/index.html',
        available: true,
    },
    {
        key:       'rami',
        name:      'Rami',
        emoji:     '🃏',
        desc:      'Cartes — pose tes combinaisons et vide ta main',
        tags:      ['multi', 'cartes'],
        color:     '#e05c2a',
        bg:        'rgba(224,92,42,0.12)',
        url:       'games/rami/index.html',
        available: true,
    },
    {
        key:       'uno',
        name:      'Uno',
        emoji:     '🎴',
        desc:      'Cartes — vide ta main le premier !',
        tags:      ['multi', 'cartes'],
        color:     '#fb7185',
        bg:        'rgba(251,113,133,0.12)',
        url:       'games/uno/index.html',
        available: true,
    },
    {
        key:       'yams',
        name:      "Yam's",
        emoji:     '🎲',
        desc:      'Dés — combinaisons et stratégie',
        tags:      ['multi', 'des'],
        color:     '#a3e635',
        bg:        'rgba(163,230,53,0.12)',
        url:       'games/yams/index.html',
        available: true,
    },
    {
        key:       'scrabble',
        name:      'Scrabble',
        emoji:     '🔠',
        desc:      'Plateau — forme des mots et accumule les points',
        tags:      ['multi', 'plateau'],
        color:     '#9b59f5',
        bg:        'rgba(155,89,245,0.12)',
        url:       null,
        available: false,
    },
];

/* ── Helpers globaux dérivés du registre ── */

// { mxt: { name, emoji }, skyjo: { name, emoji }, … }
window.GAME_NAMES = Object.fromEntries(
    window.GAMES_REGISTRY.map(g => [g.key, { name: g.name, emoji: g.emoji }])
);

// ['mxt', 'skyjo', …]  (jeux disponibles uniquement)
window.GAME_KEYS = window.GAMES_REGISTRY
    .filter(g => g.available)
    .map(g => g.key);