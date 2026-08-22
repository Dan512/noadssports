// League landing pages: fetch today's games for one league and render them.
// The surrounding page is static HTML, so this only enhances; if it fails the page
// still has its heading, description and team list.
(function () {
    const root = document.getElementById('league-games');
    if (!root) return;

    const leagueId = root.dataset.leagueId;
    const source = root.dataset.source;
    // NCAA runs on a different API with a different shape. Those pages ship without a
    // live section rather than showing a broken one.
    if (!leagueId || source !== 'tsdb') return;

    const PROXY_URL = 'https://api.noadssports.com';

    function esc(str) {
        const d = document.createElement('div');
        d.textContent = str == null ? '' : String(str);
        return d.innerHTML;
    }

    const FINISHED = (s) => s === 'Match Finished' || s === 'FT';
    const NOT_STARTED = (s) => s === 'Not Started' || s === 'NS' || s === '';

    function timeOf(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        if (isNaN(d)) return '';
        return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }

    function render(games) {
        if (!games.length) {
            root.innerHTML = '<p class="league-empty">No games scheduled today.</p>';
            return;
        }
        const rows = games.map((g) => {
            const status = g.strStatus || '';
            let right;
            if (NOT_STARTED(status)) {
                right = '<span class="league-time">' + esc(timeOf(g.strTimestamp)) + '</span>';
            } else {
                const live = !FINISHED(status);
                right = '<span class="league-score' + (live ? ' is-live' : '') + '">'
                    + esc(g.intAwayScore) + ' &ndash; ' + esc(g.intHomeScore)
                    + '</span> <span class="league-status">' + esc(FINISHED(status) ? 'Final' : status) + '</span>';
            }
            return '<li class="league-game">'
                + '<span class="league-teams">' + esc(g.strAwayTeam) + ' at ' + esc(g.strHomeTeam) + '</span>'
                + right + '</li>';
        }).join('');
        root.innerHTML = '<ul class="league-games-list">' + rows + '</ul>';
    }

    root.innerHTML = '<p class="league-empty">Loading today’s games…</p>';

    fetch(PROXY_URL + '/tsdb/livescores?sport=' + encodeURIComponent(leagueId))
        .then((r) => {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
        })
        .then((d) => render(d.livescore || d.livescores || []))
        .catch(() => {
            // Say what actually happened. The main app used to render a failed request
            // as "no games", which cost a real bug report.
            root.innerHTML = '<p class="league-empty">Could not load today’s games. '
                + '<a href="">Retry</a></p>';
            const a = root.querySelector('a');
            if (a) a.addEventListener('click', (e) => { e.preventDefault(); location.reload(); });
        });
})();

// --- Shared controls -------------------------------------------------------
// The dashboard's settings panel does not exist on these pages, and most of what it
// controls (headlines, tabs, notifications, where-to-watch) has no meaning here. So
// rather than duplicate the panel, respect the two preferences that do apply and
// otherwise stay out of the way.
(function initLeagueControls() {
    // Absent means on, matching getSettingsBool in js/app.js.
    const enabled = (key) => localStorage.getItem('setting_' + key) !== 'false';

    const toggle = document.getElementById('theme-toggle');
    if (toggle && enabled('showThemeToggle')) {
        const current = () => document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
        const paint = () => { toggle.textContent = current() === 'dark' ? '\u2600\uFE0F' : '\uD83C\uDF19'; };
        paint();
        toggle.hidden = false;
        toggle.addEventListener('click', () => {
            const next = current() === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next);
            // Written so the choice follows the visitor back to the dashboard.
            localStorage.setItem('theme', next);
            paint();
        });
    }

    const support = document.getElementById('donate-btn');
    if (support && enabled('showSupportBtn')) support.hidden = false;

    // Opens email directly rather than reproducing the dashboard's type-picker popover.
    // Subject keeps the same "NoAdsSports Feedback: ..." shape so inbox filters that
    // work for the app keep working here; the body carries which page it came from.
    const feedback = document.getElementById('feedback-toggle');
    if (feedback && enabled('showFeedbackBtn')) {
        feedback.hidden = false;
        feedback.addEventListener('click', () => {
            const address = ['dan', 'noadsdude.com'].join('@');
            const subject = 'NoAdsSports Feedback: General';
            const body = ['', '', '---', 'Page: ' + window.location.href].join('\r\n');
            window.location.href = 'mailto:' + address
                + '?subject=' + encodeURIComponent(subject)
                + '&body=' + encodeURIComponent(body);
        });
    }
})();
