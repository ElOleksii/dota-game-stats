(function () {
  const { parseAccountInput, isWin, filterToday, summarize, formatDuration } = window.DotaCore;

  const API = 'https://api.opendota.com/api';
  const REFRESH_MS = 3 * 60 * 1000;
  const HEROES_KEY = 'heroes-cache-v1';
  const HEROES_TTL = 7 * 24 * 60 * 60 * 1000;

  const $ = (id) => document.getElementById(id);
  const el = {
    avatar: $('avatar'), nickname: $('nickname'),
    btnRefresh: $('btn-refresh'), btnPin: $('btn-pin'), btnSettings: $('btn-settings'),
    btnMin: $('btn-min'), btnClose: $('btn-close'),
    viewSetup: $('view-setup'), viewStats: $('view-stats'),
    idInput: $('id-input'), btnSave: $('btn-save'), btnCancel: $('btn-cancel'), setupError: $('setup-error'),
    wins: $('wins'), losses: $('losses'), summary: $('summary'), matches: $('matches'),
    status: $('status-text'),
    btnCompact: $('btn-compact'), btnExpand: $('btn-expand'),
    compact: $('compact'), cWins: $('c-wins'), cLosses: $('c-losses'), cDot: $('c-dot'),
  };

  let accountId = null;
  let heroes = {};
  let timer = null;
  let requestSeq = 0;

  // ---------- helpers ----------
  function setStatus(text, isError = false) {
    el.status.textContent = text;
    el.status.parentElement.classList.toggle('error', isError);
    // In compact mode an error shows as a red dot; the text is in the tooltip.
    el.cDot.hidden = !isError;
    el.compact.title = text;
  }

  function setCounts(wins, losses) {
    el.wins.textContent = el.cWins.textContent = wins;
    el.losses.textContent = el.cLosses.textContent = losses;
  }

  async function setCompact(on) {
    const applied = await window.widget.setCompact(on);
    document.body.classList.toggle('compact', applied);
  }

  function storageGet(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
  }
  function storageSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
  }

  class ApiError extends Error {
    constructor(status, message) { super(message); this.status = status; }
  }

  async function getJson(path, options) {
    let res;
    try {
      res = await fetch(API + path, options);
    } catch {
      throw new ApiError(0, 'Cannot reach OpenDota');
    }
    if (res.status === 429) throw new ApiError(429, 'OpenDota rate limit reached, will retry later');
    if (!res.ok) throw new ApiError(res.status, `OpenDota returned error ${res.status}`);
    return res.json();
  }

  async function loadHeroes() {
    const cached = storageGet(HEROES_KEY);
    if (cached && cached.map && Date.now() - cached.savedAt < HEROES_TTL) {
      heroes = cached.map;
      return;
    }
    try {
      const list = await getJson('/heroes');
      const map = {};
      for (const h of list) map[h.id] = h.localized_name;
      heroes = map;
      storageSet(HEROES_KEY, { savedAt: Date.now(), map });
    } catch {
      if (cached && cached.map) heroes = cached.map; // a stale cache is better than nothing
    }
  }

  const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });

  // ---------- views ----------
  function showSetup(prefill = '') {
    el.viewStats.hidden = true;
    el.viewSetup.hidden = false;
    el.btnCancel.hidden = !accountId;
    el.setupError.hidden = true;
    el.idInput.value = prefill;
    el.idInput.focus();
    el.idInput.select();
  }

  function showStats() {
    el.viewSetup.hidden = true;
    el.viewStats.hidden = false;
  }

  function renderProfile(profile) {
    if (profile && profile.personaname) {
      el.nickname.textContent = profile.personaname;
      if (profile.avatarmedium || profile.avatar) {
        el.avatar.src = profile.avatarmedium || profile.avatar;
        el.avatar.hidden = false;
      }
    } else {
      el.nickname.textContent = `ID ${accountId}`;
      el.avatar.hidden = true;
    }
  }

  function renderMatches(todayMatches) {
    const stats = summarize(todayMatches);
    setCounts(stats.wins, stats.losses);
    el.summary.textContent = stats.total
      ? `${stats.total} ${stats.total === 1 ? 'game' : 'games'} · ${stats.winrate}% win rate`
      : 'No games played today';

    el.matches.replaceChildren(...todayMatches
      .slice()
      .sort((a, b) => b.start_time - a.start_time)
      .map((m) => {
        const w = isWin(m);
        const li = document.createElement('li');
        li.className = 'match ' + (w === true ? 'win' : w === false ? 'loss' : 'unknown');
        li.title = 'Open match on OpenDota';

        const res = document.createElement('span');
        res.className = 'res';
        res.textContent = w === true ? 'W' : w === false ? 'L' : '?';

        const hero = document.createElement('span');
        hero.className = 'hero';
        hero.textContent = heroes[m.hero_id] || `Hero #${m.hero_id}`;

        const kda = document.createElement('span');
        kda.className = 'kda';
        kda.textContent = `${m.kills ?? 0}/${m.deaths ?? 0}/${m.assists ?? 0}`;

        const meta = document.createElement('span');
        meta.className = 'meta';
        meta.textContent = `${timeFmt.format(new Date(m.start_time * 1000))} · ${formatDuration(m.duration)}`;

        li.append(res, hero, kda, meta);
        li.addEventListener('click', () => window.widget.openMatch(m.match_id));
        return li;
      }));
  }

  // ---------- data ----------
  async function refresh({ manual = false } = {}) {
    if (!accountId) return;
    const seq = ++requestSeq;
    const id = accountId;
    el.btnRefresh.classList.add('spinning');
    setStatus('Updating…');

    try {
      if (!Object.keys(heroes).length) await loadHeroes();
      const [player, matches] = await Promise.all([
        getJson(`/players/${id}`),
        getJson(`/players/${id}/matches?date=1&significant=0`),
      ]);
      if (seq !== requestSeq) return; // the player changed or a newer request started while waiting

      if (!player || !player.profile) {
        renderProfile(null);
        renderMatches([]);
        setStatus('Profile not found or private. Enable "Expose Public Match Data".', true);
        return;
      }

      renderProfile(player.profile);
      renderMatches(filterToday(matches));
      setStatus(`Updated at ${timeFmt.format(new Date())}`);

      if (manual) {
        // Ask OpenDota to fetch fresh matches from Steam, then reload a bit later.
        fetch(`${API}/players/${id}/refresh`, { method: 'POST' }).catch(() => {});
        setTimeout(() => { if (seq === requestSeq) refresh(); }, 15000);
      }
    } catch (err) {
      if (seq !== requestSeq) return;
      setStatus(err.message || 'Failed to load data', true);
    } finally {
      if (seq === requestSeq) el.btnRefresh.classList.remove('spinning');
    }
  }

  function startAutoRefresh() {
    clearInterval(timer);
    timer = setInterval(() => refresh(), REFRESH_MS);
  }

  // ---------- events ----------
  async function saveId() {
    const parsed = parseAccountInput(el.idInput.value);
    if (parsed.error) {
      el.setupError.textContent = parsed.error;
      el.setupError.hidden = false;
      return;
    }
    await window.widget.saveSettings({ accountId: parsed.id });
    accountId = parsed.id;
    el.nickname.textContent = `ID ${accountId}`;
    el.avatar.hidden = true;
    setCounts('–', '–');
    el.summary.textContent = '';
    el.matches.replaceChildren();
    showStats();
    startAutoRefresh();
    refresh({ manual: true });
  }

  el.btnSave.addEventListener('click', saveId);
  el.idInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveId();
    if (e.key === 'Escape' && accountId) showStats();
  });
  el.btnCancel.addEventListener('click', showStats);
  el.btnSettings.addEventListener('click', () => showSetup(accountId || ''));
  el.btnRefresh.addEventListener('click', () => refresh({ manual: true }));
  el.btnCompact.addEventListener('click', () => setCompact(true));
  el.btnExpand.addEventListener('click', () => setCompact(false));
  el.btnMin.addEventListener('click', () => window.widget.minimize());
  el.btnClose.addEventListener('click', () => window.widget.close());
  el.btnPin.addEventListener('click', async () => {
    const onTop = await window.widget.toggleOnTop();
    el.btnPin.classList.toggle('active', onTop);
  });

  // After sleep or when the window becomes visible again, refresh right away (it may be a new day).
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refresh();
  });

  // ---------- init ----------
  (async function init() {
    const settings = await window.widget.getSettings();
    el.btnPin.classList.toggle('active', !!settings.alwaysOnTop);
    loadHeroes();
    if (settings.accountId) {
      accountId = settings.accountId;
      el.nickname.textContent = `ID ${accountId}`;
      document.body.classList.toggle('compact', !!settings.compact);
      showStats();
      startAutoRefresh();
      refresh();
    } else {
      showSetup();
      setStatus('Enter a player to get started');
    }
  })();
})();
