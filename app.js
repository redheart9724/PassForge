/* PassForge UI — all logic is local to the browser. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var PREVIEW_LINES = 300;
  var numberFmt = new Intl.NumberFormat();

  var state = {
    passwords: [],
    meta: null
  };

  var toastTimer = null;

  /* ------------------------------------------------------------------ */
  /* helpers                                                             */
  /* ------------------------------------------------------------------ */

  function toast(message) {
    var el = $('toast');
    el.textContent = message;
    el.classList.add('show');
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      el.classList.remove('show');
    }, 2600);
  }

  function setStatus(message, kind) {
    var el = $('status');
    el.textContent = message;
    el.className = 'status' + (kind ? ' ' + kind : '');
  }

  function setBusy(busy) {
    var btn = $('btn-generate');
    btn.disabled = busy;
    btn.querySelector('.btn-label').textContent = busy ? 'Generating…' : 'Generate passwords';
  }

  function enableResults(enabled) {
    $('btn-copy').disabled = !enabled;
    $('btn-txt').disabled = !enabled;
    $('btn-csv').disabled = !enabled;
  }

  function stamp() {
    var d = new Date();
    var p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes());
  }

  function csvCell(value) {
    return /[",\r\n]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value;
  }

  /* ------------------------------------------------------------------ */
  /* reading the form                                                    */
  /* ------------------------------------------------------------------ */

  function readInputs() {
    return {
      firstName: $('in-first').value,
      lastName: $('in-last').value,
      nickName: $('in-nick').value,
      dob: $('in-dob').value,
      phone: $('in-phone').value,
      email: $('in-email').value,
      petName: $('in-pet').value,
      partnerName: $('in-partner').value,
      childName: $('in-child').value,
      company: $('in-company').value,
      city: $('in-city').value,
      wifiName: $('in-wifi').value,
      team: $('in-team').value,
      hobby: $('in-hobby').value,
      numbers: $('in-numbers').value,
      extra: [$('in-extra-1').value, $('in-extra').value].filter(Boolean).join(', ')
    };
  }

  function hasAnyInput(inputs) {
    return Object.keys(inputs).some(function (key) {
      return String(inputs[key] || '').trim().length > 0;
    });
  }

  function readOptions() {
    var min = parseInt($('opt-min').value, 10);
    var max = parseInt($('opt-max').value, 10);
    if (!Number.isFinite(min) || min < 1) min = 4;
    if (!Number.isFinite(max) || max < 1) max = 32;
    if (min > max) {
      var tmp = min;
      min = max;
      max = tmp;
      $('opt-min').value = min;
      $('opt-max').value = max;
    }

    return {
      minLength: min,
      maxLength: max,
      maxResults: $('opt-limit').value,
      useNumbers: $('opt-numbers').checked,
      maxNumber: $('opt-maxnumber').value,
      useYears: $('opt-years').checked,
      yearFrom: $('opt-yearfrom').value,
      yearTo: $('opt-yearto').value,
      useSymbols: $('opt-symbols-on').checked,
      symbols: $('opt-symbols').value,
      leet: $('opt-leet').value,
      caseMode: $('opt-case').value,
      usePairs: $('opt-pairs').checked,
      useNumberPrefixes: $('opt-number-prefix').checked,
      usePrefixSymbols: $('opt-prefix').checked,
      includeCommon: $('opt-common').checked
    };
  }

  /* ------------------------------------------------------------------ */
  /* generation                                                          */
  /* ------------------------------------------------------------------ */

  function run(event) {
    if (event) event.preventDefault();

    var inputs = readInputs();
    if (!hasAnyInput(inputs)) {
      setStatus('Add at least one detail about the target — a name, date of birth, pet name, phone number…', 'warn');
      $('in-first').focus();
      return;
    }

    var options = readOptions();
    setBusy(true);
    setStatus('Generating candidates…');
    enableResults(false);

    // Let the browser paint the busy state before the synchronous work.
    window.setTimeout(function () {
      var started = window.performance && window.performance.now ? window.performance.now() : Date.now();
      var result;
      try {
        result = window.PassForge.generate(inputs, options);
      } catch (err) {
        console.error(err);
        setBusy(false);
        setStatus('Generation failed: ' + (err && err.message ? err.message : String(err)), 'error');
        return;
      }
      var elapsed = Math.max(0, Math.round(
        (window.performance && window.performance.now ? window.performance.now() : Date.now()) - started
      ));

      state.passwords = result.passwords;
      state.meta = result;
      render(result, elapsed);
      setBusy(false);
    }, 40);
  }

  function render(result, elapsed) {
    var total = result.passwords.length;
    $('count-badge').textContent = numberFmt.format(total);

    if (!total) {
      setStatus('No candidates matched your length limits. Lower the minimum length, raise the maximum, or add more details.', 'warn');
      $('preview').textContent = 'No results.';
      $('preview-note').textContent = 'Nothing generated';
      enableResults(false);
      return;
    }

    var parts = [
      'Generated ' + numberFmt.format(total) + ' candidates in ' + elapsed + ' ms',
      'from ' + numberFmt.format(result.tokenCount) + ' base tokens'
    ];
    if (result.truncated) {
      parts.push('result limit reached — raise “Max results” or trim options for deeper coverage');
    }
    setStatus(parts.join(' · '), result.truncated ? 'warn' : 'ok');

    var shown = result.passwords.slice(0, PREVIEW_LINES);
    $('preview').textContent = shown.join('\n');
    $('preview-note').textContent = total > shown.length
      ? 'showing first ' + numberFmt.format(shown.length) + ' of ' + numberFmt.format(total)
      : numberFmt.format(total) + ' shown';

    $('preview').scrollTop = 0;
    enableResults(true);
  }

  /* ------------------------------------------------------------------ */
  /* output actions                                                      */
  /* ------------------------------------------------------------------ */

  function legacyCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-2000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try {
      ok = document.execCommand('copy');
    } finally {
      document.body.removeChild(ta);
    }
    if (!ok) throw new Error('Copy command was rejected');
  }

  function copyAll() {
    if (!state.passwords.length) return;
    var text = state.passwords.join('\n');
    var done = function () {
      toast('Copied ' + numberFmt.format(state.passwords.length) + ' passwords to the clipboard');
    };

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done).catch(function () {
        try { legacyCopy(text); done(); }
        catch (err) { toast('Copy failed — use “Download .txt” instead'); }
      });
      return;
    }

    try {
      legacyCopy(text);
      done();
    } catch (err) {
      toast('Copy failed — use “Download .txt” instead');
    }
  }

  function download(kind) {
    if (!state.passwords.length) return;

    var body;
    var mime;
    if (kind === 'csv') {
      body = 'password\r\n' + state.passwords.map(csvCell).join('\r\n') + '\r\n';
      mime = 'text/csv;charset=utf-8';
    } else {
      body = state.passwords.join('\r\n') + '\r\n';
      mime = 'text/plain;charset=utf-8';
    }

    var blob = new Blob([kind === 'csv' ? '\ufeff' : '', body], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var name = 'passforge-' + stamp() + '.' + kind;
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
    toast('Downloaded ' + name);
  }

  function clearResults() {
    state.passwords = [];
    state.meta = null;
    $('count-badge').textContent = '0';
    $('preview').textContent = 'Candidates will appear here…';
    $('preview-note').textContent = 'Nothing generated';
    setStatus('Form cleared. Add target details and hit Generate.');
    enableResults(false);
  }

  /* ------------------------------------------------------------------ */
  /* option affordances                                                  */
  /* ------------------------------------------------------------------ */

  function syncOptionState() {
    $('opt-maxnumber').disabled = !$('opt-numbers').checked;
    $('opt-symbols').disabled = !$('opt-symbols-on').checked;
    $('opt-yearfrom').disabled = !$('opt-years').checked;
    $('opt-yearto').disabled = !$('opt-years').checked;
    $('opt-maxnumber-label').textContent = $('opt-maxnumber').value || '99';
  }

  /* ------------------------------------------------------------------ */
  /* example data                                                        */
  /* ------------------------------------------------------------------ */

  function loadExample() {
    $('in-first').value = 'Rahul';
    $('in-last').value = 'Sharma';
    $('in-nick').value = 'Rocky';
    $('in-dob').value = '1990-05-14';
    $('in-phone').value = '+91 98765 49591';
    $('in-email').value = 'rahul.sharma@example.com';
    $('in-pet').value = 'Bruno';
    $('in-partner').value = 'Priya';
    $('in-child').value = 'Aarav';
    $('in-company').value = 'Acme Corp';
    $('in-city').value = 'Pune';
    $('in-wifi').value = 'Sharma_5G';
    $('in-team').value = 'Mumbai Indians';
    $('in-hobby').value = 'cricket';
    $('in-numbers').value = '9591, 4321, 2017';
    $('in-extra-1').value = 'Royal Enfield';
    $('in-extra').value = 'MH12AB1234, St. Xavier\'s, 4321';
    setStatus('Example loaded — hit Generate to see the candidate list.', 'ok');
    enableResults(false);
  }

  /* ------------------------------------------------------------------ */
  /* boot                                                                */
  /* ------------------------------------------------------------------ */

  function init() {
    var year = new Date().getFullYear();
    $('opt-yearto').value = year;

    $('pf-form').addEventListener('submit', run);
    $('btn-copy').addEventListener('click', copyAll);
    $('btn-txt').addEventListener('click', function () { download('txt'); });
    $('btn-csv').addEventListener('click', function () { download('csv'); });
    $('btn-example').addEventListener('click', loadExample);
    $('btn-reset').addEventListener('click', function () {
      window.setTimeout(function () {
        clearResults();
        $('opt-yearto').value = new Date().getFullYear();
        syncOptionState();
      }, 0);
    });

    ['opt-numbers', 'opt-symbols-on', 'opt-years'].forEach(function (id) {
      $(id).addEventListener('change', syncOptionState);
    });
    $('opt-maxnumber').addEventListener('input', syncOptionState);

    document.addEventListener('keydown', function (event) {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        run();
      }
    });

    syncOptionState();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
