// Generates the static league landing pages and sitemap.xml.
//
// Run from the repo root whenever the league list or js/teams.js changes:
//   node tools/build-league-pages.js
//
// Output is committed. There is deliberately no CI step and no build-time score
// injection: scores are the one thing Google answers in its own results widget, and
// baking them in would mean a scheduled job regenerating pages forever. The static
// content here (rosters, league descriptions) is permanent and does not go stale.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://noadssports.com';

// `id` matches `li` in js/teams.js. `blurb` must be genuinely different per league:
// sixteen copies of one sentence is thin content, which is worse than no page.
const LEAGUES = [
  { slug: 'nfl', id: '4391', source: 'tsdb', name: 'NFL', full: 'National Football League',
    blurb: 'Every NFL game, with live scores through the regular season and playoffs. No ads, no autoplay video, no gambling promos between you and the score.' },
  { slug: 'nba', id: '4387', source: 'tsdb', name: 'NBA', full: 'National Basketball Association',
    blurb: 'NBA scores and schedules from tip-off through the Finals, updated live. Nothing on the page but basketball.' },
  { slug: 'mlb', id: '4424', source: 'tsdb', name: 'MLB', full: 'Major League Baseball',
    blurb: 'Major League Baseball scores across the 162-game season and into October, without the ad load that comes with most box scores.' },
  { slug: 'nhl', id: '4380', source: 'tsdb', name: 'NHL', full: 'National Hockey League',
    blurb: 'NHL scores and schedules, regular season through the Stanley Cup Playoffs. Fast to load, nothing tracking you.' },
  { slug: 'wnba', id: '4516', source: 'tsdb', name: 'WNBA', full: "Women's National Basketball Association",
    blurb: 'WNBA scores and schedules for all fifteen teams, including the newest expansion sides. Live updates, no clutter.' },
  { slug: 'mls', id: '4346', source: 'tsdb', name: 'MLS', full: 'Major League Soccer',
    blurb: 'Major League Soccer scores and tables across the Eastern and Western Conferences, through the MLS Cup Playoffs.' },
  { slug: 'nwsl', id: '4521', source: 'tsdb', name: 'NWSL', full: "National Women's Soccer League",
    blurb: 'NWSL scores and schedules for every club, regular season and playoffs, with no ads in the way.' },
  { slug: 'premier-league', id: '4328', source: 'tsdb', name: 'Premier League', full: 'English Premier League', teamsKey: 'EPL',
    blurb: 'Premier League scores and the full table across all twenty clubs, from the August opening weekend to the final day in May.' },
  { slug: 'la-liga', id: '4335', source: 'tsdb', name: 'La Liga', full: 'La Liga',
    blurb: 'La Liga scores and standings from Spain, covering all twenty clubs through the season.' },
  { slug: 'serie-a', id: '4332', source: 'tsdb', name: 'Serie A', full: 'Serie A',
    blurb: 'Serie A scores and the Italian top-flight table, updated live on matchdays.' },
  { slug: 'bundesliga', id: '4331', source: 'tsdb', name: 'Bundesliga', full: 'Bundesliga',
    blurb: 'Bundesliga scores and standings from Germany, all eighteen clubs, no ads and no sign-in.' },
  { slug: 'champions-league', id: '4480', source: 'tsdb', name: 'Champions League', full: 'UEFA Champions League',
    blurb: 'Champions League scores through the league phase and knockout rounds, across every club still in the competition.' },
  { slug: 'liga-mx', id: '4350', source: 'tsdb', name: 'Liga MX', full: 'Liga MX',
    blurb: 'Liga MX scores and standings from Mexico, covering both the Apertura and Clausura tournaments.' },
  { slug: 'college-football', id: 'football', source: 'ncaa', name: 'College Football', full: 'NCAA Football', teamsKey: 'NCAA Football',
    blurb: 'College football scores across the FBS, from week one through the bowl season and the College Football Playoff.' },
  { slug: 'college-basketball-men', id: 'basketball-men', source: 'ncaa', name: "Men's College Basketball", full: "NCAA Men's Basketball", teamsKey: 'NCAA Basketball (M)',
    blurb: "Men's college basketball scores across Division I, through conference play and March Madness." },
  { slug: 'college-basketball-women', id: 'basketball-women', source: 'ncaa', name: "Women's College Basketball", full: "NCAA Women's Basketball", teamsKey: 'NCAA Basketball (W)',
    blurb: "Women's college basketball scores across Division I, conference tournaments and the NCAA Tournament included." },
];

// ---------- load teams ----------
function loadTeams() {
  const src = fs.readFileSync(path.join(ROOT, 'js', 'teams.js'), 'utf8');
  const box = {};
  new Function('g', src + ';g.T = typeof TEAM_LIST !== "undefined" ? TEAM_LIST : null;')(box);
  if (!Array.isArray(box.T)) throw new Error('could not load TEAM_LIST from js/teams.js');
  return box.T;
}

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function page(lg, teams, others) {
  const url = `${SITE}/${lg.slug}/`;
  const title = `${lg.name} Scores Today & Schedule | NoAdsSports`;
  const desc = `Live ${lg.name} scores and schedules with no ads, no tracking and no cookies. ${lg.full} results updated as games are played.`;

  const teamList = teams.length
    ? `      <section class="league-section">
        <h2>${esc(lg.name)} Teams</h2>
        <ul class="league-team-list">
${teams.map((t) => `          <li>${esc(t.n)}</li>`).join('\n')}
        </ul>
      </section>
`
    : '';

  const liveSection = lg.source === 'tsdb'
    ? `        <section class="league-section">
            <h2>Today's ${esc(lg.name)} Games</h2>
            <div id="league-games" data-league-id="${esc(lg.id)}" data-source="${esc(lg.source)}">
                <p class="league-empty">Live scores load here.</p>
            </div>
        </section>
`
    : '';

  const otherLinks = others
    .map((o) => `          <li><a href="/${o.slug}/">${esc(o.name)}</a></li>`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <script>
      // Mirror the app's theme choice so a landing page doesn't flash light for a
      // dark-mode user. Reads the stored preference but never writes it: this page
      // is not where someone changes their theme.
      (function(){var t=localStorage.getItem('theme');
      if(!t&&window.matchMedia('(prefers-color-scheme:dark)').matches)t='dark';
      if(t)document.documentElement.setAttribute('data-theme',t);})();
    </script>
    <title>${esc(title)}</title>
    <link rel="canonical" href="${url}">
    <meta name="description" content="${esc(desc)}">
    <link rel="icon" href="/img/notif/default.png">
    <link rel="apple-touch-icon" href="/img/notif/default.png">
    <meta name="theme-color" content="#111827">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${url}">
    <meta property="og:title" content="${esc(lg.name)} Scores — NoAdsSports">
    <meta property="og:description" content="${esc(desc)}">
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="${esc(lg.name)} Scores — NoAdsSports">
    <meta name="twitter:description" content="${esc(desc)}">
    <link rel="stylesheet" href="/css/style.css">
</head>
<body class="league-page">
    <header class="league-header">
        <a class="league-brand" href="/">NoAdsSports</a>
        <p class="league-brand-tagline">Scores without the clutter.</p>
    </header>

    <main class="league-main">
        <h1>${esc(lg.name)} Scores</h1>
        <p class="league-blurb">${esc(lg.blurb)}</p>

${liveSection}
        <section class="league-section">
            <h2>Follow your ${esc(lg.name)} team</h2>
            <p>
                Pick your teams on the <a href="/">NoAdsSports dashboard</a> and get live scores,
                schedules, standings and optional push notifications. No account, no cookies,
                nothing tracking you.
            </p>
        </section>

${teamList}
        <nav class="league-section league-other">
            <h2>Other leagues</h2>
            <ul class="league-other-list">
${otherLinks}
            </ul>
        </nav>
    </main>

    <footer class="league-footer">
        <p><a href="/">NoAdsSports</a> &middot; ad-free live sports scores &middot; <a href="/#privacy">Privacy</a></p>
    </footer>

    <button id="feedback-toggle" class="fixed-btn feedback-fixed-btn" title="Send feedback" hidden>\u{1F4AC}</button>

    <button id="theme-toggle" aria-label="Toggle dark mode" hidden>\u{1F319}</button>

    <a id="donate-btn" href="https://ko-fi.com/noadsdude" target="_blank" rel="noopener" hidden>
        Support this site
    </a>

    <script src="/js/tally.js"></script>
    <script src="/js/league.js"></script>
</body>
</html>
`;
}

// ---------- build ----------
const allTeams = loadTeams();
const built = [];

for (const lg of LEAGUES) {
  const key = lg.teamsKey || lg.name;
  const teams = allTeams
    .filter((t) => t.li === lg.id || t.l === key)
    .filter((t, i, arr) => arr.findIndex((x) => x.n === t.n) === i)
    .sort((a, b) => a.n.localeCompare(b.n));

  const others = LEAGUES.filter((o) => o.slug !== lg.slug);
  const dir = path.join(ROOT, lg.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), page(lg, teams, others));
  built.push({ slug: lg.slug, teams: teams.length });
  console.log(`  /${lg.slug}/`.padEnd(32) + teams.length + ' teams');
}

// ---------- sitemap ----------
const today = process.argv[2] || new Date().toISOString().slice(0, 10);
const urls = [{ loc: `${SITE}/`, freq: 'daily' }]
  .concat(built.map((b) => ({ loc: `${SITE}/${b.slug}/`, freq: 'daily' })));

fs.writeFileSync(
  path.join(ROOT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u.freq}</changefreq>
  </url>`).join('\n')}
</urlset>
`
);

console.log(`\n${built.length} league pages written`);
console.log(`sitemap.xml written with ${urls.length} URLs`);
