/*!
 * PassForge engine — context-aware candidate password generator.
 * Pure JavaScript, no DOM dependencies. MIT License.
 *
 * For authorized security assessments only. All generation happens locally.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && typeof root === 'object') root.PassForge = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DEFAULT_SYMBOLS = ['!', '@', '#', '$', '%', '&', '*', '?', '.', '_', '-', '+'];

  const BASIC_LEET = { a: '4', e: '3', i: '1', o: '0', s: '5', t: '7' };
  const FULL_LEET = { a: '4', b: '8', e: '3', g: '9', i: '1', l: '1', o: '0', s: '5', t: '7', z: '2' };
  const ALT_LEET = { a: '@', b: '8', e: '3', g: '6', i: '!', l: '1', o: '0', s: '$', t: '7', z: '2' };

  const MONTHS = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
  ];

  // Widely published "top password" lists. Kept short on purpose.
  const COMMON_PASSWORDS = [
    'password', 'Password1', 'Password123', 'p@ssw0rd', 'Passw0rd', 'P@ssw0rd',
    'admin', 'admin123', 'administrator', 'root', 'toor', 'guest', 'letmein',
    'welcome', 'welcome1', 'welcome123', 'qwerty', 'qwerty123', 'qwertyuiop',
    '1q2w3e4r', '1qaz2wsx', 'asdfghjkl', 'zxcvbnm', 'abc123', 'abcd1234',
    'iloveyou', 'monkey', 'dragon', 'football', 'baseball', 'cricket',
    'sunshine', 'princess', 'shadow', 'master', 'michael', 'superman',
    'batman', 'trustno1', 'changeme', 'secret', 'mypassword', 'mypassword123',
    'love', 'loveme', 'lover', 'angel', 'baby', 'hello123', 'freedom',
    'whatever', 'starwars', 'computer', 'internet', 'samsung', 'iphone',
    'google', 'facebook', 'instagram', 'whatsapp', 'snapchat', 'linkedin',
    'github', 'microsoft', 'apple123', 'india123', 'India@123', 'krishna',
    'om', 'shiv', 'sai', 'test123', 'pass', 'pass1234', 'password123',
    '123456789', '987654321', '112233', '121212', '131313', '55555',
    '666666', '7777777', '88888888', '999999', '000000', '123123',
    '159753', '147258369', '741852963', '1q2w3e', 'summer2024', 'winter2024',
    'spring2024', 'autumn2024', 'summer2025', 'winter2025'
  ];

  const PAIR_SEPARATORS = ['', '.', '_', '-'];

  /* ------------------------------------------------------------------ */
  /* small helpers                                                       */
  /* ------------------------------------------------------------------ */

  function clampInt(value, min, max, fallback) {
    const n = Number.parseInt(value, 10);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function splitWords(value) {
    return String(value == null ? '' : value)
      .normalize('NFKC')
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean);
  }

  /**
   * Strip a value down to characters that can appear in a password token.
   * With keepSeparators, dots/underscores/dashes survive (john_smith).
   */
  function sanitize(value, keepSeparators) {
    const s = String(value == null ? '' : value).normalize('NFKC');
    return keepSeparators
      ? s.replace(/[^\p{L}\p{N}._-]+/gu, '')
      : s.replace(/[^\p{L}\p{N}]+/gu, '');
  }

  function parseDob(dob) {
    if (!dob) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dob).trim());
    if (!m) return null;
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return { year, month, day };
  }

  function parseSymbols(value) {
    const source = typeof value === 'string' && value.length ? value : DEFAULT_SYMBOLS.join('');
    const seen = new Set();
    const out = [];
    for (const ch of source) {
      if (/\s/.test(ch)) continue;
      if (!seen.has(ch)) {
        seen.add(ch);
        out.push(ch);
      }
    }
    return out.length ? out : DEFAULT_SYMBOLS.slice();
  }

  /* ------------------------------------------------------------------ */
  /* variant generators                                                  */
  /* ------------------------------------------------------------------ */

  function caseVariants(base, mode) {
    const out = [];
    const seen = new Set();
    const push = (s) => {
      if (s && !seen.has(s)) {
        seen.add(s);
        out.push(s);
      }
    };

    if (mode === 'lower') {
      return [base.toLowerCase()];
    }
    if (mode === 'upper') {
      return [base.toUpperCase()];
    }

    push(base);

    push(base.toLowerCase());
    push(base.toUpperCase());
    push(base.charAt(0).toUpperCase() + base.slice(1).toLowerCase());

    if (/[._-]/.test(base)) {
      push(base.replace(/(^|[._-])(\p{L})/gu, function (_m, sep, ch) {
        return sep + ch.toUpperCase();
      }));
    }

    return out;
  }

  function leetAll(str, map) {
    let out = '';
    for (const ch of str) {
      out += map[ch.toLowerCase()] || ch;
    }
    return out;
  }

  // Replace only every other substitutable character (mixed look).
  function leetPartial(str, map) {
    let out = '';
    let hits = 0;
    for (const ch of str) {
      const rep = map[ch.toLowerCase()];
      if (rep) {
        hits += 1;
        out += hits % 2 === 0 ? rep : ch;
      } else {
        out += ch;
      }
    }
    return out;
  }

  function leetVariants(base, mode) {
    if (mode === 'none') return [];
    if (mode === 'basic') {
      return [leetAll(base, BASIC_LEET), leetPartial(base, BASIC_LEET)];
    }
    return [
      leetAll(base, FULL_LEET),
      leetPartial(base, FULL_LEET),
      leetAll(base, ALT_LEET)
    ];
  }

  function expandVariants(base, leetMode, caseMode) {
    const out = [];
    const seen = new Set();
    for (const c of caseVariants(base, caseMode)) {
      if (!seen.has(c)) {
        seen.add(c);
        out.push(c);
      }
      for (const l of leetVariants(c, leetMode)) {
        if (!seen.has(l)) {
          seen.add(l);
          out.push(l);
        }
      }
    }
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* token collection                                                    */
  /* ------------------------------------------------------------------ */

  function buildTokens(input, opts) {
    const tokens = [];
    const seen = new Set();

    const push = (value, keepSeparators) => {
      const w = sanitize(value, keepSeparators);
      if (!w) return;
      // Deduplicate exact tokens only: "JohnSmith" and "johnsmith" produce
      // different camel-case variants and must both survive.
      if (seen.has(w)) return;
      seen.add(w);
      tokens.push(w);
    };

    const addField = (value) => {
      if (value == null) return;
      const raw = String(value).trim();
      if (!raw) return;
      const words = splitWords(raw);
      if (!words.length) return;

      push(words.join(''));

      if (words.length > 1) {
        push(words.join('_'), true);
        push(words.join('.'), true);
        push(words.join('-'), true);
        push(words.map((w) => w.charAt(0)).join(''));
        push(words.map((w) => w.charAt(0)).join('').toLowerCase());
      }

      words.forEach((w) => push(w));
    };

    addField(input.firstName);
    addField(input.lastName);
    addField(input.nickName);
    addField(input.partnerName);
    addField(input.childName);
    addField(input.petName);
    addField(input.company);
    addField(input.city);
    addField(input.team);
    addField(input.hobby);
    addField(input.wifiName);

    if (input.email) {
      const local = String(input.email).split('@')[0];
      addField(local);
    }

    const digits = String(input.phone == null ? '' : input.phone).replace(/\D/g, '');
    if (digits) {
      push(digits);
      if (digits.length > 4) push(digits.slice(-4));
      if (digits.length > 5) push(digits.slice(-5));
      if (digits.length > 6) push(digits.slice(-6));
      if (digits.length > 10) push(digits.slice(-10));
      if (digits.length === 12 && digits.indexOf('91') === 0) push(digits.slice(2));
    }

    const dob = parseDob(input.dob);
    if (dob) {
      const dd = pad2(dob.day);
      const mm = pad2(dob.month);
      const yyyy = String(dob.year);
      const yy = yyyy.slice(-2);
      [
        dd, mm, yyyy, yy,
        dd + mm, mm + dd,
        dd + mm + yyyy, mm + dd + yyyy,
        dd + mm + yy, mm + dd + yy,
        yyyy + mm + dd,
        MONTHS[dob.month - 1],
        MONTHS[dob.month - 1].slice(0, 3)
      ].forEach((v) => push(v));
    }

    // Direct name pairings (also produced by the pair stage, but useful
    // as standalone tokens with every suffix).
    const first = sanitize(input.firstName, false);
    const last = sanitize(input.lastName, false);
    if (first && last && first.toLowerCase() !== last.toLowerCase()) {
      push(first + last);
      push(last + first);
      push(first + '.' + last, true);
      push(first + '_' + last, true);
      push(first + '-' + last, true);
      push(first.charAt(0) + last);
      push(first + last.charAt(0));
    }

    if (input.extra) {
      String(input.extra)
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach(addField);
    }

    return tokens.slice(0, 150);
  }

  function buildPairBases(input) {
    const out = [];
    const seen = new Set();
    const add = (value) => {
      const w = sanitize(value, false);
      if (!w) return;
      const key = w.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push(w);
    };

    [
      input.firstName, input.lastName, input.nickName, input.petName,
      input.partnerName, input.childName, input.company, input.city
    ].forEach(add);

    return out.slice(0, 8);
  }

  /* ------------------------------------------------------------------ */
  /* suffix sets                                                         */
  /* ------------------------------------------------------------------ */

  /**
   * Numbers that a real person is likely to reuse in a password.
   * Ordered by likely relevance: explicit numbers, phone prefixes/tails,
   * date fragments, digit runs from free text, then common choices.
   */
  function collectNumbers(input, dob, opts, now) {
    const out = [];
    const seen = new Set();

    const add = (value) => {
      const s = String(value == null ? '' : value).replace(/\D/g, '');
      if (!s || s.length > 12) return;
      if (seen.has(s)) return;
      seen.add(s);
      out.push(s);
    };

    // Explicitly supplied "important numbers" win.
    String(input.numbers || '')
      .split(/[^\d]+/)
      .filter(Boolean)
      .forEach(add);

    // Phones are reused from both ends: 9591xxxxxx -> 9591, xxxxxx9591.
    // Country-code prefixes (e.g. +91) are stripped first so the local
    // number's own prefix is not hidden.
    const rawDigits = String(input.phone || '').replace(/\D/g, '');
    let primary = rawDigits;
    if (rawDigits.length > 10) primary = rawDigits.slice(-10);
    if (primary) {
      add(primary.slice(0, 4));
      add(primary.slice(-4));
      add(primary.slice(0, 5));
      add(primary.slice(-5));
      add(primary.slice(0, 6));
      add(primary.slice(-6));
    }

    // Date fragments — short, high-value ones first.
    if (dob) {
      const dd = pad2(dob.day);
      const mm = pad2(dob.month);
      const yyyy = String(dob.year);
      add(yyyy);
      add(yyyy.slice(2));
      add(dd);
      add(mm);
      add(dd + mm);
      add(mm + dd);
      add(dd + mm + yyyy);
      add(dd + mm + yyyy.slice(2));
      add(mm + dd + yyyy);
      add(mm + dd + yyyy.slice(2));
      add(yyyy + mm + dd);
    }

    // Longer phone forms are useful but lower priority.
    if (primary) {
      add(primary.slice(-8));
      add(primary);
      if (rawDigits !== primary) add(rawDigits);
    }

    // Digit runs inside free text (bike number, PIN, house number, …).
    ['extra', 'numbers', 'team', 'hobby', 'wifiName', 'company', 'city'].forEach((key) => {
      const value = input[key];
      if (!value) return;
      (String(value).match(/\d{2,10}/g) || []).forEach(add);
    });

    if (opts.useYears) {
      add(now.getFullYear());
      add(now.getFullYear() - 1);
    }

    ['123', '1234', '12345', '123456', '0000', '1111', '007', '786', '111',
      '101', '321', '69', '01', '12', '9999', '5555', '4321', '2020', '2021',
      '2022', '2023', '2024'].forEach(add);

    return out.slice(0, 36);
  }

  function buildSuffixes(opts, dob, now, input) {
    const out = [];
    const seen = new Set();
    const push = (v) => {
      const s = String(v);
      if (!seen.has(s)) {
        seen.add(s);
        out.push(s);
      }
    };

    const currentYear = now.getFullYear();
    const symbols = opts.useSymbols ? parseSymbols(opts.symbols) : [];
    const comboSymbols = symbols.slice(0, 6);
    const tripleSymbols = symbols.slice(0, 3);
    const numbers = opts.useNumbers ? collectNumbers(input || {}, dob, opts, now) : [];
    const comboNumbers = numbers.slice(0, 20);

    // Tier 1 — the suffixes that dominate real leaked lists.
    push('');
    if (opts.useNumbers) {
      ['1', '12', '123', '1234', '12345', '123456', '01', '007', '786', '111', '000', '321', '69', '123456789']
        .forEach(push);
    }
    if (opts.useSymbols) {
      ['!', '@', '#', '$'].forEach(push);
    }
    if (opts.useYears) {
      push(currentYear);
      push(currentYear - 1);
      push(currentYear + 1);
    }

    if (dob) {
      if (opts.useYears) {
        const yyyy = String(dob.year);
        push(yyyy);
        push(yyyy.slice(-2));
        for (let d = 1; d <= 5; d += 1) push(dob.year - d);
      }
      if (opts.useNumbers) {
        push(pad2(dob.day));
        push(pad2(dob.month));
        push(pad2(dob.day) + pad2(dob.month));
        push(pad2(dob.month) + pad2(dob.day));
      }
    }

    // Tier 2 — the meaningful numbers themselves, then their combinations
    // with symbols: Sunny@9591, 9591Sunny, Sunny#1990, Sunny@1996!
    numbers.forEach(push);
    if (opts.useNumbers && opts.useSymbols) {
      for (const n of comboNumbers) {
        for (const s of comboSymbols) {
          push(s + n);
          push(n + s);
        }
        for (const s of tripleSymbols) {
          push(s + n + s);
          push(s + n + '!');
        }
      }
    }

    // Tier 3 — full birth-year range.
    if (opts.useYears) {
      let from = clampInt(opts.yearFrom, 1900, 2100, 1980);
      let to = clampInt(opts.yearTo, 1900, 2100, currentYear);
      if (from > to) {
        const tmp = from;
        from = to;
        to = tmp;
      }
      for (let y = from; y <= to; y += 1) {
        push(y);
        push(String(y).slice(-2));
      }
    }

    // Tier 4 — simple numeric suffixes.
    if (opts.useNumbers) {
      const max = clampInt(opts.maxNumber, 0, 9999, 99);
      for (let i = 0; i <= max; i += 1) {
        push(i);
        if (i < 10) push('0' + i);
      }
    }

    // Tier 5 — symbols, and the wider symbol × number space.
    if (opts.useSymbols) {
      symbols.forEach(push);
      symbols.slice(0, 6).forEach((s) => {
        push('1' + s);
        push(s + '1');
      });
      push('!@#');
      push('123!');
      push('!@#$');

      if (opts.useNumbers) {
        const max = Math.min(clampInt(opts.maxNumber, 0, 9999, 99), 999);
        for (let i = 0; i <= max; i += 1) {
          for (const s of comboSymbols) {
            push(s + i);
            push(i + s);
          }
        }
      }

      const years = [currentYear, currentYear - 1];
      if (dob) years.push(dob.year);
      years.forEach((y) => {
        push(y + '!');
        push('!' + y);
        push(y + '@');
        push('@' + y);
      });
    }

    return out;
  }

  function buildPairSuffixes(opts, dob, now, input) {
    const out = [''];
    const symbols = opts.useSymbols ? parseSymbols(opts.symbols) : [];

    // Core suffixes first — pair + 123 is more likely than pair @ number.
    if (opts.useNumbers) {
      out.push('1', '12', '123', '1234', '12345', '01', '007', '69');
    }
    if (opts.useSymbols) {
      out.push('!', '@', '#');
    }
    if (opts.useYears) {
      const year = now.getFullYear();
      out.push(String(year), String(year - 1));
      if (dob) {
        out.push(String(dob.year));
        out.push(String(dob.year).slice(-2));
      }
    }
    if (dob && opts.useNumbers) {
      out.push(pad2(dob.day) + pad2(dob.month));
    }

    // Then symbol + important number pairs (name@9591).
    if (opts.useNumbers && opts.useSymbols) {
      const numbers = collectNumbers(input || {}, dob, opts, now).slice(0, 8);
      const combos = symbols.slice(0, 4);
      for (const n of numbers) {
        for (const s of combos) {
          out.push(s + n);
          out.push(n + s);
        }
      }
    }

    return Array.from(new Set(out));
  }

  /* ------------------------------------------------------------------ */
  /* options                                                             */
  /* ------------------------------------------------------------------ */

  function normalizeOptions(options) {
    const o = options || {};
    const currentYear = new Date().getFullYear();
    return {
      minLength: clampInt(o.minLength, 1, 128, 4),
      maxLength: clampInt(o.maxLength, 1, 128, 32),
      maxResults: clampInt(o.maxResults, 100, 1000000, 200000),
      useNumbers: o.useNumbers !== false,
      maxNumber: clampInt(o.maxNumber, 0, 9999, 99),
      useYears: o.useYears !== false,
      yearFrom: clampInt(o.yearFrom, 1900, 2100, 1980),
      yearTo: clampInt(o.yearTo, 1900, 2100, currentYear),
      useSymbols: o.useSymbols !== false,
      symbols: typeof o.symbols === 'string' ? o.symbols : DEFAULT_SYMBOLS.join(''),
      usePairs: o.usePairs !== false,
      useNumberPrefixes: o.useNumberPrefixes !== false,
      usePrefixSymbols: o.usePrefixSymbols === true,
      includeCommon: o.includeCommon !== false,
      leet: ['none', 'basic', 'full'].indexOf(o.leet) !== -1 ? o.leet : 'full',
      caseMode: ['all', 'lower', 'upper'].indexOf(o.caseMode) !== -1 ? o.caseMode : 'all'
    };
  }

  /* ------------------------------------------------------------------ */
  /* main generator                                                      */
  /* ------------------------------------------------------------------ */

  function generate(input, options) {
    const opts = normalizeOptions(options);
    const dob = parseDob(input && input.dob);
    const now = new Date();
    const cap = opts.maxResults;
    const tokens = buildTokens(input || {}, opts);
    const suffixes = buildSuffixes(opts, dob, now, input || {});
    const results = [];
    const seen = new Set();
    let truncated = false;

    if (!tokens.length) {
      return {
        passwords: results,
        truncated: false,
        tokenCount: 0,
        suffixCount: suffixes.length,
        maxResults: cap,
        dob: dob
      };
    }

    const add = (p) => {
      if (!p) return false;
      if (p.length < opts.minLength || p.length > opts.maxLength) return false;
      if (seen.has(p)) return false;
      if (results.length >= cap) {
        truncated = true;
        return false;
      }
      seen.add(p);
      results.push(p);
      return true;
    };

    const variantsByToken = tokens.map((t) => expandVariants(t, opts.leet, opts.caseMode));
    const singleLimit = Math.floor(cap * (opts.usePairs ? 0.65 : 0.94));
    const prefixLimit = opts.usePairs ? Math.floor(cap * 0.70) : cap;
    const numberPrefixLimit = opts.usePairs ? Math.floor(cap * 0.78) : cap;

    // Resumable iteration over every (suffix, token, variant) combination.
    // Stopping and resuming lets high-value pair combinations get room in
    // the middle of the list without starving the tail of the variants.
    let sIdx = 0;
    let tIdx = 0;
    let vIdx = 0;
    function pumpSingles(limit) {
      while (sIdx < suffixes.length) {
        const suffix = suffixes[sIdx];
        while (tIdx < variantsByToken.length) {
          const variants = variantsByToken[tIdx];
          while (vIdx < variants.length) {
            if (results.length >= limit) return false;
            add(variants[vIdx] + suffix);
            vIdx += 1;
          }
          vIdx = 0;
          tIdx += 1;
        }
        tIdx = 0;
        sIdx += 1;
      }
      return true;
    }

    // Stage 1 — single tokens with every suffix, most plausible first.
    pumpSingles(singleLimit);

    // Stage 2 — optional leading symbol (!Password1).
    if (opts.usePrefixSymbols && results.length < prefixLimit) {
      const prefixes = ['!', '@', '#'];
      const prefixSuffixes = ['', '1', '123', '!'];
      prefixStage:
      for (const pre of prefixes) {
        for (const suffix of prefixSuffixes) {
          for (const variants of variantsByToken) {
            for (const v of variants) {
              if (results.length >= prefixLimit) break prefixStage;
              add(pre + v + suffix);
            }
          }
        }
      }
    }

    // Stage 2b — number-first patterns (9591Sunny, 9591@Sunny).
    if (opts.useNumberPrefixes && opts.useNumbers && results.length < numberPrefixLimit) {
      const numbers = collectNumbers(input || {}, dob, opts, now).slice(0, 12);
      const syms = opts.useSymbols ? parseSymbols(opts.symbols).slice(0, 3) : [];
      numberStage:
      for (const n of numbers) {
        for (const variants of variantsByToken) {
          for (const v of variants) {
            if (results.length >= numberPrefixLimit) break numberStage;
            add(n + v);
            for (const s of syms) {
              if (results.length >= numberPrefixLimit) break numberStage;
              add(n + s + v);
              add(n + v + s);
            }
          }
        }
      }
    }

    // Stage 3 — two-field combinations (johnsmith123, smith.john!).
    if (opts.usePairs) {
      const bases = buildPairBases(input || {});
      if (bases.length > 1) {
        const pool = [];
        for (let i = 0; i < bases.length; i += 1) {
          for (let j = 0; j < bases.length; j += 1) {
            if (i === j) continue;
            for (const sep of PAIR_SEPARATORS) {
              pool.push(bases[i] + sep + bases[j]);
            }
          }
        }

        const variantPool = [];
        for (const base of pool) {
          const lower = base.toLowerCase();
          const cap2 = lower.charAt(0).toUpperCase() + lower.slice(1);
          const set = new Set([base, lower, cap2, lower.toUpperCase(), leetAll(lower, BASIC_LEET)]);
          set.forEach((v) => variantPool.push(v));
        }

        const pairSuffixes = buildPairSuffixes(opts, dob, now, input || {});
        pairStage:
        for (const suffix of pairSuffixes) {
          for (const v of variantPool) {
            if (results.length >= cap) break pairStage;
            add(v + suffix);
          }
        }
      }
    }

    // Stage 4 — finish any single-token variants that the staged budgets skipped.
    if (results.length < cap) pumpSingles(cap);

    // Stage 5 — published common passwords, if space remains.
    if (opts.includeCommon) {
      for (const p of COMMON_PASSWORDS) {
        if (results.length >= cap) break;
        add(p);
      }
    }

    if (results.length >= cap) truncated = true;

    return {
      passwords: results,
      truncated: truncated,
      tokenCount: tokens.length,
      suffixCount: suffixes.length,
      maxResults: cap,
      dob: dob
    };
  }

  return {
    generate: generate,
    // exposed for tests / advanced integrations
    _internals: {
      buildTokens: buildTokens,
      buildSuffixes: buildSuffixes,
      collectNumbers: collectNumbers,
      caseVariants: caseVariants,
      leetAll: leetAll,
      sanitize: sanitize,
      parseDob: parseDob,
      normalizeOptions: normalizeOptions,
      COMMON_PASSWORDS: COMMON_PASSWORDS
    }
  };
});
