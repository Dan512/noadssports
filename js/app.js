// =============================================================================
// NoAdsSports - app.js
// Starter template — reusable infrastructure from NoAdsWeather
// =============================================================================

// --- Section Preferences System -----------------------------------------------
// Reusable: drag-to-reorder, minimize, hide, persist layout in localStorage

const DEFAULT_SECTION_ORDER = [
    'live-section', 'upcoming-section', 'scores-section',
    'standings-section', 'news-section'
];

const DEFAULT_LAYOUT_LIST = [
    { id: 'live-section', col: 'left' },
    { id: 'upcoming-section', col: 'right' },
    { id: 'scores-section', col: 'wide' },
    { id: 'standings-section', col: 'left' },
    { id: 'news-section', col: 'right' },
];

const SECTION_NAMES = {
    'live-section': 'Live Games',
    'upcoming-section': 'Upcoming',
    'scores-section': 'Recent Scores',
    'standings-section': 'Standings',
    'news-section': 'News',
};

function loadSectionPrefs() {
    const stored = JSON.parse(localStorage.getItem('sectionPrefs') || 'null');
    if (stored && !stored.layoutList) {
        localStorage.removeItem('sectionPrefs');
        return { layoutList: JSON.parse(JSON.stringify(DEFAULT_LAYOUT_LIST)), hidden: [], minimized: [] };
    }
    return stored || {
        layoutList: JSON.parse(JSON.stringify(DEFAULT_LAYOUT_LIST)),
        hidden: [],
        minimized: [],
    };
}

function saveSectionPrefs(prefs) {
    localStorage.setItem('sectionPrefs', JSON.stringify(prefs));
}

// --- Data Layer --------------------------------------------------------------

function loadFollowedTeams() {
    return JSON.parse(localStorage.getItem('followedTeams') || '[]');
}

function saveFollowedTeams(teams) {
    localStorage.setItem('followedTeams', JSON.stringify(teams));
}

function addFollowedTeam(team) {
    // team: { id, name, league, leagueId, sport, badge, source:'tsdb'|'ncaa' }
    const teams = loadFollowedTeams();
    if (teams.some(t => t.id === team.id && t.source === team.source)) return false;
    teams.push(team);
    saveFollowedTeams(teams);
    return true;
}

function removeFollowedTeam(teamId, source) {
    let teams = loadFollowedTeams();
    teams = teams.filter(t => !(t.id === teamId && t.source === source));
    saveFollowedTeams(teams);
    // Also remove from all tabs
    const tabs = loadTabs();
    for (const tab of tabs) {
        tab.teams = tab.teams.filter(tid => tid !== `${source}:${teamId}`);
    }
    saveTabs(tabs);
    // Also remove notification prefs
    removeNotificationPrefs(teamId, source);
}

function loadTabs() {
    const stored = JSON.parse(localStorage.getItem('tabs') || 'null');
    if (!stored) return [{ id: 'main', label: 'Main', teams: ['all'] }];
    return stored;
}

function saveTabs(tabs) {
    localStorage.setItem('tabs', JSON.stringify(tabs));
}

function addTab(label) {
    const tabs = loadTabs();
    const id = 'tab-' + Date.now();
    tabs.push({ id, label, teams: [] });
    saveTabs(tabs);
    return id;
}

function removeTab(tabId) {
    if (tabId === 'main') return; // Can't remove main
    let tabs = loadTabs();
    tabs = tabs.filter(t => t.id !== tabId);
    saveTabs(tabs);
}

function addTeamToTab(tabId, teamKey) {
    // teamKey format: "source:teamId" e.g. "tsdb:133604"
    const tabs = loadTabs();
    const tab = tabs.find(t => t.id === tabId);
    if (tab && !tab.teams.includes(teamKey) && !tab.teams.includes('all')) {
        tab.teams.push(teamKey);
        saveTabs(tabs);
    }
}

function loadNotificationPrefs() {
    return JSON.parse(localStorage.getItem('notificationPrefs') || '{}');
}

function saveNotificationPrefs(prefs) {
    localStorage.setItem('notificationPrefs', JSON.stringify(prefs));
}

function setNotificationPrefsForTeam(teamId, source, prefs) {
    // prefs: { gameStart, finalScore, closeGame, teamNews }
    const all = loadNotificationPrefs();
    all[`${source}:${teamId}`] = prefs;
    saveNotificationPrefs(all);
}

function removeNotificationPrefs(teamId, source) {
    const all = loadNotificationPrefs();
    delete all[`${source}:${teamId}`];
    saveNotificationPrefs(all);
}

function getActiveTab() {
    return localStorage.getItem('activeTab') || 'main';
}

function setActiveTab(tabId) {
    localStorage.setItem('activeTab', tabId);
}

// --- API Client (Task 9) ----------------------------------------------------

const PROXY_URL = 'https://sports-proxy-15838356607.us-central1.run.app';

const api = (() => {
    const TSDB_BASE = 'https://www.thesportsdb.com/api/v1/json/3';

    function buildUrl(proxyPath, tsdbPath, params) {
        if (PROXY_URL) {
            const qs = new URLSearchParams(params).toString();
            return `${PROXY_URL}${proxyPath}${qs ? '?' + qs : ''}`;
        }
        const qs = new URLSearchParams(params).toString();
        return `${TSDB_BASE}${tsdbPath}${qs ? '?' + qs : ''}`;
    }

    async function fetchJSON(url) {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return resp.json();
    }

    return {
        searchTeams(query) {
            return fetchJSON(buildUrl('/tsdb/search/teams', '/searchteams.php', { t: query }));
        },
        getLeagueTeams(leagueId, leagueName) {
            const params = { id: leagueId };
            if (leagueName) params.l = leagueName;
            return fetchJSON(buildUrl('/tsdb/league/teams', '/lookup_all_teams.php', params));
        },
        getTeamNextEvents(teamId) {
            return fetchJSON(buildUrl('/tsdb/team/next', '/eventsnext.php', { id: teamId }));
        },
        getTeamLastEvents(teamId) {
            return fetchJSON(buildUrl('/tsdb/team/last', '/eventslast.php', { id: teamId }));
        },
        getLeagueStandings(leagueId, season) {
            return fetchJSON(buildUrl('/tsdb/league/standings', '/lookuptable.php', { id: leagueId, s: season }));
        },
        getLivescores(sport) {
            return fetchJSON(buildUrl('/tsdb/livescores', '/latestscore.php', { sport: sport }));
        },
        getHighlights(date, leagueId) {
            const params = {};
            if (date) params.d = date;
            if (leagueId) params.l = leagueId;
            return fetchJSON(buildUrl('/tsdb/highlights', '/eventshighlights.php', params));
        },
        getNews() {
            if (!PROXY_URL) return Promise.resolve({ articles: [] });
            const lang = getCurrentLang();
            return fetchJSON(`${PROXY_URL}/news?lang=${lang}`);
        },
        getSeasonSchedule(leagueId, season, teamId) {
            const params = { league: leagueId, season };
            if (teamId) params.team = teamId;
            return fetchJSON(`${PROXY_URL}/tsdb/season?${new URLSearchParams(params)}`);
        },
        getEventStats(eventId) {
            return fetchJSON(`${PROXY_URL}/tsdb/event/stats?id=${encodeURIComponent(eventId)}`);
        },
        getHeadToHead(homeTeam, awayTeam) {
            return fetchJSON(`${PROXY_URL}/tsdb/h2h?home=${encodeURIComponent(homeTeam)}&away=${encodeURIComponent(awayTeam)}`);
        },
        getEspnInjuries(sport, league, teamName) {
            return fetchJSON(`${PROXY_URL}/espn/injuries?sport=${encodeURIComponent(sport)}&league=${encodeURIComponent(league)}&team=${encodeURIComponent(teamName)}`);
        },
        getEspnTeamRecord(sport, league, teamName) {
            return fetchJSON(`${PROXY_URL}/espn/team?sport=${encodeURIComponent(sport)}&league=${encodeURIComponent(league)}&name=${encodeURIComponent(teamName)}`);
        },
        getEspnBoxScore(sport, league, home, away, date) {
            return fetchJSON(`${PROXY_URL}/espn/boxscore?sport=${encodeURIComponent(sport)}&league=${encodeURIComponent(league)}&home=${encodeURIComponent(home)}&away=${encodeURIComponent(away)}&date=${encodeURIComponent(date)}`);
        },
    };
})();

function saveLayoutFromDOM() {
    const container = document.getElementById('sports-content');
    if (!container) return;
    const prefs = loadSectionPrefs();
    const newList = [];
    for (const child of container.children) {
        if (child.classList && child.classList.contains('columns-row')) {
            const left = child.querySelector('.sports-col:first-child');
            const right = child.querySelector('.sports-col:last-child');
            const leftSections = left ? [...left.querySelectorAll('section')].map(s => s.id) : [];
            const rightSections = right ? [...right.querySelectorAll('section')].map(s => s.id) : [];
            const maxLen = Math.max(leftSections.length, rightSections.length);
            for (let i = 0; i < maxLen; i++) {
                if (i < leftSections.length) newList.push({ id: leftSections[i], col: 'left' });
                if (i < rightSections.length) newList.push({ id: rightSections[i], col: 'right' });
            }
        } else if (child.tagName === 'SECTION' && DEFAULT_SECTION_ORDER.includes(child.id)) {
            newList.push({ id: child.id, col: 'wide' });
        }
    }
    if (newList.length > 0) prefs.layoutList = newList;
    saveSectionPrefs(prefs);
}

function applySectionPreferences() {
    const prefs = loadSectionPrefs();
    const container = document.getElementById('sports-content');
    if (!container) return;

    // Reset all sections
    for (const id of DEFAULT_SECTION_ORDER) {
        const el = document.getElementById(id);
        if (el) {
            el.style.display = '';
            el.classList.remove('section-minimized');
            container.appendChild(el);
        }
    }

    // Remove old layout rows
    container.querySelectorAll('.columns-row').forEach(r => r.remove());

    const spacer = container.querySelector('.bottom-spacer');
    let currentLeft = [];
    let currentRight = [];

    function flushColumns(force) {
        if (!force && currentLeft.length === 0 && currentRight.length === 0) return;
        const row = document.createElement('div');
        row.className = 'columns-row';
        const left = document.createElement('div');
        left.className = 'sports-col';
        const right = document.createElement('div');
        right.className = 'sports-col';
        for (const el of currentLeft) left.appendChild(el);
        for (const el of currentRight) right.appendChild(el);
        row.appendChild(left);
        row.appendChild(right);
        container.insertBefore(row, spacer);
        currentLeft = [];
        currentRight = [];
    }

    for (const item of prefs.layoutList) {
        const el = document.getElementById(item.id);
        if (!el) continue;
        if (item.col === 'wide') {
            flushColumns();
            container.insertBefore(el, spacer);
        } else if (item.col === 'left') {
            currentLeft.push(el);
        } else {
            currentRight.push(el);
        }
    }
    flushColumns();
    flushColumns(true); // empty drop target row

    // Apply hidden
    for (const id of prefs.hidden) {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    }

    // Apply minimized
    for (const id of prefs.minimized) {
        const el = document.getElementById(id);
        if (el) el.classList.add('section-minimized');
    }

    injectSectionControls();
    renderHiddenSectionsBar();
}

function injectSectionControls() {
    for (const id of DEFAULT_SECTION_ORDER) {
        const el = document.getElementById(id);
        if (!el || el.style.display === 'none') continue;
        el.setAttribute('data-section-name', SECTION_NAMES[id] || id);
        const old = el.querySelector('.section-controls');
        if (old) old.remove();

        const isMin = el.classList.contains('section-minimized');
        const controls = document.createElement('div');
        controls.className = 'section-controls';
        controls.innerHTML = `
            <span class="section-drag-handle" title="Drag to reorder">⠿</span>
            <button class="section-min-btn" title="${isMin ? 'Remove section' : 'Minimize section'}">${isMin ? '✕' : '−'}</button>
        `;
        el.prepend(controls);

        // Minimize/hide
        controls.querySelector('.section-min-btn').addEventListener('click', () => {
            const p = loadSectionPrefs();
            if (el.classList.contains('section-minimized')) {
                el.style.display = 'none';
                p.minimized = p.minimized.filter(x => x !== id);
                if (!p.hidden.includes(id)) p.hidden.push(id);
                saveSectionPrefs(p);
                renderHiddenSectionsBar();
            } else {
                el.classList.add('section-minimized');
                if (!p.minimized.includes(id)) p.minimized.push(id);
                saveSectionPrefs(p);
                controls.querySelector('.section-min-btn').textContent = '✕';
                controls.querySelector('.section-min-btn').title = 'Remove section';
            }
        });

        // Click minimized section to expand
        if (!el._expandListenerAdded) {
            el._expandListenerAdded = true;
            el.addEventListener('click', (e) => {
                if (!el.classList.contains('section-minimized')) return;
                if (e.target.closest('.section-controls')) return;
                const p = loadSectionPrefs();
                el.classList.remove('section-minimized');
                p.minimized = p.minimized.filter(x => x !== id);
                saveSectionPrefs(p);
                const btn = el.querySelector('.section-min-btn');
                if (btn) { btn.textContent = '−'; btn.title = 'Minimize section'; }
            });
        }
    }
}

function renderHiddenSectionsBar() {
    let bar = document.getElementById('hidden-sections-bar');
    const prefs = loadSectionPrefs();

    if (prefs.hidden.length === 0) {
        if (bar) bar.remove();
        return;
    }

    const container = document.getElementById('sports-content');
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'hidden-sections-bar';
        container.insertBefore(bar, container.firstChild);
    }

    bar.innerHTML = prefs.hidden.map(id =>
        `<button class="show-section-btn" data-id="${id}">Show ${SECTION_NAMES[id] || id}</button>`
    ).join(' ');

    bar.querySelectorAll('.show-section-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const p = loadSectionPrefs();
            p.hidden = p.hidden.filter(h => h !== id);
            saveSectionPrefs(p);
            const el = document.getElementById(id);
            if (el) { el.style.display = ''; el.classList.remove('section-minimized'); }
            applySectionPreferences();
        });
    });
}

// --- Drag-to-Reorder ---------------------------------------------------------

function initSectionDrag() {
    const container = document.getElementById('sports-content');
    if (!container) return;

    let dragEl = null;
    let placeholder = null;
    let offsetY = 0;
    let offsetX = 0;
    let dragActive = false;

    container.addEventListener('pointerdown', (e) => {
        const handle = e.target.closest('.section-drag-handle');
        if (!handle || document.body.classList.contains('layout-locked')) return;

        dragEl = handle.closest('section');
        if (!dragEl || !DEFAULT_SECTION_ORDER.includes(dragEl.id)) return;

        e.preventDefault();
        handle.setPointerCapture(e.pointerId);

        const rect = dragEl.getBoundingClientRect();
        offsetY = e.clientY - rect.top;
        offsetX = e.clientX - rect.left;

        placeholder = document.createElement('div');
        placeholder.className = 'drag-placeholder';
        placeholder.style.height = rect.height + 'px';
        dragEl.parentNode.insertBefore(placeholder, dragEl);

        dragEl.classList.add('section-dragging');
        dragEl.style.position = 'fixed';
        dragEl.style.top = (e.clientY - offsetY) + 'px';
        dragEl.style.left = (e.clientX - offsetX) + 'px';
        dragEl.style.width = rect.width + 'px';
        dragEl.style.zIndex = '999';
        dragActive = true;
        document.body.classList.add('is-dragging');
    });

    container.addEventListener('pointermove', (e) => {
        if (!dragActive || !dragEl) return;
        e.preventDefault();

        dragEl.style.top = (e.clientY - offsetY) + 'px';
        dragEl.style.left = (e.clientX - offsetX) + 'px';

        const cols = [...container.querySelectorAll('.sports-col')];
        let targetCol = null;
        let minDist = Infinity;
        for (const col of cols) {
            const r = col.getBoundingClientRect();
            const dx = e.clientX < r.left ? r.left - e.clientX : e.clientX > r.right ? e.clientX - r.right : 0;
            const dy = e.clientY < r.top ? r.top - e.clientY : e.clientY > r.bottom ? e.clientY - r.bottom : 0;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minDist) { minDist = dist; targetCol = col; }
        }

        if (targetCol && minDist < 200) {
            if (placeholder.parentNode !== targetCol) targetCol.appendChild(placeholder);
            const siblings = [...targetCol.querySelectorAll('section:not(.section-dragging)')];
            let inserted = false;
            for (const sib of siblings) {
                const r = sib.getBoundingClientRect();
                if (e.clientY < r.top + r.height / 2) {
                    targetCol.insertBefore(placeholder, sib);
                    inserted = true;
                    break;
                }
            }
            if (!inserted) targetCol.appendChild(placeholder);
        }
    });

    const endDrag = () => {
        if (!dragActive || !dragEl) return;

        placeholder.parentNode.insertBefore(dragEl, placeholder);
        placeholder.remove();

        dragEl.classList.remove('section-dragging');
        dragEl.style.position = '';
        dragEl.style.top = '';
        dragEl.style.left = '';
        dragEl.style.width = '';
        dragEl.style.zIndex = '';

        saveLayoutFromDOM();

        dragEl = null;
        placeholder = null;
        dragActive = false;
        document.body.classList.remove('is-dragging');
    };

    container.addEventListener('pointerup', endDrag);
    container.addEventListener('pointercancel', endDrag);
}

// --- DOM Refs ----------------------------------------------------------------

const homeView = document.getElementById('home-view');
const tabBar = document.getElementById('tab-bar');
const dashboard = document.getElementById('dashboard');
const teamCardsContainer = document.getElementById('team-cards');
const emptyState = document.getElementById('empty-state');
const addTeamBtn = document.getElementById('add-team-btn');
const addTeamFab = document.getElementById('add-team-fab');

// Modal refs
const addTeamModal = document.getElementById('add-team-modal');
const modalCloseBtn = document.getElementById('modal-close');
const modalSearchInput = document.getElementById('modal-search-input');
const modalSearchResults = document.getElementById('modal-search-results');
const browseLeagueButtons = document.getElementById('browse-league-buttons');
const browseTeamList = document.getElementById('browse-team-list');
const teamConfig = document.getElementById('team-config');
const teamConfigHeader = document.getElementById('team-config-header');
const tabCheckboxes = document.getElementById('tab-checkboxes');
const notificationCheckboxes = document.getElementById('notification-checkboxes');
const confirmAddTeamBtn = document.getElementById('confirm-add-team');
const modalBrowse = document.getElementById('modal-browse');

// --- Browse Leagues Array ----------------------------------------------------

const BROWSE_LEAGUES = [
    { id: '4391', name: 'NFL', tsdbName: 'NFL', source: 'tsdb', sport: 'American Football' },
    { id: '4387', name: 'NBA', tsdbName: 'NBA', source: 'tsdb', sport: 'Basketball' },
    { id: '4424', name: 'MLB', tsdbName: 'MLB', source: 'tsdb', sport: 'Baseball' },
    { id: '4380', name: 'NHL', tsdbName: 'NHL', source: 'tsdb', sport: 'Ice Hockey' },
    { id: '4516', name: 'WNBA', tsdbName: 'WNBA', source: 'tsdb', sport: 'Basketball' },
    { id: '4521', name: 'NWSL', tsdbName: 'American NWSL', source: 'tsdb', sport: 'Soccer' },
    { id: '4346', name: 'MLS', tsdbName: 'American Major League Soccer', source: 'tsdb', sport: 'Soccer' },
    { id: '4350', name: 'Liga MX', tsdbName: 'Mexican Primera League', source: 'tsdb', sport: 'Soccer' },
    { id: '4328', name: 'English Premier League', tsdbName: 'English Premier League', source: 'tsdb', sport: 'Soccer' },
    { id: '4335', name: 'La Liga', tsdbName: 'Spanish La Liga', source: 'tsdb', sport: 'Soccer' },
    { id: '4332', name: 'Serie A', tsdbName: 'Italian Serie A', source: 'tsdb', sport: 'Soccer' },
    { id: '4331', name: 'Bundesliga', tsdbName: 'German Bundesliga', source: 'tsdb', sport: 'Soccer' },
    { id: '4480', name: 'Champions League', tsdbName: 'UEFA Champions League', source: 'tsdb', sport: 'Soccer' },
    { id: '4429', name: 'FIFA World Cup 2026', tsdbName: 'FIFA World Cup', source: 'tsdb', sport: 'Soccer' },
    { id: 'football', name: 'NCAA Football', source: 'ncaa', sport: 'Football' },
    { id: 'basketball-men', name: 'NCAA Basketball (M)', source: 'ncaa', sport: 'Basketball' },
    { id: 'basketball-women', name: 'NCAA Basketball (W)', source: 'ncaa', sport: 'Basketball' },
];

const STREAMING_SERVICES = [
    {
        name: 'ESPN+',
        price: '$11.99/mo',
        sports: ['NHL', 'MLB', 'MLS', 'NCAA', 'UFC', 'La Liga'],
        url: 'https://www.espn.com/espnplus/',  // TODO: replace with affiliate link
        description: 'NHL, MLB, MLS, college sports, La Liga, UFC',
    },
    {
        name: 'Sling TV',
        price: 'From $40/mo',
        sports: ['NFL', 'NBA', 'MLB', 'NHL', 'NCAA', 'EPL'],
        url: 'https://www.sling.com/',  // TODO: replace with affiliate link
        description: 'ESPN, TNT, Fox Sports, NFL Network, NBC Sports',
    },
    {
        name: 'YouTube TV',
        price: '$72.99/mo',
        sports: ['NFL', 'NBA', 'MLB', 'NHL', 'NCAA', 'MLS'],
        url: 'https://tv.youtube.com/',  // TODO: replace with affiliate link
        description: 'All major networks + ESPN, Fox, CBS, NBC, TNT',
    },
    {
        name: 'Fubo',
        price: 'From $79.99/mo',
        sports: ['NFL', 'NBA', 'MLB', 'NHL', 'MLS', 'EPL', 'La Liga', 'Serie A', 'Liga MX'],
        url: 'https://www.fubo.tv/',  // TODO: replace with affiliate link
        description: 'Best for soccer. All major US sports + international leagues',
    },
    {
        name: 'Peacock',
        price: '$7.99/mo',
        sports: ['NFL', 'EPL', 'NASCAR', 'Olympics'],
        url: 'https://www.peacocktv.com/',  // TODO: replace with affiliate link
        description: 'Sunday Night Football, Premier League, NASCAR',
    },
    {
        name: 'Paramount+',
        price: '$7.99/mo',
        sports: ['NFL', 'Champions League', 'Serie A', 'NWSL'],
        url: 'https://www.paramountplus.com/',  // TODO: replace with affiliate link
        description: 'Champions League, CBS NFL games, Serie A, NWSL',
    },
    {
        name: 'Apple TV+',
        price: '$9.99/mo',
        sports: ['MLB', 'MLS'],
        url: 'https://tv.apple.com/',  // TODO: replace with affiliate link
        description: 'Friday Night Baseball, MLS Season Pass',
    },
    {
        name: 'Amazon Prime Video',
        price: '$14.99/mo',
        sports: ['NFL', 'NBA'],
        url: 'https://www.amazon.com/prime/',  // TODO: replace with affiliate link
        description: 'Thursday Night Football, select NBA games',
    },
];

// --- Sanitization Helpers ----------------------------------------------------

function sanitizeText(str) {
    if (str === null || str === undefined) return '';
    if (typeof str !== 'string') str = String(str);
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function sanitizeAttr(str) {
    if (str === null || str === undefined) return '';
    if (typeof str !== 'string') str = String(str);
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// --- Team Badge Helper -------------------------------------------------------

function getTeamBadge(team) {
    // Pro teams: try locally hosted badge first, fall back to TheSportsDB URL
    if (team.source === 'tsdb' && team.id) {
        // Check if this team is in our local TEAM_LIST (we have logos for those)
        const inLocalList = typeof TEAM_LIST !== 'undefined' && TEAM_LIST.some(t => t.id === team.id);
        if (inLocalList) {
            return `/img/teams/${encodeURIComponent(team.id)}.png`;
        }
        // Not in local list — use TheSportsDB badge URL if available
        if (team.badge) return team.badge;
        return `/img/teams/${encodeURIComponent(team.id)}.png`; // Try local anyway (onerror will hide)
    }
    // NCAA teams: use locally hosted PNG logos
    if (team.source === 'ncaa' && team.id) {
        return `/img/ncaa/${encodeURIComponent(team.id)}.png`;
    }
    return '';
}

// --- Dashboard Rendering (Task 4) -------------------------------------------

function renderDashboard() {
    const teams = loadFollowedTeams();
    const header = document.querySelector('.home-header');
    const settingsToggle = document.getElementById('settings-toggle');
    const feedbackToggle = document.getElementById('feedback-toggle');
    if (teams.length === 0) {
        dashboard.hidden = true;
        addTeamFab.hidden = true;
        emptyState.hidden = false;
        tabBar.hidden = true;
        if (header) header.classList.remove('compact');
        if (settingsToggle) settingsToggle.hidden = true;
        if (feedbackToggle) feedbackToggle.hidden = true;
    } else {
        emptyState.hidden = true;
        dashboard.hidden = false;
        addTeamFab.hidden = false;
        if (header) header.classList.add('compact');
        if (settingsToggle) settingsToggle.hidden = false;
        if (feedbackToggle) feedbackToggle.hidden = false;
        applySettings();
        renderTabBar();
        renderTeamCards();
        renderHeadlinesRestore();
        fetchAllTeamData(teams);
        // Check livescores after a short delay so it runs AFTER fetchAllTeamData renders
        setTimeout(() => checkLiveGames(teams), 2000);
    }
}

function renderHeadlinesRestore() {
    // Show a "Show Headlines" link when headlines are hidden for this tab
    let restoreLink = document.getElementById('headlines-restore');
    if (isHeadlinesHiddenForTab()) {
        if (!restoreLink) {
            restoreLink = document.createElement('button');
            restoreLink.id = 'headlines-restore';
            restoreLink.className = 'headlines-restore';
            restoreLink.textContent = t('showHeadlines');
            restoreLink.addEventListener('click', () => {
                showHeadlinesForTab();
                renderHeadlinesRestore();
            });
            const dashboard = document.getElementById('dashboard');
            dashboard.appendChild(restoreLink);
        }
        restoreLink.hidden = false;
    } else {
        if (restoreLink) restoreLink.hidden = true;
    }
}

let tabEditMode = false;

function renderTabBar() {
    const tabs = loadTabs();
    if (tabs.length < 2) {
        tabBar.hidden = true;
        return;
    }
    // Show tab bar if 2+ tabs OR if header is hidden (gear lives here)
    tabBar.hidden = false;
    const activeTab = getActiveTab();

    if (tabEditMode) {
        tabBar.innerHTML = tabs.map(tab => {
            const isMain = tab.id === 'main';
            return `<div class="tab-pill editing" data-tab-id="${sanitizeAttr(tab.id)}" draggable="${isMain ? 'false' : 'true'}">
                <input type="text" class="tab-rename-input" value="${sanitizeAttr(tab.label)}" ${isMain ? 'disabled' : ''}>
                ${isMain ? '' : `<button class="tab-delete-btn" data-tab-id="${sanitizeAttr(tab.id)}" title="Delete tab">&times;</button>`}
            </div>`;
        }).join('') + `<button class="tab-edit-btn done" id="tab-done-btn">${t('done')}</button>`;

        // Done button
        document.getElementById('tab-done-btn').addEventListener('click', () => {
            // Save all renamed tabs
            const currentTabs = loadTabs();
            tabBar.querySelectorAll('.tab-rename-input').forEach(input => {
                const tabId = input.closest('.tab-pill').dataset.tabId;
                const tab = currentTabs.find(t => t.id === tabId);
                if (tab && input.value.trim()) {
                    tab.label = input.value.trim();
                }
            });
            saveTabs(currentTabs);
            tabEditMode = false;
            renderTabBar();
        });

        // Delete buttons
        tabBar.querySelectorAll('.tab-delete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.dataset.tabId;
                const tabLabel = tabs.find(t => t.id === tabId)?.label || tabId;
                if (confirm(t('deleteTabConfirm').replace('{name}', tabLabel))) {
                    removeTab(tabId);
                    if (getActiveTab() === tabId) setActiveTab('main');
                    const remaining = loadTabs();
                    if (remaining.length < 2) {
                        tabEditMode = false;
                        location.reload();
                    } else {
                        renderTabBar();
                        renderTeamCards();
                        fetchAllTeamData(loadFollowedTeams(), true);
                    }
                }
            });
        });

        // Drag to reorder
        let dragTab = null;
        tabBar.querySelectorAll('.tab-pill[draggable="true"]').forEach(pill => {
            pill.addEventListener('dragstart', (e) => {
                dragTab = pill.dataset.tabId;
                pill.classList.add('tab-dragging');
            });
            pill.addEventListener('dragend', () => {
                pill.classList.remove('tab-dragging');
                dragTab = null;
            });
        });
        tabBar.querySelectorAll('.tab-pill').forEach(pill => {
            pill.addEventListener('dragover', (e) => {
                e.preventDefault();
                pill.classList.add('tab-drag-over');
            });
            pill.addEventListener('dragleave', () => {
                pill.classList.remove('tab-drag-over');
            });
            pill.addEventListener('drop', (e) => {
                e.preventDefault();
                pill.classList.remove('tab-drag-over');
                if (!dragTab || dragTab === pill.dataset.tabId) return;
                const currentTabs = loadTabs();
                const fromIdx = currentTabs.findIndex(t => t.id === dragTab);
                const toIdx = currentTabs.findIndex(t => t.id === pill.dataset.tabId);
                if (fromIdx === -1 || toIdx === -1) return;
                const [moved] = currentTabs.splice(fromIdx, 1);
                currentTabs.splice(toIdx, 0, moved);
                saveTabs(currentTabs);
                renderTabBar();
            });
        });
    } else {
        tabBar.innerHTML = tabs.map(tab => {
            const isActive = tab.id === activeTab ? ' active' : '';
            return `<button class="tab-pill${isActive}" data-tab-id="${sanitizeAttr(tab.id)}">${sanitizeText(tab.label)}</button>`;
        }).join('') + '<button class="tab-edit-btn" id="tab-edit-btn" title="Edit tabs">&#9998;</button>';

        tabBar.querySelectorAll('.tab-pill').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const tabId = btn.dataset.tabId;
                setActiveTab(tabId);
                // Re-render everything for the new tab
                renderTabBar();
                renderTeamCards();
                renderHeadlinesRestore();
                // Fetch data for visible teams
                const teams = loadFollowedTeams();
                const allTabs = loadTabs();
                const active = allTabs.find(t => t.id === tabId) || allTabs[0];
                let visibleTeams = teams;
                if (active && !active.teams.includes('all')) {
                    const allowedKeys = new Set(active.teams);
                    visibleTeams = teams.filter(t => allowedKeys.has(`${t.source}:${t.id}`));
                }
                fetchAllTeamData(visibleTeams);
                loadHeadlines();
            });
        });

        document.getElementById('tab-edit-btn').addEventListener('click', () => {
            tabEditMode = true;
            renderTabBar();
        });
    }

}

function renderTeamCards() {
    const teams = loadFollowedTeams();
    const tabs = loadTabs();
    const activeTabId = getActiveTab();
    const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

    let visibleTeams = teams;
    if (activeTab && !activeTab.teams.includes('all')) {
        const allowedKeys = new Set(activeTab.teams);
        visibleTeams = teams.filter(t => allowedKeys.has(`${t.source}:${t.id}`));
    }

    if (visibleTeams.length === 0) {
        const activeTabId = getActiveTab();
        const removeBtn = activeTabId !== 'main'
            ? `<br><button class="empty-tab-remove" data-tab-id="${sanitizeAttr(activeTabId)}">${t('deleteTab') || 'Remove Tab'}</button>`
            : '';
        teamCardsContainer.innerHTML = `<p class="text-muted" style="padding:2rem;text-align:center;">${t('noTeamsInTab')}${removeBtn}</p>`;
        const btn = teamCardsContainer.querySelector('.empty-tab-remove');
        if (btn) {
            btn.addEventListener('click', () => {
                const tabId = btn.dataset.tabId;
                const tabs = loadTabs();
                const tabLabel = (tabs.find(t => t.id === tabId) || {}).label || tabId;
                if (confirm(`Delete the "${tabLabel}" tab?`)) {
                    removeTab(tabId);
                    setActiveTab('main');
                    location.reload();
                }
            });
        }
        return;
    }

    teamCardsContainer.innerHTML = visibleTeams.map(team => {
        const teamKey = `${team.source}:${team.id}`;
        const badgeUrl = getTeamBadge(team);
        const badge = badgeUrl ? `<img class="team-card-badge" src="${sanitizeAttr(badgeUrl)}" alt="" loading="lazy" onerror="this.style.display='none'">` : '<div class="team-card-badge"></div>';
        return `
            <div class="team-card" data-team-key="${sanitizeAttr(teamKey)}">
                <div class="team-card-actions">
                    <button class="team-card-collapse" title="Collapse">&#9650;</button>
                    <button class="team-card-remove" title="Remove team" data-team-id="${sanitizeAttr(team.id)}" data-source="${sanitizeAttr(team.source)}">&times;</button>
                </div>
                <div class="team-card-header">
                    ${badge}
                    <div class="team-card-info">
                        <h3>${sanitizeText(team.name)}</h3>
                        <span class="team-card-league">${sanitizeText(team.league || '')}</span>
                    </div>
                </div>
                <div class="team-card-data" id="card-data-${sanitizeAttr(teamKey)}">
                    <p class="team-card-placeholder">${t('loading')}</p>
                </div>
                <div class="team-card-expanded" id="expanded-${sanitizeAttr(teamKey)}"></div>
            </div>
        `;
    }).join('');

    // Remove team handlers
    teamCardsContainer.querySelectorAll('.team-card-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const teamId = btn.dataset.teamId;
            const source = btn.dataset.source;
            removeFollowedTeam(teamId, source);
            renderDashboard();
        });
    });

    // Restore expanded card from localStorage
    const savedExpanded = localStorage.getItem('expandedCard');
    if (savedExpanded) {
        const card = teamCardsContainer.querySelector(`.team-card[data-team-key="${CSS.escape(savedExpanded)}"]`);
        if (card) {
            card.classList.add('expanded');
            const team = loadFollowedTeams().find(t => `${t.source}:${t.id}` === savedExpanded);
            if (team) {
                renderExpandedTeamData(card, team, savedExpanded);
            }
        }
    }
}

// Where to Watch — delegated click handler on team cards
teamCardsContainer.addEventListener('click', (e) => {
    const wtwLink = e.target.closest('.wtw-link');
    if (wtwLink) {
        e.stopPropagation();
        openWhereToWatch(wtwLink.dataset.sport, wtwLink);
    }
});

// Head-to-Head — delegated click handler on team cards
teamCardsContainer.addEventListener('click', (e) => {
    const h2hLink = e.target.closest('.h2h-link');
    if (h2hLink) {
        e.stopPropagation();
        openHeadToHead(h2hLink.dataset.home, h2hLink.dataset.away, h2hLink);
    }
});

// Expand/collapse team card — delegated click handler
teamCardsContainer.addEventListener('click', (e) => {
    // Ignore clicks on interactive elements
    if (e.target.closest('.team-card-remove')) return;
    if (e.target.closest('a')) return;
    if (e.target.closest('.wtw-link')) return;
    if (e.target.closest('.h2h-link')) return;
    if (e.target.closest('.clickable-stat')) return;
    if (e.target.closest('.match-stats')) return;

    const card = e.target.closest('.team-card');
    if (!card) return;

    const teamKey = card.dataset.teamKey;
    const isCollapseBtn = e.target.closest('.team-card-collapse');
    const isHeader = e.target.closest('.team-card-header');

    if (card.classList.contains('expanded')) {
        // Only collapse if clicking the header or collapse button
        if (!isCollapseBtn && !isHeader) return;
        // Collapse this card
        card.classList.remove('expanded');
        const expandedEl = document.getElementById(`expanded-${teamKey}`);
        if (expandedEl) expandedEl.innerHTML = '';
        localStorage.removeItem('expandedCard');
    } else {
        // Collapse any other expanded card first
        const currentExpanded = teamCardsContainer.querySelector('.team-card.expanded');
        if (currentExpanded) {
            currentExpanded.classList.remove('expanded');
            const oldKey = currentExpanded.dataset.teamKey;
            const oldExpanded = document.getElementById(`expanded-${oldKey}`);
            if (oldExpanded) oldExpanded.innerHTML = '';
        }
        // Expand this card
        card.classList.add('expanded');
        localStorage.setItem('expandedCard', teamKey);
        const team = loadFollowedTeams().find(t => `${t.source}:${t.id}` === teamKey);
        if (team) {
            renderExpandedTeamData(card, team, teamKey);
        }
    }
});

// In-memory cache for team data (avoids re-fetching on tab switch)
const teamDataCache = new Map(); // teamKey -> { data, timestamp, hasLiveGame }
const CACHE_TTL_LIVE = 120000;     // 2 min for teams with a live game
const CACHE_TTL_STATIC = 3600000;  // 1 hour for teams with no live game

// Check livescores and update cards with live game data
async function checkLiveGames(teams) {
    if (!PROXY_URL) return;
    try {
        // Fetch livescores per league that we have teams for (much smaller than all)
        const leagueIds = [...new Set(teams.filter(t => t.leagueId).map(t => t.leagueId))];
        let livescores = [];
        for (const lid of leagueIds) {
            try {
                const data = await api.getLivescores(lid);
                const games = data.livescore || [];
                if (Array.isArray(games)) livescores.push(...games);
            } catch (e) { /* skip failed league */ }
        }
        if (!Array.isArray(livescores) || livescores.length === 0) return;

        for (const team of teams) {
            const teamKey = `${team.source}:${team.id}`;
            const cardData = document.getElementById(`card-data-${teamKey}`);
            if (!cardData) continue;

            // Find a live game for this team
            const liveGame = livescores.find(g => {
                const s = (g.strStatus || '').toLowerCase();
                const isActive = s && s !== 'ft' && s !== 'ns' && s !== 'not started' && s !== 'match finished' && s !== '';
                if (!isActive) return false;
                return String(g.idHomeTeam) === String(team.id) || String(g.idAwayTeam) === String(team.id);
            });

            if (liveGame) {
                const isHome = String(liveGame.idHomeTeam) === String(team.id);
                const opponent = isHome ? liveGame.strAwayTeam : liveGame.strHomeTeam;
                const prefix = isHome ? t('vs') : t('at');

                // Update the card's "Next" section with live data
                const existingNext = cardData.querySelector('.team-card-next, .team-card-live');
                const liveHtml = `<div class="team-card-live">
                    <span class="live-badge">LIVE</span>
                    <span class="live-matchup">${prefix} ${sanitizeText(opponent)}</span>
                    <span class="live-score">${sanitizeText(liveGame.strHomeTeam)} ${liveGame.intHomeScore || 0} - ${liveGame.intAwayScore || 0} ${sanitizeText(liveGame.strAwayTeam)}</span>
                    <span class="live-status">${sanitizeText(liveGame.strStatus || '')}</span>
                </div>`;

                if (existingNext) {
                    existingNext.outerHTML = liveHtml;
                }

                // Also update cache to indicate live game
                const cached = teamDataCache.get(teamKey);
                if (cached) cached.hasLiveGame = true;
            }
        }
    } catch (err) {
        // Silently fail — livescore check is supplemental
    }
}

function fetchAllTeamData(teams, forceRefresh) {
    for (const team of teams) {
        const teamKey = `${team.source}:${team.id}`;
        const cardData = document.getElementById(`card-data-${teamKey}`);
        if (!cardData) continue;

        // Use cache if fresh enough — live games expire faster
        const cached = teamDataCache.get(teamKey);
        if (!forceRefresh && cached) {
            const ttl = cached.hasLiveGame ? CACHE_TTL_LIVE : CACHE_TTL_STATIC;
            if (Date.now() - cached.timestamp < ttl) {
                renderTeamCardData(cardData, team, cached.data);
                continue;
            }
        }

        cardData.innerHTML = `<p class="team-card-loading">${t('loading')}</p>`;

        if (team.source === 'tsdb') {
            fetchTsdbTeamData(team, teamKey, cardData);
        } else if (team.source === 'ncaa') {
            fetchNcaaTeamData(team, teamKey, cardData);
        }
    }
}

function fetchTsdbTeamData(team, teamKey, cardData) {
    const currentSeason = guessCurrentSeason(team.leagueId);
    Promise.allSettled([
        api.getTeamNextEvents(team.id),
        api.getTeamLastEvents(team.id),
        team.leagueId ? api.getLeagueStandings(team.leagueId, currentSeason) : Promise.resolve(null)
    ]).then(([nextRes, lastRes, standingsRes]) => {
        const data = {
            nextEvents: nextRes.status === 'fulfilled' ? (nextRes.value?.events || []) : [],
            lastEvents: lastRes.status === 'fulfilled' ? (lastRes.value?.results || []) : [],
            standings: standingsRes.status === 'fulfilled' && standingsRes.value ? (standingsRes.value?.table || []) : []
        };
        // Check if any next event is currently live
        const hasLiveGame = data.nextEvents.some(e =>
            e.strStatus && e.strStatus !== 'Not Started' && e.strStatus !== 'Match Finished'
        );
        teamDataCache.set(teamKey, { data, timestamp: Date.now(), hasLiveGame });
        renderTeamCardData(cardData, team, data);
    }).catch(() => {
        cardData.innerHTML = `<p class="team-card-error">${t('failedToLoad')}</p>`;
    });
}

function fetchNcaaTeamData(team, teamKey, cardData) {
    // NCAA API: fetch scoreboard for the sport, then filter for this team
    const sport = team.leagueId || 'football'; // football, basketball-men, basketball-women
    const division = sport === 'football' ? 'fbs' : 'd1';
    const proxyBase = PROXY_URL || '';

    Promise.allSettled([
        fetch(`${proxyBase}/ncaa/scoreboard/${sport}/${division}`).then(r => r.json()),
        fetch(`${proxyBase}/ncaa/standings/${sport}/${division}`).then(r => r.json()),
    ]).then(([scoreboardRes, standingsRes]) => {
        const data = { nextEvents: [], lastEvents: [], standings: [] };
        const teamSlug = team.id;

        // Parse scoreboard for recent/upcoming games
        if (scoreboardRes.status === 'fulfilled' && scoreboardRes.value?.games) {
            for (const g of scoreboardRes.value.games) {
                const game = g.game;
                const homeSeo = game.home?.names?.seo || '';
                const awaySeo = game.away?.names?.seo || '';
                if (homeSeo === teamSlug || awaySeo === teamSlug) {
                    const isHome = homeSeo === teamSlug;
                    if (game.finalMessage) {
                        // Finished game
                        data.lastEvents.push({
                            strHomeTeam: game.home?.names?.short || '',
                            strAwayTeam: game.away?.names?.short || '',
                            intHomeScore: game.home?.score || '0',
                            intAwayScore: game.away?.score || '0',
                            idHomeTeam: homeSeo,
                            idAwayTeam: awaySeo,
                        });
                    } else {
                        // Upcoming or live
                        data.nextEvents.push({
                            strHomeTeam: game.home?.names?.short || '',
                            strAwayTeam: game.away?.names?.short || '',
                            idHomeTeam: homeSeo,
                            idAwayTeam: awaySeo,
                            dateEvent: game.startDate || '',
                            strTimestamp: game.startTimeEpoch ? new Date(parseInt(game.startTimeEpoch) * 1000).toISOString() : '',
                        });
                    }
                }
            }
        }

        // Parse standings — store entire conference for expanded view
        if (standingsRes.status === 'fulfilled' && standingsRes.value?.data) {
            // First, find which conference the team belongs to
            let matchedConf = null;
            for (const conf of standingsRes.value.data) {
                for (const s of (conf.standings || [])) {
                    const schoolSlug = (s.School || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
                    if (schoolSlug === teamSlug || s.School === team.name) {
                        matchedConf = conf;
                        break;
                    }
                }
                if (matchedConf) break;
            }
            // Store all teams from that conference
            if (matchedConf) {
                for (const s of (matchedConf.standings || [])) {
                    data.standings.push({
                        strTeam: s.School,
                        intWin: s['Overall W'],
                        intLoss: s['Overall L'],
                        conference: matchedConf.conference,
                    });
                }
            }
        }

        const hasLiveGame = data.nextEvents.some(e => e.strStatus && e.strStatus !== 'Not Started' && e.strStatus !== 'Final');
        teamDataCache.set(teamKey, { data, timestamp: Date.now(), hasLiveGame });
        renderTeamCardData(cardData, team, data);
    }).catch(() => {
        cardData.innerHTML = `<p class="team-card-error">${t('failedToLoad')}</p>`;
    });
}

function guessCurrentSeason(leagueId) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-indexed
    // Some leagues use single-year seasons (MLB, MLS, WNBA)
    if (leagueId && SINGLE_YEAR_SEASON_LEAGUES.includes(String(leagueId))) {
        return String(year);
    }
    // For most sports, season straddles years; use prior year if before July
    return month < 6 ? `${year - 1}-${year}` : `${year}-${year + 1}`;
}

function renderTeamCardData(cardEl, team, data) {
    let html = '';

    // Next game / Live game — skip events that are already finished
    const nextEvent = (data.nextEvents || []).find(ev => {
        const s = (ev.strStatus || '').toLowerCase();
        if (s === 'ft' || s === 'match finished') return false;
        // Also check if the event date is in the past with no live status
        if (ev.dateEvent && !s) {
            const eventDate = new Date(ev.dateEvent + 'T23:59:59');
            if (eventDate < new Date()) return false;
        }
        return true;
    });
    if (nextEvent) {
        const isHome = nextEvent.idHomeTeam === team.id || nextEvent.strHomeTeam === team.name;
        const opponent = isHome ? nextEvent.strAwayTeam : nextEvent.strHomeTeam;
        const prefix = isHome ? t('vs') : t('at');

        // Check if game is live
        const status = (nextEvent.strStatus || '').toLowerCase();
        const isLive = status && status !== 'not started' && status !== 'match finished' && status !== 'ft' && status !== '' && status !== 'ns';

        if (isLive) {
            // Live game — show score and status
            const liveHome = nextEvent.intHomeScore || 0;
            const liveAway = nextEvent.intAwayScore || 0;
            html += `<div class="team-card-live">`;
            html += `<span class="live-badge">LIVE</span>`;
            html += `<span class="live-matchup">${prefix} ${sanitizeText(opponent)}</span>`;
            html += `<span class="live-score">${sanitizeText(nextEvent.strHomeTeam)} ${liveHome} - ${liveAway} ${sanitizeText(nextEvent.strAwayTeam)}</span>`;
            html += `<span class="live-status">${sanitizeText(nextEvent.strStatus || '')}</span>`;
            html += `</div>`;
        } else {
            let dateStr = '';
            if (nextEvent.strTimestamp || nextEvent.dateEvent) {
                try {
                    // strTimestamp from TheSportsDB is UTC but missing the Z suffix
                    let raw = nextEvent.strTimestamp || nextEvent.dateEvent;
                    if (raw && !raw.endsWith('Z') && !raw.includes('+') && !raw.includes('-', 10)) {
                        raw += '+00:00';
                    }
                    const d = new Date(raw);
                    if (!isNaN(d)) {
                        const locale = getCurrentLang();
                        dateStr = ' \u00b7 ' + d.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' });
                        if (nextEvent.strTimestamp) {
                            dateStr += ' ' + d.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
                        }
                    }
                } catch (e) { /* ignore date parse errors */ }
            }
            html += `<p class="team-card-next"><strong>${t('next')}</strong> ${prefix} ${sanitizeText(opponent)}${dateStr}</p>`;
        }
        // Venue
        if (nextEvent.strVenue) {
            html += `<p class="team-card-venue">${sanitizeText(nextEvent.strVenue)}</p>`;
        }
        // TV channel (if available)
        if (nextEvent.strChannel) {
            html += `<p class="team-card-channel">📺 ${sanitizeText(nextEvent.strChannel)}</p>`;
        }
        // Where to watch link
        if (getSettingsBool('showWhereToWatch')) {
            const sportTag = LEAGUE_TO_SPORT_TAG[team.league] || LEAGUE_TO_SPORT_TAG[team.sport] || '';
            if (sportTag && STREAMING_SERVICES.some(svc => svc.sports.includes(sportTag))) {
                html += `<span class="wtw-link" data-sport="${sanitizeAttr(sportTag)}">📺 ${t('whereToWatch')}</span>`;
            }
        }
        // Head-to-Head link
        const h2hHome = nextEvent.strHomeTeam || '';
        const h2hAway = nextEvent.strAwayTeam || '';
        if (h2hHome && h2hAway) {
            html += `<span class="h2h-link" data-home="${sanitizeAttr(h2hHome)}" data-away="${sanitizeAttr(h2hAway)}">⚔ ${t('headToHead')}</span>`;
        }
    } else {
        html += `<p class="team-card-next text-muted">${t('noUpcoming')}</p>`;
    }

    // Last result — also check "next" events that are now finished
    const finishedNextEvents = (data.nextEvents || []).filter(ev => {
        const s = (ev.strStatus || '').toLowerCase();
        return (s === 'ft' || s === 'match finished') && ev.intHomeScore != null && ev.intAwayScore != null;
    });
    const allLastEvents = [...finishedNextEvents, ...(data.lastEvents || [])];
    const lastEvent = allLastEvents.find(ev => ev.intHomeScore != null && ev.intAwayScore != null);
    if (lastEvent) {
        const homeScore = parseInt(lastEvent.intHomeScore, 10) || 0;
        const awayScore = parseInt(lastEvent.intAwayScore, 10) || 0;
        const isHome = lastEvent.idHomeTeam === team.id || lastEvent.strHomeTeam === team.name;
        const won = isHome ? homeScore > awayScore : awayScore > homeScore;
        const draw = homeScore === awayScore;
        const colorClass = draw ? '' : (won ? 'result-win' : 'result-loss');
        html += `<p class="team-card-last ${colorClass}"><strong>${t('last')}</strong> ${sanitizeText(lastEvent.strHomeTeam)} ${homeScore} - ${awayScore} ${sanitizeText(lastEvent.strAwayTeam)}</p>`;

        // Highlights link
        if (lastEvent.strVideo) {
            html += `<a class="team-card-highlights" href="${sanitizeAttr(lastEvent.strVideo)}" target="_blank" rel="noopener">\u25b6 ${t('watchHighlights')}</a>`;
        }
    }

    // Standings
    if (data.standings.length > 0) {
        const entry = data.standings.find(s =>
            s.idTeam === team.id || s.strTeam === team.name
        );
        if (entry) {
            const rank = entry.intRank || entry.intPos || null;
            const league = entry.strLeague || entry.conference || team.league || '';
            const wins = entry.intWin || 0;
            const losses = entry.intLoss || 0;
            const draws = entry.intDraw || 0;
            const pts = entry.intPoints;
            let standingsStr = rank ? `#${rank} in ` : '';
            standingsStr += `${sanitizeText(league)} \u00b7 ${wins}${t('win')}-${losses}${t('loss')}`;
            if (parseInt(draws)) standingsStr += `-${draws}${t('draw')}`;
            if (pts !== undefined && pts !== null) standingsStr += ` \u00b7 ${pts} ${t('pts')}`;
            html += `<p class="team-card-standings">${standingsStr}</p>`;
        }
    }

    cardEl.innerHTML = html || `<p class="text-muted">${t('noData')}</p>`;
}

// --- Expanded team card detail view ------------------------------------------

function renderExpandedTeamData(card, team, teamKey) {
    const expandedEl = document.getElementById(`expanded-${teamKey}`);
    if (!expandedEl) return;

    const cached = teamDataCache.get(teamKey);
    if (!cached) {
        expandedEl.innerHTML = `<p class="team-card-loading">${t('loading')}</p>`;
        // Data not cached yet; wait for it to load then try again
        const checkInterval = setInterval(() => {
            const c = teamDataCache.get(teamKey);
            if (c) {
                clearInterval(checkInterval);
                if (card.classList.contains('expanded')) {
                    buildExpandedContent(expandedEl, team, c.data);
                }
            }
        }, 500);
        // Stop checking after 15 seconds
        setTimeout(() => clearInterval(checkInterval), 15000);
        return;
    }

    buildExpandedContent(expandedEl, team, cached.data);
}

function buildExpandedContent(expandedEl, team, data) {
    let html = '';
    const locale = getCurrentLang();

    // --- ESPN Record placeholder (filled async) ---
    const espnMapping = ESPN_LEAGUE_MAP[team.leagueId];
    if (espnMapping) {
        html += `<div class="expanded-section team-record" id="espn-record-${team.source}-${team.id}">
            <div class="record-loading">${t('loading')}</div>
        </div>`;
    }

    // --- Injuries placeholder (filled async) ---
    if (espnMapping) {
        html += `<div class="expanded-section" id="injuries-${team.source}-${team.id}"></div>`;
    }

    // --- Season Schedule (replaces separate upcoming/results sections) ---
    html += `<div class="expanded-section">`;
    html += `<h4>${t('seasonSchedule')}</h4>`;
    html += `<div class="schedule-list season-schedule" id="season-schedule-${team.source}-${team.id}">`;
    html += `<div class="schedule-loading">${t('loading')}</div>`;
    html += `</div></div>`;

    // --- League Standings ---
    if (data.standings && data.standings.length > 1) {
        html += `<div class="expanded-section">`;
        html += `<h4>${t('standings')}</h4>`;
        html += renderStandingsTable(data.standings, team);
        html += `</div>`;
    }

    expandedEl.innerHTML = html || `<p class="text-muted">${t('noData')}</p>`;

    // --- Async: fetch ESPN record (uses team name, no ESPN ID needed) ---
    if (espnMapping) {
        fetchEspnRecord(team, espnMapping);
    }

    // --- Async: fetch injuries ---
    if (espnMapping) {
        fetchEspnInjuries(team, espnMapping);
    }

    // --- Async: fetch season schedule ---
    fetchSeasonSchedule(team, data, locale);
}

function fetchEspnRecord(team, espnMapping) {
    const container = document.getElementById(`espn-record-${team.source}-${team.id}`);
    if (!container) return;

    api.getEspnTeamRecord(espnMapping.sport, espnMapping.league, team.name)
        .then(espnData => {
            if (!espnData || espnData.error || !espnData.records || espnData.records.length === 0) {
                container.remove();
                return;
            }
            const standingSummary = espnData.standing || '';
            const records = espnData.records;

            // Find overall record
            const overall = records.find(r => r.type === 'total') || records[0];
            const stats = overall.stats || {};
            const getStat = (name) => stats[name] !== undefined ? stats[name] : null;

            const wins = getStat('wins');
            const losses = getStat('losses');
            const ties = getStat('ties');
            const winPct = getStat('winPercent') || getStat('winPct');
            const streak = getStat('streak');
            const gamesBack = getStat('gamesBehind') || getStat('gamesBack');
            const playoffSeed = getStat('playoffSeed');

            if (wins === null && losses === null) {
                container.remove();
                return;
            }

            let recordStr = `${Math.round(wins)}-${Math.round(losses)}`;
            if (ties !== null && ties > 0) recordStr += `-${Math.round(ties)}`;
            let pctStr = '';
            if (winPct !== null) pctStr = ` (.${String(Math.round(winPct * 1000)).padStart(3, '0')})`;

            // Home/away records
            const homeRec = records.find(r => r.type === 'home');
            const awayRec = records.find(r => r.type === 'road' || r.type === 'away');
            let homeAwayStr = '';
            if (homeRec) {
                homeAwayStr = homeRec.summary || '';
            }
            if (awayRec) {
                if (homeAwayStr) homeAwayStr += ' / ';
                homeAwayStr += awayRec.summary || '';
            }

            let recordHtml = `<div class="record-main">${t('overallRecord')}: <strong>${recordStr}</strong>${pctStr}</div>`;
            recordHtml += `<div class="record-details">`;

            if (homeRec && awayRec) {
                recordHtml += `<span class="record-stat">${t('homeRecord')} ${homeRec.summary || ''}</span>`;
                recordHtml += `<span class="record-stat">${t('awayRecord')} ${awayRec.summary || ''}</span>`;
            }
            if (streak !== null && streak !== 0) {
                const streakVal = Math.round(streak);
                const streakLabel = streakVal > 0 ? `W${streakVal}` : `L${Math.abs(streakVal)}`;
                recordHtml += `<span class="record-stat">${t('streak')}: ${streakLabel}</span>`;
            }
            if (standingSummary) {
                recordHtml += `<span class="record-stat">${sanitizeText(standingSummary)}</span>`;
            }
            if (gamesBack !== null && gamesBack > 0) {
                recordHtml += `<span class="record-stat">${t('gamesBehind')}: ${gamesBack}</span>`;
            }
            if (playoffSeed !== null && playoffSeed > 0) {
                recordHtml += `<span class="record-stat">#${Math.round(playoffSeed)} seed</span>`;
            }
            recordHtml += `</div>`;

            container.innerHTML = recordHtml;
        })
        .catch(() => {
            if (container) container.remove();
        });
}

function fetchEspnInjuries(team, espnMapping) {
    const container = document.getElementById(`injuries-${team.source}-${team.id}`);
    if (!container) return;

    api.getEspnInjuries(espnMapping.sport, espnMapping.league, team.name)
        .then(data => {
            const injuries = data.injuries || [];
            if (injuries.length === 0) {
                container.remove();
                return;
            }

            let html = `<h4>${t('injuries') || 'Injuries'} (${injuries.length})</h4>`;
            html += `<div class="injury-list">`;
            injuries.forEach(inj => {
                const statusLower = (inj.status || '').toLowerCase();
                let dot = '🟡'; // default yellow for day-to-day
                if (statusLower.includes('out') || statusLower.includes('il') || statusLower.includes('injured')) dot = '🔴';
                if (statusLower.includes('day-to-day') || statusLower.includes('questionable') || statusLower.includes('probable')) dot = '🟡';

                html += `<div class="injury-item">
                    <span class="injury-dot">${dot}</span>
                    <div class="injury-info">
                        <span class="injury-player">${sanitizeText(inj.player)}</span>
                        <span class="injury-status">${sanitizeText(inj.status)}${inj.detail ? ' — ' + sanitizeText(inj.detail) : ''}</span>
                    </div>
                </div>`;
            });
            html += `</div>`;
            container.innerHTML = html;
        })
        .catch(() => {
            container.remove();
        });
}

function fetchSeasonSchedule(team, existingData, locale) {
    const container = document.getElementById(`season-schedule-${team.source}-${team.id}`);
    if (!container) return;

    if (team.source !== 'tsdb' || !team.leagueId) {
        // For NCAA or teams without leagueId, fall back to existing next/last events
        renderFallbackSchedule(container, team, existingData, locale);
        return;
    }

    const currentSeason = guessCurrentSeason(team.leagueId);
    api.getSeasonSchedule(team.leagueId, currentSeason, team.id)
        .then(scheduleData => {
            const events = scheduleData?.events || scheduleData?.event || [];
            if (!events || events.length === 0) {
                // Fall back to existing data
                renderFallbackSchedule(container, team, existingData, locale);
                return;
            }

            renderSeasonScheduleList(container, team, events, locale);
        })
        .catch(() => {
            renderFallbackSchedule(container, team, existingData, locale);
        });
}

function renderEspnBoxScore(boxData, homeName, awayName, league) {
    let html = '';

    // Stat display configs per league
    const STAT_CONFIGS = {
        nba: {
            // labels from ESPN: MIN, FG, 3PT, FT, OREB, DREB, REB, AST, STL, BLK, TO, PF, +/-, PTS
            display: ['PTS', 'FG%', '3PT%', 'REB', 'AST', 'TO', 'STL', 'BLK'],
            playerFormat(name, stats, labels) {
                const get = (lbl) => stats[labels.indexOf(lbl)] || '0';
                return `${sanitizeText(name)}: ${get('PTS')} PTS, ${get('REB')} REB, ${get('AST')} AST`;
            }
        },
        mlb: {
            display: null, // MLB has batting + pitching groups, handled specially
            playerFormat(name, stats, labels, group) {
                if (group.toLowerCase().includes('pitching')) {
                    const get = (lbl) => stats[labels.indexOf(lbl)] || '0';
                    return `${sanitizeText(name)}: ${get('IP')} IP, ${get('K')} K, ${get('ER')} ER`;
                }
                // Batting
                const get = (lbl) => stats[labels.indexOf(lbl)] || '0';
                const ab = get('AB');
                const h = get('H');
                const hr = get('HR');
                const rbi = get('RBI');
                return `${sanitizeText(name)}: ${h}-${ab}, ${hr} HR, ${rbi} RBI`;
            }
        },
        nhl: {
            display: ['G', 'A', 'PTS', 'SOG', 'HIT', 'BLK', 'PIM', 'FW'],
            playerFormat(name, stats, labels) {
                const get = (lbl) => stats[labels.indexOf(lbl)] || '0';
                return `${sanitizeText(name)}: ${get('G')} G, ${get('A')} A, ${get('SOG')} SOG`;
            }
        },
        nfl: {
            display: null, // NFL has passing/rushing/receiving groups
            playerFormat(name, stats, labels, group) {
                const get = (lbl) => stats[labels.indexOf(lbl)] || '0';
                const gLower = group.toLowerCase();
                if (gLower.includes('passing')) {
                    return `${sanitizeText(name)}: ${get('C/ATT')} C/ATT, ${get('YDS')} YDS, ${get('TD')} TD`;
                } else if (gLower.includes('rushing')) {
                    return `${sanitizeText(name)}: ${get('CAR')} CAR, ${get('YDS')} YDS, ${get('TD')} TD`;
                } else if (gLower.includes('receiving')) {
                    return `${sanitizeText(name)}: ${get('REC')} REC, ${get('YDS')} YDS, ${get('TD')} TD`;
                }
                return `${sanitizeText(name)}: ${stats.slice(0, 3).join(', ')}`;
            }
        },
        wnba: null // Will fall back to nba
    };

    const config = STAT_CONFIGS[league] || STAT_CONFIGS[league === 'wnba' ? 'nba' : league];
    if (!config) return '';

    const teams = boxData.teams;

    // --- Team totals comparison ---
    // Use the totals from player stats (more reliable than boxscore.teams)
    if (teams && teams.length >= 2) {
        const team0 = teams[0];
        const team1 = teams[1];
        const abbr0 = team0.abbreviation || homeName;
        const abbr1 = team1.abbreviation || awayName;

        html += `<div class="match-stats-header"><span>${sanitizeText(abbr0)}</span><span>${t('matchStats')}</span><span>${sanitizeText(abbr1)}</span></div>`;

        // Get first stat group's totals (batting for MLB, main stats for NBA/NHL)
        const group0 = (team0.stats || [])[0];
        const group1 = (team1.stats || [])[0];

        if (group0 && group1 && group0.labels && group0.totals && group1.totals) {
            // Pick key stats to show based on league
            let showLabels;
            if (league === 'mlb') {
                showLabels = ['R', 'H', 'HR', 'RBI', 'BB', 'K'];
            } else if (league === 'nba' || league === 'wnba') {
                showLabels = ['PTS', 'REB', 'AST', 'STL', 'BLK', 'TO'];
            } else if (league === 'nhl') {
                showLabels = ['G', 'A', 'SOG', 'HIT', 'BLK', 'PIM'];
            } else if (league === 'nfl') {
                showLabels = ['YDS', 'TD', 'TO'];
            } else {
                showLabels = group0.labels.slice(0, 8);
            }

            for (const lbl of showLabels) {
                const idx = group0.labels.indexOf(lbl);
                if (idx === -1) continue;
                const homeVal = parseFloat(group0.totals[idx]) || 0;
                const awayVal = parseFloat(group1.totals[idx]) || 0;
                const total = homeVal + awayVal || 1;
                const homePct = (homeVal / total) * 100;
                const awayPct = (awayVal / total) * 100;

            html += `<div class="stat-row">
                <span class="stat-value stat-value-home">${homeVal}</span>
                <div class="stat-center">
                    <div class="stat-bar">
                        <div class="stat-bar-home" style="width:${homePct}%"></div>
                        <div class="stat-bar-away" style="width:${awayPct}%"></div>
                    </div>
                    <span class="stat-name">${sanitizeText(lbl)}</span>
                </div>
                <span class="stat-value stat-value-away">${awayVal}</span>
            </div>`;
            }
        }
    } else {
        // Fallback: build comparison from player totals
        html += `<div class="match-stats-header"><span>${sanitizeText(teams[0].abbreviation || homeName)}</span><span>${t('matchStats')}</span><span>${sanitizeText(teams[1].abbreviation || awayName)}</span></div>`;

        // Use first stat group totals
        if (teams[0].stats.length > 0 && teams[1].stats.length > 0) {
            const labels = teams[0].stats[0].labels || [];
            const totals0 = teams[0].stats[0].totals || [];
            const totals1 = teams[1].stats[0].totals || [];

            // Pick key stat indices based on league
            let showLabels;
            if (league === 'nba' || league === 'wnba') {
                showLabels = ['PTS', 'REB', 'AST', 'STL', 'BLK', 'TO'];
            } else if (league === 'nhl') {
                showLabels = ['G', 'A', 'SOG', 'HIT', 'BLK', 'PIM'];
            } else {
                showLabels = labels.slice(0, 8);
            }

            for (const lbl of showLabels) {
                const idx = labels.indexOf(lbl);
                if (idx === -1) continue;
                const homeVal = parseFloat(totals0[idx]) || 0;
                const awayVal = parseFloat(totals1[idx]) || 0;
                const total = homeVal + awayVal || 1;
                const homePct = (homeVal / total) * 100;
                const awayPct = (awayVal / total) * 100;

                html += `<div class="stat-row">
                    <span class="stat-value stat-value-home">${sanitizeText(totals0[idx])}</span>
                    <div class="stat-center">
                        <div class="stat-bar">
                            <div class="stat-bar-home" style="width:${homePct}%"></div>
                            <div class="stat-bar-away" style="width:${awayPct}%"></div>
                        </div>
                        <span class="stat-name">${sanitizeText(lbl)}</span>
                    </div>
                    <span class="stat-value stat-value-away">${sanitizeText(totals1[idx])}</span>
                </div>`;
            }
        }
    }

    // --- Top players per team ---
    for (const teamData of teams) {
        let playerLines = [];
        for (const group of (teamData.topPlayers || [])) {
            const groupName = group.group || '';
            for (const p of (group.players || [])) {
                const fmt = config.playerFormat
                    ? config.playerFormat(p.name, p.stats, p.labels, groupName)
                    : `${sanitizeText(p.name)}: ${p.stats.slice(0, 3).join(', ')}`;
                playerLines.push(fmt);
            }
        }
        if (playerLines.length > 0) {
            // Limit to 3 total
            playerLines = playerLines.slice(0, 3);
            html += `<div class="espn-top-players">`;
            html += `<div class="espn-players-header">${sanitizeText(teamData.abbreviation || teamData.name)}</div>`;
            for (const line of playerLines) {
                html += `<div class="espn-player-line">${line}</div>`;
            }
            html += `</div>`;
        }
    }

    return html;
}

function renderSeasonScheduleList(container, team, events, locale) {
    const now = new Date();
    let html = '';
    let pastHtml = '';
    let futureHtml = '';
    let firstFutureIdx = -1;
    let totalPast = 0;

    for (let i = 0; i < events.length; i++) {
        const ev = events[i];
        const isHome = ev.idHomeTeam === team.id || ev.strHomeTeam === team.name;
        const opponent = isHome ? (ev.strAwayTeam || '') : (ev.strHomeTeam || '');
        const prefix = isHome ? t('vs') : t('at');

        let eventDate = null;
        let dateStr = '';
        try {
            let raw = ev.strTimestamp || ev.dateEvent;
            if (raw && !raw.endsWith('Z') && !raw.includes('+') && !raw.includes('-', 10)) {
                raw += '+00:00';
            }
            eventDate = new Date(raw);
            if (!isNaN(eventDate)) {
                dateStr = eventDate.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
                if (ev.strTimestamp && eventDate > now) {
                    dateStr += ' ' + eventDate.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
                }
            }
        } catch (e) { /* ignore */ }

        const hasScores = ev.intHomeScore != null && ev.intAwayScore != null &&
                       String(ev.intHomeScore).trim() !== '' && String(ev.intAwayScore).trim() !== '';
        const gameDate = ev.dateEvent ? new Date(ev.dateEvent + 'T23:59:59') : null;
        const isDatePast = gameDate && gameDate < new Date();
        const isPast = hasScores || isDatePast;

        if (isPast) {
            const eventId = ev.idEvent || '';
            let scoreHtml;
            if (hasScores) {
                const homeScore = parseInt(ev.intHomeScore, 10) || 0;
                const awayScore = parseInt(ev.intAwayScore, 10) || 0;
                const won = isHome ? homeScore > awayScore : awayScore > homeScore;
                const draw = homeScore === awayScore;
                const resultClass = draw ? 'result-draw' : (won ? 'result-win' : 'result-loss');
                const isSoccer = (ev.strSport || '').toLowerCase() === 'soccer';
                const hasVideo = !!ev.strVideo;
                const hasEspn = !!ESPN_LEAGUE_MAP[team.leagueId];
                const isClickable = isSoccer || hasVideo || hasEspn;
                const clickClass = isClickable ? ' clickable-stat' : '';
                pastHtml += `<div class="schedule-item past ${resultClass}${clickClass}" data-event-id="${sanitizeAttr(eventId)}" data-home="${sanitizeAttr(ev.strHomeTeam || '')}" data-away="${sanitizeAttr(ev.strAwayTeam || '')}" data-video="${sanitizeAttr(ev.strVideo || '')}" data-thumb="${sanitizeAttr(ev.strThumb || '')}" data-date="${sanitizeAttr(ev.dateEvent || '')}">`;
                pastHtml += `<div><span class="schedule-opponent">${prefix} ${sanitizeText(opponent)}</span></div>`;
                pastHtml += `<span><span class="result-score">${homeScore} - ${awayScore}</span> <span class="schedule-date">${dateStr}</span></span>`;
            } else {
                // Past game but no scores recorded
                pastHtml += `<div class="schedule-item past" data-event-id="${sanitizeAttr(eventId)}">`;
                pastHtml += `<div><span class="schedule-opponent">${prefix} ${sanitizeText(opponent)}</span></div>`;
                pastHtml += `<span><span class="result-score" style="color:var(--text-muted)">--</span> <span class="schedule-date">${dateStr}</span></span>`;
            }
            pastHtml += `</div>`;
            totalPast++;
        } else {
            if (firstFutureIdx === -1) firstFutureIdx = i;
            const venue = ev.strVenue ? `<span class="schedule-venue">${sanitizeText(ev.strVenue)}</span>` : '';

            futureHtml += `<div class="schedule-item future">`;
            futureHtml += `<div><span class="schedule-opponent">${prefix} ${sanitizeText(opponent)}</span> ${venue}</div>`;
            futureHtml += `<span class="schedule-date">${dateStr}</span>`;
            futureHtml += `</div>`;
        }
    }

    if (pastHtml) {
        html += `<div class="season-past-games">${pastHtml}</div>`;
    }
    if (pastHtml && futureHtml) {
        html += `<div class="season-divider"><span>${t('upcoming')}</span></div>`;
    }
    if (futureHtml) {
        html += futureHtml;
    }

    container.innerHTML = html || `<p class="text-muted">${t('noData')}</p>`;

    // Scroll the schedule container (not the page) so the divider is visible
    if (totalPast > 0) {
        const divider = container.querySelector('.season-divider');
        if (divider) {
            setTimeout(() => {
                container.scrollTop = divider.offsetTop - container.offsetTop - 20;
            }, 100);
        }
    }

    // Click handler for past games — show match stats and/or highlights
    container.querySelectorAll('.clickable-stat').forEach(item => {
        item.addEventListener('click', async () => {
            const eventId = item.dataset.eventId;
            if (!eventId) return;

            // Toggle: if panel already shown, collapse
            const existing = item.nextElementSibling;
            if (existing && existing.classList.contains('match-stats')) {
                existing.remove();
                return;
            }

            // Remove any other open panels in this container
            container.querySelectorAll('.match-stats').forEach(el => el.remove());

            const statsDiv = document.createElement('div');
            statsDiv.className = 'match-stats';
            item.after(statsDiv);

            const videoUrl = item.dataset.video;
            const thumbUrl = item.dataset.thumb;

            // Build highlight HTML
            let highlightHtml = '';
            if (videoUrl) {
                highlightHtml += `<a class="highlight-card" href="${sanitizeAttr(videoUrl)}" target="_blank" rel="noopener">`;
                if (thumbUrl) {
                    highlightHtml += `<img class="highlight-thumb" src="${sanitizeAttr(thumbUrl)}" alt="Highlights" loading="lazy" onerror="this.style.display='none'">`;
                }
                highlightHtml += `<span class="highlight-label">▶ ${t('watchHighlights')}</span></a>`;
            }

            // Check if this is a soccer game (stats available)
            const homeName = item.dataset.home || '';
            const awayName = item.dataset.away || '';
            // Determine sport from the team data or parent context
            const isSoccerLeague = ['Soccer', 'soccer'].some(s =>
                (team.sport || '').toLowerCase().includes('soccer') ||
                (team.league || '').includes('Premier') ||
                (team.league || '').includes('Liga') ||
                (team.league || '').includes('Serie') ||
                (team.league || '').includes('Bundesliga') ||
                (team.league || '').includes('Champions') ||
                (team.league || '').includes('MLS') ||
                (team.league || '').includes('NWSL') ||
                (team.league || '').includes('World Cup')
            );

            let content = '';

            // Determine if this is an ESPN-supported US sport
            const espnMapping = ESPN_LEAGUE_MAP[team.leagueId];
            const isEspnSport = !!espnMapping && !isSoccerLeague;

            if (isSoccerLeague) {
                // Fetch TheSportsDB stats for soccer
                statsDiv.innerHTML = `<p class="text-muted" style="font-size:0.8rem;padding:0.5rem 0;">${t('loading')}</p>`;
                try {
                    const data = await api.getEventStats(eventId);
                    const stats = data.eventstats || [];
                    const SHOW_STATS = ['Shots on Goal', 'Total Shots', 'Ball Possession', 'Corner Kicks', 'Fouls', 'Yellow Cards', 'Red Cards', 'Offsides', 'Goalkeeper Saves', 'Total passes'];
                    const filtered = stats.filter(s => SHOW_STATS.includes(s.strStat));

                    if (filtered.length > 0) {
                        content += `<div class="match-stats-header"><span>${sanitizeText(homeName)}</span><span>${t('matchStats')}</span><span>${sanitizeText(awayName)}</span></div>`;
                        for (const s of filtered) {
                            const homeVal = parseFloat(s.intHome) || 0;
                            const awayVal = parseFloat(s.intAway) || 0;
                            const total = homeVal + awayVal || 1;
                            const homePct = (homeVal / total) * 100;
                            const awayPct = (awayVal / total) * 100;
                            const homeDisplay = s.strStat === 'Ball Possession' ? s.intHome + '%' : s.intHome;
                            const awayDisplay = s.strStat === 'Ball Possession' ? s.intAway + '%' : s.intAway;
                            content += `<div class="stat-row">
                                <span class="stat-value stat-value-home">${homeDisplay}</span>
                                <div class="stat-center">
                                    <div class="stat-bar">
                                        <div class="stat-bar-home" style="width:${homePct}%"></div>
                                        <div class="stat-bar-away" style="width:${awayPct}%"></div>
                                    </div>
                                    <span class="stat-name">${sanitizeText(s.strStat)}</span>
                                </div>
                                <span class="stat-value stat-value-away">${awayDisplay}</span>
                            </div>`;
                        }
                    }
                } catch (err) { /* stats fetch failed, continue with highlights */ }
            } else if (isEspnSport) {
                // Fetch ESPN box score for US sports (NBA, MLB, NHL, NFL)
                const gameDate = item.dataset.date || '';
                if (gameDate && PROXY_URL) {
                    statsDiv.innerHTML = `<p class="text-muted" style="font-size:0.8rem;padding:0.5rem 0;">${t('loading')}</p>`;
                    try {
                        const boxData = await api.getEspnBoxScore(
                            espnMapping.sport, espnMapping.league,
                            homeName, awayName, gameDate
                        );
                        if (boxData && boxData.teams && boxData.teams.length >= 2) {
                            content += renderEspnBoxScore(boxData, homeName, awayName, espnMapping.league);
                        }
                    } catch (err) { /* ESPN fetch failed, continue with highlights */ }
                }
            }

            // Add highlight thumbnail
            content += highlightHtml;

            if (!content) {
                statsDiv.remove();
                return;
            }

            statsDiv.innerHTML = content;
        });
    });
}

function renderFallbackSchedule(container, team, data, locale) {
    let html = '';

    // Past games (completed section)
    const validResults = (data.lastEvents || []).filter(ev => ev.intHomeScore != null && ev.intAwayScore != null);
    if (validResults.length > 0) {
        html += `<div class="season-past-games">`;
        for (const ev of validResults) {
            const homeScore = parseInt(ev.intHomeScore, 10) || 0;
            const awayScore = parseInt(ev.intAwayScore, 10) || 0;
            const isHome = ev.idHomeTeam === team.id || ev.strHomeTeam === team.name;
            const won = isHome ? homeScore > awayScore : awayScore > homeScore;
            const draw = homeScore === awayScore;
            const resultClass = draw ? 'result-draw' : (won ? 'result-win' : 'result-loss');
            const opponent = isHome ? ev.strAwayTeam : ev.strHomeTeam;
            const prefix = isHome ? t('vs') : t('at');
            const score = `${homeScore} - ${awayScore}`;

            let dateStr = '';
            try {
                let raw = ev.strTimestamp || ev.dateEvent;
                if (raw && !raw.endsWith('Z') && !raw.includes('+') && !raw.includes('-', 10)) {
                    raw += '+00:00';
                }
                const d = new Date(raw);
                if (!isNaN(d)) {
                    dateStr = d.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
                }
            } catch (e) { /* ignore */ }

            html += `<div class="schedule-item past ${resultClass}">`;
            html += `<div><span class="schedule-opponent">${prefix} ${sanitizeText(opponent)}</span></div>`;
            html += `<span><span class="result-score">${score}</span> <span class="schedule-date">${dateStr}</span></span>`;
            html += `</div>`;
        }
        html += `</div>`;
    }

    // Divider
    if (validResults.length > 0 && data.nextEvents && data.nextEvents.length > 0) {
        html += `<div class="season-divider"><span>${t('upcoming')}</span></div>`;
    }

    // Future games
    if (data.nextEvents && data.nextEvents.length > 0) {
        for (const ev of data.nextEvents) {
            const isHome = ev.idHomeTeam === team.id || ev.strHomeTeam === team.name;
            const opponent = isHome ? ev.strAwayTeam : ev.strHomeTeam;
            const prefix = isHome ? t('vs') : t('at');

            let dateStr = '';
            try {
                let raw = ev.strTimestamp || ev.dateEvent;
                if (raw && !raw.endsWith('Z') && !raw.includes('+') && !raw.includes('-', 10)) {
                    raw += '+00:00';
                }
                const d = new Date(raw);
                if (!isNaN(d)) {
                    dateStr = d.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' });
                    if (ev.strTimestamp) {
                        dateStr += ' ' + d.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
                    }
                }
            } catch (e) { /* ignore */ }

            const venue = ev.strVenue ? `<span class="schedule-venue">${sanitizeText(ev.strVenue)}</span>` : '';

            html += `<div class="schedule-item future">`;
            html += `<div><span class="schedule-opponent">${prefix} ${sanitizeText(opponent)}</span> ${venue}</div>`;
            html += `<span class="schedule-date">${dateStr}</span>`;
            html += `</div>`;
        }
    }

    container.innerHTML = html || `<p class="text-muted">${t('noData')}</p>`;
}

function renderStandingsTable(standings, team) {
    // Detect if this is NCAA-style data (has conference field, no intRank)
    const isNcaa = standings.length > 0 && standings[0].conference && !standings[0].intRank;

    if (isNcaa) {
        // NCAA standings — group by conference
        let html = `<table class="standings-table">`;
        html += `<thead><tr>`;
        html += `<th>${t('rank')}</th><th>${t('team')}</th><th>${t('record')}</th>`;
        html += `</tr></thead><tbody>`;
        standings.forEach((entry, idx) => {
            const isCurrent = entry.strTeam === team.name;
            const record = `${entry.intWin || 0}-${entry.intLoss || 0}`;
            html += `<tr class="${isCurrent ? 'current-team' : ''}">`;
            html += `<td>${idx + 1}</td>`;
            html += `<td>${sanitizeText(entry.strTeam)}</td>`;
            html += `<td>${record}</td>`;
            html += `</tr>`;
        });
        html += `</tbody></table>`;
        return html;
    }

    // TheSportsDB standings
    let html = `<table class="standings-table">`;
    html += `<thead><tr>`;
    html += `<th>#</th><th>${t('team')}</th><th>${t('record')}</th>`;
    const hasPoints = standings.some(s => s.intPoints !== undefined && s.intPoints !== null);
    if (hasPoints) html += `<th>${t('points')}</th>`;
    html += `</tr></thead><tbody>`;

    for (const entry of standings) {
        const isCurrent = entry.idTeam === team.id || entry.strTeam === team.name;
        const rank = entry.intRank || entry.intPos || '';
        const wins = entry.intWin || 0;
        const losses = entry.intLoss || 0;
        const draws = entry.intDraw || 0;
        let record = `${wins}${t('win')}-${losses}${t('loss')}`;
        if (parseInt(draws)) record += `-${draws}${t('draw')}`;

        html += `<tr class="${isCurrent ? 'current-team' : ''}">`;
        html += `<td>${rank}</td>`;
        html += `<td>${sanitizeText(entry.strTeam)}</td>`;
        html += `<td>${record}</td>`;
        if (hasPoints) html += `<td>${entry.intPoints ?? ''}</td>`;
        html += `</tr>`;
    }

    html += `</tbody></table>`;
    return html;
}

// --- Empty state league quick buttons ----------------------------------------

document.querySelectorAll('.league-quick-buttons .league-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const leagueId = btn.dataset.leagueId;
        const source = btn.dataset.source;
        const sport = btn.dataset.sport;
        const name = btn.textContent;
        openAddTeamModal();
        browseLeagueTeams(leagueId, source, name, sport);
    });
});

// --- Add Team button handlers ------------------------------------------------

addTeamBtn.addEventListener('click', () => openAddTeamModal());
addTeamFab.addEventListener('click', () => openAddTeamModal());

// =============================================================================
// Add Team Modal Logic (Task 5)
// =============================================================================

let selectedTeamData = null;
let searchDebounceTimer = null;

function openAddTeamModal() {
    addTeamModal.hidden = false;
    // Reset state
    modalSearchInput.value = '';
    modalSearchResults.hidden = true;
    modalSearchResults.innerHTML = '';
    browseTeamList.hidden = true;
    browseTeamList.innerHTML = '';
    teamConfig.hidden = true;
    modalBrowse.hidden = false;
    selectedTeamData = null;
    // Deactivate all browse buttons
    browseLeagueButtons.querySelectorAll('.browse-league-btn').forEach(b => b.classList.remove('active'));
    // Populate league browse buttons
    populateBrowseLeagues();
    // Focus search
    setTimeout(() => modalSearchInput.focus(), 100);
}

function closeAddTeamModal() {
    addTeamModal.hidden = true;
    selectedTeamData = null;
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
}

// Close modal: X button, overlay click, Escape key
modalCloseBtn.addEventListener('click', closeAddTeamModal);
addTeamModal.addEventListener('click', (e) => {
    if (e.target === addTeamModal) closeAddTeamModal();
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !addTeamModal.hidden) closeAddTeamModal();
});

// --- Search Teams (debounced 800ms) ------------------------------------------

modalSearchInput.addEventListener('input', () => {
    const query = modalSearchInput.value.trim();
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);

    if (query.length < 2) {
        modalSearchResults.hidden = true;
        modalSearchResults.innerHTML = '';
        return;
    }

    modalSearchResults.hidden = false;

    // Instant local search from TEAM_LIST
    const localResults = searchLocalTeams(query);
    if (localResults.length > 0) {
        renderSearchResults(localResults);
    } else if (query.length < 4) {
        modalSearchResults.innerHTML = `<div class="search-hint">${t('keepTyping')}</div>`;
    } else {
        // Fall back to API search
        modalSearchResults.innerHTML = `<div class="search-loading">${t('searchingOnline')}</div>`;
        if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => searchTeams(query), 800);
    }
});

// Local search: filter TEAM_LIST by name or alternate names
function searchLocalTeams(query) {
    if (typeof TEAM_LIST === 'undefined' || !TEAM_LIST) return [];
    const q = query.toLowerCase();
    return TEAM_LIST.filter(t => {
        const name = (t.n || '').toLowerCase();
        const alt = (t.a || '').toLowerCase();
        return name.includes(q) || alt.includes(q);
    }).slice(0, 15).map(t => {
        const source = t.li === 'football' || t.li === 'basketball-men' || t.li === 'basketball-women' ? 'ncaa' : 'tsdb';
        const team = { id: t.id, name: t.n, league: t.l, leagueId: t.li, sport: t.s, badge: t.b || '', source };
        team.badge = getTeamBadge(team);
        return team;
    });
}

// Render search results (used by both local and API search)
function renderSearchResults(teams) {
    if (teams.length === 0) {
        modalSearchResults.innerHTML = `<div class="search-no-results">${t('noTeamsFound')}</div>`;
        return;
    }

    modalSearchResults.innerHTML = teams.map(team => {
        const teamData = JSON.stringify(team);
        const badge = team.badge
            ? `<img class="search-result-badge" src="${sanitizeAttr(team.badge)}" alt="" loading="lazy" onerror="this.style.display='none'">`
            : '<div class="search-result-badge"></div>';
        return `
            <div class="search-result-item" data-team='${sanitizeAttr(teamData)}'>
                ${badge}
                <div class="search-result-info">
                    <div class="search-result-name">${sanitizeText(team.name)}</div>
                    <div class="search-result-league">${sanitizeText(team.league || '')} &middot; ${sanitizeText(team.sport || '')}</div>
                </div>
            </div>
        `;
    }).join('');

    modalSearchResults.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', () => {
            const teamData = JSON.parse(item.dataset.team);
            showTeamConfig(teamData);
        });
    });
}

// API fallback search for teams not in local list
async function searchTeams(query) {
    try {
        const data = await api.searchTeams(query);
        const teams = (data.teams || []).slice(0, 15).map(team => ({
            id: team.idTeam,
            name: team.strTeam,
            league: team.strLeague,
            leagueId: team.idLeague,
            sport: team.strSport,
            badge: team.strBadge || '',
            source: 'tsdb',
            espnId: team.idESPN || ''
        }));
        renderSearchResults(teams);
    } catch (err) {
        modalSearchResults.innerHTML = `<div class="search-no-results">${t('searchError')}</div>`;
    }
}

// --- Browse Leagues ----------------------------------------------------------

function populateBrowseLeagues() {
    browseLeagueButtons.innerHTML = BROWSE_LEAGUES.map(league =>
        `<button class="browse-league-btn" data-league-id="${sanitizeAttr(league.id)}" data-source="${sanitizeAttr(league.source)}" data-sport="${sanitizeAttr(league.sport)}" data-tsdb-name="${sanitizeAttr(league.tsdbName || league.name)}">${sanitizeText(league.name)}</button>`
    ).join('');

    browseLeagueButtons.querySelectorAll('.browse-league-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            // Toggle active state
            browseLeagueButtons.querySelectorAll('.browse-league-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            browseLeagueTeams(btn.dataset.leagueId, btn.dataset.source, btn.dataset.tsdbName || btn.textContent, btn.dataset.sport);
        });
    });
}

async function browseLeagueTeams(leagueId, source, leagueName, sport) {
    browseTeamList.hidden = false;
    browseTeamList.innerHTML = `<div class="browse-loading">${t('loadingTeams')}</div>`;
    teamConfig.hidden = true;

    if (source === 'ncaa') {
        // Use local TEAM_LIST for NCAA browse
        if (typeof TEAM_LIST !== 'undefined') {
            const leagueLabel = BROWSE_LEAGUES.find(lg => lg.id === leagueId)?.name || leagueId;
            const ncaaTeams = TEAM_LIST.filter(t => t.li === leagueId)
                .sort((a, b) => a.n.localeCompare(b.n));

            if (ncaaTeams.length > 0) {
                browseTeamList.innerHTML = ncaaTeams.map(t => {
                    const team = { id: t.id, name: t.n, league: leagueLabel,
                        leagueId: t.li, sport: t.s, badge: t.b || '', source: 'ncaa' };
                    team.badge = getTeamBadge(team);
                    const teamData = JSON.stringify(team);
                    const badge = team.badge
                        ? `<img class="browse-team-badge" src="${sanitizeAttr(team.badge)}" alt="" loading="lazy" onerror="this.style.display='none'">`
                        : '<div class="browse-team-badge"></div>';
                    return `
                        <div class="browse-team-item" data-team='${sanitizeAttr(teamData)}'>
                            ${badge}
                            <span class="browse-team-name">${sanitizeText(t.n)}</span>
                        </div>`;
                }).join('');

                browseTeamList.querySelectorAll('.browse-team-item').forEach(item => {
                    item.addEventListener('click', () => {
                        const teamData = JSON.parse(item.dataset.team);
                        showTeamConfig(teamData);
                    });
                });
                return;
            }
        }
        browseTeamList.innerHTML = `<div class="browse-message">${t('useSearchBar')}</div>`;
        return;
    }

    try {
        const data = await api.getLeagueTeams(leagueId, leagueName);
        const teams = (data.teams || []).sort((a, b) => a.strTeam.localeCompare(b.strTeam));

        if (teams.length === 0) {
            browseTeamList.innerHTML = `<div class="browse-message">${t('noTeamsForLeague')}</div>`;
            return;
        }

        browseTeamList.innerHTML = teams.map(team => {
            const teamData = JSON.stringify({
                id: team.idTeam,
                name: team.strTeam,
                league: leagueName,
                leagueId: leagueId,
                sport: sport || team.strSport,
                badge: team.strBadge || '',
                source: 'tsdb',
                espnId: team.idESPN || ''
            });
            const badge = team.strBadge
                ? `<img class="browse-team-badge" src="${sanitizeAttr(team.strBadge)}" alt="" loading="lazy">`
                : '<div class="browse-team-badge"></div>';
            return `
                <div class="browse-team-item" data-team='${sanitizeAttr(teamData)}'>
                    ${badge}
                    <span class="browse-team-name">${sanitizeText(team.strTeam)}</span>
                </div>
            `;
        }).join('');

        browseTeamList.querySelectorAll('.browse-team-item').forEach(item => {
            item.addEventListener('click', () => {
                const teamData = JSON.parse(item.dataset.team);
                showTeamConfig(teamData);
            });
        });
    } catch (err) {
        browseTeamList.innerHTML = `<div class="browse-message">${t('errorLoadingTeams')}</div>`;
    }
}

// --- Team Config (tab + notification checkboxes) ----------------------------

function showTeamConfig(teamData) {
    selectedTeamData = teamData;

    // Hide search results and browse
    modalSearchResults.hidden = true;
    modalBrowse.hidden = true;
    teamConfig.hidden = false;

    // Header
    const badge = teamData.badge
        ? `<img src="${sanitizeAttr(teamData.badge)}" alt="">`
        : '';
    teamConfigHeader.innerHTML = `
        ${badge}
        <div>
            <div class="config-team-name">${sanitizeText(teamData.name)}</div>
            <div class="config-team-league">${sanitizeText(teamData.league || '')} &middot; ${sanitizeText(teamData.sport || '')}</div>
        </div>
    `;

    // Tab checkboxes
    const tabs = loadTabs();
    const mainTabExists = tabs.some(t => t.id === 'main');

    // Determine suggested league tab name
    const leagueTabName = teamData.league || '';
    const leagueTabExists = tabs.some(t => t.label === leagueTabName);
    const teamTabName = teamData.name || '';
    const teamTabExists = tabs.some(t => t.label === teamTabName);

    let tabHtml = '';

    // Main (always checked, disabled)
    tabHtml += `<label><input type="checkbox" value="main" checked disabled> ${t('main')}</label>`;

    // League tab suggestion
    if (leagueTabName) {
        if (leagueTabExists) {
            const leagueTab = tabs.find(t => t.label === leagueTabName);
            tabHtml += `<label><input type="checkbox" value="${sanitizeAttr(leagueTab.id)}" checked> ${sanitizeText(leagueTabName)}</label>`;
        } else {
            tabHtml += `<label><input type="checkbox" value="new:${sanitizeAttr(leagueTabName)}" checked> ${sanitizeText(leagueTabName)} (${t('newTab')})</label>`;
        }
    }

    // Team name tab
    if (teamTabName && teamTabName !== leagueTabName) {
        if (teamTabExists) {
            const tTab = tabs.find(t => t.label === teamTabName);
            tabHtml += `<label><input type="checkbox" value="${sanitizeAttr(tTab.id)}"> ${sanitizeText(teamTabName)}</label>`;
        } else {
            tabHtml += `<label><input type="checkbox" value="new:${sanitizeAttr(teamTabName)}"> ${sanitizeText(teamTabName)} (${t('newTab')})</label>`;
        }
    }

    // Existing custom tabs (not main, not matching league/team name)
    for (const tab of tabs) {
        if (tab.id === 'main') continue;
        if (tab.label === leagueTabName) continue;
        if (tab.label === teamTabName) continue;
        tabHtml += `<label><input type="checkbox" value="${sanitizeAttr(tab.id)}"> ${sanitizeText(tab.label)}</label>`;
    }

    // New custom tab option
    tabHtml += `<label><input type="checkbox" value="custom-new" id="custom-tab-check"> <input type="text" class="new-tab-input" id="custom-tab-name" placeholder="${t('newCustomTab')}"></label>`;

    tabCheckboxes.innerHTML = tabHtml;

    // Focus new tab input when checkbox is checked
    const customCheck = document.getElementById('custom-tab-check');
    const customName = document.getElementById('custom-tab-name');
    customCheck.addEventListener('change', () => {
        if (customCheck.checked) customName.focus();
    });
    customName.addEventListener('input', () => {
        if (customName.value.trim()) customCheck.checked = true;
    });

    // Notification checkboxes
    notificationCheckboxes.innerHTML = `
        <label><input type="checkbox" id="notif-all" value="all"> ${t('notifAll')}</label>
        <label><input type="checkbox" id="notif-game-start" value="gameStart" checked> ${t('notifGameStart')}</label>
        <label><input type="checkbox" id="notif-final" value="finalScore" checked> ${t('notifFinalScore')}</label>
        <label><input type="checkbox" id="notif-close" value="closeGame"> ${t('notifCloseGame')}</label>
        <label><input type="checkbox" id="notif-score-update" value="scoreUpdate"> ${t('notifScoreUpdate')}</label>
        <label><input type="checkbox" id="notif-news" value="teamNews"> ${t('notifTeamNews')}</label>
    `;

    // "All" master toggle logic
    const allCheck = document.getElementById('notif-all');
    const individualChecks = [
        document.getElementById('notif-game-start'),
        document.getElementById('notif-final'),
        document.getElementById('notif-close'),
        document.getElementById('notif-score-update'),
        document.getElementById('notif-news')
    ];

    allCheck.addEventListener('change', () => {
        for (const cb of individualChecks) cb.checked = allCheck.checked;
    });

    for (const cb of individualChecks) {
        cb.addEventListener('change', () => {
            // If any individual is unchecked, uncheck "All"
            allCheck.checked = individualChecks.every(c => c.checked);
        });
    }
}

// --- Confirm Add Team --------------------------------------------------------

confirmAddTeamBtn.addEventListener('click', () => {
    if (!selectedTeamData) return;

    const team = selectedTeamData;
    const teamKey = `${team.source}:${team.id}`;

    // Add team to followed teams
    addFollowedTeam({
        id: team.id,
        name: team.name,
        league: team.league,
        leagueId: team.leagueId,
        sport: team.sport,
        badge: team.badge,
        source: team.source,
        espnId: team.espnId || ''
    });

    // Process tab checkboxes
    const checkedTabs = tabCheckboxes.querySelectorAll('input[type="checkbox"]:checked:not(:disabled)');
    for (const cb of checkedTabs) {
        const val = cb.value;
        if (val === 'custom-new') {
            const customName = document.getElementById('custom-tab-name').value.trim();
            if (customName) {
                const newId = addTab(customName);
                addTeamToTab(newId, teamKey);
            }
        } else if (val.startsWith('new:')) {
            const label = val.substring(4);
            const newId = addTab(label);
            addTeamToTab(newId, teamKey);
        } else {
            // Existing tab id — add team to it
            addTeamToTab(val, teamKey);
        }
    }

    // Always add to main tab (main uses 'all' so no explicit add needed unless
    // main is a normal tab)
    const tabs = loadTabs();
    const mainTab = tabs.find(t => t.id === 'main');
    if (mainTab && !mainTab.teams.includes('all')) {
        addTeamToTab('main', teamKey);
    }

    // Save notification preferences
    const notifPrefs = {
        gameStart: document.getElementById('notif-game-start').checked,
        finalScore: document.getElementById('notif-final').checked,
        closeGame: document.getElementById('notif-close').checked,
        scoreUpdate: document.getElementById('notif-score-update').checked,
        teamNews: document.getElementById('notif-news').checked
    };
    setNotificationPrefsForTeam(team.id, team.source, notifPrefs);

    // Close modal and re-render
    closeAddTeamModal();
    renderDashboard();

    // Sync push subscription with updated team/notification prefs
    syncPushSubscription();
});

// --- Headlines ---------------------------------------------------------------

function getHiddenHeadlineTabs() {
    return JSON.parse(localStorage.getItem('hiddenHeadlineTabs') || '[]');
}

function setHiddenHeadlineTabs(tabs) {
    localStorage.setItem('hiddenHeadlineTabs', JSON.stringify(tabs));
}

function isHeadlinesHiddenForTab() {
    const activeTab = getActiveTab();
    return getHiddenHeadlineTabs().includes(activeTab);
}

function hideHeadlinesForTab() {
    const activeTab = getActiveTab();
    const hidden = getHiddenHeadlineTabs();
    if (!hidden.includes(activeTab)) {
        hidden.push(activeTab);
        setHiddenHeadlineTabs(hidden);
    }
    const box = document.getElementById('dashboard-headlines');
    if (box) box.hidden = true;
}

function showHeadlinesForTab() {
    const activeTab = getActiveTab();
    const hidden = getHiddenHeadlineTabs();
    setHiddenHeadlineTabs(hidden.filter(t => t !== activeTab));
    const box = document.getElementById('dashboard-headlines');
    if (box) {
        box.hidden = false;
        loadHeadlines();
    }
}

// Dismiss button
document.getElementById('headlines-dismiss')?.addEventListener('click', () => {
    setSettingBool('showHeadlines', false);
    applySettings();
});

// --- Where to Watch ----------------------------------------------------------

// --- Where to Watch (per-game popup) -----------------------------------------

const LEAGUE_TO_SPORT_TAG = {
    'NFL': 'NFL', 'NBA': 'NBA', 'MLB': 'MLB', 'NHL': 'NHL',
    'WNBA': 'WNBA', 'NWSL': 'NWSL', 'MLS': 'MLS', 'Liga MX': 'Liga MX',
    'English Premier League': 'EPL', 'EPL': 'EPL',
    'Spanish La Liga': 'La Liga', 'La Liga': 'La Liga',
    'Italian Serie A': 'Serie A', 'Serie A': 'Serie A',
    'German Bundesliga': 'Bundesliga', 'Bundesliga': 'Bundesliga',
    'Champions League': 'Champions League', 'UEFA Champions League': 'Champions League',
    'FIFA World Cup': 'Soccer', 'FIFA World Cup 2026': 'Soccer',
    'NCAA Football': 'NCAA', 'NCAA Basketball (M)': 'NCAA', 'NCAA Basketball (W)': 'NCAA',
    'American Football': 'NFL', 'Basketball': 'NBA', 'Baseball': 'MLB', 'Ice Hockey': 'NHL',
    'Soccer': 'MLS',
};

// ESPN sport/league mapping for fetching team records
const ESPN_LEAGUE_MAP = {
    '4391': { sport: 'football', league: 'nfl' },       // NFL
    '4387': { sport: 'basketball', league: 'nba' },     // NBA
    '4424': { sport: 'baseball', league: 'mlb' },       // MLB
    '4380': { sport: 'hockey', league: 'nhl' },         // NHL
    '4516': { sport: 'basketball', league: 'wnba' },    // WNBA
    '4346': { sport: 'soccer', league: 'usa.1' },       // MLS
};

// Leagues that use single-year seasons (e.g. "2026" not "2025-2026")
const SINGLE_YEAR_SEASON_LEAGUES = ['4424', '4346', '4516']; // MLB, MLS, WNBA

function openWhereToWatch(sportTag, anchorEl) {
    if (!getSettingsBool('showWhereToWatch')) return;

    const popup = document.getElementById('wtw-popup');
    const container = document.getElementById('wtw-popup-services');
    if (!popup || !container) return;

    // Filter services that carry this sport
    const relevant = STREAMING_SERVICES.filter(svc => svc.sports.includes(sportTag));

    if (relevant.length === 0) {
        container.innerHTML = `<p class="text-muted" style="font-size:0.8rem;">No streaming info available for this sport.</p>`;
    } else {
        container.innerHTML = relevant.map(svc =>
            `<div class="wtw-service">
                <div class="wtw-service-info">
                    <span class="wtw-service-name">${sanitizeText(svc.name)}</span>
                    <span class="wtw-service-price">${sanitizeText(svc.price)}</span>
                </div>
                <a class="wtw-service-link" href="${sanitizeAttr(svc.url)}" target="_blank" rel="noopener">${t('learnMore')}</a>
            </div>`
        ).join('');
    }

    // Translate
    const heading = popup.querySelector('h4');
    if (heading) heading.textContent = t('whereToWatch');
    const disclosure = popup.querySelector('.wtw-disclosure');
    if (disclosure) disclosure.textContent = t('whereToWatchDisclosure');

    // Position near the clicked link
    popup.hidden = false;
    const rect = anchorEl.getBoundingClientRect();
    const popupWidth = 300;
    let left = rect.left;
    let top = rect.bottom + 6;
    // Keep on screen
    if (left + popupWidth > window.innerWidth - 16) left = window.innerWidth - popupWidth - 16;
    if (left < 16) left = 16;
    if (top + 300 > window.innerHeight) top = rect.top - 306;
    popup.style.left = left + 'px';
    popup.style.top = top + 'px';
}

// Close popup
document.getElementById('wtw-popup-close')?.addEventListener('click', () => {
    document.getElementById('wtw-popup').hidden = true;
});
document.addEventListener('click', (e) => {
    const popup = document.getElementById('wtw-popup');
    if (popup && !popup.hidden && !popup.contains(e.target) && !e.target.classList.contains('wtw-link')) {
        popup.hidden = true;
    }
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const popup = document.getElementById('wtw-popup');
        if (popup) popup.hidden = true;
        const h2h = document.getElementById('h2h-popup');
        if (h2h) h2h.hidden = true;
    }
});

// --- Head-to-Head popup -------------------------------------------------------

async function openHeadToHead(homeTeam, awayTeam, anchorEl) {
    const popup = document.getElementById('h2h-popup');
    const container = document.getElementById('h2h-popup-content');
    if (!popup || !container) return;

    // Translate heading
    const heading = popup.querySelector('h4');
    if (heading) heading.textContent = t('headToHead');

    container.innerHTML = `<p class="text-muted" style="font-size:0.8rem;">${t('loading')}</p>`;

    // Position near the clicked link
    popup.hidden = false;
    const rect = anchorEl.getBoundingClientRect();
    const popupWidth = 320;
    let left = rect.left;
    let top = rect.bottom + 6;
    if (left + popupWidth > window.innerWidth - 16) left = window.innerWidth - popupWidth - 16;
    if (left < 16) left = 16;
    if (top + 350 > window.innerHeight) top = rect.top - 356;
    popup.style.left = left + 'px';
    popup.style.top = top + 'px';

    try {
        const data = await api.getHeadToHead(homeTeam, awayTeam);
        const events = (data.events || []).filter(ev =>
            ev.intHomeScore != null && ev.intAwayScore != null &&
            String(ev.intHomeScore).trim() !== '' && String(ev.intAwayScore).trim() !== ''
        );

        if (events.length === 0) {
            container.innerHTML = `<p class="text-muted" style="font-size:0.8rem;">${t('noData')}</p>`;
            return;
        }

        // Calculate overall record
        let homeWins = 0, awayWins = 0, draws = 0;
        for (const ev of events) {
            const hs = parseInt(ev.intHomeScore, 10) || 0;
            const as = parseInt(ev.intAwayScore, 10) || 0;
            // "home" and "away" in each match refer to that match's home/away, not the original query
            // We need to count wins per team name
            const winner = hs > as ? ev.strHomeTeam : (as > hs ? ev.strAwayTeam : null);
            if (!winner) {
                draws++;
            } else if (winner === homeTeam) {
                homeWins++;
            } else if (winner === awayTeam) {
                awayWins++;
            } else {
                // Could be reversed name match
                draws++;
            }
        }

        let html = `<div class="h2h-summary">`;
        html += `<div class="h2h-record-row"><span class="h2h-team-name">${sanitizeText(homeTeam)}</span><span class="h2h-record-val">${homeWins} ${t('wins')}</span></div>`;
        html += `<div class="h2h-record-row"><span class="h2h-team-name">${t('draws')}</span><span class="h2h-record-val">${draws}</span></div>`;
        html += `<div class="h2h-record-row"><span class="h2h-team-name">${sanitizeText(awayTeam)}</span><span class="h2h-record-val">${awayWins} ${t('wins')}</span></div>`;
        html += `</div>`;

        // Last 5 meetings
        const last5 = events.slice(0, 5);
        html += `<div class="h2h-meetings-title">${t('meetings')}</div>`;
        for (const ev of last5) {
            const hs = ev.intHomeScore;
            const as = ev.intAwayScore;
            let dateStr = '';
            if (ev.dateEvent) {
                try {
                    const d = new Date(ev.dateEvent);
                    if (!isNaN(d)) dateStr = d.toLocaleDateString(getCurrentLang(), { year: 'numeric', month: 'short', day: 'numeric' });
                } catch (e) { /* ignore */ }
            }
            html += `<div class="h2h-match">`;
            html += `<span class="h2h-match-teams">${sanitizeText(ev.strHomeTeam)} <strong>${hs} - ${as}</strong> ${sanitizeText(ev.strAwayTeam)}</span>`;
            if (dateStr) html += `<span class="h2h-match-date">${dateStr}</span>`;
            html += `</div>`;
        }

        container.innerHTML = html;
    } catch (err) {
        container.innerHTML = `<p class="text-muted" style="font-size:0.8rem;">${t('noData')}</p>`;
    }
}

// Close H2H popup
document.getElementById('h2h-popup-close')?.addEventListener('click', () => {
    document.getElementById('h2h-popup').hidden = true;
});
document.addEventListener('click', (e) => {
    const popup = document.getElementById('h2h-popup');
    if (popup && !popup.hidden && !popup.contains(e.target) && !e.target.classList.contains('h2h-link')) {
        popup.hidden = true;
    }
});

async function loadHeadlines() {
    // Hide/show dashboard headlines based on per-tab preference
    const dashboardBox = document.getElementById('dashboard-headlines');
    if (dashboardBox) {
        dashboardBox.hidden = isHeadlinesHiddenForTab();
    }

    const boxes = [
        document.getElementById('headlines-box'),
        dashboardBox && !dashboardBox.hidden ? dashboardBox : null,
    ].filter(Boolean);

    if (boxes.length === 0) return;

    if (!PROXY_URL) {
        boxes.forEach(box => { box.innerHTML = `<h3>${t('headlines')}</h3><p class="text-muted">${t('headlinesProxyNeeded')}</p>`; });
        return;
    }

    try {
        const data = await api.getNews();
        const headlines = data.headlines || data.articles || data.items || [];
        if (headlines.length === 0) {
            boxes.forEach(box => { box.innerHTML = `<h3>${t('headlines')}</h3><p class="text-muted">${t('noHeadlines')}</p>`; });
            return;
        }

        // Determine which teams are relevant to the active tab
        const followedTeams = loadFollowedTeams();
        const tabs = loadTabs();
        const activeTabId = getActiveTab();
        const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

        // Get teams visible on active tab
        let tabTeams = followedTeams;
        if (activeTab && !activeTab.teams.includes('all')) {
            const allowedKeys = new Set(activeTab.teams);
            tabTeams = followedTeams.filter(t => allowedKeys.has(`${t.source}:${t.id}`));
        }

        // Build name lists for matching
        function buildNameList(teams) {
            const full = teams.map(t => t.name.toLowerCase());
            const short = teams.map(t => {
                const parts = t.name.split(' ');
                return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : t.name.toLowerCase();
            });
            return [...new Set([...full, ...short])].filter(n => n.length > 3);
        }

        const tabNames = buildNameList(tabTeams);
        const allFollowedNames = buildNameList(followedTeams);
        const showAllNews = getSettingsBool('showAllNews');

        // Map league names to RSS sport tags for sport-level matching
        const LEAGUE_TO_SPORT = {
            'NFL': 'nfl', 'NBA': 'nba', 'MLB': 'mlb', 'NHL': 'nhl',
            'American Football': 'nfl', 'Basketball': 'nba', 'Baseball': 'mlb', 'Ice Hockey': 'nhl',
        };
        const tabSports = new Set(tabTeams.map(t => LEAGUE_TO_SPORT[t.league] || LEAGUE_TO_SPORT[t.sport] || '').filter(Boolean));
        const allFollowedSports = new Set(followedTeams.map(t => LEAGUE_TO_SPORT[t.league] || LEAGUE_TO_SPORT[t.sport] || '').filter(Boolean));

        const tagged = headlines.map(h => {
            const titleLower = (h.title || '').toLowerCase();
            const descLower = (h.desc || '').toLowerCase();
            const textToMatch = titleLower + ' ' + descLower;
            const hSport = h.sport || 'general';
            // Star only if a specific team name is mentioned in title or description
            const isTabTeamName = tabNames.some(name => textToMatch.includes(name));
            const isFollowedName = allFollowedNames.some(name => textToMatch.includes(name));
            // Sport-level match (for filtering, not starring)
            const isTabSport = hSport !== 'general' && tabSports.has(hSport);
            const isFollowedSport = hSport !== 'general' && allFollowedSports.has(hSport);
            return { ...h, isTabTeam: isTabTeamName || isTabSport, isFollowed: isFollowedName || isFollowedSport, isStarred: isTabTeamName || isFollowedName };
        });

        // Filter based on active tab + settings
        let filtered;
        if (activeTab && activeTab.id !== 'main') {
            // Non-main tab: show tab-relevant headlines first, fill with general if showAllNews
            filtered = showAllNews ? tagged : tagged.filter(h => h.isTabTeam);
            filtered.sort((a, b) => (b.isTabTeam ? 2 : b.isFollowed ? 1 : 0) - (a.isTabTeam ? 2 : a.isFollowed ? 1 : 0));
        } else {
            // Main tab: followed teams first, then general
            filtered = showAllNews ? tagged : tagged.filter(h => h.isFollowed);
            filtered.sort((a, b) => (b.isFollowed ? 1 : 0) - (a.isFollowed ? 1 : 0));
        }

        if (filtered.length === 0) {
            boxes.forEach(box => { box.innerHTML = `<h3>${t('headlines')}</h3><p class="text-muted">${t('noMatchingHeadlines')}</p>`; });
            return;
        }

        const html = `<h3>${t('headlines')}</h3>` + filtered.slice(0, 10).map(h => {
            const title = sanitizeText(h.title || 'Untitled');
            let url = (h.link || h.url || '#').replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').trim();
            const source = h.source ? `<span class="headline-source">${sanitizeText(h.source)}</span>` : '';
            const followedBadge = h.isStarred ? '<span class="headline-followed" title="Your team">&#9733;</span>' : '';
            const desc = h.desc && h.desc !== 'null' ? `<span class="headline-desc">${sanitizeText(h.desc)}</span>` : '';
            return `<div class="headline-item">${followedBadge}<div class="headline-content"><a href="${sanitizeAttr(url)}" target="_blank" rel="noopener">${title}</a>${desc}${source}</div></div>`;
        }).join('');
        boxes.forEach(box => { box.innerHTML = html; });
    } catch (err) {
        boxes.forEach(box => { box.innerHTML = `<h3>${t('headlines')}</h3><p class="text-muted">${t('couldNotLoadHeadlines')}</p>`; });
    }
}

// --- Auto-refresh Polling (Task 12) -----------------------------------------

let teamDataInterval = null;
let headlinesInterval = null;

function startPolling() {
    stopPolling();

    const teams = loadFollowedTeams();
    if (teams.length > 0) {
        teamDataInterval = setInterval(() => { const t = loadFollowedTeams(); fetchAllTeamData(t); checkLiveGames(t); }, 120000);
    }

    headlinesInterval = setInterval(loadHeadlines, 600000);

    document.addEventListener('visibilitychange', handleVisibilityChange);
}

function stopPolling() {
    if (teamDataInterval) { clearInterval(teamDataInterval); teamDataInterval = null; }
    if (headlinesInterval) { clearInterval(headlinesInterval); headlinesInterval = null; }
    document.removeEventListener('visibilitychange', handleVisibilityChange);
}

function handleVisibilityChange() {
    if (document.hidden) {
        if (teamDataInterval) { clearInterval(teamDataInterval); teamDataInterval = null; }
        if (headlinesInterval) { clearInterval(headlinesInterval); headlinesInterval = null; }
    } else {
        // Refresh immediately on tab becoming visible
        const teams = loadFollowedTeams();
        if (teams.length > 0) {
            fetchAllTeamData(teams);
            teamDataInterval = setInterval(() => { const t = loadFollowedTeams(); fetchAllTeamData(t); checkLiveGames(t); }, 120000);
        }
        loadHeadlines();
        headlinesInterval = setInterval(loadHeadlines, 600000);
    }
}

// --- Settings ----------------------------------------------------------------

function getSettingsBool(key) {
    const v = localStorage.getItem('setting_' + key);
    return v === null ? true : v === 'true';
}

function setSettingBool(key, val) {
    localStorage.setItem('setting_' + key, val);
}

function applySettings() {
    const header = document.querySelector('.home-header');
    const supportBtn = document.getElementById('donate-btn');
    const themeToggle = document.getElementById('theme-toggle');

    // Show/hide header
    if (header) {
        if (getSettingsBool('showHeader')) {
            header.classList.remove('header-hidden');
        } else {
            header.classList.add('header-hidden');
        }
    }

    // Show/hide all headlines
    const dashboardHeadlines = document.getElementById('dashboard-headlines');
    const headlinesBox = document.getElementById('headlines-box');
    const showHeadlines = getSettingsBool('showHeadlines');
    if (dashboardHeadlines) dashboardHeadlines.style.display = showHeadlines ? '' : 'none';
    if (headlinesBox) headlinesBox.style.display = showHeadlines ? '' : 'none';

    // Show/hide support button — slide FAB down when hidden
    const addFab = document.getElementById('add-team-fab');
    const showSupport = getSettingsBool('showSupportBtn');
    if (supportBtn) {
        supportBtn.style.display = showSupport ? '' : 'none';
    }
    if (addFab) {
        addFab.style.bottom = showSupport ? '' : '1.5rem';
    }

    // Show/hide theme toggle — slide settings over when hidden
    const settingsBtn = document.getElementById('settings-toggle');
    const showTheme = getSettingsBool('showThemeToggle');
    if (themeToggle) {
        themeToggle.style.display = showTheme ? '' : 'none';
    }
    if (settingsBtn) {
        settingsBtn.style.left = showTheme ? '' : '1.5rem';
    }
    const feedbackBtn = document.getElementById('feedback-toggle');
    const showFeedback = getSettingsBool('showFeedbackBtn');
    if (feedbackBtn) {
        feedbackBtn.style.display = showFeedback ? '' : 'none';
        feedbackBtn.style.left = showTheme ? '' : '4.5rem';
    }

    // Sync checkbox states
    document.querySelectorAll('#settings-popover input[data-setting]').forEach(cb => {
        cb.checked = getSettingsBool(cb.dataset.setting);
    });
}

(function initSettings() {
    const toggle = document.getElementById('settings-toggle');
    const popover = document.getElementById('settings-popover');
    if (!toggle || !popover) return;

    // Toggle popover
    toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        popover.hidden = !popover.hidden;
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (!popover.hidden && !popover.contains(e.target) && e.target !== toggle) {
            popover.hidden = true;
        }
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !popover.hidden) popover.hidden = true;
    });

    // Checkbox changes
    popover.querySelectorAll('input[data-setting]').forEach(cb => {
        cb.addEventListener('change', () => {
            setSettingBool(cb.dataset.setting, cb.checked);
            applySettings();
            if (cb.dataset.setting === 'showAllNews') loadHeadlines();
            if (cb.dataset.setting === 'showWhereToWatch') {
                renderDashboard(); // Re-render to show/hide WTW links on cards
            }
        });
    });

    // Font size buttons
    function applyFontSize(size) {
        document.documentElement.classList.remove('font-small', 'font-medium', 'font-large');
        document.documentElement.classList.add(`font-${size}`);
        localStorage.setItem('fontSize', size);
        document.querySelectorAll('.font-size-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.size === size);
        });
    }

    // Apply saved font size on load
    const savedFontSize = localStorage.getItem('fontSize') || 'medium';
    applyFontSize(savedFontSize);

    document.querySelectorAll('.font-size-btn').forEach(btn => {
        btn.addEventListener('click', () => applyFontSize(btn.dataset.size));
    });

    // Restore defaults
    document.getElementById('settings-revert').addEventListener('click', () => {
        ['showHeader', 'showSupportBtn', 'showThemeToggle', 'showHeadlines', 'showAllNews', 'showWhereToWatch', 'showFeedbackBtn'].forEach(k => {
            localStorage.removeItem('setting_' + k);
        });
        localStorage.removeItem('sectionPrefs');
        localStorage.removeItem('fontSize');
        applyFontSize('medium');
        applySettings();
        popover.hidden = true;
    });

    // Language popover
    const langBtn = document.getElementById('language-btn');
    const langPopover = document.getElementById('language-popover');
    const langList = document.getElementById('language-list');
    if (langBtn && langPopover && langList) {
        // Set button text to current language
        const curLang = getCurrentLang();
        let flagHtml;
        if (curLang === 'en') {
            flagHtml = '<img src="/img/flags/en.png" class="lang-btn-flag"><img src="/img/flags/gb.png" class="lang-btn-flag">';
        } else if (curLang === 'pt') {
            flagHtml = '<img src="/img/flags/pt-br.png" class="lang-btn-flag"><img src="/img/flags/pt-eu.png" class="lang-btn-flag">';
        } else {
            flagHtml = `<img src="/img/flags/${curLang}.png" class="lang-btn-flag">`;
        }
        langBtn.innerHTML = `${t('language')}: ${flagHtml} ${LANGUAGE_NAMES[curLang] || 'English'}`;

        // Build radio list with flags
        langList.innerHTML = Object.entries(LANGUAGE_NAMES).map(([code, name]) => {
            const checked = code === curLang ? 'checked' : '';
            let flagHtml;
            if (code === 'en') {
                flagHtml = `<span class="lang-flags"><img src="/img/flags/en.png" alt="US"><img src="/img/flags/gb.png" alt="UK"></span>`;
            } else if (code === 'pt') {
                flagHtml = `<span class="lang-flags"><img src="/img/flags/pt-br.png" alt="BR"><img src="/img/flags/pt-eu.png" alt="PT"></span>`;
            } else {
                flagHtml = `<img class="lang-flag" src="/img/flags/${code}.png" alt="">`;
            }
            return `<label class="language-option">
                <input type="radio" name="language" value="${code}" ${checked}>
                ${flagHtml}
                <span class="lang-name">${name}</span>
            </label>`;
        }).join('');

        // Open language popover from settings
        langBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            popover.hidden = true;
            langPopover.hidden = !langPopover.hidden;
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!langPopover.hidden && !langPopover.contains(e.target) && e.target !== langBtn) {
                langPopover.hidden = true;
            }
        });

        // Close on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !langPopover.hidden) langPopover.hidden = true;
        });

        // Radio change
        langList.querySelectorAll('input[type="radio"]').forEach(radio => {
            radio.addEventListener('change', () => {
                if (radio.checked) setLanguage(radio.value);
            });
        });
    }

    // Notifications popover
    const notifBtn = document.getElementById('notifications-btn');
    const notifPopover = document.getElementById('notifications-popover');
    const notifList = document.getElementById('notifications-list');
    if (notifBtn && notifPopover && notifList) {
        notifBtn.textContent = t('manageNotifications') || 'Manage Notifications';

        function renderNotifList() {
            const teams = loadFollowedTeams();
            if (teams.length === 0) {
                notifList.innerHTML = `<p class="text-muted">${t('noTeamsInTab') || 'No teams added yet.'}</p>`;
                return;
            }

            const allPrefs = loadNotificationPrefs();
            notifList.innerHTML = teams.map(team => {
                const teamKey = `${team.source}:${team.id}`;
                const prefs = allPrefs[teamKey] || { gameStart: false, finalScore: false, closeGame: false, scoreUpdate: false, teamNews: false };
                const badgeUrl = getTeamBadge(team);
                const badge = badgeUrl ? `<img src="${sanitizeAttr(badgeUrl)}" alt="" onerror="this.style.display='none'">` : '';

                return `<div class="notif-team" data-team-key="${sanitizeAttr(teamKey)}">
                    <div class="notif-team-header">
                        ${badge}
                        <span class="notif-team-name">${sanitizeText(team.name)}</span>
                        <span class="notif-team-league">${sanitizeText(team.league || '')}</span>
                    </div>
                    <div class="notif-checkboxes">
                        <label><input type="checkbox" data-notif="gameStart" ${prefs.gameStart ? 'checked' : ''}> ${t('notifGameStart')}</label>
                        <label><input type="checkbox" data-notif="finalScore" ${prefs.finalScore ? 'checked' : ''}> ${t('notifFinalScore')}</label>
                        <label><input type="checkbox" data-notif="closeGame" ${prefs.closeGame ? 'checked' : ''}> ${t('notifCloseGame')}</label>
                        <label><input type="checkbox" data-notif="scoreUpdate" ${prefs.scoreUpdate ? 'checked' : ''}> ${t('notifScoreUpdate')}</label>
                        <label><input type="checkbox" data-notif="teamNews" ${prefs.teamNews ? 'checked' : ''}> ${t('notifTeamNews')}</label>
                    </div>
                </div>`;
            }).join('');

            // Wire up checkbox changes
            notifList.querySelectorAll('.notif-team').forEach(teamEl => {
                const teamKey = teamEl.dataset.teamKey;
                const [source, ...idParts] = teamKey.split(':');
                const teamId = idParts.join(':');
                teamEl.querySelectorAll('input[data-notif]').forEach(cb => {
                    cb.addEventListener('change', () => {
                        const currentPrefs = loadNotificationPrefs();
                        if (!currentPrefs[teamKey]) currentPrefs[teamKey] = {};
                        currentPrefs[teamKey][cb.dataset.notif] = cb.checked;
                        saveNotificationPrefs(currentPrefs);
                        syncPushSubscription();
                    });
                });
            });
        }

        // Enable/disable all buttons
        document.getElementById('notif-enable-all').addEventListener('click', () => {
            const teams = loadFollowedTeams();
            const allPrefs = loadNotificationPrefs();
            for (const team of teams) {
                const key = `${team.source}:${team.id}`;
                allPrefs[key] = { gameStart: true, finalScore: true, closeGame: true, scoreUpdate: true, teamNews: true };
            }
            saveNotificationPrefs(allPrefs);
            syncPushSubscription();
            renderNotifList();
        });

        document.getElementById('notif-disable-all').addEventListener('click', () => {
            const teams = loadFollowedTeams();
            const allPrefs = loadNotificationPrefs();
            for (const team of teams) {
                const key = `${team.source}:${team.id}`;
                allPrefs[key] = { gameStart: false, finalScore: false, closeGame: false, scoreUpdate: false, teamNews: false };
            }
            saveNotificationPrefs(allPrefs);
            syncPushSubscription();
            renderNotifList();
        });

        notifBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            popover.hidden = true;
            notifPopover.hidden = !notifPopover.hidden;
            if (!notifPopover.hidden) renderNotifList();
        });

        document.addEventListener('click', (e) => {
            if (!notifPopover.hidden && !notifPopover.contains(e.target) && e.target !== notifBtn) {
                notifPopover.hidden = true;
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !notifPopover.hidden) notifPopover.hidden = true;
        });
    }

    // Translate settings popover labels
    const settingLabels = {
        showHeader: t('showHeader'),
        showSupportBtn: t('showSupportBtn'),
        showThemeToggle: t('showThemeToggle'),
        showAllNews: t('showAllNews'),
        showWhereToWatch: t('showWhereToWatch'),
    };
    popover.querySelectorAll('input[data-setting]').forEach(cb => {
        const label = cb.parentElement;
        if (label && settingLabels[cb.dataset.setting]) {
            label.childNodes.forEach(node => {
                if (node.nodeType === 3 && node.textContent.trim()) {
                    node.textContent = ' ' + settingLabels[cb.dataset.setting];
                }
            });
        }
    });

    // Translate restore defaults button
    const revertBtn = document.getElementById('settings-revert');
    if (revertBtn) revertBtn.textContent = t('restoreDefaults');

    // Language button text is set during language popover init above

    applySettings();
})();

// --- Feedback ----------------------------------------------------------------

(function initFeedback() {
    const feedbackToggle = document.getElementById('feedback-toggle');
    const feedbackPopover = document.getElementById('feedback-popover');
    const feedbackMessage = document.getElementById('feedback-message');
    const feedbackType = document.getElementById('feedback-type');
    const feedbackSend = document.getElementById('feedback-send');
    const feedbackStatus = document.getElementById('feedback-status');
    if (!feedbackToggle || !feedbackPopover) return;

    // Toggle popover
    feedbackToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        feedbackPopover.hidden = !feedbackPopover.hidden;
        if (!feedbackPopover.hidden) {
            feedbackMessage.value = '';
            feedbackStatus.textContent = '';
            setTimeout(() => feedbackMessage.focus(), 100);
        }
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (!feedbackPopover.hidden && !feedbackPopover.contains(e.target) && e.target !== feedbackToggle) {
            feedbackPopover.hidden = true;
        }
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !feedbackPopover.hidden) feedbackPopover.hidden = true;
    });

    // Send feedback
    feedbackSend.addEventListener('click', async () => {
        const message = feedbackMessage.value.trim();
        if (!message || message.length < 3) {
            feedbackStatus.textContent = 'Please enter a message.';
            feedbackStatus.style.color = 'var(--loss)';
            return;
        }

        feedbackSend.disabled = true;
        feedbackStatus.textContent = 'Sending...';
        feedbackStatus.style.color = 'var(--text-muted)';

        try {
            const res = await fetch(`${PROXY_URL}/feedback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: feedbackType.value,
                    message,
                    page: window.location.href,
                    lang: getCurrentLang(),
                }),
            });

            if (res.ok) {
                feedbackStatus.textContent = 'Thanks for your feedback!';
                feedbackStatus.style.color = 'var(--win)';
                feedbackMessage.value = '';
                setTimeout(() => { feedbackPopover.hidden = true; }, 1500);
            } else {
                feedbackStatus.textContent = 'Failed to send. Try again.';
                feedbackStatus.style.color = 'var(--loss)';
            }
        } catch {
            feedbackStatus.textContent = 'Failed to send. Try again.';
            feedbackStatus.style.color = 'var(--loss)';
        }
        feedbackSend.disabled = false;
    });
})();

// --- Translate Static HTML Elements ------------------------------------------

(function translateStaticHTML() {
    // Header
    const h1 = document.querySelector('.home-header h1');
    if (h1) h1.textContent = t('siteName');
    const tagline = document.querySelector('.tagline');
    if (tagline) tagline.textContent = t('tagline');

    // Empty state
    const addTeamBtnEl = document.getElementById('add-team-btn');
    if (addTeamBtnEl) addTeamBtnEl.textContent = t('addTeam');
    const quickBrowseH3 = document.querySelector('.league-quick-picks h3');
    if (quickBrowseH3) quickBrowseH3.textContent = t('quickBrowse');

    // Headlines boxes
    const headlinesBoxH2 = document.querySelector('#headlines-box h2');
    if (headlinesBoxH2) headlinesBoxH2.textContent = t('headlines');
    const dashHeadlinesH3 = document.querySelector('#dashboard-headlines h3');
    if (dashHeadlinesH3) dashHeadlinesH3.textContent = t('headlines');
    const dashHeadlinesP = document.querySelector('#dashboard-headlines .text-muted');
    if (dashHeadlinesP) dashHeadlinesP.textContent = t('loadingHeadlines');

    // Modal
    const modalTitle = document.querySelector('.modal-title');
    if (modalTitle) modalTitle.textContent = t('addTeamTitle');
    const modalInput = document.getElementById('modal-search-input');
    if (modalInput) modalInput.placeholder = t('searchPlaceholder');
    const browseH3 = document.querySelector('#modal-browse h3');
    if (browseH3) browseH3.textContent = t('browseByLeague');
    const addToTabsH3 = document.querySelector('#team-config h3:nth-of-type(1)');
    if (addToTabsH3) addToTabsH3.textContent = t('addToTabs');
    // Team config h3 elements
    const configH3s = document.querySelectorAll('#team-config h3');
    if (configH3s[0]) configH3s[0].textContent = t('addToTabs');
    if (configH3s[1]) configH3s[1].textContent = t('notifications');
    const confirmBtn = document.getElementById('confirm-add-team');
    if (confirmBtn) confirmBtn.textContent = t('confirmAddTeam');

    // Privacy
    const privacyToggle = document.getElementById('privacy-toggle-home');
    if (privacyToggle) privacyToggle.textContent = t('privacyCookies');
    const privacyTitle = document.querySelector('#privacy-panel strong');
    if (privacyTitle) privacyTitle.textContent = t('privacyTitle');

    // Support button
    const donateBtn = document.getElementById('donate-btn');
    if (donateBtn) donateBtn.textContent = t('supportSite');

    // Set html lang attribute
    document.documentElement.lang = getCurrentLang();
})();

// --- Init Dashboard ----------------------------------------------------------

renderDashboard();
loadHeadlines();
startPolling();
registerServiceWorker();
renderPrivacyContent();

// Handle notification click — scroll to team card
(function handleNotificationNav() {
    const params = new URLSearchParams(window.location.search);
    const teamKey = params.get('team');
    if (teamKey) {
        // Clean up URL
        history.replaceState(null, '', '/');
        // Wait for cards to render, then scroll to the team
        setTimeout(() => {
            const card = document.querySelector(`.team-card[data-team-key="${CSS.escape(teamKey)}"]`);
            if (card) {
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Flash highlight
                card.style.outline = '2px solid var(--accent)';
                setTimeout(() => { card.style.outline = ''; }, 3000);
            }
        }, 1500);
    }
})();

// --- Layout Lock (simplified — no sports-view lock button in V1 dashboard) ---

function applyLayoutLock() {
    const locked = localStorage.getItem('layoutLocked') === 'true';
    document.body.classList.toggle('layout-locked', locked);
}

// --- Dark Mode ---------------------------------------------------------------

(function () {
    const toggle = document.getElementById('theme-toggle');
    const stored = localStorage.getItem('theme');

    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        toggle.textContent = theme === 'dark' ? '☀️' : '🌙';
        localStorage.setItem('theme', theme);
    }

    if (stored) {
        setTheme(stored);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        setTheme('dark');
    }

    toggle.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        setTheme(current === 'dark' ? 'light' : 'dark');
    });
})();

// --- Privacy Panel -----------------------------------------------------------

function togglePrivacy() {
    const panel = document.getElementById('privacy-panel');
    panel.hidden = !panel.hidden;
}

document.getElementById('privacy-toggle-home').addEventListener('click', togglePrivacy);
document.getElementById('privacy-close').addEventListener('click', () => {
    document.getElementById('privacy-panel').hidden = true;
});

document.addEventListener('click', (e) => {
    const panel = document.getElementById('privacy-panel');
    if (!panel.hidden &&
        !panel.contains(e.target) &&
        e.target.id !== 'privacy-toggle-home') {
        panel.hidden = true;
    }
});

function renderPrivacyContent() {
    const container = document.getElementById('privacy-content');
    if (!container) return;
    container.innerHTML = `
        <p><strong>${t('privacyTitle')}</strong></p>
        <p>${t('privacyIntro')}</p>
        <p>${t('privacyApi')}</p>
        <p>${t('privacyStorage')}</p>
        <p>${t('privacyPush')}</p>
        <p>${t('privacyFeedback')}</p>
        <p>${t('privacyAffiliate')}</p>
        <p>${t('privacySupport')} <a href="https://ko-fi.com/noadsdude" target="_blank" rel="noopener" style="color:var(--accent);">${t('privacySupportLink')}</a></p>
    `;
}

// --- Push Notifications ------------------------------------------------------

const PUSH_SERVER_URL = 'https://push-server-15838356607.us-central1.run.app';

async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return null;
    try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        return registration;
    } catch (err) {
        console.error('Service worker registration failed:', err);
        return null;
    }
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const output = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
        output[i] = raw.charCodeAt(i);
    }
    return output;
}

async function subscribeToPush() {
    if (!PUSH_SERVER_URL) return;

    try {
        const registration = await navigator.serviceWorker.ready;

        // Get VAPID public key from push server
        const vapidResponse = await fetch(`${PUSH_SERVER_URL}/vapid-key`);
        const { publicKey } = await vapidResponse.json();

        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey)
        });

        // Send subscription + user prefs to push server
        const teams = loadFollowedTeams();
        const notifPrefs = loadNotificationPrefs();

        await fetch(`${PUSH_SERVER_URL}/subscribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                subscription,
                teams,
                prefs: notifPrefs
            })
        });
    } catch (err) {
        console.error('Push subscription failed:', err);
    }
}

async function syncPushSubscription() {
    if (!PUSH_SERVER_URL) return;

    const prefs = loadNotificationPrefs();
    // Check if any team has at least one notification pref enabled
    const hasAnyEnabled = Object.values(prefs).some(teamPrefs =>
        Object.values(teamPrefs).some(v => v === true)
    );

    if (hasAnyEnabled) {
        await subscribeToPush();
    }
}

// --- PWA Manifest ------------------------------------------------------------

(function () {
    const manifest = {
        name: 'NoAdsSports',
        short_name: 'Sports',
        description: 'Scores without the clutter. Follow your teams, get live scores and push notifications — with zero ads.',
        start_url: '/',
        display: 'standalone',
        background_color: '#111827',
        theme_color: '#111827',
        icons: [{
            src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🏈</text></svg>',
            sizes: 'any',
            type: 'image/svg+xml',
        }],
    };
    const blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = URL.createObjectURL(blob);
    document.head.appendChild(link);
})();
