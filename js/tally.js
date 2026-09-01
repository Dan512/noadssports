// NoAds Tally — anonymous page-view counter.
//
// Shared first-party service (Cloud Run `tally`, GCP pollen-api-492014), also used by
// noadsweather.com, z64central.com and noadstools.com. Adding a site requires adding it
// to ALLOWED_HOSTS and ALLOWED_SITES in the noadsweather repo's tally/index.js and
// redeploying that service.
//
// The entire payload is:
//   { site, path, ref, pwa, unique }
// No cookies, no IP stored, no fingerprinting, no identifier of any kind. Every
// rate-limiting and "first visit today" decision is made by this browser in
// localStorage; the server can see that someone visited, never who.
//
// RULE: any change to the payload must update the privacy copy (privacyCounter in
// js/i18n.js, all nine languages) in the same commit.
//
// localStorage keys used: tallySkip, tallyRecent, lastTallyDay.
// Set localStorage.tallySkip = '1' in a console to exclude a device permanently.

(function () {
    var SITE = 'noadssports.com';
    if (location.hostname !== SITE && location.hostname !== 'www.' + SITE) return;
    if (!navigator.sendBeacon) return;
    var DAMP_MS = 30 * 60 * 1000;

    function sendOnce() {
        try { if (localStorage.getItem('tallySkip') === '1') return; } catch (e) { }
        var nowTs = Date.now();
        try {
            var recent = {};
            try { recent = JSON.parse(localStorage.getItem('tallyRecent')) || {}; } catch (e) { }
            for (var k in recent) {
                if (typeof recent[k] !== 'number' || nowTs - recent[k] > DAMP_MS) delete recent[k];
            }
            if (recent[location.pathname]) return; // counted within 30 min
            recent[location.pathname] = nowTs;
            localStorage.setItem('tallyRecent', JSON.stringify(recent));
        } catch (e) { /* private mode — no dampening, still count */ }

        var unique = false;
        try {
            var now = new Date();
            var today = now.getFullYear() + '-' +
                String(now.getMonth() + 1).padStart(2, '0') + '-' +
                String(now.getDate()).padStart(2, '0');
            if (localStorage.getItem('lastTallyDay') !== today) {
                localStorage.setItem('lastTallyDay', today);
                unique = true;
            }
        } catch (e) { }

        var ref = '';
        try {
            if (document.referrer) {
                var host = new URL(document.referrer).hostname;
                if (host && host !== location.hostname) ref = host;
            }
        } catch (e) { }

        var pwa = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
            window.navigator.standalone === true;

        try {
            navigator.sendBeacon('https://tally-15838356607.us-central1.run.app/',
                JSON.stringify({ site: SITE, path: location.pathname, ref: ref, pwa: pwa, unique: unique }));
        } catch (e) { }
    }

    // Chrome's omnibox prerender would otherwise count visits that never happened.
    if (document.prerendering) {
        document.addEventListener('prerenderingchange', sendOnce, { once: true });
    } else {
        sendOnce();
    }
})();
