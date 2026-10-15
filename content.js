/* content.js — DoomStop content script.
 * Loaded after defaults.js as a classic script in the top frame only.
 * Handles: scroll/time tracking, greyscale fade, session pause overlay,
 * 30-minute lockout block overlay, post-break scroll re-blocking. */

(function () {
  'use strict';

  // Only run in top frame
  if (window !== window.top) return;

  // ─── State ───
  var settings = null;
  var rules = [];
  var currentRule = null;
  var sessionPx = 0;
  var unsentSeconds = 0;
  var unsentPx = 0;
  var totalSeconds = 0;
  var totalPx = 0;
  var tickCount = 0;
  var lastInputTime = 0;
  var overlayShowing = false;
  var overlayHost = null;
  var overlayType = null; // 'session' | 'lockout'
  var lockoutUntil = 0;
  var blockCompleted = false;
  var tickInterval = null;
  var scrollPositions = new WeakMap();
  var pausedMedia = [];
  var savedHtmlOverflow = '';
  var savedBodyOverflow = '';
  var savedBodyPointerEvents = '';
  var savedBodyUserSelect = '';
  var savedHtmlUserSelect = '';
  var countdownEl = null;
  var countdownInterval = null;
  var leaveBtn = null;
  var overlayObserver = null;

  var POINTER_BLOCK_EVENTS = [
    'click', 'dblclick', 'mousedown', 'mouseup', 'pointerdown', 'pointerup',
    'contextmenu', 'selectstart', 'wheel', 'touchmove', 'touchstart'
  ];

  var KEYBOARD_BLOCK_EVENTS = ['keydown', 'keyup', 'keypress'];

  // ─── Reset tracking state when block time completes or stats are reset ───
  function resetTracking() {
    sessionPx = 0;
    unsentSeconds = 0;
    unsentPx = 0;
    totalSeconds = 0;
    totalPx = 0;
    lockoutUntil = 0;
    blockCompleted = false;
    removeGreyscale();
  }

  // ─── DOM helper (safe node creation) ───
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      var keys = Object.keys(attrs);
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var val = attrs[key];
        if (key === 'textContent') node.textContent = val;
        else if (key === 'className') node.className = val;
        else if (key === 'onclick') node.addEventListener('click', val);
        else if (key === 'disabled' && val) node.setAttribute('disabled', '');
        else node.setAttribute(key, val);
      }
    }
    if (children) {
      for (var j = 0; j < children.length; j++) {
        if (!children[j]) continue;
        if (typeof children[j] === 'string') node.append(children[j]);
        else node.append(children[j]);
      }
    }
    return node;
  }

  // ─── Overlay CSS (constructable stylesheet for shadow root) ───
  function getOverlayCSS() {
    return [
      '.overlay-container {',
      '  all: initial !important;',
      '  position: fixed !important;',
      '  top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important;',
      '  display: flex !important; flex-direction: column !important;',
      '  align-items: center !important; justify-content: center !important;',
      '  background: rgba(26, 26, 46, 0.97) !important;',
      '  color: #f4f6f8 !important;',
      '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;',
      '  font-size: 16px !important; line-height: 1.5 !important;',
      '  z-index: 2147483647 !important;',
      '  text-align: center !important;',
      '  padding: 24px !important;',
      '  box-sizing: border-box !important;',
      '  cursor: not-allowed !important;',
      '  user-select: none !important;',
      '}',
      '.overlay-icon { font-size: 56px !important; margin-bottom: 16px !important; line-height: 1 !important; }',
      '.overlay-title {',
      '  font-size: 26px !important; font-weight: 700 !important; margin: 0 0 10px !important; color: #f4f6f8 !important;',
      '  font-family: inherit !important;',
      '}',
      '.overlay-subtitle {',
      '  font-size: 16px !important; margin: 0 0 20px !important; color: #d1d5db !important; max-width: 480px !important;',
      '  font-family: inherit !important;',
      '}',
      '.overlay-countdown {',
      '  font-size: 36px !important; font-weight: 700 !important; margin: 0 0 24px !important; color: #2a9d8f !important;',
      '  font-variant-numeric: tabular-nums !important; font-family: inherit !important;',
      '}',
      '.overlay-btn {',
      '  padding: 12px 28px !important; border: none !important; border-radius: 8px !important; font-size: 16px !important;',
      '  font-weight: 500 !important; cursor: pointer !important; margin: 6px !important; min-width: 180px !important;',
      '  font-family: inherit !important;',
      '  transition: background 0.2s, opacity 0.2s !important;',
      '}',
      '.overlay-btn:focus-visible {',
      '  outline: 2px solid #2a9d8f !important; outline-offset: 2px !important;',
      '}',
      '.overlay-btn-leave { background: #2a9d8f !important; color: #fff !important; }',
      '.overlay-btn-leave:hover { background: #1f7a6e !important; }',
      '.btn-row {',
      '  display: flex !important; flex-wrap: wrap !important; justify-content: center !important; gap: 12px !important; margin-top: 8px !important;',
      '}',
      '.breathe-ring {',
      '  width: 80px !important; height: 80px !important; border-radius: 50% !important;',
      '  border: 3px solid #2a9d8f !important;',
      '  animation: breathe 4s ease-in-out infinite !important;',
      '  margin: 0 auto 8px !important;',
      '}',
      '.breathe-label {',
      '  font-size: 14px !important; color: #d1d5db !important; margin: 0 0 24px !important; font-family: inherit !important;',
      '}',
      '@keyframes breathe {',
      '  0%, 100% { transform: scale(1); opacity: 0.6; }',
      '  50% { transform: scale(1.15); opacity: 1; }',
      '}',
      '@media (prefers-reduced-motion: reduce) {',
      '  .breathe-ring { animation: none !important; opacity: 1 !important; }',
      '  .overlay-btn { transition: none !important; }',
      '}'
    ].join('\n');
  }

  // ─── Safe message send ───
  async function safeSend(msg) {
    try {
      return await chrome.runtime.sendMessage(msg);
    } catch (e) {
      return null;
    }
  }

  // ─── Fast Lockout Check on Script Load (BR-26, BR-27) ───
  // Executes synchronously as script starts so reloaded pages (e.g. Instagram) block immediately.
  function fastLockoutCheck() {
    var hostname = location.hostname.toLowerCase().replace(/^www\./, '');
    chrome.storage.sync.get(['sites'], function (syncData) {
      var sitesText = (syncData && syncData.sites !== undefined) ? syncData.sites : DEFAULTS.sites;

      var parsedRules = parseRules(sitesText);
      if (!hostMayMatch(hostname, parsedRules)) return;
      var matched = matchRule(hostname, location.pathname, parsedRules);
      if (!matched) return;

      chrome.storage.local.get(['lockoutUntil', 'blockCompleted'], function (localData) {
        var now = Date.now();
        var storedLockout = (localData && localData.lockoutUntil) || 0;
        // If the time for the existing block has ended, clear it and reset doomscrolled time & screens
        if (storedLockout > 0 && now >= storedLockout) {
          resetTracking();
          chrome.storage.local.set({
            stats: { date: todayKey(), sites: {} },
            lockoutUntil: 0,
            blockCompleted: false
          });
          safeSend({ type: 'clearLockout' });
          return;
        }
        if (storedLockout > 0 && now < storedLockout) {
          lockoutUntil = storedLockout;
          blockCompleted = false;
          showLockoutOverlay();
        }
      });
    });
  }
  fastLockoutCheck();

  // ─── Init ───
  async function init() {
    settings = await getSettings();
    rules = parseRules(settings.sites);
    var hostname = location.hostname.toLowerCase().replace(/^www\./, '');

    // BR-5: early exit if no rule could ever match
    if (!hostMayMatch(hostname, rules)) return;

    currentRule = matchRule(hostname, location.pathname, rules);

    // Input listeners for activity tracking (both window and document)
    var inputEvents = ['scroll', 'wheel', 'keydown', 'touchstart', 'pointermove'];
    for (var i = 0; i < inputEvents.length; i++) {
      window.addEventListener(inputEvents[i], onUserInput, { capture: true, passive: true });
      document.addEventListener(inputEvents[i], onUserInput, { capture: true, passive: true });
    }

    // Capture-phase scroll for distance tracking on any element (BR-11)
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });

    // Listen for storage changes (settings, lockout, snooze, stats)
    chrome.storage.onChanged.addListener(onStorageChanged);

    // Read initial lockout and blockCompleted status
    var local = await chrome.storage.local.get(['lockoutUntil', 'blockCompleted']);
    var storedLockout = local.lockoutUntil || 0;
    blockCompleted = Boolean(local.blockCompleted);
    var now = Date.now();

    if (storedLockout > 0 && now >= storedLockout) {
      resetTracking();
      await chrome.storage.local.set({
        stats: { date: todayKey(), sites: {} },
        lockoutUntil: 0,
        blockCompleted: false
      });
      await safeSend({ type: 'clearLockout' });
    } else if (storedLockout > 0 && now < storedLockout) {
      lockoutUntil = storedLockout;
      showLockoutOverlay();
    } else {
      lockoutUntil = 0;
    }

    // Get current day stats from background
    var stats = await safeSend({ type: 'getStats' });
    if (stats) {
      totalSeconds = stats.totalSeconds || 0;
      totalPx = stats.totalPx || 0;
    }

    // Start 1-second tick loop
    tickInterval = setInterval(tick, 1000);

    // If body becomes available later, ensure inputs blocked if overlay is showing
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', function () {
        if (overlayShowing) {
          blockAllInputs();
        }
      });
    }

    // Check on page load
    checkOnLoad();
  }

  function checkOnLoad() {
    if (!settings || !currentRule) return;
    var now = Date.now();

    // Active lockout?
    if (lockoutUntil > 0 && now < lockoutUntil) {
      showLockoutOverlay();
      return;
    }

    // Lockout expired? Reset screens and time
    if (lockoutUntil > 0 && now >= lockoutUntil) {
      resetTracking();
      chrome.storage.local.set({
        stats: { date: todayKey(), sites: {} },
        lockoutUntil: 0,
        blockCompleted: false
      });
      safeSend({ type: 'clearLockout' });
    }

    // Daily limit exceeded on page load for the first time? Block immediately
    if (settings.dailyMinutesLimit > 0 &&
        totalSeconds >= settings.dailyMinutesLimit * 60) {
      triggerLockout();
    }
  }

  // ─── User input handler ───
  function onUserInput() {
    lastInputTime = Date.now();
  }

  // ─── Root target detection & scroll measurement ───
  function isRootTarget(target) {
    return (!target ||
      target === window ||
      target === document ||
      target === document.documentElement ||
      target === document.body);
  }

  function getScrollPos(target) {
    if (isRootTarget(target)) {
      return (window.scrollY ||
        window.pageYOffset ||
        (document.documentElement ? document.documentElement.scrollTop : 0) ||
        (document.body ? document.body.scrollTop : 0) ||
        0);
    }
    return (target && target.scrollTop !== undefined) ? target.scrollTop : 0;
  }

  // ─── Scroll tracking (BR-10, BR-11, BR-12) ───
  function onScroll(e) {
    if (!settings || !currentRule) return;

    var now = Date.now();

    // Don't track while overlay showing (BR-14)
    if (overlayShowing) return;

    // Active lockout check
    if (lockoutUntil > 0 && now < lockoutUntil) {
      showLockoutOverlay();
      return;
    }

    if (lockoutUntil > 0 && now >= lockoutUntil) {
      resetTracking();
      chrome.storage.local.set({
        stats: { date: todayKey(), sites: {} },
        lockoutUntil: 0,
        blockCompleted: false
      });
      safeSend({ type: 'clearLockout' });
    }

    var rawTarget = e.target;
    var isRoot = isRootTarget(rawTarget);
    var key = isRoot ? (document.documentElement || document) : rawTarget;
    if (!key) return;

    var currentPos = getScrollPos(rawTarget);

    var lastPos = scrollPositions.get(key);
    if (lastPos === undefined) {
      lastPos = 0;
    }

    var delta = Math.abs(currentPos - lastPos);
    // BR-12: ignore jumps over 20000px
    if (delta > 0 && delta <= MAX_JUMP_PX) {
      sessionPx += delta;
      unsentPx += delta;
    }
    scrollPositions.set(key, currentPos);
    lastInputTime = now;

    // Check limits immediately upon scroll!
    checkLimits(now);
  }

  // ─── Check limits (session & daily) ───
  function checkLimits(now) {
    if (overlayShowing) return;
    now = now || Date.now();

    // Active lockout check
    if (lockoutUntil > 0 && now < lockoutUntil) {
      showLockoutOverlay();
      return;
    }

    if (lockoutUntil > 0 && now >= lockoutUntil) {
      resetTracking();
      chrome.storage.local.set({
        stats: { date: todayKey(), sites: {} },
        lockoutUntil: 0,
        blockCompleted: false
      });
      safeSend({ type: 'clearLockout' });
    }

    // Check session scroll limit (BR-22)
    if (settings.sessionScreenLimit > 0) {
      var screens = sessionPx / PX_PER_SCREEN;
      if (screens >= settings.sessionScreenLimit) {
        // Session limit reached: trigger break lockout!
        sessionPx = 0;
        triggerLockout();
        return;
      }
    }

    // Check daily limit (BR-23) - only if daily block hasn't been completed today
    if (!blockCompleted &&
        settings.dailyMinutesLimit > 0 &&
        (!lockoutUntil || now < lockoutUntil) &&
        (totalSeconds + unsentSeconds) >= settings.dailyMinutesLimit * 60) {
      triggerLockout();
    }
  }

  // ─── Storage changes ───
  function onStorageChanged(changes, area) {
    if (area === 'sync') {
      getSettings().then(function (s) {
        settings = s;
        rules = parseRules(s.sites);
      });
    }
    if (area === 'local') {
      if (changes.blockCompleted) {
        blockCompleted = Boolean(changes.blockCompleted.newValue);
      }
      if (changes.lockoutUntil) {
        var newLockout = changes.lockoutUntil.newValue || 0;
        var now = Date.now();
        if (newLockout === 0 || now >= newLockout) {
          resetTracking();
          if (overlayShowing && overlayType === 'lockout') {
            removeOverlay();
            restoreAllInputs();
            resumeMedia();
          }
        } else {
          lockoutUntil = newLockout;
          if (lockoutUntil && now < lockoutUntil && !overlayShowing) {
            showLockoutOverlay();
          }
          if (!lockoutUntil && overlayShowing && overlayType === 'lockout') {
            resetTracking();
            removeOverlay();
            restoreAllInputs();
            resumeMedia();
          }
        }
      }
      if (changes.stats) {
        var newStats = changes.stats.newValue;
        if (newStats && newStats.date === todayKey()) {
          var ts = 0;
          var tp = 0;
          var siteKeys = Object.keys(newStats.sites || {});
          for (var i = 0; i < siteKeys.length; i++) {
            ts += (newStats.sites[siteKeys[i]].seconds || 0);
            tp += (newStats.sites[siteKeys[i]].px || 0);
          }
          totalSeconds = ts;
          totalPx = tp;
          if (ts === 0 && tp === 0) {
            resetTracking();
          }
        } else {
          resetTracking();
        }
      }
    }
  }

  // ─── Main tick (1 second) ───
  function tick() {
    // Check extension context is still valid (B3.8)
    if (!chrome.runtime.id) {
      cleanup();
      return;
    }

    var now = Date.now();
    var hostname = location.hostname.toLowerCase().replace(/^www\./, '');

    // BR-6: re-check path match every tick for SPAs
    currentRule = matchRule(hostname, location.pathname, rules);

    if (!currentRule) {
      removeGreyscale();
      return;
    }

    // Active lockout
    if (lockoutUntil && now < lockoutUntil) {
      if (!overlayShowing || overlayType !== 'lockout') {
        showLockoutOverlay();
      }
      return;
    }

    // If lockout just expired or is past expiry, remove overlay, clear lockout, and reset doomscrolled time & screens
    if ((overlayShowing && overlayType === 'lockout' && (!lockoutUntil || now >= lockoutUntil)) ||
        (lockoutUntil > 0 && now >= lockoutUntil)) {
      resetTracking();
      chrome.storage.local.set({
        stats: { date: todayKey(), sites: {} },
        lockoutUntil: 0,
        blockCompleted: false
      });
      safeSend({ type: 'clearLockout' });
      if (overlayShowing) {
        removeOverlay();
        restoreAllInputs();
        resumeMedia();
      }
    }

    // BR-40: re-attach overlay if site removed it
    if (overlayShowing && overlayHost && !document.documentElement.contains(overlayHost) && (!document.body || !document.body.contains(overlayHost))) {
      var attachTo = document.documentElement || document.body;
      if (attachTo) attachTo.append(overlayHost);
    }

    // BR-14: don't count while overlay showing
    if (overlayShowing) return;

    // BR-9: time counts only if tab visible and recent input
    var tabVisible = !document.hidden;
    var recentInput = (now - lastInputTime) < ACTIVE_WINDOW_MS;

    if (tabVisible && recentInput) {
      unsentSeconds++;
    }

    tickCount++;

    // BR-15: flush every 5 ticks
    if (tickCount >= FLUSH_EVERY_TICKS && (unsentSeconds > 0 || unsentPx > 0)) {
      flushToBackground();
      tickCount = 0;
    }

    // Greyscale
    updateGreyscale();

    // Check limits (BR-22, BR-23, BR-25)
    checkLimits(now);
  }

  // ─── Flush unsent data to background ───
  async function flushToBackground() {
    if (!currentRule) return;
    var sec = unsentSeconds;
    var px = unsentPx;
    unsentSeconds = 0;
    unsentPx = 0;

    var resp = await safeSend({
      type: 'update',
      rule: currentRule,
      seconds: sec,
      px: px
    });
    if (resp) {
      totalSeconds = resp.totalSeconds || 0;
      totalPx = resp.totalPx || 0;
    } else {
      // Put data back if send failed
      unsentSeconds += sec;
      unsentPx += px;
    }
  }

  // ─── Greyscale fade (BR-29, BR-30, BR-31) ───
  function updateGreyscale() {
    if (!settings.greyscaleEnabled) {
      removeGreyscale();
      return;
    }
    var ratio = 0;
    if (settings.sessionScreenLimit > 0) {
      ratio = Math.max(ratio, (sessionPx / PX_PER_SCREEN) / settings.sessionScreenLimit);
    }
    if (!blockCompleted && settings.dailyMinutesLimit > 0) {
      ratio = Math.max(ratio, (totalSeconds + unsentSeconds) / (settings.dailyMinutesLimit * 60));
    }
    var grey = clamp((ratio - 0.5) / 0.5, 0, 1);
    if (grey > 0) {
      document.documentElement.style.filter = 'grayscale(' + grey + ')';
    } else {
      removeGreyscale();
    }
  }

  function removeGreyscale() {
    if (document.documentElement &&
        document.documentElement.style.filter &&
        document.documentElement.style.filter.indexOf('grayscale') !== -1) {
      document.documentElement.style.filter = '';
    }
  }

  // ─── Pause / resume media (BR-32) ───
  function pauseMedia() {
    pausedMedia = [];
    var media = document.querySelectorAll('video, audio');
    for (var i = 0; i < media.length; i++) {
      if (!media[i].paused) {
        media[i].pause();
        pausedMedia.push(media[i]);
      }
    }
  }

  function resumeMedia() {
    for (var i = 0; i < pausedMedia.length; i++) {
      try { pausedMedia[i].play(); } catch (e) {}
    }
    pausedMedia = [];
  }

  // ─── Block / restore all inputs (cursor, keyboard, scroll — BR-33) ───
  function blockAllInputs() {
    savedHtmlOverflow = document.documentElement ? document.documentElement.style.overflow : '';
    savedHtmlUserSelect = document.documentElement ? document.documentElement.style.userSelect : '';
    if (document.documentElement) {
      document.documentElement.style.overflow = 'hidden';
      document.documentElement.style.userSelect = 'none';
    }

    if (document.body) {
      savedBodyOverflow = document.body.style.overflow || '';
      savedBodyPointerEvents = document.body.style.pointerEvents || '';
      savedBodyUserSelect = document.body.style.userSelect || '';
      document.body.style.overflow = 'hidden';
      document.body.style.pointerEvents = 'none';
      document.body.style.userSelect = 'none';
    }

    for (var i = 0; i < POINTER_BLOCK_EVENTS.length; i++) {
      window.addEventListener(POINTER_BLOCK_EVENTS[i], preventPointerInput, { passive: false, capture: true });
      document.addEventListener(POINTER_BLOCK_EVENTS[i], preventPointerInput, { passive: false, capture: true });
    }
    for (var j = 0; j < KEYBOARD_BLOCK_EVENTS.length; j++) {
      window.addEventListener(KEYBOARD_BLOCK_EVENTS[j], preventKeyboardInput, { passive: false, capture: true });
      document.addEventListener(KEYBOARD_BLOCK_EVENTS[j], preventKeyboardInput, { passive: false, capture: true });
    }
  }

  function restoreAllInputs() {
    if (document.documentElement) {
      document.documentElement.style.overflow = savedHtmlOverflow;
      document.documentElement.style.userSelect = savedHtmlUserSelect;
    }

    if (document.body) {
      document.body.style.overflow = savedBodyOverflow;
      document.body.style.pointerEvents = savedBodyPointerEvents;
      document.body.style.userSelect = savedBodyUserSelect;
    }

    for (var i = 0; i < POINTER_BLOCK_EVENTS.length; i++) {
      window.removeEventListener(POINTER_BLOCK_EVENTS[i], preventPointerInput, { capture: true });
      document.removeEventListener(POINTER_BLOCK_EVENTS[i], preventPointerInput, { capture: true });
    }
    for (var j = 0; j < KEYBOARD_BLOCK_EVENTS.length; j++) {
      window.removeEventListener(KEYBOARD_BLOCK_EVENTS[j], preventKeyboardInput, { capture: true });
      document.removeEventListener(KEYBOARD_BLOCK_EVENTS[j], preventKeyboardInput, { capture: true });
    }
  }

  function isOverlayButton(target, path) {
    if (target && target.tagName === 'BUTTON') return true;
    if (path) {
      for (var i = 0; i < path.length; i++) {
        if (path[i] && path[i].tagName === 'BUTTON') return true;
      }
    }
    return false;
  }

  function preventPointerInput(e) {
    var path = e.composedPath ? e.composedPath() : [];
    if (isOverlayButton(e.target, path)) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
  }

  function preventKeyboardInput(e) {
    var path = e.composedPath ? e.composedPath() : [];
    var isBtn = isOverlayButton(e.target, path);

    if (isBtn && (e.code === 'Space' || e.code === 'Enter' || e.key === ' ' || e.key === 'Enter')) {
      return;
    }

    if (e.code === 'Tab' || e.key === 'Tab') {
      e.preventDefault();
      var btn = leaveBtn || keepGoingBtn;
      if (btn && btn.focus) btn.focus();
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
  }

  // ─── Trigger 30-minute lockout (BR-23, BR-37) ───
  function triggerLockout() {
    if (overlayShowing && overlayType === 'lockout') return;

    var breakMinutes = (settings && settings.breakMinutes) || 30;
    var breakMs = breakMinutes * 60 * 1000;
    lockoutUntil = Date.now() + breakMs;
    blockCompleted = false;

    showLockoutOverlay();

    chrome.storage.local.set({ lockoutUntil: lockoutUntil, blockCompleted: false });
    safeSend({ type: 'setLockout', lockoutUntil: lockoutUntil, blockCompleted: false });
    flushToBackground();
  }

  // ─── Show lockout overlay (30-minute block — BR-37) ───
  function showLockoutOverlay() {
    if (overlayShowing && overlayType === 'lockout') {
      updateCountdown();
      return;
    }
    removeOverlay();
    overlayType = 'lockout';
    overlayShowing = true;

    pauseMedia();
    blockAllInputs();
    removeGreyscale();

    overlayHost = document.createElement('div');
    overlayHost.id = 'doomstop-overlay';
    overlayHost.setAttribute('style',
      'all:initial !important;position:fixed !important;top:0 !important;left:0 !important;width:100vw !important;height:100vh !important;z-index:2147483647 !important;pointer-events:auto !important;display:block !important;');

    var shadow = overlayHost.attachShadow({ mode: 'open' });
    var sheet = new CSSStyleSheet();
    sheet.replaceSync(getOverlayCSS());
    shadow.adoptedStyleSheets = [sheet];

    var container = el('div', {
      className: 'overlay-container',
      role: 'alertdialog',
      'aria-modal': 'true',
      'aria-label': 'Screen blocked: You have been scrolling for too long. Go read a book.'
    });

    var icon = el('div', { className: 'overlay-icon', textContent: '📖' });
    var title = el('h1', { className: 'overlay-title', textContent: 'You have been scrolling for too long' });
    var sub = el('p', { className: 'overlay-subtitle',
      textContent: 'Time to put the screen away and read a book. Take a mandatory 30-minute break.' });
    countdownEl = el('p', { className: 'overlay-countdown' });
    var breathe = el('div', { className: 'breathe-ring' });
    var breatheLabel = el('p', { className: 'breathe-label', textContent: 'Step away and read a book' });

    leaveBtn = el('button', {
      className: 'overlay-btn overlay-btn-leave',
      textContent: 'Leave this site',
      onclick: onLeave
    });

    var btnRow = el('div', { className: 'btn-row' }, [leaveBtn]);
    container.append(icon, title, sub, countdownEl, breathe, breatheLabel, btnRow);
    shadow.append(container);

    var attachNode = document.documentElement || document.body;
    if (attachNode) {
      attachNode.append(overlayHost);
    }
    observeOverlay();

    // BR-34: Leave has initial focus
    leaveBtn.focus();
    updateCountdown();

    // Update countdown every second
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(function () {
      var now = Date.now();
      if (now >= lockoutUntil) {
        clearInterval(countdownInterval);
        countdownInterval = null;
        resetTracking();
        chrome.storage.local.set({
          stats: { date: todayKey(), sites: {} },
          lockoutUntil: 0,
          blockCompleted: false
        });
        safeSend({ type: 'clearLockout' });
        removeOverlay();
        restoreAllInputs();
        resumeMedia();
      } else {
        updateCountdown();
      }
    }, 1000);
  }

  function updateCountdown() {
    if (!countdownEl) return;
    var remaining = Math.max(0, lockoutUntil - Date.now());
    var mins = Math.floor(remaining / 60000);
    var secs = Math.floor((remaining % 60000) / 1000);
    countdownEl.textContent = mins + ':' + (secs < 10 ? '0' : '') + secs;
  }

  // ─── Show session overlay (scroll limit pause — BR-22, BR-36) ───
  function showSessionOverlay() {
    if (overlayShowing) return;
    overlayType = 'session';
    overlayShowing = true;

    pauseMedia();
    blockAllInputs();
    removeGreyscale();

    overlayHost = document.createElement('div');
    overlayHost.id = 'doomstop-overlay';
    overlayHost.setAttribute('style',
      'all:initial !important;position:fixed !important;top:0 !important;left:0 !important;width:100vw !important;height:100vh !important;z-index:2147483647 !important;pointer-events:auto !important;display:block !important;');

    var shadow = overlayHost.attachShadow({ mode: 'open' });
    var sheet = new CSSStyleSheet();
    sheet.replaceSync(getOverlayCSS());
    shadow.adoptedStyleSheets = [sheet];

    var container = el('div', {
      className: 'overlay-container',
      role: 'alertdialog',
      'aria-modal': 'true',
      'aria-label': 'Scroll limit reached: You have been scrolling for too long. Step away and read a book.'
    });

    var screenCount = Math.floor(sessionPx / PX_PER_SCREEN);
    var icon = el('div', { className: 'overlay-icon', textContent: '📖' });
    var title = el('h1', { className: 'overlay-title',
      textContent: 'You have been scrolling for too long' });
    var sub = el('p', { className: 'overlay-subtitle',
      textContent: 'You have scrolled ' + screenCount + ' screens. Time to put the screen away and read a book.' });
    var breathe = el('div', { className: 'breathe-ring' });
    var breatheLabel = el('p', { className: 'breathe-label', textContent: 'Step away and read a book' });

    leaveBtn = el('button', {
      className: 'overlay-btn overlay-btn-leave',
      textContent: 'Leave this site',
      onclick: onLeave
    });

    var btnRow = el('div', { className: 'btn-row' }, [leaveBtn]);

    container.append(icon, title, sub, breathe, breatheLabel, btnRow);
    shadow.append(container);

    var attachNode = document.documentElement || document.body;
    if (attachNode) {
      attachNode.append(overlayHost);
    }
    observeOverlay();

    // BR-34: Leave has initial focus
    leaveBtn.focus();
  }

  // ─── Leave this site (BR-35) ───
  async function onLeave() {
    await flushToBackground();
    sessionPx = 0;
    removeOverlay();
    restoreAllInputs();
    safeSend({ type: 'closeTab' });
  }

  // ─── Overlay Observer (BR-40) ───
  function observeOverlay() {
    if (overlayObserver) return;
    var target = document.documentElement || document.body;
    if (typeof MutationObserver !== 'undefined' && target) {
      overlayObserver = new MutationObserver(function () {
        if (overlayShowing && overlayHost && !document.documentElement.contains(overlayHost) && (!document.body || !document.body.contains(overlayHost))) {
          var attachTo = document.documentElement || document.body;
          if (attachTo) attachTo.append(overlayHost);
        }
      });
      overlayObserver.observe(target, { childList: true });
    }
  }

  // ─── Remove overlay ───
  function removeOverlay() {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    if (overlayObserver) {
      overlayObserver.disconnect();
      overlayObserver = null;
    }
    if (overlayHost && overlayHost.parentNode) {
      overlayHost.parentNode.removeChild(overlayHost);
    }
    restoreAllInputs();
    overlayHost = null;
    overlayShowing = false;
    overlayType = null;
    countdownEl = null;
    leaveBtn = null;
  }

  // ─── Cleanup (extension unloaded — B3.8) ───
  function cleanup() {
    if (tickInterval) {
      clearInterval(tickInterval);
      tickInterval = null;
    }
    removeOverlay();
    restoreAllInputs();
    removeGreyscale();
    resumeMedia();
  }

  // ─── Start ───
  init();

})();
