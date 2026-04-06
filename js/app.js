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
            return fetchJSON(`${PROXY_URL}/news`);
        }
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
    { id: '4346', name: 'MLS', tsdbName: 'American Major League Soccer', source: 'tsdb', sport: 'Soccer' },
    { id: '4328', name: 'English Premier League', tsdbName: 'English Premier League', source: 'tsdb', sport: 'Soccer' },
    { id: '4335', name: 'La Liga', tsdbName: 'Spanish La Liga', source: 'tsdb', sport: 'Soccer' },
    { id: '4332', name: 'Serie A', tsdbName: 'Italian Serie A', source: 'tsdb', sport: 'Soccer' },
    { id: '4331', name: 'Bundesliga', tsdbName: 'German Bundesliga', source: 'tsdb', sport: 'Soccer' },
    { id: '4480', name: 'Champions League', tsdbName: 'UEFA Champions League', source: 'tsdb', sport: 'Soccer' },
    { id: 'football', name: 'NCAA Football', source: 'ncaa', sport: 'Football' },
    { id: 'basketball-men', name: 'NCAA Basketball (M)', source: 'ncaa', sport: 'Basketball' },
    { id: 'basketball-women', name: 'NCAA Basketball (W)', source: 'ncaa', sport: 'Basketball' },
];

// --- Sanitization Helpers ----------------------------------------------------

function sanitizeText(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function sanitizeAttr(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// --- Team Badge Helper -------------------------------------------------------

function getTeamBadge(team) {
    // Pro teams: use locally hosted badge by team ID
    if (team.source === 'tsdb' && team.id) {
        return `/img/teams/${encodeURIComponent(team.id)}.png`;
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
    if (teams.length === 0) {
        dashboard.hidden = true;
        addTeamFab.hidden = true;
        emptyState.hidden = false;
        tabBar.hidden = true;
        if (header) header.classList.remove('compact');
        if (settingsToggle) settingsToggle.hidden = true;
    } else {
        emptyState.hidden = true;
        dashboard.hidden = false;
        addTeamFab.hidden = false;
        if (header) header.classList.add('compact');
        if (settingsToggle) settingsToggle.hidden = false;
        applySettings();
        renderTabBar();
        renderTeamCards();
        fetchAllTeamData(teams);
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
        }).join('') + '<button class="tab-edit-btn done" id="tab-done-btn">Done</button>';

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
                if (confirm(`Delete the "${tabLabel}" tab?`)) {
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
            btn.addEventListener('click', () => {
                setActiveTab(btn.dataset.tabId);
                renderTabBar();
                renderTeamCards();
                const teams = loadFollowedTeams();
                const allTabs = loadTabs();
                const active = allTabs.find(t => t.id === btn.dataset.tabId) || allTabs[0];
                let visibleTeams = teams;
                if (active && !active.teams.includes('all')) {
                    const allowedKeys = new Set(active.teams);
                    visibleTeams = teams.filter(t => allowedKeys.has(`${t.source}:${t.id}`));
                }
                fetchAllTeamData(visibleTeams);
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
        teamCardsContainer.innerHTML = '<p class="text-muted" style="padding:2rem;text-align:center;">No teams in this tab. Add a team or switch tabs.</p>';
        return;
    }

    teamCardsContainer.innerHTML = visibleTeams.map(team => {
        const teamKey = `${team.source}:${team.id}`;
        const badgeUrl = getTeamBadge(team);
        const badge = badgeUrl ? `<img class="team-card-badge" src="${sanitizeAttr(badgeUrl)}" alt="" loading="lazy" onerror="this.style.display='none'">` : '<div class="team-card-badge"></div>';
        return `
            <div class="team-card" data-team-key="${sanitizeAttr(teamKey)}">
                <button class="team-card-remove" title="Remove team" data-team-id="${sanitizeAttr(team.id)}" data-source="${sanitizeAttr(team.source)}">&times;</button>
                <div class="team-card-header">
                    ${badge}
                    <div class="team-card-info">
                        <h3>${sanitizeText(team.name)}</h3>
                        <span class="team-card-league">${sanitizeText(team.league || '')}</span>
                    </div>
                </div>
                <div class="team-card-data" id="card-data-${sanitizeAttr(teamKey)}">
                    <p class="team-card-placeholder">Loading...</p>
                </div>
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
}

// In-memory cache for team data (avoids re-fetching on tab switch)
const teamDataCache = new Map(); // teamKey -> { data, timestamp }
const TEAM_CACHE_TTL = 120000; // 2 minutes

function fetchAllTeamData(teams, forceRefresh) {
    const tsdbTeams = teams.filter(t => t.source === 'tsdb');
    for (const team of tsdbTeams) {
        const teamKey = `${team.source}:${team.id}`;
        const cardData = document.getElementById(`card-data-${teamKey}`);
        if (!cardData) continue;

        // Use cache if fresh enough
        const cached = teamDataCache.get(teamKey);
        if (!forceRefresh && cached && (Date.now() - cached.timestamp < TEAM_CACHE_TTL)) {
            renderTeamCardData(cardData, team, cached.data);
            continue;
        }

        cardData.innerHTML = '<p class="team-card-loading">Loading...</p>';

        const currentSeason = guessCurrentSeason();

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
            teamDataCache.set(teamKey, { data, timestamp: Date.now() });
            renderTeamCardData(cardData, team, data);
        }).catch(() => {
            cardData.innerHTML = '<p class="team-card-error">Failed to load data</p>';
        });
    }
}

function guessCurrentSeason() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-indexed
    // For most sports, season straddles years; use prior year if before July
    return month < 6 ? `${year - 1}-${year}` : `${year}-${year + 1}`;
}

function renderTeamCardData(cardEl, team, data) {
    let html = '';

    // Next game
    const nextEvent = data.nextEvents[0];
    if (nextEvent) {
        const isHome = nextEvent.idHomeTeam === team.id || nextEvent.strHomeTeam === team.name;
        const opponent = isHome ? nextEvent.strAwayTeam : nextEvent.strHomeTeam;
        const prefix = isHome ? 'vs' : '@';
        let dateStr = '';
        if (nextEvent.strTimestamp || nextEvent.dateEvent) {
            try {
                const d = new Date(nextEvent.strTimestamp || nextEvent.dateEvent);
                if (!isNaN(d)) {
                    dateStr = ' \u00b7 ' + d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
                    if (nextEvent.strTimestamp) {
                        dateStr += ' ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
                    }
                }
            } catch (e) { /* ignore date parse errors */ }
        }
        html += `<p class="team-card-next"><strong>Next:</strong> ${prefix} ${sanitizeText(opponent)}${dateStr}</p>`;
    } else {
        html += '<p class="team-card-next text-muted">No upcoming games</p>';
    }

    // Last result
    const lastEvent = data.lastEvents[0];
    if (lastEvent) {
        const homeScore = parseInt(lastEvent.intHomeScore, 10);
        const awayScore = parseInt(lastEvent.intAwayScore, 10);
        const isHome = lastEvent.idHomeTeam === team.id || lastEvent.strHomeTeam === team.name;
        const won = isHome ? homeScore > awayScore : awayScore > homeScore;
        const draw = homeScore === awayScore;
        const colorClass = draw ? '' : (won ? 'result-win' : 'result-loss');
        html += `<p class="team-card-last ${colorClass}"><strong>Last:</strong> ${sanitizeText(lastEvent.strHomeTeam)} ${homeScore} - ${awayScore} ${sanitizeText(lastEvent.strAwayTeam)}</p>`;

        // Highlights link
        if (lastEvent.strVideo) {
            html += `<a class="team-card-highlights" href="${sanitizeAttr(lastEvent.strVideo)}" target="_blank" rel="noopener">\u25b6 Watch highlights</a>`;
        }
    }

    // Standings
    if (data.standings.length > 0) {
        const entry = data.standings.find(s =>
            s.idTeam === team.id || s.strTeam === team.name
        );
        if (entry) {
            const rank = entry.intRank || entry.intPos || '?';
            const league = entry.strLeague || team.league || '';
            const wins = entry.intWin || 0;
            const losses = entry.intLoss || 0;
            const draws = entry.intDraw || 0;
            const pts = entry.intPoints;
            let standingsStr = `#${rank} in ${sanitizeText(league)} \u00b7 ${wins}W-${losses}L-${draws}D`;
            if (pts !== undefined && pts !== null) standingsStr += ` \u00b7 ${pts} Pts`;
            html += `<p class="team-card-standings">${standingsStr}</p>`;
        }
    }

    cardEl.innerHTML = html || '<p class="text-muted">No data available</p>';
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
        modalSearchResults.innerHTML = '<div class="search-hint">Keep typing to search online...</div>';
    } else {
        // Fall back to API search
        modalSearchResults.innerHTML = '<div class="search-loading">Searching online...</div>';
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
        modalSearchResults.innerHTML = '<div class="search-no-results">No teams found. Try a different search.</div>';
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
            source: 'tsdb'
        }));
        renderSearchResults(teams);
    } catch (err) {
        modalSearchResults.innerHTML = '<div class="search-no-results">Search error. Please try again.</div>';
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
    browseTeamList.innerHTML = '<div class="browse-loading">Loading teams...</div>';
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
        browseTeamList.innerHTML = '<div class="browse-message">Use the search bar above to find your team.</div>';
        return;
    }

    try {
        const data = await api.getLeagueTeams(leagueId, leagueName);
        const teams = (data.teams || []).sort((a, b) => a.strTeam.localeCompare(b.strTeam));

        if (teams.length === 0) {
            browseTeamList.innerHTML = '<div class="browse-message">No teams found for this league.</div>';
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
                source: 'tsdb'
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
        browseTeamList.innerHTML = '<div class="browse-message">Error loading teams. Please try again.</div>';
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
    tabHtml += `<label><input type="checkbox" value="main" checked disabled> Main</label>`;

    // League tab suggestion
    if (leagueTabName) {
        if (leagueTabExists) {
            const leagueTab = tabs.find(t => t.label === leagueTabName);
            tabHtml += `<label><input type="checkbox" value="${sanitizeAttr(leagueTab.id)}" checked> ${sanitizeText(leagueTabName)}</label>`;
        } else {
            tabHtml += `<label><input type="checkbox" value="new:${sanitizeAttr(leagueTabName)}" checked> ${sanitizeText(leagueTabName)} (new tab)</label>`;
        }
    }

    // Team name tab
    if (teamTabName && teamTabName !== leagueTabName) {
        if (teamTabExists) {
            const tTab = tabs.find(t => t.label === teamTabName);
            tabHtml += `<label><input type="checkbox" value="${sanitizeAttr(tTab.id)}"> ${sanitizeText(teamTabName)}</label>`;
        } else {
            tabHtml += `<label><input type="checkbox" value="new:${sanitizeAttr(teamTabName)}"> ${sanitizeText(teamTabName)} (new tab)</label>`;
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
    tabHtml += `<label><input type="checkbox" value="custom-new" id="custom-tab-check"> <input type="text" class="new-tab-input" id="custom-tab-name" placeholder="New custom tab..."></label>`;

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
        <label><input type="checkbox" id="notif-all" value="all"> All</label>
        <label><input type="checkbox" id="notif-game-start" value="gameStart" checked> Game start</label>
        <label><input type="checkbox" id="notif-final" value="finalScore" checked> Final score</label>
        <label><input type="checkbox" id="notif-close" value="closeGame"> Close game</label>
        <label><input type="checkbox" id="notif-news" value="teamNews"> Team news</label>
    `;

    // "All" master toggle logic
    const allCheck = document.getElementById('notif-all');
    const individualChecks = [
        document.getElementById('notif-game-start'),
        document.getElementById('notif-final'),
        document.getElementById('notif-close'),
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
        source: team.source
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
        teamNews: document.getElementById('notif-news').checked
    };
    setNotificationPrefsForTeam(team.id, team.source, notifPrefs);

    // Close modal and re-render
    closeAddTeamModal();
    renderDashboard();

    // Sync push subscription with updated team/notification prefs
    syncPushSubscription();
});

// --- Headlines (Task 11) ----------------------------------------------------

async function loadHeadlines() {
    const box = document.getElementById('headlines-box');
    if (!box) return;

    if (!PROXY_URL) {
        box.innerHTML = '<p class="text-muted">News headlines available when proxy is configured.</p>';
        return;
    }

    try {
        const data = await api.getNews();
        const articles = data.articles || data.items || [];
        if (articles.length === 0) {
            box.innerHTML = '<p class="text-muted">No headlines available.</p>';
            return;
        }
        box.innerHTML = articles.slice(0, 10).map(a => {
            const title = sanitizeText(a.title || a.headline || 'Untitled');
            const url = a.url || a.link || '#';
            return `<a class="headline-link" href="${sanitizeAttr(url)}" target="_blank" rel="noopener">${title}</a>`;
        }).join('');
    } catch (err) {
        box.innerHTML = '<p class="text-muted">Could not load headlines.</p>';
    }
}

// --- Auto-refresh Polling (Task 12) -----------------------------------------

let teamDataInterval = null;
let headlinesInterval = null;

function startPolling() {
    stopPolling();

    const teams = loadFollowedTeams();
    if (teams.length > 0) {
        teamDataInterval = setInterval(() => fetchAllTeamData(loadFollowedTeams(), true), 120000);
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
            fetchAllTeamData(teams, true);
            teamDataInterval = setInterval(() => fetchAllTeamData(loadFollowedTeams(), true), 120000);
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

    // Show/hide support button
    if (supportBtn) {
        supportBtn.style.display = getSettingsBool('showSupportBtn') ? '' : 'none';
    }

    // Show/hide theme toggle
    if (themeToggle) {
        themeToggle.style.display = getSettingsBool('showThemeToggle') ? '' : 'none';
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
        });
    });

    // Restore defaults
    document.getElementById('settings-revert').addEventListener('click', () => {
        ['showHeader', 'showSupportBtn', 'showThemeToggle'].forEach(k => {
            localStorage.removeItem('setting_' + k);
        });
        localStorage.removeItem('sectionPrefs');
        applySettings();
        popover.hidden = true;
    });

    applySettings();
})();

// --- Init Dashboard ----------------------------------------------------------

renderDashboard();
loadHeadlines();
startPolling();
registerServiceWorker();

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

// --- Push Notifications ------------------------------------------------------

const PUSH_SERVER_URL = ''; // Set to Cloud Run URL for production

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
        const vapidResponse = await fetch(`${PUSH_SERVER_URL}/vapid-public-key`);
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
