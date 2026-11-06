// Чиста логіка без DOM — працює і в браузері (window.DotaCore), і в Node (тести).
(function (root) {
  const STEAM64_BASE = 76561197960265728n;
  const STEAM32_MAX = 4294967295n;

  // Перетворює ID або посилання на account_id (Steam32) у вигляді рядка.
  // Повертає { id } або { error }.
  function parseAccountInput(input) {
    const text = String(input ?? '').trim();
    if (!text) return { error: 'Вкажіть ID гравця.' };

    if (/steamcommunity\.com\/id\//i.test(text)) {
      return { error: 'Посилання з нікнеймом (steamcommunity.com/id/…) не підтримується. Вкажіть числовий ID або посилання /profiles/….' };
    }

    let digits = null;
    const urlMatch = text.match(/(?:steamcommunity\.com\/profiles|opendota\.com\/players|dotabuff\.com\/players|stratz\.com\/players)\/(\d+)/i);
    if (urlMatch) digits = urlMatch[1];
    else if (/^\d+$/.test(text)) digits = text;
    else {
      const steamId3 = text.match(/^\[?U:1:(\d+)\]?$/i);
      if (steamId3) digits = steamId3[1];
    }

    if (!digits) return { error: 'Не вдалося розпізнати ID. Приклад: 123456789 або посилання на профіль OpenDota/Dotabuff/Steam.' };

    let n = BigInt(digits);
    if (n >= STEAM64_BASE) n -= STEAM64_BASE;
    if (n <= 0n || n > STEAM32_MAX) return { error: 'Некоректний ID гравця.' };
    return { id: n.toString() };
  }

  // Чи виграв гравець матч. null — якщо результат невідомий.
  function isWin(match) {
    if (match == null || match.radiant_win == null || match.player_slot == null) return null;
    const isRadiant = match.player_slot < 128;
    return isRadiant === Boolean(match.radiant_win);
  }

  function startOfToday(now = new Date()) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  function filterToday(matches, now = new Date()) {
    const from = startOfToday(now);
    return (matches || []).filter((m) => m && m.start_time * 1000 >= from);
  }

  function summarize(matches) {
    let wins = 0;
    let losses = 0;
    for (const m of matches) {
      const w = isWin(m);
      if (w === true) wins++;
      else if (w === false) losses++;
    }
    const total = wins + losses;
    return { wins, losses, total, winrate: total ? Math.round((wins / total) * 100) : null };
  }

  function formatDuration(seconds) {
    const s = Math.max(0, Math.floor(seconds || 0));
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
  }

  const api = { parseAccountInput, isWin, startOfToday, filterToday, summarize, formatDuration };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DotaCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
