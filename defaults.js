/* defaults.js — shared constants, defaults and pure helpers.
 * Loaded as a classic script by content.js, background.js, popup.js, options.js.
 * No ES module syntax. Everything is a top-level const/function. */

// ─── Constants ───
var PX_PER_SCREEN = 900;
var ACTIVE_WINDOW_MS = 15000;
var FLUSH_EVERY_TICKS = 5;
var MAX_REPORT_SECONDS = 60;
var MAX_JUMP_PX = 20000;
var LOCKOUT_DURATION_MS = 30 * 60 * 1000;

// ─── Default settings ───
var DEFAULTS = {
  enabled: true,
  sites:
    'reddit.com\n' +
    'x.com\n' +
    'twitter.com\n' +
    'instagram.com\n' +
    'facebook.com\n' +
    'tiktok.com\n' +
    'threads.net\n' +
    'youtube.com/shorts\n' +
    'linkedin.com/feed',
  sessionScreenLimit: 50,
  dailyMinutesLimit: 30,
  breakMinutes: 30,
  greyscaleEnabled: true,
  strictMode: false
};

// ─── Rule normalisation (BR-1) ───
function normaliseRule(raw) {
  var s = raw.trim().toLowerCase();
  s = s.replace(/^https?:\/\//, '');
  s = s.replace(/^www\./, '');
  s = s.replace(/\/+$/, '');
  return s;
}

// ─── Parse rules text into unique normalised array (BR-44) ───
function parseRules(text) {
  if (!text) return [];
  var seen = {};
  var result = [];
  var lines = text.split('\n');
  for (var i = 0; i < lines.length; i++) {
    var r = normaliseRule(lines[i]);
    if (r && !seen[r]) {
      seen[r] = true;
      result.push(r);
    }
  }
  return result;
}

// ─── Split a rule into host and path parts ───
function splitRule(rule) {
  var idx = rule.indexOf('/');
  if (idx === -1) return { host: rule, path: '' };
  return { host: rule.substring(0, idx), path: rule.substring(idx) };
}

// ─── Check whether any rule could match this hostname (BR-5) ───
function hostMayMatch(hostname, rules) {
  var h = hostname.toLowerCase().replace(/^www\./, '');
  for (var i = 0; i < rules.length; i++) {
    var rh = splitRule(rules[i]).host;
    if (h === rh || h.endsWith('.' + rh)) return true;
  }
  return false;
}

// ─── Find the first matching rule for hostname + pathname (BR-2, BR-3, BR-4) ───
function matchRule(hostname, pathname, rules) {
  var h = hostname.toLowerCase().replace(/^www\./, '');
  var p = pathname.toLowerCase();
  for (var i = 0; i < rules.length; i++) {
    var parts = splitRule(rules[i]);
    var hostMatch = (h === parts.host) || h.endsWith('.' + parts.host);
    if (!hostMatch) continue;
    if (parts.path === '') return rules[i];
    if (p === parts.path || p.startsWith(parts.path + '/')) {
      return rules[i];
    }
  }
  return null;
}

// ─── Today's date key (BR-17) ───
function todayKey() {
  var d = new Date();
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

// ─── Read settings merged over defaults ───
async function getSettings() {
  var keys = Object.keys(DEFAULTS);
  var stored = await chrome.storage.sync.get(keys);
  var result = {};
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    result[k] = stored[k] !== undefined ? stored[k] : DEFAULTS[k];
  }
  return result;
}

// ─── Format seconds into readable time ───
function formatMinutes(totalSeconds) {
  var m = Math.floor(totalSeconds / 60);
  if (m < 60) return m + ' min';
  var h = Math.floor(m / 60);
  var rem = m % 60;
  if (rem === 0) return h + ' hr';
  return h + ' hr ' + rem + ' min';
}

// ─── Short format for badge ───
function formatTimeShort(totalSeconds) {
  if (totalSeconds < 60) return '';
  return Math.floor(totalSeconds / 60) + 'm';
}

// ─── Numeric clamp ───
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// ─── Attach to global scope ───
if (typeof globalThis !== 'undefined') {
  globalThis.PX_PER_SCREEN = PX_PER_SCREEN;
  globalThis.ACTIVE_WINDOW_MS = ACTIVE_WINDOW_MS;
  globalThis.FLUSH_EVERY_TICKS = FLUSH_EVERY_TICKS;
  globalThis.MAX_REPORT_SECONDS = MAX_REPORT_SECONDS;
  globalThis.MAX_JUMP_PX = MAX_JUMP_PX;
  globalThis.LOCKOUT_DURATION_MS = LOCKOUT_DURATION_MS;
  globalThis.DEFAULTS = DEFAULTS;
  globalThis.normaliseRule = normaliseRule;
  globalThis.parseRules = parseRules;
  globalThis.splitRule = splitRule;
  globalThis.hostMayMatch = hostMayMatch;
  globalThis.matchRule = matchRule;
  globalThis.todayKey = todayKey;
  globalThis.getSettings = getSettings;
  globalThis.formatMinutes = formatMinutes;
  globalThis.formatTimeShort = formatTimeShort;
  globalThis.clamp = clamp;
}
