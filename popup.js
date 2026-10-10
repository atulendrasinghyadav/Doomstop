/* popup.js — DoomStop popup logic.
 * Reads stats from background, displays today's summary,
 * toggle on/off, reset, and link to settings. */

(function () {
  'use strict';

  var enableToggle = document.getElementById('enableToggle');
  var totalTimeEl = document.getElementById('totalTime');
  var progressContainer = document.getElementById('progressContainer');
  var progressFill = document.getElementById('progressFill');
  var limitLabel = document.getElementById('limitLabel');
  var limitValue = document.getElementById('limitValue');
  var siteList = document.getElementById('siteList');
  var settingsLink = document.getElementById('settingsLink');

  var settings = null;

  async function init() {
    settings = await getSettings();

    // Set toggle state
    enableToggle.checked = settings.enabled;

    // Load and display stats
    await refreshStats();

    // Event listeners
    enableToggle.addEventListener('change', onToggle);
    settingsLink.addEventListener('click', function (e) {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    });
  }

  async function refreshStats() {
    var resp = await chrome.runtime.sendMessage({ type: 'getStats' });
    if (!resp) return;

    var totalSeconds = resp.totalSeconds || 0;
    totalTimeEl.textContent = formatMinutes(totalSeconds);

    // Progress bar (BR-48)
    if (settings.dailyMinutesLimit > 0) {
      progressContainer.style.display = '';
      var limitSec = settings.dailyMinutesLimit * 60;
      var pct = Math.min(100, (totalSeconds / limitSec) * 100);
      progressFill.style.width = pct + '%';

      // Amber at 80%
      if (pct >= 80) {
        progressFill.classList.add('amber');
      } else {
        progressFill.classList.remove('amber');
      }

      limitLabel.textContent = 'Limit';
      limitValue.textContent = settings.dailyMinutesLimit + ' min';
    } else {
      progressContainer.style.display = 'none';
    }

    // Site list (BR-49: sorted by time, highest first)
    var sites = resp.sites || {};
    var siteKeys = Object.keys(sites);

    if (siteKeys.length === 0) {
      siteList.textContent = '';
      var emptyEl = document.createElement('p');
      emptyEl.className = 'empty';
      emptyEl.textContent = 'No usage recorded today. Start browsing a watched site.';
      siteList.append(emptyEl);
    } else {
      // Sort by seconds descending
      siteKeys.sort(function (a, b) {
        return (sites[b].seconds || 0) - (sites[a].seconds || 0);
      });

      siteList.textContent = '';
      for (var i = 0; i < siteKeys.length; i++) {
        var key = siteKeys[i];
        var site = sites[key];
        var screens = Math.floor((site.px || 0) / PX_PER_SCREEN);
        var row = document.createElement('div');
        row.className = 'stat-row';

        var labelSpan = document.createElement('span');
        labelSpan.className = 'stat-label';
        labelSpan.textContent = key;

        var valueSpan = document.createElement('span');
        valueSpan.className = 'stat-value';
        valueSpan.textContent = formatMinutes(site.seconds || 0) + ', ' + screens + ' screens';

        row.append(labelSpan, valueSpan);
        siteList.append(row);
      }
    }
  }

  async function onToggle() {
    var enabled = enableToggle.checked;
    await chrome.storage.sync.set({ enabled: enabled });
    settings.enabled = enabled;
  }

  init();
})();
