/* options.js — DoomStop settings page logic.
 * Loads settings, populates form, validates and saves on submit,
 * restores defaults. Opened automatically on first install. */

(function () {
  'use strict';

  var sitesInput = document.getElementById('sitesInput');
  var sessionScreenLimitInput = document.getElementById('sessionScreenLimit');
  var dailyMinutesLimitInput = document.getElementById('dailyMinutesLimit');
  var breakMinutesInput = document.getElementById('breakMinutes');
  var greyscaleEnabledInput = document.getElementById('greyscaleEnabled');
  var saveBtn = document.getElementById('saveBtn');
  var restoreBtn = document.getElementById('restoreBtn');
  var savedMsg = document.getElementById('savedMsg');

  async function init() {
    var settings = await getSettings();
    populateForm(settings);

    saveBtn.addEventListener('click', onSave);
    restoreBtn.addEventListener('click', onRestore);
  }

  function populateForm(settings) {
    sitesInput.value = settings.sites || '';
    sessionScreenLimitInput.value = settings.sessionScreenLimit;
    dailyMinutesLimitInput.value = settings.dailyMinutesLimit;
    breakMinutesInput.value = settings.breakMinutes;
    greyscaleEnabledInput.checked = settings.greyscaleEnabled;
  }

  // ─── Validate a number field, falling back to default (BR-43) ───
  function validNumber(value, min, max, defaultVal) {
    var n = parseInt(value, 10);
    if (isNaN(n) || n < min) return defaultVal;
    if (n > max) return max;
    return n;
  }

  async function onSave() {
    // Normalise and deduplicate sites (BR-44)
    var rulesArr = parseRules(sitesInput.value);
    var sitesText = rulesArr.join('\n');

    var toSave = {
      sites: sitesText,
      sessionScreenLimit: validNumber(
        sessionScreenLimitInput.value, 0, 1000, DEFAULTS.sessionScreenLimit),
      dailyMinutesLimit: validNumber(
        dailyMinutesLimitInput.value, 0, 1440, DEFAULTS.dailyMinutesLimit),
      breakMinutes: validNumber(
        breakMinutesInput.value, 1, 120, DEFAULTS.breakMinutes),
      greyscaleEnabled: greyscaleEnabledInput.checked
    };

    await chrome.storage.sync.set(toSave);

    // Update form with normalised values
    sitesInput.value = sitesText;
    sessionScreenLimitInput.value = toSave.sessionScreenLimit;
    dailyMinutesLimitInput.value = toSave.dailyMinutesLimit;
    breakMinutesInput.value = toSave.breakMinutes;

    showSaved();
  }

  // ─── Restore defaults (BR-45: everything except on/off switch) ───
  async function onRestore() {
    var current = await getSettings();
    var toWrite = {};
    var keys = Object.keys(DEFAULTS);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (k === 'enabled') continue; // BR-45: keep on/off
      toWrite[k] = DEFAULTS[k];
    }
    await chrome.storage.sync.set(toWrite);

    var restored = await getSettings();
    populateForm(restored);
    showSaved();
  }

  function showSaved() {
    savedMsg.classList.add('show');
    setTimeout(function () {
      savedMsg.classList.remove('show');
    }, 2000);
  }

  init();
})();
