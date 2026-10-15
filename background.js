/* background.js — DoomStop service worker.
 * Sole writer of daily stats. Stateless: everything persisted to storage. */

importScripts('defaults.js');

// ─── Serialised write queue ───
var _queue = Promise.resolve();
function enqueue(fn) {
  _queue = _queue.then(fn, fn);
  return _queue;
}

// ─── Read today's stats from storage ───
async function getTodayStats() {
  var data = await chrome.storage.local.get(['stats', 'lockoutUntil', 'blockCompleted']);
  var stats = data.stats || { date: todayKey(), sites: {} };
  var now = Date.now();
  var lockoutUntil = data.lockoutUntil || 0;
  var dateChanged = stats.date !== todayKey();
  var lockoutExpired = lockoutUntil > 0 && now >= lockoutUntil;

  if (dateChanged || lockoutExpired) {
    stats = { date: todayKey(), sites: {} };
    await chrome.storage.local.set({
      stats: stats,
      lockoutUntil: 0,
      blockCompleted: false
    });
    updateBadge(0);
  }
  var totalSeconds = 0;
  var totalPx = 0;
  var siteKeys = Object.keys(stats.sites);
  for (var i = 0; i < siteKeys.length; i++) {
    var s = stats.sites[siteKeys[i]];
    totalSeconds += (s.seconds || 0);
    totalPx += (s.px || 0);
  }
  return {
    date: stats.date,
    sites: stats.sites,
    totalSeconds: totalSeconds,
    totalPx: totalPx
  };
}

// ─── Update badge ───
function updateBadge(totalSeconds) {
  var text = formatTimeShort(totalSeconds);
  chrome.action.setBadgeText({ text: text });
  chrome.action.setBadgeBackgroundColor({ color: '#2a9d8f' });
}

// ─── Message handler ───
chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (msg.type === 'update') {
    enqueue(async function () {
      var seconds = Math.min(Math.max((msg.seconds | 0), 0), MAX_REPORT_SECONDS);
      var px = Math.max((msg.px | 0), 0);
      var rule = msg.rule;
      if (!rule || typeof rule !== 'string') {
        sendResponse(null);
        return;
      }

      var local = await chrome.storage.local.get(['lockoutUntil']);
      var now = Date.now();
      var lockout = local.lockoutUntil || 0;
      if (lockout > 0 && now < lockout) {
        var curStats = await getTodayStats();
        sendResponse(curStats);
        return;
      }

      var result = await getTodayStats();
      var sites = result.sites;

      if (!sites[rule]) {
        sites[rule] = { seconds: 0, px: 0 };
      }
      sites[rule].seconds += seconds;
      sites[rule].px += px;

      await chrome.storage.local.set({
        stats: { date: result.date, sites: sites }
      });

      var totalSeconds = 0;
      var totalPx = 0;
      var keys = Object.keys(sites);
      for (var i = 0; i < keys.length; i++) {
        totalSeconds += sites[keys[i]].seconds;
        totalPx += sites[keys[i]].px;
      }

      updateBadge(totalSeconds);
      sendResponse({ totalSeconds: totalSeconds, totalPx: totalPx, sites: sites });
    });
    return true;
  }

  if (msg.type === 'getStats') {
    getTodayStats().then(function (result) {
      sendResponse(result);
    });
    return true;
  }

  if (msg.type === 'resetToday') {
    enqueue(async function () {
      await chrome.storage.local.set({
        stats: { date: todayKey(), sites: {} },
        lockoutUntil: 0,
        blockCompleted: false
      });
      updateBadge(0);
      sendResponse({ ok: true });
    });
    return true;
  }

  if (msg.type === 'closeTab') {
    var tabId = sender.tab && sender.tab.id;
    var windowId = sender.tab && sender.tab.windowId;
    if (tabId && windowId) {
      chrome.tabs.query({ windowId: windowId }, function (tabs) {
        if (tabs && tabs.length <= 1) {
          chrome.tabs.create({ windowId: windowId }, function () {
            chrome.tabs.remove(tabId);
          });
        } else {
          chrome.tabs.remove(tabId);
        }
      });
    }
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === 'setLockout') {
    var lockoutVal = Math.max(Number(msg.lockoutUntil) || 0, 0);
    var blockCompletedVal = Boolean(msg.blockCompleted);
    chrome.storage.local.set({
      lockoutUntil: lockoutVal,
      blockCompleted: blockCompletedVal
    });
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === 'clearLockout') {
    enqueue(async function () {
      await chrome.storage.local.set({
        stats: { date: todayKey(), sites: {} },
        lockoutUntil: 0,
        blockCompleted: false
      });
      updateBadge(0);
      sendResponse({ ok: true });
    });
    return true;
  }

  if (msg.type === 'getLockout') {
    enqueue(async function () {
      var data = await chrome.storage.local.get(['lockoutUntil', 'blockCompleted']);
      var now = Date.now();
      var lockout = data.lockoutUntil || 0;
      if (lockout > 0 && now >= lockout) {
        await chrome.storage.local.set({
          stats: { date: todayKey(), sites: {} },
          lockoutUntil: 0,
          blockCompleted: false
        });
        updateBadge(0);
        sendResponse({
          lockoutUntil: 0,
          blockCompleted: false
        });
      } else {
        sendResponse({
          lockoutUntil: lockout,
          blockCompleted: Boolean(data.blockCompleted)
        });
      }
    });
    return true;
  }
});

// ─── Install / update handler ───
chrome.runtime.onInstalled.addListener(function (details) {
  if (details.reason === 'install') {
    var keys = Object.keys(DEFAULTS);
    chrome.storage.sync.get(keys).then(function (stored) {
      stored = stored || {};
      var toWrite = {};
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (stored[k] === undefined) {
          toWrite[k] = DEFAULTS[k];
        }
      }
      if (Object.keys(toWrite).length > 0) {
        chrome.storage.sync.set(toWrite);
      }
    });
    chrome.runtime.openOptionsPage();
  }
});

// ─── Refresh badge and ensure enabled on startup ───
chrome.storage.sync.get(['enabled'], function (stored) {
  if (stored && stored.enabled === false) {
    chrome.storage.sync.set({ enabled: true });
  }
});

getTodayStats().then(function (result) {
  updateBadge(result.totalSeconds);
});

