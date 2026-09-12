// arkadia_cal v1.0.12 | 07-09-2026
// Kalendarz Imperium + Ishtar dla oficjalnego klienta arkadia.rpg.pl

(function () {
  'use strict';

  if (window.__arkadia_cal_loaded__) return;
  window.__arkadia_cal_loaded__ = true;

  if (typeof Input === 'undefined' || typeof Gmcp === 'undefined' ||
      typeof Output === 'undefined' || typeof Text === 'undefined') {
    return;
  }

  var EXT_VERSION = '1.0.12';
  var EXT_DATE    = '07-09-2026';
  var UPDATE_URL  = 'https://isithunzi000.github.io/www-arkadia_cal/index.json';

  // =========================================================================
  // SHARED UTILS
  // =========================================================================

  function pad2(n) { return String(n).padStart(2, '0'); }

  function formatRealDate(d) {
    return pad2(d.getDate()) + '-' + pad2(d.getMonth() + 1) + '-' + d.getFullYear() +
           ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function stripAnsi(s) {
    return s.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '');
  }

  function sanitizeCzasLine(line) {
    var s = stripAnsi(line).replace(/\r$/, '');
    var bi = s.indexOf('[');
    if (bi >= 0) s = s.slice(0, bi);
    s = s.replace(/^\s*>\s*/, '');
    var ai = s.indexOf('\u2192');
    if (ai >= 0) {
      var before = s.slice(0, ai).trim();
      if (before === '' || before === '>' || before.endsWith('>')) s = s.slice(0, ai);
    }
    return s.replace(/\s+/g, ' ').trim();
  }

  function printLines(lines) {
    Output.send(Text.parse_patterns(['', '', '---'].concat(lines).concat(['---', '', '']).join('\n')));
  }

  function printWrapped(text) {
    Output.send(Text.parse_patterns('\n\n---\n' + text + '\n---\n\n'));
  }

  // =========================================================================
  // IMPERIUM MODULE
  // =========================================================================

  var IMP_REAL_MS_PER_GAME_MINUTE = 2000;
  var IMP_YEAR_LENGTH_DAYS        = 400;
  var IMP_GAME_MINUTES_PER_DAY   = 24 * 60;
  var IMP_ANCHOR_KEY              = 'www.imperium_cal.anchor.v2';
  var IMP_REQUEST_TIMEOUT_MS      = 3500;

  var IMP_MONTHS = [
    { name: 'Hexenstag',   days: 1,  sunrise: 8, sunset: 17 },
    { name: 'Nachexen',    days: 32, sunrise: 8, sunset: 17 },
    { name: 'Jahrdrung',   days: 33, sunrise: 7, sunset: 18 },
    { name: 'Mitterfruhl', days: 1,  sunrise: 7, sunset: 18 },
    { name: 'Pflugzeit',   days: 33, sunrise: 6, sunset: 19 },
    { name: 'Sigmarzeit',  days: 33, sunrise: 5, sunset: 20 },
    { name: 'Sommerzeit',  days: 33, sunrise: 5, sunset: 21 },
    { name: 'Sonnstill',   days: 1,  sunrise: 5, sunset: 22 },
    { name: 'Vorgeheim',   days: 33, sunrise: 4, sunset: 22 },
    { name: 'Nachgeheim',  days: 33, sunrise: 5, sunset: 21 },
    { name: 'Erntezeit',   days: 33, sunrise: 5, sunset: 20 },
    { name: 'Mittherbst',  days: 1,  sunrise: 5, sunset: 20 },
    { name: 'Brauzeit',    days: 33, sunrise: 6, sunset: 19 },
    { name: 'Kaldezeit',   days: 33, sunrise: 6, sunset: 18 },
    { name: 'Ulriczeit',   days: 33, sunrise: 7, sunset: 17 },
    { name: 'Mondstille',  days: 1,  sunrise: 8, sunset: 16 },
    { name: 'Vorhexen',   days: 33, sunrise: 8, sunset: 16 },
  ];

  var IMP_MONTH_ALIASES = {
    nachhexen: 'nachexen', sigmarszeit: 'sigmarzeit', kaltezeit: 'kaldezeit',
    ulrichszeit: 'ulriczeit', sonnenstill: 'sonnstill', sonnenstil: 'sonnstill',
    sonnenstille: 'sonnstill', mondstill: 'mondstille', mitterherbst: 'mittherbst',
    hexensnacht: 'hexenstag',
  };

  function impNormMonthKey(raw) {
    var k = raw.trim().toLowerCase();
    return IMP_MONTH_ALIASES[k] || k;
  }

  var IMP_MONTH_INDEX = (function () {
    var idx = {};
    IMP_MONTHS.forEach(function (m, i) { idx[m.name.toLowerCase()] = i; });
    Object.keys(IMP_MONTH_ALIASES).forEach(function (alias) {
      var canon = IMP_MONTH_ALIASES[alias];
      if (typeof idx[canon] === 'number') idx[alias] = idx[canon];
    });
    return idx;
  })();

  var IMP_PREFIX_DAYS = (function () {
    var out = [], acc = 0;
    IMP_MONTHS.forEach(function (m) { out.push(acc); acc += m.days; });
    return out;
  })();

  var IMP_SUNSET_BY_DOY = (function () {
    var out = new Array(IMP_YEAR_LENGTH_DAYS + 1).fill(0);
    IMP_MONTHS.forEach(function (m, i) {
      var start = IMP_PREFIX_DAYS[i] + 1;
      for (var d = 0; d < m.days; d++) out[start + d] = m.sunset;
    });
    return out;
  })();

  var IMP_SUNRISE_BY_DOY = (function () {
    var out = new Array(IMP_YEAR_LENGTH_DAYS + 1).fill(0);
    IMP_MONTHS.forEach(function (m, i) {
      var start = IMP_PREFIX_DAYS[i] + 1;
      for (var d = 0; d < m.days; d++) out[start + d] = m.sunrise;
    });
    return out;
  })();

  var IMP_MSG_INTERNAL = [
    '[imperium_cal] Blad wewnetrzny kalendarza Imperium - nie mozna wyliczyc danych.',
  ];
  var IMP_MSG_GN_COLDSTART = [
    "[imperium_cal] Trwa Geheimnisnacht - komenda 'czas' nie podaje teraz daty.",
    'To pierwsze uzycie w tej sesji, wiec nie mam zapamietanej daty do wyliczenia.',
    "Uruchom /imperium raz poza Geheimnisnacht (gdy 'czas' pokazuje date) - potem zadziala tez w trakcie eventu.",
  ];
  var IMP_MSG_TIMEOUT = [
    "[imperium_cal] Brak odpowiedzi na komende 'czas' (timeout) i nie mam zapamietanej daty.",
    "Sprawdz, czy 'czas' dziala, i sprobuj ponownie.",
  ];
  var IMP_MSG_RESET_DONE = [
    "[imperium_cal] Kotwica Imperium wyczyszczona. Uzyj /imperium na zewnatrz, zeby zapisac nowa.",
  ];
  var IMP_MSG_CROSS_NO_ANCHOR = [
    "[imperium_cal] Nie mam zapamietanej daty domeny Imperium - nie moge wyliczyc raportu.",
    "Bedac w domenie Imperium, uzyj komendy /imperium - odczyt zapisze date na przyszlosc.",
  ];

  var IMP_NEW_MOONS = [
    { dayOfMonth: 13, month: 'Nachexen' }, { dayOfMonth: 6,  month: 'Jahrdrung' },
    { dayOfMonth: 31, month: 'Jahrdrung' }, { dayOfMonth: 22, month: 'Pflugzeit' },
    { dayOfMonth: 14, month: 'Sigmarzeit' }, { dayOfMonth: 6,  month: 'Sommerzeit' },
    { dayOfMonth: 31, month: 'Sommerzeit' }, { dayOfMonth: 22, month: 'Vorgeheim' },
    { dayOfMonth: 13, month: 'Nachgeheim' }, { dayOfMonth: 6,  month: 'Erntezeit' },
    { dayOfMonth: 31, month: 'Erntezeit' }, { dayOfMonth: 22, month: 'Brauzeit' },
    { dayOfMonth: 14, month: 'Kaldezeit' }, { dayOfMonth: 6,  month: 'Ulriczeit' },
    { dayOfMonth: 31, month: 'Ulriczeit' }, { dayOfMonth: 22, month: 'Vorhexen' },
  ];

  var IMP_FULL_MOONS = [
    { dayOfMonth: 25, month: 'Nachexen' }, { dayOfMonth: 18, month: 'Jahrdrung' },
    { dayOfMonth: 9,  month: 'Pflugzeit' }, { dayOfMonth: 2,  month: 'Sigmarzeit' },
    { dayOfMonth: 26, month: 'Sigmarzeit' }, { dayOfMonth: 18, month: 'Sommerzeit' },
    { dayOfMonth: 9,  month: 'Vorgeheim' }, { dayOfMonth: 1,  month: 'Nachgeheim' },
    { dayOfMonth: 26, month: 'Nachgeheim' }, { dayOfMonth: 18, month: 'Erntezeit' },
    { dayOfMonth: 9,  month: 'Brauzeit' }, { dayOfMonth: 1,  month: 'Kaldezeit' },
    { dayOfMonth: 26, month: 'Kaldezeit' }, { dayOfMonth: 18, month: 'Ulriczeit' },
    { dayOfMonth: 9,  month: 'Vorhexen' },
  ];

  var IMP_SEASONAL_EVENTS = [
    { dayOfYear: 18,  name: 'Pierwszy dzien wiosny' },
    { dayOfYear: 118, name: 'Pierwszy dzien lata' },
    { dayOfYear: 218, name: 'Pierwszy dzien jesieni' },
    { dayOfYear: 319, name: 'Pierwszy dzien zimy' },
  ];

  var IMP_INTERCALARY_EVENTS = [
    { month: 'Hexenstag',   dayOfMonth: 1, name: 'Hexentag' },
    { month: 'Mitterfruhl', dayOfMonth: 1, name: 'Mitterfruhl' },
    { month: 'Sonnstill',   dayOfMonth: 1, name: 'Sonnstill' },
    { month: 'Mittherbst',  dayOfMonth: 1, name: 'Mittherbst' },
    { month: 'Mondstille',  dayOfMonth: 1, name: 'Mondstille' },
  ];

  var IMP_INTERCALARY_MONTHS = new Set(IMP_INTERCALARY_EVENTS.map(function (e) {
    return impNormMonthKey(e.month);
  }));

  var IMP_GN_FULLS = [
    { dayOfMonth: 1,  month: 'Nachgeheim' },
    { dayOfMonth: 26, month: 'Nachgeheim' },
    { dayOfMonth: 18, month: 'Erntezeit' },
    { dayOfMonth: 9,  month: 'Brauzeit' },
    { dayOfMonth: 1,  month: 'Kaldezeit' },
  ];

  // Geheimnisnacht: MG synchronizuje zegar tak, by noc pelni wypadla w wieczornym
  // prime time RL; event to sama noc pelni (bez przesuwania o dni). Potwierdzone
  // empirycznie: 11.08.2026 ok. 20:00 = noc pelni 1 Nachgeheim (zachod 19:57 PL).
  // Okno liczone wg zegara EUROPE/WARSAW (przez Intl) - niezaleznie od strefy
  // przegladarki gracza i od zmiany czasu letni/zimowy.
  var IMP_GN_WINDOW_START_MIN = 19 * 60;
  var IMP_GN_WINDOW_END_MIN   = 21 * 60;
  var IMP_GN_PRIME_MIN        = 20 * 60;
  var IMP_GN_SCAN_YEARS       = 4;
  var IMP_GN_CLUSTER_MS       = 180 * 60 * 1000;

  var IMP_GN_CLOCK_FORMATTER = new Intl.DateTimeFormat('pl-PL', {
    timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  });

  function impWarsawClockMinutes(realMs) {
    var parts = IMP_GN_CLOCK_FORMATTER.formatToParts(new Date(realMs));
    var h = 0, m = 0;
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].type === 'hour') h = parseInt(parts[i].value, 10);
      else if (parts[i].type === 'minute') m = parseInt(parts[i].value, 10);
    }
    return h * 60 + m;
  }

  function impNormDoy(doy) {
    return (((doy - 1) % IMP_YEAR_LENGTH_DAYS) + IMP_YEAR_LENGTH_DAYS) % IMP_YEAR_LENGTH_DAYS + 1;
  }

  function impSunsetH(doy)  { return IMP_SUNSET_BY_DOY[impNormDoy(doy)]; }
  function impSunriseH(doy) { return IMP_SUNRISE_BY_DOY[impNormDoy(doy)]; }

  function impClampInt(n, min, max) {
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, Math.floor(n)));
  }

  function impClamp(t) {
    return {
      dayOfYear: impClampInt(t.dayOfYear, 1, IMP_YEAR_LENGTH_DAYS),
      hour:      impClampInt(t.hour,      0, 23),
      minute:    impClampInt(t.minute,    0, 59),
    };
  }

  function impValidTime(t) {
    if (!t) return false;
    return Number.isFinite(t.dayOfYear) && Number.isFinite(t.hour) && Number.isFinite(t.minute) &&
      t.dayOfYear >= 1 && t.dayOfYear <= IMP_YEAR_LENGTH_DAYS &&
      t.hour >= 0 && t.hour <= 23 && t.minute >= 0 && t.minute <= 59;
  }

  function impDeltaMin(from, to) {
    var ft = (from.dayOfYear - 1) * IMP_GAME_MINUTES_PER_DAY + from.hour * 60 + from.minute;
    var tt = (to.dayOfYear   - 1) * IMP_GAME_MINUTES_PER_DAY + to.hour   * 60 + to.minute;
    var yt = IMP_YEAR_LENGTH_DAYS * IMP_GAME_MINUTES_PER_DAY;
    var diff = tt - ft;
    if (diff < 0) diff += yt;
    return diff;
  }

  function impFormatDelta(dm) {
    var totalMin = Math.max(0, Math.round(dm * IMP_REAL_MS_PER_GAME_MINUTE / 60000));
    var d = Math.floor(totalMin / 1440);
    var h = Math.floor((totalMin % 1440) / 60);
    var m = totalMin % 60;
    return d + 'd ' + h + 'h ' + m + 'm';
  }

  function impDoyFromMonthDay(monthName, dayOfMonth) {
    var idx = IMP_MONTH_INDEX[impNormMonthKey(monthName)];
    if (idx === undefined) return null;
    if (dayOfMonth < 1 || dayOfMonth > IMP_MONTHS[idx].days) return null;
    return IMP_PREFIX_DAYS[idx] + dayOfMonth;
  }

  function impNextFromList(now, sorted) {
    var nowDoy = impNormDoy(now.dayOfYear);
    var atMid  = now.hour === 0 && now.minute === 0;
    for (var i = 0; i < sorted.length; i++) {
      var d = sorted[i];
      if (d > nowDoy) return d;
      if (d === nowDoy && atMid) return d;
    }
    return sorted[0] || 1;
  }

  function impToSortedDoyList(list) {
    var out = [];
    list.forEach(function (item) {
      var doy = impDoyFromMonthDay(item.month, item.dayOfMonth);
      if (typeof doy === 'number') out.push(impNormDoy(doy));
    });
    return out.sort(function (a, b) { return a - b; });
  }

  // --- Parsing ---

  function isLikelyImperiumCzasLine(raw) {
    var lc = raw.toLowerCase();
    return lc.startsWith('jest w przyblizeniu') && lc.includes('kalendarza imperialnego');
  }

  var IMP_ORDINALS = {
    pierwszy: 1, drugi: 2, trzeci: 3, czwarty: 4, piaty: 5,
    szosty: 6, siodmy: 7, osmy: 8, dziewiaty: 9, dziesiaty: 10,
    jedenasty: 11, dwunasty: 12, trzynasty: 13, czternasty: 14, pietnasty: 15,
    szesnasty: 16, siedemnasty: 17, osiemnasty: 18, dziewietnasty: 19,
    dwudziesty: 20, 'dwudziesty pierwszy': 21, 'dwudziesty drugi': 22,
    'dwudziesty trzeci': 23, 'dwudziesty czwarty': 24, 'dwudziesty piaty': 25,
    'dwudziesty szosty': 26, 'dwudziesty siodmy': 27, 'dwudziesty osmy': 28,
    'dwudziesty dziewiaty': 29, trzydziesty: 30, 'trzydziesty pierwszy': 31,
    'trzydziesty drugi': 32, 'trzydziesty trzeci': 33,
  };

  var IMP_HOUR_WORDS = {
    polnoc: 0, pierwsza: 1, druga: 2, trzecia: 3, czwarta: 4, piata: 5,
    szosta: 6, siodma: 7, osma: 8, dziewiata: 9, dziesiata: 10,
    jedenasta: 11, dwunasta: 12, poludnie: 12,
  };

  function impParseHour(line) {
    var m = line.toLowerCase().match(
      /^jest w przyblizeniu (\w+)(?: (?:|w|po|przed|nad|poznym)\s*(dzien|nocy|poludniu|poludniem|poludnie|rano|ranem|wieczorem))?/
    );
    if (!m) return null;
    var v = IMP_HOUR_WORDS[m[1]];
    if (typeof v !== 'number') return null;
    var dt = m[2] || '';
    var h = v;
    if (dt === 'poludniu' || dt === 'wieczorem' || (dt === 'nocy' && v >= 6)) h += 12;
    if (h > 23) h = 0;
    return h;
  }

  function impMatchMonthName(key) {
    var idx = IMP_MONTH_INDEX[impNormMonthKey(key)];
    return idx === undefined ? null : IMP_MONTHS[idx].name;
  }

  function impParseCzas(text) {
    var hour = impParseHour(text);
    if (hour === null) return null;
    var t = text.toLowerCase();
    var md = t.match(/\b([a-z]+(?:[\s-]+[a-z]+){0,2})\s+dzien\s+miesiaca\s+([a-z]+)[.,]?\b/i);
    if (md) {
      var key = md[1].trim().toLowerCase().replace(/[-]+/g, ' ').replace(/\s+/g, ' ');
      var dom = IMP_ORDINALS[key];
      if (!dom) return null;
      var mn = impMatchMonthName(md[2].replace(/[^a-z]/g, ''));
      if (!mn) return null;
      var doy = impDoyFromMonthDay(mn, dom);
      if (!doy) return null;
      return { dayOfYear: doy, hour: hour, minute: 0 };
    }
    var sd = t.match(/\b(?:dzien|noc)\s+([a-z]+)[.,]?\s+wedlug\b/i);
    if (sd) {
      var mn2 = impMatchMonthName(sd[1].replace(/[^a-z]/g, ''));
      if (!mn2) return null;
      var doy2 = impDoyFromMonthDay(mn2, 1);
      if (!doy2) return null;
      return { dayOfYear: doy2, hour: hour, minute: 0 };
    }
    return null;
  }

  // --- Sanity check ---

  function impComputeSanity() {
    var totalDays = IMP_MONTHS.reduce(function (a, m) { return a + m.days; }, 0);
    if (totalDays !== IMP_YEAR_LENGTH_DAYS) return null;
    for (var i = 0; i < IMP_SEASONAL_EVENTS.length; i++) {
      var ev = IMP_SEASONAL_EVENTS[i];
      if (!Number.isFinite(ev.dayOfYear) || ev.dayOfYear < 1 || ev.dayOfYear > IMP_YEAR_LENGTH_DAYS) return null;
    }
    var allMoons = IMP_NEW_MOONS.concat(IMP_FULL_MOONS);
    for (var j = 0; j < allMoons.length; j++) {
      if (IMP_INTERCALARY_MONTHS.has(impNormMonthKey(allMoons[j].month))) return null;
    }
    var allItems = IMP_NEW_MOONS.concat(IMP_FULL_MOONS, IMP_INTERCALARY_EVENTS, IMP_GN_FULLS);
    for (var k = 0; k < allItems.length; k++) {
      if (typeof impDoyFromMonthDay(allItems[k].month, allItems[k].dayOfMonth) !== 'number') return null;
    }
    var newMoons  = impToSortedDoyList(IMP_NEW_MOONS);
    var fullMoons = impToSortedDoyList(IMP_FULL_MOONS);
    if (!newMoons.length || !fullMoons.length) return null;
    var nmToIdx = new Map();
    IMP_NEW_MOONS.forEach(function (md, i) {
      var d = impDoyFromMonthDay(md.month, md.dayOfMonth);
      if (typeof d === 'number') nmToIdx.set(impNormDoy(d), i);
    });
    for (var n = 0; n < newMoons.length; n++) {
      if (!nmToIdx.has(newMoons[n])) return null;
    }
    return { newMoons: newMoons, fullMoons: fullMoons, nmToIdx: nmToIdx };
  }

  var IMP_SANITY       = impComputeSanity();
  var IMP_OK           = Boolean(IMP_SANITY);
  var IMP_NEW_MOONS_DOY  = IMP_SANITY ? IMP_SANITY.newMoons  : [];
  var IMP_FULL_MOONS_DOY = IMP_SANITY ? IMP_SANITY.fullMoons : [];
  var IMP_NM_TO_IDX      = IMP_SANITY ? IMP_SANITY.nmToIdx   : new Map();

  // --- Report building ---

  function impPushTiming(lines, now, nowReal, doy) {
    var d = impNormDoy(doy);
    if (impNormDoy(now.dayOfYear) === d) {
      var minsToEnd = (24 - now.hour) * 60 - now.minute;
      var endReal = new Date(nowReal.getTime() + minsToEnd * IMP_REAL_MS_PER_GAME_MINUTE);
      lines.push('    Dzis (dzien ' + d + ')');
      lines.push('    TRWA TERAZ (do ' + formatRealDate(endReal) + ')');
      return;
    }
    var dm = impDeltaMin(now, { dayOfYear: d, hour: 0, minute: 0 });
    var real = new Date(nowReal.getTime() + dm * IMP_REAL_MS_PER_GAME_MINUTE);
    lines.push('    Data RL: ' + formatRealDate(real));
    lines.push('    Za:      ' + impFormatDelta(dm));
  }

  function impMonthDayFromDoy(doy) {
    var d = impNormDoy(doy);
    for (var i = IMP_MONTHS.length - 1; i >= 0; i--) {
      if (d > IMP_PREFIX_DAYS[i]) {
        return { month: IMP_MONTHS[i].name, dayOfMonth: d - IMP_PREFIX_DAYS[i] };
      }
    }
    return null;
  }

  function impComputeHexennacht(now, nowReal) {
    var sunsetH  = impSunsetH(1);
    var sunriseH = impSunriseH(2);
    var nightDur = (24 - sunsetH + sunriseH) * 60;
    var yearMin  = IMP_YEAR_LENGTH_DAYS * IMP_GAME_MINUTES_PER_DAY;
    var base = impDeltaMin(now, { dayOfYear: 1, hour: sunsetH, minute: 0 });
    var back = base - yearMin;
    if (back > -nightDur) return { trwa: true, deltaMin: nightDur + back, nightDoy: 1 };
    return { trwa: false, deltaMin: base, nightDoy: 1 };
  }

  function impComputeGN(now, nowReal) {
    var yearMin = IMP_YEAR_LENGTH_DAYS * IMP_GAME_MINUTES_PER_DAY;
    var cands = [];
    for (var fi = 0; fi < IMP_GN_FULLS.length; fi++) {
      var f = IMP_GN_FULLS[fi];
      var fdoy = impDoyFromMonthDay(f.month, f.dayOfMonth);
      if (typeof fdoy !== 'number') continue;
      // Noc Geheimnisnacht = sama noc pelni (offset 0 dni).
      var gnDoy      = impNormDoy(fdoy);
      var gnSunsetH  = impSunsetH(gnDoy);
      var gnSunriseH = impSunriseH(impNormDoy(gnDoy + 1));
      var nightDur   = (24 - gnSunsetH + gnSunriseH) * 60;
      var base = impDeltaMin(now, { dayOfYear: gnDoy, hour: gnSunsetH, minute: 0 });
      // TRWA: noc pelni zaczela sie mniej niz nightDur temu (delta zawinela sie
      // przez koniec roku). Niezalezne od okna - trwajacy event pokazujemy zawsze.
      if (base > yearMin - nightDur && base < yearMin) {
        return { trwa: true, deltaMin: base - (yearMin - nightDur), nightDoy: gnDoy };
      }
      for (var k = 0; k < IMP_GN_SCAN_YEARS; k++) {
        var dmAnchor = base + k * yearMin;
        var realAnchor = nowReal.getTime() + dmAnchor * IMP_REAL_MS_PER_GAME_MINUTE;
        var clockA = impWarsawClockMinutes(realAnchor);
        if (clockA < IMP_GN_WINDOW_START_MIN || clockA > IMP_GN_WINDOW_END_MIN) continue;
        cands.push({ deltaMin: dmAnchor, nightDoy: gnDoy, realMs: realAnchor, dist: Math.abs(clockA - IMP_GN_PRIME_MIN) });
      }
    }
    if (!cands.length) return null;
    var t0 = cands[0].realMs;
    cands.forEach(function (c) { if (c.realMs < t0) t0 = c.realMs; });
    var best = null;
    cands.forEach(function (c) {
      if (c.realMs > t0 + IMP_GN_CLUSTER_MS) return;
      if (!best || c.dist < best.dist || (c.dist === best.dist && c.realMs < best.realMs)) best = c;
    });
    return best ? { trwa: false, deltaMin: best.deltaMin, nightDoy: best.nightDoy } : null;
  }

  function impBuildReport(nowRaw) {
    var now    = impClamp(nowRaw);
    var nowReal = new Date(Math.floor(Date.now() / 60000) * 60000);
    var lines  = [];
    var hexDoy = impDoyFromMonthDay('Hexenstag', 1) || 1;

    lines.push('Glowne swieta interkalarne:');
    lines.push('  *** Hexentag ***');
    impPushTiming(lines, now, nowReal, hexDoy);

    var hn = impComputeHexennacht(now, nowReal);
    lines.push('  *** Hexennacht ***');
    if (hn.trwa) {
      lines.push('    TRWA TERAZ (do ' + formatRealDate(new Date(nowReal.getTime() + hn.deltaMin * IMP_REAL_MS_PER_GAME_MINUTE)) + ')');
    } else {
      lines.push('    Data RL: ' + formatRealDate(new Date(nowReal.getTime() + hn.deltaMin * IMP_REAL_MS_PER_GAME_MINUTE)));
      lines.push('    Za:      ' + impFormatDelta(hn.deltaMin));
    }

    var gn = impComputeGN(now, nowReal);
    if (gn) {
      var gnMd = impMonthDayFromDoy(gn.nightDoy);
      var gnLabel = gnMd ? gnMd.month + ' ' + gnMd.dayOfMonth + ', dzien ' + gn.nightDoy : 'dzien ' + gn.nightDoy;
      lines.push('  *** Geheimnisnacht (' + gnLabel + ') ***');
      if (gn.trwa) {
        lines.push('    TRWA TERAZ (do ' + formatRealDate(new Date(nowReal.getTime() + gn.deltaMin * IMP_REAL_MS_PER_GAME_MINUTE)) + ')');
      } else {
        lines.push('    Data RL: ' + formatRealDate(new Date(nowReal.getTime() + gn.deltaMin * IMP_REAL_MS_PER_GAME_MINUTE)));
        lines.push('    Za:      ' + impFormatDelta(gn.deltaMin));
      }
    }

    var scands = IMP_SEASONAL_EVENTS.map(function (ev) {
      var isToday = impNormDoy(now.dayOfYear) === impNormDoy(ev.dayOfYear);
      var dm = impDeltaMin(now, { dayOfYear: ev.dayOfYear, hour: 0, minute: 0 });
      return { dayOfYear: ev.dayOfYear, name: ev.name, isToday: isToday, deltaMin: dm };
    });
    var seasonal = scands.filter(function (c) { return c.isToday; })[0] ||
      scands.slice().sort(function (a, b) { return a.deltaMin - b.deltaMin; })[0];
    lines.push('');
    lines.push('Najblizsze wydarzenie sezonowe:');
    if (seasonal) {
      lines.push('  ' + seasonal.name);
      impPushTiming(lines, now, nowReal, seasonal.dayOfYear);
    }

    lines.push('');
    lines.push('Najblizsze wydarzenia ksiezycowe:');
    var nowDoy = impNormDoy(now.dayOfYear);

    if (IMP_NM_TO_IDX.has(nowDoy)) {
      var sunsetH = impSunsetH(nowDoy);
      lines.push('  *** Now astronomiczny ***');
      impPushTiming(lines, now, nowReal, nowDoy);
      if (now.hour >= sunsetH) {
        var minsToEnd = (24 - now.hour) * 60 - now.minute;
        lines.push('  +++ Now widoczny TERAZ +++');
        lines.push('    TRWA TERAZ (do ' + formatRealDate(new Date(nowReal.getTime() + minsToEnd * IMP_REAL_MS_PER_GAME_MINUTE)) + ')');
        lines.push('    Zachod:  ' + pad2(sunsetH) + ':00 IG');
      } else {
        var toSunset = (sunsetH - now.hour) * 60 - now.minute;
        lines.push('  +++ Now widoczny dzis po zachodzie slonca +++');
        lines.push('    Data RL: ' + formatRealDate(new Date(nowReal.getTime() + toSunset * IMP_REAL_MS_PER_GAME_MINUTE)));
        lines.push('    Zachod:  ' + pad2(sunsetH) + ':00 IG');
        lines.push('    Za:      ' + impFormatDelta(toSunset));
      }
    } else {
      var newDoy = impNextFromList(now, IMP_NEW_MOONS_DOY);
      var dm     = impDeltaMin(now, { dayOfYear: newDoy, hour: 0, minute: 0 });
      lines.push('  *** Now astronomiczny ***');
      lines.push('    Data RL: ' + formatRealDate(new Date(nowReal.getTime() + dm * IMP_REAL_MS_PER_GAME_MINUTE)));
      lines.push('    Za:      ' + impFormatDelta(dm));
      var sunsetH2 = impSunsetH(newDoy);
      if (typeof sunsetH2 === 'number') {
        var sdm = impDeltaMin(now, { dayOfYear: newDoy, hour: sunsetH2, minute: 0 });
        lines.push('  +++ Now widoczny po zachodzie slonca +++');
        lines.push('    Data RL: ' + formatRealDate(new Date(nowReal.getTime() + sdm * IMP_REAL_MS_PER_GAME_MINUTE)));
        lines.push('    Zachod:  ' + pad2(sunsetH2) + ':00 IG');
        lines.push('    Za:      ' + impFormatDelta(sdm));
      }
    }

    var fullDoy = IMP_FULL_MOONS_DOY.includes(nowDoy) ? nowDoy : impNextFromList(now, IMP_FULL_MOONS_DOY);
    lines.push('  Pelnia astronomiczna');
    impPushTiming(lines, now, nowReal, fullDoy);

    var other = IMP_INTERCALARY_EVENTS
      .filter(function (ev) { return !ev.name.toLowerCase().includes('hexentag'); })
      .map(function (ev) {
        var doy = impDoyFromMonthDay(ev.month, ev.dayOfMonth) || 1;
        var isToday = impNormDoy(now.dayOfYear) === impNormDoy(doy);
        var dm = impDeltaMin(now, { dayOfYear: doy, hour: 0, minute: 0 });
        return { name: ev.name, dayOfYear: doy, isToday: isToday, sortKey: isToday ? -1 : dm };
      })
      .sort(function (a, b) { return a.sortKey - b.sortKey; });

    lines.push('');
    lines.push('Inne swieta interkalarne:');
    other.forEach(function (ev) {
      lines.push('  ' + ev.name);
      impPushTiming(lines, now, nowReal, ev.dayOfYear);
    });

    return lines;
  }

  // --- Anchor ---

  function impSaveAnchor(doy, hour, minute) {
    try {
      window.localStorage.setItem(IMP_ANCHOR_KEY, JSON.stringify({
        scheme:      'hexenstag',
        dayOfYear:   impClampInt(doy,    1, IMP_YEAR_LENGTH_DAYS),
        hour:        impClampInt(hour,   0, 23),
        minute:      impClampInt(minute, 0, 59),
        rlTimestampMs: Date.now(),
      }));
    } catch (e) { }
  }

  function impLoadAnchor() {
    try {
      var raw = window.localStorage.getItem(IMP_ANCHOR_KEY);
      if (!raw) return null;
      var p = JSON.parse(raw);
      if (!p || typeof p !== 'object') return null;
      // Rekord bez zgodnego scheme (np. zapis legacy) - ignoruj.
      if (p.scheme !== 'hexenstag') return null;
      var dayOfYear    = Number(p.dayOfYear);
      var hour         = Number(p.hour);
      var minute       = Number(p.minute);
      var rlTimestampMs = Number(p.rlTimestampMs);
      if (!Number.isFinite(dayOfYear) || !Number.isFinite(hour) ||
          !Number.isFinite(minute)    || !Number.isFinite(rlTimestampMs)) return null;
      if (dayOfYear < 1 || dayOfYear > IMP_YEAR_LENGTH_DAYS ||
          hour < 0 || hour > 23 || minute < 0 || minute > 59 || rlTimestampMs <= 0) return null;
      return { scheme: 'hexenstag', dayOfYear: dayOfYear, hour: hour, minute: minute, rlTimestampMs: rlTimestampMs };
    } catch (e) { return null; }
  }

  function impClearAnchor() {
    try { window.localStorage.removeItem(IMP_ANCHOR_KEY); } catch (e) { }
  }

  function impExtrapolate(anchor, nowMs) {
    var elapsed = nowMs - anchor.rlTimestampMs;
    if (!Number.isFinite(elapsed) || elapsed < 0) return null;
    var elGameMin = Math.floor(elapsed / IMP_REAL_MS_PER_GAME_MINUTE);
    var yt = IMP_YEAR_LENGTH_DAYS * IMP_GAME_MINUTES_PER_DAY;
    var at = (anchor.dayOfYear - 1) * IMP_GAME_MINUTES_PER_DAY + anchor.hour * 60 + anchor.minute;
    var nt = (((at + elGameMin) % yt) + yt) % yt;
    var rem = nt % IMP_GAME_MINUTES_PER_DAY;
    return impClamp({ dayOfYear: Math.floor(nt / IMP_GAME_MINUTES_PER_DAY) + 1, hour: Math.floor(rem / 60), minute: rem % 60 });
  }

  // --- State + handlers ---

  var impState = { pending: false, startMs: 0, timerId: null };

  function impClearPending() {
    impState.pending = false;
    impState.startMs = 0;
    if (impState.timerId) { clearTimeout(impState.timerId); impState.timerId = null; }
  }

  function impRunReport(now) {
    if (!IMP_OK) { printLines(IMP_MSG_INTERNAL); return; }
    try { printLines(impBuildReport(now)); } catch (e) { printLines(IMP_MSG_INTERNAL); }
  }

  function impTryAnchorFallback() {
    if (!impState.pending) return false;
    var anchor = impLoadAnchor();
    if (!anchor) return false;
    var now = impExtrapolate(anchor, Date.now());
    if (!impValidTime(now)) return false;
    impClearPending();
    printLines(["[imperium_cal] Pokazuje Imperium wyliczone z zapisanej daty (ostatni odczyt: " + formatRealDate(new Date(anchor.rlTimestampMs)) + ")."]);
    impRunReport(now);
    return true;
  }

  function impOnTimeout() {
    if (!impState.pending) return;
    if (impTryAnchorFallback()) return;
    impClearPending();
    printLines(IMP_MSG_TIMEOUT);
  }

  function impStart() {
    if (impState.pending) return;
    impState.pending = true;
    impState.startMs = Date.now();
    impState.timerId = setTimeout(impOnTimeout, IMP_REQUEST_TIMEOUT_MS + 50);
    _origInput('czas');
  }

  function impHandleLine(sanitized) {
    // O1: kazda poprawnie sparsowana wlasna linia 'czas' zapisuje kotwice,
    // takze bez oczekujacego zapytania (pasywny zapis, paritet z Dargoth).
    // Linia GN ("noc Geheimnisnacht") nie ma daty - impValidTime ja odrzuci.
    var ownImp = isLikelyImperiumCzasLine(sanitized);
    var parsed = ownImp ? impParseCzas(sanitized) : null;
    if (ownImp && impValidTime(parsed)) {
      impSaveAnchor(parsed.dayOfYear, parsed.hour, 0);
    }
    if (!impState.pending) return false;
    if (Date.now() - impState.startMs > IMP_REQUEST_TIMEOUT_MS + 200) return false;
    if (!ownImp) {
      if (isLikelyIshtarCzasLine(sanitized)) {
        impClearPending();
        setTimeout(function () {
          printLines(["[imperium_cal] Otrzymano czas Ishtar - postac jest w domenie Ishtar.", "Uzyj /ishtar zamiast /imperium."]);
          // Wariant A: raport zadanej domeny z jej wlasnej zapisanej daty (bez
          // delt miedzy domenami). Brak zapisanej daty -> komunikat S6.
          var anchor = impLoadAnchor();
          var now = anchor ? impExtrapolate(anchor, Date.now()) : null;
          if (now && impValidTime(now)) {
            printLines(["[imperium_cal] Pokazuje Imperium wyliczone z zapisanej daty (ostatni odczyt: " + formatRealDate(new Date(anchor.rlTimestampMs)) + ")."]);
            impRunReport(now);
          } else {
            printLines(IMP_MSG_CROSS_NO_ANCHOR);
          }
        }, 0);
        return 'cross';
      }
      return false;
    }
    if (!impValidTime(parsed)) {
      if (impTryAnchorFallback()) return true;
      impClearPending();
      printLines(IMP_MSG_GN_COLDSTART);
      return true;
    }
    // Kotwica zostala juz zapisana w bloku O1 powyzej.
    impClearPending();
    setTimeout(function () { impRunReport(parsed); }, 0);
    return true;
  }

  function impResetAnchor() {
    impClearAnchor();
    printLines(IMP_MSG_RESET_DONE);
  }

  function impShowHelp() {
    printLines([
      'Kalendarz Imperium v' + EXT_VERSION + ' | ' + EXT_DATE,
      '',
      "Wylicza przyblizony czas do najblizszych wydarzen ksiezycowych,",
      "sezonowych i swiat w domenie Imperium, bazujac na komendzie 'czas'.",
      '',
      'Komendy:',
      '  /imperium          - oblicza i wyswietla wyniki',
      '  /imperium help     - ta pomoc',
      '  /imperium pomoc    - ta pomoc',
      '  /imperium reset    - czysci zapamietana date (kotwice)',
      '',
      'Wyniki: najblizszy now i pelnia (Mannslieb), wydarzenie sezonowe,',
      'swieta interkalarne. Hexentag, Hexennacht, Geheimnisnacht oraz now',
      'sa wyroznianie ***. Jesli event trwa - TRWA TERAZ z godzina konca.',
      '',
      'Dla nowiu pokazywana jest godzina widocznosci sierpa po zachodzie.',
      '',
      'Przeliczenie: 120 sekund RL = 1 godzina IG (przyblizenie).',
      '',
      "Jesli nie uda sie odczytac 'czas', plugin liczy z zapisanej daty lub wyswietli komunikat.",
      "Po komunikacie o innej domenie pokazuje raport z zapisanej daty (jesli ja ma) lub informuje o jej braku.",
    ]);
  }

  // =========================================================================
  // ISHTAR MODULE
  // =========================================================================

  var ISH_REAL_SECONDS_PER_GAME_MINUTE = 2;
  var ISH_GAME_MINUTES_PER_DAY         = 24 * 60;
  var ISH_DAYS_PER_SEASON              = 45;
  var ISH_SEASONS = ['Saovine','Yule','Imbaelk','Birke','Blathe','Feainn','Lammas','Velen']  // rok od 1 Saovine (paritet z ishtar_cal 1.8.12m);
  var ISH_DAYS_PER_YEAR                = ISH_SEASONS.length * ISH_DAYS_PER_SEASON;
  var ISH_ANCHOR_KEY                   = 'www.ishtar_cal.anchor.v2';
  var ISH_REQUEST_TIMEOUT_MS           = 3500;
  var ISH_YEAR_TOTAL_GAME_MINUTES      = ISH_DAYS_PER_YEAR * ISH_GAME_MINUTES_PER_DAY;
  var ISH_HOLIDAY_WINDOW_GAME_MINUTES  = 24 * 60;
  var ISH_BELLETEYN_DOY                = 180  // ostatni dzien Birke (rok od 1 Saovine);
  var ISH_EYSENLAAN_START_DOM          = 6;
  var ISH_EYSENLAAN_DAYS               = 3;
  var ISH_MAX_EYSENLAAN                = 2;

  var ISH_SUNSET = { Yule:16, Imbaelk:18, Birke:19, Blathe:21, Feainn:20, Lammas:20, Velen:18, Saovine:17 };

  function ishClampDoy(doy) {
    if (!Number.isFinite(doy)) return 1;
    return Math.max(1, Math.min(ISH_DAYS_PER_YEAR, Math.floor(doy)));
  }

  function ishSeasonOf(doy) {
    return ISH_SEASONS[Math.floor((ishClampDoy(doy) - 1) / ISH_DAYS_PER_SEASON)];
  }

  function ishDuskH(doy) { return ISH_SUNSET[ishSeasonOf(doy)]; }

  function ishSeasonIdxOf(season) {
    var key = String(season).toLowerCase();
    return ISH_SEASONS.findIndex(function (s) { return s.toLowerCase() === key; });
  }

  function ishBoundaryStartDoy(season) {
    var idx = ishSeasonIdxOf(season);
    if (idx < 0) return 1;
    var prev = (idx - 1 + ISH_SEASONS.length) % ISH_SEASONS.length;
    return prev * ISH_DAYS_PER_SEASON + ISH_DAYS_PER_SEASON;
  }

  function ishMomentToMin(doy, h, m) {
    return (ishClampDoy(doy) - 1) * ISH_GAME_MINUTES_PER_DAY + h * 60 + m;
  }

  function ishDmToMs(dm) { return dm * ISH_REAL_SECONDS_PER_GAME_MINUTE * 1000; }

  // --- Full moon windows ---

  var ISH_FULL_MOON_WINDOWS = [
    {s:49,e:51},{s:73,e:75},{s:97,e:99},{s:121,e:123},{s:145,e:147},
    {s:169,e:171},{s:193,e:195},{s:217,e:219},{s:241,e:243},{s:267,e:269},
    {s:289,e:291},{s:313,e:315},{s:337,e:339},{s:1,e:3},{s:25,e:27},
  ].map(function (w) {
    return { startDay: ishClampDoy(w.s), endDay: ishClampDoy(w.e) };
  }).filter(function (w) { return w.endDay > w.startDay; });

  var ISH_FULL_MOON_STARTS = ISH_FULL_MOON_WINDOWS.map(function (w) {
    return {
      startDay:          w.startDay,
      startMinuteOfYear: ishMomentToMin(w.startDay, 0, 0),
      windowMinutes:     (w.endDay - w.startDay) * ISH_GAME_MINUTES_PER_DAY,
    };
  }).sort(function (a, b) { return a.startMinuteOfYear - b.startMinuteOfYear; });

  // --- Holiday definitions ---

  function ishBuildHolidays() {
    var defs = [];
    function addBoundary(id, name, kind, season, emphasize) {
      var startDoy = ishBoundaryStartDoy(season);
      defs.push({ id:id, name:name, kind:kind, startDayOfYear:startDoy, startHour:ishDuskH(startDoy), startMinute:0, emphasize:!!emphasize, windowGameMinutes:ISH_HOLIDAY_WINDOW_GAME_MINUTES });
    }
    function addFixed(id, name, kind, doy, emphasize) {
      var startDoy = ishClampDoy(doy);
      defs.push({ id:id, name:name, kind:kind, startDayOfYear:startDoy, startHour:ishDuskH(startDoy), startMinute:0, emphasize:!!emphasize, windowGameMinutes:ISH_HOLIDAY_WINDOW_GAME_MINUTES });
    }
    addBoundary('midinvaerne','Midinvaerne','astronomiczne','Yule');
    addBoundary('birke',      'Birke',      'astronomiczne','Birke');
    addBoundary('midaete',    'Midaete',    'astronomiczne','Feainn');
    addBoundary('velen',      'Velen',      'astronomiczne','Velen');
    addBoundary('imbaelk',    'Imbaelk',    'magiczne',     'Imbaelk');
    addFixed(   'belleteyn',  'Belleteyn',  'magiczne',     ISH_BELLETEYN_DOY, true);
    addBoundary('lammas',     'Lammas',     'magiczne',     'Lammas');
    addBoundary('saovine',    'Saovine',    'magiczne',     'Saovine', true);
    return defs;
  }

  var ISH_HOLIDAYS = ishBuildHolidays();

  // --- Occurrence computation ---

  function ishIsWithinWindow(nowMin, startMin, winMin, yearMin) {
    var end = startMin + winMin;
    if (end <= yearMin) return nowMin >= startMin && nowMin < end;
    var endW = end - yearMin;
    return nowMin >= startMin || nowMin < endW;
  }

  function ishMinUntilEnd(nowMin, startMin, winMin, yearMin) {
    if (winMin <= 0) return 0;
    var end = startMin + winMin;
    if (end <= yearMin) return Math.max(0, end - nowMin);
    var endW = end - yearMin;
    if (nowMin >= startMin) return yearMin - nowMin + endW;
    return Math.max(0, endW - nowMin);
  }

  function ishMakeOcc(def, nowMin, startMin, yearMin) {
    var active = ishIsWithinWindow(nowMin, startMin, def.windowGameMinutes, yearMin);
    var deltaToStart = startMin - nowMin;
    if (deltaToStart < 0) deltaToStart += yearMin;
    if (active) {
      var untilEnd = ishMinUntilEnd(nowMin, startMin, def.windowGameMinutes, yearMin);
      var sinceStart = (def.windowGameMinutes - untilEnd) % yearMin;
      return { def:def, deltaToStartGameMinutes:0, realStartDate:new Date(Date.now() - ishDmToMs(sinceStart)), activeNow:true, gameMinutesUntilEnd:untilEnd };
    }
    return { def:def, deltaToStartGameMinutes:deltaToStart, realStartDate:new Date(Date.now() + ishDmToMs(deltaToStart)), activeNow:false, gameMinutesUntilEnd:0 };
  }

  function ishComputeFixed(def, nowMin) {
    var start = ishMomentToMin(ishClampDoy(def.startDayOfYear), def.startHour, def.startMinute);
    return ishMakeOcc(def, nowMin, start, ISH_YEAR_TOTAL_GAME_MINUTES);
  }

  function ishComputeFullMoon(now) {
    var nowMin = ishMomentToMin(now.dayOfYear, now.hours, now.minutes);
    var base   = { id:'pelnia', name:'Pelnia ksiezyca', kind:'ksiezycowe', startDayOfYear:1, startHour:0, startMinute:0, emphasize:true, windowGameMinutes:0 };
    for (var i = 0; i < ISH_FULL_MOON_STARTS.length; i++) {
      var w = ISH_FULL_MOON_STARTS[i];
      var occ = ishMakeOcc(Object.assign({}, base, { startDayOfYear:w.startDay, windowGameMinutes:w.windowMinutes }), nowMin, w.startMinuteOfYear, ISH_YEAR_TOTAL_GAME_MINUTES);
      if (occ.activeNow) return occ;
    }
    var best = null, bestDelta = Infinity;
    for (var j = 0; j < ISH_FULL_MOON_STARTS.length; j++) {
      var w2 = ISH_FULL_MOON_STARTS[j];
      var d = w2.startMinuteOfYear - nowMin;
      if (d < 0) d += ISH_YEAR_TOTAL_GAME_MINUTES;
      if (d < bestDelta) { bestDelta = d; best = w2; }
    }
    if (!best) return ishComputeFixed(Object.assign({}, base, { windowGameMinutes:0 }), nowMin);
    return ishMakeOcc(Object.assign({}, base, { startDayOfYear:best.startDay, windowGameMinutes:best.windowMinutes }), nowMin, best.startMinuteOfYear, ISH_YEAR_TOTAL_GAME_MINUTES);
  }

  function ishComputeEysenlaanFairs(now) {
    var today  = ishClampDoy(now.dayOfYear);
    var nowMin = ishMomentToMin(today, now.hours, now.minutes);
    var si     = Math.floor((today - 1) / ISH_DAYS_PER_SEASON);
    var dom    = ((today - 1) % ISH_DAYS_PER_SEASON) + 1;
    var curStart  = si * ISH_DAYS_PER_SEASON + 1;
    var nextSi    = (si + 1) % ISH_SEASONS.length;
    var nextStart = nextSi * ISH_DAYS_PER_SEASON + 1;
    var first  = dom <= ISH_EYSENLAAN_START_DOM + ISH_EYSENLAAN_DAYS - 1
      ? curStart  + (ISH_EYSENLAAN_START_DOM - 1)
      : nextStart + (ISH_EYSENLAAN_START_DOM - 1);
    var firstSi = Math.floor((ishClampDoy(first) - 1) / ISH_DAYS_PER_SEASON);
    var second  = ((firstSi + 1) % ISH_SEASONS.length) * ISH_DAYS_PER_SEASON + 1 + (ISH_EYSENLAAN_START_DOM - 1);
    var baseDef = { id:'festyn_eysenlaan', name:'Festyn w Eysenlaan', kind:'lokalne', startDayOfYear:1, startHour:0, startMinute:0, emphasize:true, windowGameMinutes:ISH_EYSENLAAN_DAYS * ISH_GAME_MINUTES_PER_DAY };
    return [first, second].map(function (d) {
      var day = ishClampDoy(d);
      var def = Object.assign({}, baseDef, { startDayOfYear: day });
      return ishMakeOcc(def, nowMin, ishMomentToMin(day, 0, 0), ISH_YEAR_TOTAL_GAME_MINUTES);
    }).sort(function (a, b) { return a.deltaToStartGameMinutes - b.deltaToStartGameMinutes; })
      .slice(0, ISH_MAX_EYSENLAAN);
  }

  function ishComputeAll(now) {
    var nowMin = ishMomentToMin(now.dayOfYear, now.hours, now.minutes);
    var all = ISH_HOLIDAYS.map(function (def) { return ishComputeFixed(def, nowMin); });
    all.push(ishComputeFullMoon(now));
    var fairs = ishComputeEysenlaanFairs(now);
    fairs.forEach(function (f) { all.push(f); });
    return all.sort(function (a, b) { return a.deltaToStartGameMinutes - b.deltaToStartGameMinutes; });
  }

  function ishMerge(occs) {
    var fixedMap = new Map(), multi = [];
    occs.forEach(function (o) {
      var isMulti = o.def.id === 'festyn_eysenlaan';
      var item = {
        id: isMulti ? o.def.id + '|' + o.deltaToStartGameMinutes : o.def.id,
        name: o.def.name, kind: o.def.kind, emphasize: Boolean(o.def.emphasize),
        deltaToStartGameMinutes: o.deltaToStartGameMinutes, realStartDate: o.realStartDate,
        activeNow: o.activeNow, windowGameMinutes: o.def.windowGameMinutes, gameMinutesUntilEnd: o.gameMinutesUntilEnd,
      };
      if (isMulti) { multi.push(item); return; }
      var existing = fixedMap.get(o.def.id);
      if (existing && existing.deltaToStartGameMinutes <= o.deltaToStartGameMinutes) return;
      fixedMap.set(o.def.id, item);
    });
    return Array.from(fixedMap.values()).concat(multi).sort(function (a, b) { return a.deltaToStartGameMinutes - b.deltaToStartGameMinutes; });
  }

  function ishFormatDelta(ms) {
    var totalMin = Math.max(0, Math.round(ms / 60000));
    var d = Math.floor(totalMin / 1440);
    var r = totalMin - d * 1440;
    return d + 'd ' + pad2(Math.floor(r / 60)) + 'h ' + pad2(r % 60) + 'm';
  }

  function ishKindLabel(kind) {
    if (kind === 'astronomiczne') return 'swieto astronomiczne';
    if (kind === 'magiczne')      return 'swieto magiczne';
    if (kind === 'lokalne')       return 'festyn';
    return 'wydarzenie ksiezycowe';
  }

  function ishFormatEventLines(item) {
    var clean = item.name.trim().replace(/\s+/g, ' ');
    var label = ishKindLabel(item.kind);
    var lines = [];
    lines.push(item.emphasize ? '  *** ' + clean + ' (' + label + ') ***' : '  ' + clean + ' (' + label + ')');
    if (item.activeNow) {
      if (item.windowGameMinutes > 0) {
        lines.push('    TRWA TERAZ (do ' + formatRealDate(new Date(Date.now() + ishDmToMs(item.gameMinutesUntilEnd))) + ')');
      } else { lines.push('    TRWA TERAZ'); }
      return lines;
    }
    var dms = item.realStartDate.getTime() - Date.now();
    if (item.windowGameMinutes > 0 && item.kind === 'lokalne') {
      lines.push('    Od:      ' + formatRealDate(item.realStartDate));
      lines.push('    Do:      ' + formatRealDate(new Date(item.realStartDate.getTime() + ishDmToMs(item.windowGameMinutes))));
      lines.push('    Za:      ' + ishFormatDelta(dms));
    } else {
      lines.push('    Data RL: ' + formatRealDate(item.realStartDate));
      lines.push('    Za:      ' + ishFormatDelta(dms));
    }
    return lines;
  }

  function ishFormatMainMagic(item) {
    var clean = item.name.trim().replace(/\s+/g, ' ');
    var lines = [];
    lines.push(item.id === 'belleteyn' ? '  *** ' + clean + ' (dzien ' + ISH_BELLETEYN_DOY + ') ***' : '  *** ' + clean + ' ***');
    if (item.activeNow) {
      if (item.windowGameMinutes > 0) {
        lines.push('    TRWA TERAZ (do ' + formatRealDate(new Date(Date.now() + ishDmToMs(item.gameMinutesUntilEnd))) + ')');
      } else { lines.push('    TRWA TERAZ'); }
      return lines;
    }
    var dms = item.realStartDate.getTime() - Date.now();
    lines.push('    Data RL: ' + formatRealDate(item.realStartDate));
    lines.push('    Za:      ' + ishFormatDelta(dms));
    return lines;
  }

  function ishBuildResultText(now) {
    var upcoming  = ishMerge(ishComputeAll(now));
    var mainMagic = [], other = [];
    upcoming.forEach(function (item) {
      if (item.kind === 'magiczne' && item.emphasize) mainMagic.push(item);
      else other.push(item);
    });
    var lines = ['Glowne swieta magiczne:'];
    mainMagic.forEach(function (item) { ishFormatMainMagic(item).forEach(function (l) { lines.push(l); }); });
    lines.push('');
    lines.push('Inne najblizsze wydarzenia:');
    other.forEach(function (ev) { ishFormatEventLines(ev).forEach(function (l) { lines.push(l); }); });
    return lines.join('\n');
  }

  var ISH_MSG_INTERNAL = '[ishtar_cal] Blad wewnetrzny kalendarza Ishtar - nie mozna wyliczyc danych.';
  var ISH_MSG_TIMEOUT  = "[ishtar_cal] Brak odpowiedzi na komende 'czas' (timeout) i nie mam zapamietanej daty.\n" +
                         "Sprawdz, czy 'czas' dziala, i sprobuj ponownie.";
  var ISH_MSG_CROSS_NO_ANCHOR = "[ishtar_cal] Nie mam zapamietanej daty domeny Ishtar - nie moge wyliczyc raportu.\n" +
                                "Bedac w domenie Ishtar, uzyj komendy /ishtar - odczyt zapisze date na przyszlosc.";
  var ISH_MSG_RESET_DONE = "[ishtar_cal] Kotwica Ishtar wyczyszczona. Uzyj /ishtar na zewnatrz, zeby zapisac nowa.";

  // --- Parsing ---

  function isLikelyIshtarCzasLine(raw) {
    var lc = raw.toLowerCase();
    return lc.startsWith('jest w przyblizeniu') && lc.includes('wedlug rachuby czasu starszego ludu');
  }

  var ISH_ORD_UNITS = {
    pierwszy:1,pierwsza:1,pierwsze:1, drugi:2,druga:2,drugie:2, trzeci:3,trzecia:3,trzecie:3,
    czwarty:4,czwarta:4,czwarte:4, piaty:5,piata:5,piate:5, szosty:6,szosta:6,szoste:6,
    siodmy:7,siodma:7,siodme:7, osmy:8,osma:8,osme:8, dziewiaty:9,dziewiata:9,dziewiate:9,
    dziesiaty:10,dziesiata:10,dziesiate:10, jedenasty:11,jedenasta:11,jedenaste:11,
    dwunasty:12,dwunasta:12,dwunaste:12, trzynasty:13,trzynasta:13,trzynaste:13,
    czternasty:14,czternasta:14,czternaste:14, pietnasty:15,pietnasta:15,pietnaste:15,
    szesnasty:16,szesnasta:16,szesnaste:16, siedemnasty:17,siedemnasta:17,siedemnaste:17,
    osiemnasty:18,osiemnasta:18,osiemnaste:18, dziewietnasty:19,dziewietnasta:19,dziewietnaste:19,
  };
  var ISH_ORD_TENS = {
    dwudziesty:20,dwudziesta:20,dwudzieste:20,
    trzydziesty:30,trzydziesta:30,trzydzieste:30,
    czterdziesty:40,czterdziesta:40,czterdzieste:40,
  };

  function ishParseOrdinal(words) {
    var w = words.trim().toLowerCase();
    if (ISH_ORD_UNITS[w]) return ISH_ORD_UNITS[w];
    if (ISH_ORD_TENS[w])  return ISH_ORD_TENS[w];
    var parts = w.split(/[\s-]+/);
    if (parts.length === 2) {
      var t = ISH_ORD_TENS[parts[0]], u = ISH_ORD_UNITS[parts[1]];
      if (typeof t === 'number' && typeof u === 'number') return t + u;
    }
    return null;
  }

  var ISH_HOUR_WORDS = {
    polnoc:0, pierwsza:1, druga:2, trzecia:3, czwarta:4, piata:5,
    szosta:6, siodma:7, osma:8, dziewiata:9, dziesiata:10,
    jedenasta:11, dwunasta:12, poludnie:12,
  };

  function ishParseHour(line) {
    var m = line.toLowerCase().match(
      /^jest w przyblizeniu (\w+)(?: (?:|w|po|przed|nad|poznym)\s*(dzien|nocy|poludniu|poludniem|poludnie|rano|ranem|wieczorem))?/
    );
    if (!m) return null;
    var v = ISH_HOUR_WORDS[m[1]];
    if (typeof v !== 'number') return null;
    var dt = m[2] || '';
    var h = v;
    if (dt === 'poludniu' || dt === 'wieczorem' || (dt === 'nocy' && v >= 6)) h += 12;
    if (h > 23) h = 0;
    return h;
  }

  function ishParseCzas(line) {
    var hours = ishParseHour(line);
    if (hours === null) return null;
    var alt = ISH_SEASONS.join('|');
    var mNum = line.match(new RegExp('\\b(\\d{1,2})\\s*dzien\\s+pory\\s+(' + alt + ')\\b', 'i'));
    if (mNum) {
      var dom = Number(mNum[1]);
      if (!Number.isFinite(dom) || dom < 1 || dom > ISH_DAYS_PER_SEASON) return null;
      var si = ishSeasonIdxOf(mNum[2]);
      if (si < 0) return null;
      return { hours: hours, dayOfYear: si * ISH_DAYS_PER_SEASON + dom };
    }
    var mWord = line.match(new RegExp('\\b([a-z]+(?:[\\s-]+[a-z]+){0,2})\\s+dzien\\s+pory\\s+(' + alt + ')\\b', 'i'));
    if (mWord) {
      var dom2 = ishParseOrdinal(mWord[1]);
      if (!dom2 || dom2 < 1 || dom2 > ISH_DAYS_PER_SEASON) return null;
      var si2 = ishSeasonIdxOf(mWord[2]);
      if (si2 < 0) return null;
      return { hours: hours, dayOfYear: si2 * ISH_DAYS_PER_SEASON + dom2 };
    }
    var lc = line.toLowerCase();
    for (var i = 0; i < ISH_HOLIDAYS.length; i++) {
      var holiday = ISH_HOLIDAYS[i];
      if (new RegExp('\\b' + holiday.name.toLowerCase() + '\\b', 'i').test(lc)) {
        return { hours: hours, dayOfYear: holiday.startDayOfYear };
      }
    }
    return null;
  }

  // --- Anchor ---

  function ishSaveAnchor(doy, hour, minute) {
    try {
      window.localStorage.setItem(ISH_ANCHOR_KEY, JSON.stringify({
        scheme:       'saovine',
        dayOfYear:    Math.max(1, Math.min(ISH_DAYS_PER_YEAR, Math.floor(doy))),
        hour:         Math.max(0, Math.min(23, Math.floor(hour))),
        minute:       Math.max(0, Math.min(59, Math.floor(minute))),
        rlTimestampMs: Date.now(),
      }));
    } catch (e) { }
  }

  function ishLoadAnchor() {
    try {
      var raw = window.localStorage.getItem(ISH_ANCHOR_KEY);
      if (!raw) return null;
      var p = JSON.parse(raw);
      if (!p || typeof p !== 'object') return null;
      // Rekord bez zgodnego scheme (np. zapis legacy) - ignoruj.
      if (p.scheme !== 'saovine') return null;
      var dayOfYear    = Number(p.dayOfYear);
      var hour         = Number(p.hour);
      var minute       = Number(p.minute);
      var rlTimestampMs = Number(p.rlTimestampMs);
      if (!Number.isFinite(dayOfYear)||!Number.isFinite(hour)||!Number.isFinite(minute)||!Number.isFinite(rlTimestampMs)) return null;
      if (dayOfYear<1||dayOfYear>ISH_DAYS_PER_YEAR||hour<0||hour>23||minute<0||minute>59||rlTimestampMs<=0) return null;
      return { scheme:'saovine', dayOfYear:dayOfYear, hour:hour, minute:minute, rlTimestampMs:rlTimestampMs };
    } catch (e) { return null; }
  }

  function ishClearAnchor() {
    try { window.localStorage.removeItem(ISH_ANCHOR_KEY); } catch (e) { }
  }

  function ishExtrapolate(anchor, nowMs) {
    var elapsed = nowMs - anchor.rlTimestampMs;
    if (!Number.isFinite(elapsed) || elapsed < 0) return null;
    var elGameMin = Math.floor(elapsed / (ISH_REAL_SECONDS_PER_GAME_MINUTE * 1000));
    var yt  = ISH_DAYS_PER_YEAR * ISH_GAME_MINUTES_PER_DAY;
    var at  = (anchor.dayOfYear - 1) * ISH_GAME_MINUTES_PER_DAY + anchor.hour * 60 + anchor.minute;
    var nt  = (((at + elGameMin) % yt) + yt) % yt;
    var rem = nt % ISH_GAME_MINUTES_PER_DAY;
    return {
      dayOfYear: Math.max(1, Math.min(ISH_DAYS_PER_YEAR, Math.floor(nt / ISH_GAME_MINUTES_PER_DAY) + 1)),
      hours:     Math.max(0, Math.min(23, Math.floor(rem / 60))),
      minutes:   rem % 60,
    };
  }

  // --- State + handlers ---

  var ishState = { pending: false, startMs: 0, timerId: null };

  function ishClearPending() {
    ishState.pending = false;
    ishState.startMs = 0;
    if (ishState.timerId) { clearTimeout(ishState.timerId); ishState.timerId = null; }
  }

  function ishRunReport(now) {
    try { printWrapped(ishBuildResultText(now)); } catch (e) { printWrapped(ISH_MSG_INTERNAL); }
  }

  function ishTryAnchorFallback() {
    if (!ishState.pending) return false;
    var anchor = ishLoadAnchor();
    if (!anchor) return false;
    var now = ishExtrapolate(anchor, Date.now());
    if (!now || !Number.isFinite(now.dayOfYear) || now.dayOfYear < 1 || now.dayOfYear > ISH_DAYS_PER_YEAR) return false;
    ishClearPending();
    printWrapped("[ishtar_cal] Pokazuje Ishtar wyliczone z zapisanej daty (ostatni odczyt: " + formatRealDate(new Date(anchor.rlTimestampMs)) + ").");
    ishRunReport({ dayOfYear: now.dayOfYear, hours: now.hours, minutes: now.minutes });
    return true;
  }

  function ishOnTimeout() {
    if (!ishState.pending) return;
    if (ishTryAnchorFallback()) return;
    ishClearPending();
    printWrapped(ISH_MSG_TIMEOUT);
  }

  function ishStart() {
    if (ishState.pending) return;
    ishState.pending = true;
    ishState.startMs = Date.now();
    ishState.timerId = setTimeout(ishOnTimeout, ISH_REQUEST_TIMEOUT_MS + 50);
    _origInput('czas');
  }

  function ishHandleLine(sanitized) {
    // O1: kazda poprawnie sparsowana wlasna linia 'czas' zapisuje kotwice,
    // takze bez oczekujacego zapytania (pasywny zapis, paritet z Dargoth).
    var ownIsh = isLikelyIshtarCzasLine(sanitized);
    var parsed = ownIsh ? ishParseCzas(sanitized) : null;
    if (ownIsh && parsed) {
      ishSaveAnchor(parsed.dayOfYear, parsed.hours, 0);
    }
    if (!ishState.pending) return false;
    if (Date.now() - ishState.startMs > ISH_REQUEST_TIMEOUT_MS + 200) return false;
    if (!ownIsh) {
      if (isLikelyImperiumCzasLine(sanitized)) {
        ishClearPending();
        setTimeout(function () {
          printWrapped("[ishtar_cal] Otrzymano czas Imperium - postac jest w domenie Imperium.\nUzyj /imperium zamiast /ishtar.");
          // Wariant A: raport zadanej domeny z jej wlasnej zapisanej daty (bez
          // delt miedzy domenami). Brak zapisanej daty -> komunikat S6.
          var anchor = ishLoadAnchor();
          var now = anchor ? ishExtrapolate(anchor, Date.now()) : null;
          if (now && Number.isFinite(now.dayOfYear) && now.dayOfYear >= 1 && now.dayOfYear <= ISH_DAYS_PER_YEAR) {
            printWrapped("[ishtar_cal] Pokazuje Ishtar wyliczone z zapisanej daty (ostatni odczyt: " + formatRealDate(new Date(anchor.rlTimestampMs)) + ").");
            ishRunReport({ dayOfYear: now.dayOfYear, hours: now.hours, minutes: now.minutes });
          } else {
            printWrapped(ISH_MSG_CROSS_NO_ANCHOR);
          }
        }, 0);
        return 'cross';
      }
      return false;
    }
    if (!parsed) return false;
    // Kotwica zostala juz zapisana w bloku O1 powyzej.
    ishClearPending();
    setTimeout(function () { ishRunReport({ dayOfYear: parsed.dayOfYear, hours: parsed.hours, minutes: 0 }); }, 0);
    return true;
  }

  function ishResetAnchor() {
    ishClearAnchor();
    printWrapped(ISH_MSG_RESET_DONE);
  }

  function ishShowHelp() {
    printWrapped([
      'Kalendarz Ishtar v' + EXT_VERSION + ' | ' + EXT_DATE,
      '',
      "Wylicza przyblizony czas do najblizszych swiat astronomicznych i magicznych",
      "w domenie Ishtar, bazujac na odpowiedzi serwera na komende 'czas'.",
      '',
      'Komendy:',
      '  /ishtar          - oblicza i wyswietla wyniki',
      '  /ishtar help     - ta pomoc',
      '  /ishtar pomoc    - ta pomoc',
      '  /ishtar reset    - czysci zapamietana date (kotwice)',
      '',
      'Swieta liczone cyklicznie w kalendarzu Ishtar (360 dni arkowych).',
      'Godziny wschodu i zachodu slonca ustalone empirycznie dla kazdego savoedu.',
      'Belleteyn, pelnia oraz festyn w Eysenlaan wyroznianie trzema gwiazdkami.',
      'Jesli event trwa - wyswietlany jest komunikat TRWA TERAZ z godzina konca.',
      '',
      'Pelnia: na podstawie stalej listy empirycznych zakresow (okno 2 dni).',
      '',
      'Festyn w Eysenlaan: kazdy savoed, 6.-8. dzien (wlacznie).',
      'Pokazywane sa 2 najblizsze wystapienia.',
      '',
      'Przeliczenie: 120 sekund RL = 1 godzina IG (przyblizenie).',
      '',
      "Jesli nie uda sie odczytac 'czas', plugin liczy z zapisanej daty lub wyswietli komunikat.",
      "Po komunikacie o innej domenie pokazuje raport z zapisanej daty (jesli ja ma) lub informuje o jej braku.",
    ].join('\n'));
  }

  // =========================================================================
  // HOOKS
  // =========================================================================

  var _origInput = Input.send;
  Input.send = function (cmd) {
    var t = (cmd || '').trim();
    if (/^\/imperium\s+reset$/i.test(t)) { impResetAnchor(); return; }
    if (/^\/ishtar\s+reset$/i.test(t)) { ishResetAnchor(); return; }
    var mImp = t.match(/^\/imperium(\s+(help|pomoc))?$/i);
    if (mImp) { if (mImp[1]) impShowHelp(); else impStart(); return; }
    var mIsh = t.match(/^\/ishtar(\s+(help|pomoc))?$/i);
    if (mIsh) { if (mIsh[1]) ishShowHelp(); else ishStart(); return; }
    _origInput(cmd);
  };

  var _origGmcp = Gmcp.parse_option_subnegotiation;
  Gmcp.parse_option_subnegotiation = function (match) {
    try {
      var prefix  = match.substring(0, 2);
      var postfix = match.substring(match.length - 2);
      var message = match.substring(2, match.length - 2);
      if (message.charCodeAt(0) === 0xC9) {
        var spaceIdx = message.indexOf(' ');
        if (spaceIdx > 0) {
          var type = message.substring(1, spaceIdx);
          if (type === 'gmcp_msgs') {
            var payload = JSON.parse(message.substring(spaceIdx));
            var text    = atob(payload.text);
            var lines   = text.split('\n');
            var kept    = [];
            for (var i = 0; i < lines.length; i++) {
              var line      = lines[i];
              var sanitized = sanitizeCzasLine(line);
              var suppress  = false;
              if (/jest w przyblizeniu/i.test(sanitized)) {
                var impR = impHandleLine(sanitized);
                if (impR) {
                  suppress = true;
                } else if (ishHandleLine(sanitized)) {
                  suppress = true;
                }
              }
              if (!suppress) kept.push(line);
            }
            if (kept.length !== lines.length) {
              try {
                payload.text = btoa(kept.join('\n'));
                match = prefix + '\xC9' + type + ' ' + JSON.stringify(payload) + postfix;
              } catch (e) { }
            }
          }
        }
      }
    } catch (e) { }
    return _origGmcp(match);
  };

  // =========================================================================
  // UPDATE CHECK
  // =========================================================================

  function versionNewer(remote, local) {
    var r = String(remote).split('.').map(Number);
    var l = String(local).split('.').map(Number);
    var len = Math.max(r.length, l.length);
    for (var i = 0; i < len; i++) {
      var a = r[i] || 0, b = l[i] || 0;
      if (a > b) return true;
      if (a < b) return false;
    }
    return false;
  }

  function showUpdateNotification(version, zipUrl) {
    if (window.__arkadia_update_active__) {
      document.addEventListener('arkadia_update_dismissed', function handler() {
        document.removeEventListener('arkadia_update_dismissed', handler);
        showUpdateNotification(version, zipUrl);
      }, { once: true });
      return;
    }
    if (document.getElementById('arkadia-cal-update')) return;
    window.__arkadia_update_active__ = true;

    function dismiss() {
      overlay.remove();
      window.__arkadia_update_active__ = false;
      document.dispatchEvent(new CustomEvent('arkadia_update_dismissed'));
    }

    var overlay = document.createElement('div');
    overlay.id = 'arkadia-cal-update';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;' +
      'z-index:99999;display:flex;align-items:center;justify-content:center;' +
      'background:rgba(0,0,0,0.6);';

    var box = document.createElement('div');
    box.style.cssText = 'background:#1a1a1a;border:2px solid #555;border-radius:8px;' +
      'padding:28px 36px;font-family:monospace;color:#e0e0e0;text-align:center;' +
      'box-shadow:0 8px 32px rgba(0,0,0,0.8);max-width:420px;width:90%;';

    var title = document.createElement('div');
    title.textContent = 'arkadia_cal';
    title.style.cssText = 'font-size:20px;font-weight:bold;color:#fff;margin-bottom:10px;';

    var msg = document.createElement('div');
    msg.textContent = 'Dostepna nowa wersja ' + version;
    msg.style.cssText = 'font-size:16px;color:#bbb;margin-bottom:6px;';

    var sub = document.createElement('div');
    sub.textContent = 'Pobierz ZIP, rozpakuj do tego samego folderu, odswiez rozszerzenie.';
    sub.style.cssText = 'font-size:12px;color:#888;margin-bottom:24px;';

    var row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:12px;justify-content:center;';

    var link = document.createElement('a');
    link.href = '#';
    link.textContent = 'Pobierz';
    link.style.cssText = 'background:#2a6496;color:#fff;padding:10px 28px;' +
      'border-radius:4px;text-decoration:none;font-size:15px;cursor:pointer;';
    link.addEventListener('click', function (e) {
      e.preventDefault();
      fetch(zipUrl)
        .then(function (r) { return r.blob(); })
        .then(function (blob) {
          var blobUrl = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = blobUrl;
          a.download = 'arkadia_cal.zip';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(function () { URL.revokeObjectURL(blobUrl); }, 1000);
          setTimeout(function () { dismiss(); }, 300);
        })
        .catch(function () {
          window.open(zipUrl);
          setTimeout(function () { dismiss(); }, 300);
        });
    });

    var btn = document.createElement('button');
    btn.textContent = 'Pozniej';
    btn.style.cssText = 'background:#333;border:1px solid #555;color:#aaa;' +
      'padding:10px 20px;border-radius:4px;font-size:15px;cursor:pointer;font-family:monospace;';
    btn.onclick = function () { dismiss(); };

    row.appendChild(link);
    row.appendChild(btn);
    box.appendChild(title);
    box.appendChild(msg);
    box.appendChild(sub);
    box.appendChild(row);
    overlay.appendChild(box);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) dismiss();
    });

    document.body.appendChild(overlay);
  }

  setTimeout(function () {
    fetch(UPDATE_URL, { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data && data.version && versionNewer(data.version, EXT_VERSION)) {
          var zipFile = data.zip || ('arkadia_cal_' + String(data.version).replace(/\./g, '_') + '.zip');
          showUpdateNotification(data.version, 'https://isithunzi000.github.io/www-arkadia_cal/' + zipFile);
        }
      })
      .catch(function () { });
  }, 1000);

})();
