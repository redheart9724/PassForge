# PassForge

**Context-aware candidate password generator for authorized security testing.**

PassForge turns the details a person leaves behind — names, dates of birth, phone numbers, pet names, Wi-Fi SSIDs, hobbies — into a de-duplicated, length-filtered candidate wordlist. It is built for penetration testers, incident responders, red teams, and anyone running a legitimate password audit.

Everything runs **100% client-side** in a single browser tab. There is no backend, no analytics, no cookie, and no network request after the page loads.

> **Authorized use only.** Use PassForge against accounts and systems you own or have explicit written permission to test. See [Legal & ethics](#legal--ethics).

---

## Features

- **Rich target profile** — first/last name, nickname, DOB, mobile, email, partner, child, pet, company, city, Wi-Fi name, team, hobby, important numbers, plus arbitrary keywords.
- **Deep combinatorial expansion**
  - Letter-case variants (as-typed, lower, UPPER, Capitalized, segment-cased)
  - Leetspeak — basic (`a→4, e→3, i→1, o→0, s→5, t→7`) or full (`i→1/!`, `s→5/$`, `a→4/@`, …)
  - Numeric suffixes (configurable range, zero-padded)
  - Year suffixes (DOB year, birth-year ±5, configurable range, current year)
  - Symbol suffixes, leading symbols, symbol+number patterns (`@9591`, `#1996`, `@1996!`)
  - Meaningful numbers mined from **both ends** of the phone number, DOB fragments, vehicle/PIN numbers and free text
  - Two-field combinations with `.`, `_`, `-` and no separator (`johnsmith123`, `smith.john!`)
  - Published common passwords (optional)
- **Smart de-duplication** — a `Set`-backed pipeline guarantees unique output.
- **Filtering** — minimum / maximum password length.
- **Bounded generation** — hard result cap (default 200,000, max 1,000,000) with clear truncation warnings.
- **Export** — copy the entire list in one click, or download `.txt` / `.csv`.
- **Fast & private** — pure JavaScript, no dependencies, no build step, works offline.

---

## Quick start

### Option 1: Open locally

```bash
git clone https://github.com/<your-user>/passforge.git
cd passforge
```

Then open `index.html` in any modern browser. No server required.

### Option 2: Serve locally (recommended for clipboard testing)

```bash
cd passforge
npx --yes serve .
# or: python -m http.server 8000
```

Clipboard access requires a secure context (`https://` or `localhost`), so prefer this over `file://` if you want the **Copy all** button to work.

---

## Deploy to GitHub Pages

1. Create a new GitHub repository named `passforge` (public).
2. Push the contents of this folder to the `main` branch:

   ```bash
   cd passforge
   git init
   git add .
   git commit -m "PassForge: client-side candidate password generator"
   git branch -M main
   git remote add origin https://github.com/<your-user>/passforge.git
   git push -u origin main
   ```

3. In the repository: **Settings → Pages → Build and deployment**
   - **Source:** Deploy from a branch
   - **Branch:** `main`
   - **Folder:** `/ (root)`
4. Save. After a minute the tool is live at:

   ```
   https://<your-user>.github.io/passforge/
   ```

No build step, no secrets, no Actions workflow required. If you want a custom domain, add it under **Settings → Pages → Custom domain**.

> Tip: if you put the files in a subfolder (e.g. `docs/`), select that folder as the Pages source instead.

---

## Using the tool

1. Fill in whatever you know about the target. Every field is optional, but more context means better coverage.
2. Adjust **Generation options**:
   - **Max results** — raise it for deeper coverage (max 1,000,000).
   - **Numeric suffixes up to** — `99` covers `name0` … `name99`; `9999` is much heavier.
   - **Leet substitutions** — full is recommended; disable for smaller, cleaner lists.
   - **Two-field combinations** — name + pet, first + last, name + year, etc.
   - **Leading symbols** — adds `!Password1`-style candidates.
3. Hit **Generate passwords** (or `Ctrl`/`Cmd` + `Enter`).
4. Use **Copy all**, **Download .txt**, or **Download .csv**.

### Reading the result panel

- The **badge** shows the exact number of candidates.
- **Preview** shows the first 300 entries only — Copy/Download always contain the full list.
- A yellow status means the result cap was reached. Raise **Max results**, or narrow the options if you want different coverage rather than more results.

---

## How generation works

For each input field PassForge derives base tokens:

| `Sharma_5G` (Wi-Fi) | `Sharma5G`, `Sharma`, `5G`, `S5` |

Each token is expanded with case + leet variants, then combined with suffixes in priority order:

1. core patterns (`123`, `1234`, `!`, `@`, current year)
2. meaningful numbers from the profile — both ends of the phone number, DOB fragments, vehicle/PIN numbers, anything typed into **Important numbers**
4. the full birth-year range
5. the numeric range
6. the wider symbol × number space


Generation is deterministic for the same inputs and options, and output is de-duplicated.

### CLI / automation

The engine is dependency-free and usable from Node.js:

```js
const fs = require('node:fs');
const { generate } = require('./engine.js');

const result = generate(
  {
    firstName: 'Rahul',
    lastName: 'Sharma',
    dob: '1990-05-14',
    phone: '9876543210',
    petName: 'Bruno',
    wifiName: 'Sharma_5G',
    numbers: '9591, 4321'
  },
  { maxResults: 50000, leet: 'full', usePairs: true }
);

fs.writeFileSync('wordlist.txt', result.passwords.join('\n'));
console.log(result.passwords.length, 'candidates', result.truncated ? '(capped)' : '');
```

### Tests

```bash
npm test
```

Runs the Node test suite in `tests/engine.test.js` (no dependencies).

---

## Options reference

| Option | Default | Notes |
| --- | --- | --- |
| Minimum length | 4 | Candidates shorter than this are discarded |
| Maximum length | 32 | Candidates longer than this are discarded |
| Max results | 200,000 | Hard cap; 1,000,000 maximum |
| Numeric suffixes up to | 99 | `0 … N`, plus zero-padded `00 … 09` |
| Append years | on | DOB year ±5, current year ±1, configurable range |
| Append symbols | on | Symbols from the Symbols field |
| Symbols to use | `!@#$%&*?._-+` | Any non-space characters |
| Two-field combinations | on | Uses names, pet, partner, child, company, city |
| Leading symbols | off | `!Password1`, `@Password123` |
| Common passwords | on | Short published top-password list |
| Leet substitutions | full | `none`, `basic`, `full` |
| Letter case | all | `all`, `lower`, `upper` |

---

## Privacy

- No `fetch`, no XHR, no WebSocket, no third-party fonts or scripts.
- No localStorage/sessionStorage — nothing is persisted between visits.
- Inputs live only in the page's memory and disappear when you close or refresh the tab.
- Copy and download actions are handled entirely by the browser.

You can verify this by opening DevTools → Network and generating a list. After the initial page load you should see no requests.

---

## Legal & ethics

PassForge is a profiling helper, not an attack tool. It generates **guesses**; it does not authenticate, spray, or connect to anything.

Use it only when you have **explicit written authorization** — for example:

- a signed penetration-test scope,
- an internal password audit,
- incident response on systems you are responsible for,
- CTF/lab environments you own.

Unauthorized access to computer systems is illegal in most jurisdictions (for example the U.S. CFAA, U.K. Computer Misuse Act, India IT Act 2000). The author accepts no liability for misuse or damage caused by this tool.

Also consider:

- Account lockout and rate-limiting policies before testing.
- Data-handling rules: generated lists are sensitive; delete them after the engagement.
- Reporting obligations if real credentials are discovered.

---

## Limitations

- Candidate quality depends entirely on the accuracy of the supplied details.
- Unknown private numbers cannot be guessed. If a password might contain `9591`, put it in **Important numbers** (or anywhere in the free-text fields) and it will be used in symbol/number combinations.
- The cap means very large option sets are truncated; raise the cap or split the work.
- This is not a rule engine like Hashcat; it produces candidates, not crack attempts.
- Browser generation of several hundred thousand strings can take a second or two on slower machines.

---

## License

MIT — see [LICENSE](LICENSE).
