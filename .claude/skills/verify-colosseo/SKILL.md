---
name: verify-colosseo
description: Drive Overwatch Stats Colosseo (the React web app in this repo) in a real browser to prove a UI change works, using a private Vite dev server and a private tab in Orca's built-in browser, and capture snapshots and screenshots as evidence. Use after changing anything a user sees (Slots, BattleTag form, Recent Players, filters, Stat Rows, Leaders, Score), or when asked to "verify", "check in the browser", or "prove it works".
---

# Verify Overwatch Stats Colosseo

The app is a static React SPA (`src/`) that calls the public OverFast API (`https://overfast-api.tekrop.fr`) straight from the browser. There's no backend, database, or login. Everything a user does lives in the URL (`?players=&hero=&gamemode=&platform=`) plus one `localStorage` key, `recentPlayers`. Words like Matchup, Slot, Leader and Score are defined in `GLOSSARY.md`.

Every step goes through `scripts/control.sh`, run from anywhere in the repo:

```bash
S=.claude/skills/verify-colosseo/scripts/control.sh
```

It needs `orca` (Orca's CLI, which drives its built-in Chromium), `jq`, `curl`, `lsof` and `node`. If `orca` isn't on `PATH`, stop and report that. Don't drive the user's own browser tabs instead.

## Launch

```bash
$S launch
```

What `launch` does:
- Runs `npm ci` if `node_modules` is missing.
- Picks the first free port in 5300-5399 and starts Vite there with `--strictPort`.
- Waits for the page `<title>`.
- Opens a new Orca tab on that port and waits until the top bar has rendered.
- Empties that origin's `localStorage`, so Recent Players starts empty. A port can be reused once an earlier run is cleaned up, and the Orca profile keeps storage per origin.
- Prints `READY http://localhost:<port> (run <id>, page <id>)`.

Run state lives in `.verify-runs/<run-id>/` (gitignored). Later commands act on the most recent run, or on `VERIFY_RUN_ID=<id>` if set, which lets two runs work side by side.

Never drive the user's own dev server (often on 5173-5179) or their tabs. That would change their URL and their Recent Players.

## Doctor

```bash
$S doctor
```

Read-only. Checks:
- The Vite process this run started is alive and owns the port.
- The port serves the app.
- This run's Orca tab is still open on that URL.
- OverFast answers.

Prints `HEALTHY` or lists every `FAIL`. Run it first whenever anything looks off. If OverFast is down, every Player shows "Couldn't load stats". That's an outage, not an app bug, so report it that way.

## Drive

Load a Matchup by URL, wait for the Slots, then act through accessible names from the snapshot:

```bash
$S goto '/?players=Jingwen-11594,JigglyPuff-11568&hero=ana&gamemode=competitive&platform=pc'
$S wait "document.querySelectorAll('.score').length === 2"   # both Slots loaded and scored
$S click 'button "Change Jingwen#11594"'                      # opens the form, cursor in the input
$S type 'combobox "BATTLETAG"' 'Alone2die#1446'               # fill + Enter
$S wait "location.search.includes('Alone2die-1446')"
$S js "localStorage.getItem('recentPlayers')"
```

| Command | What it does |
| --- | --- |
| `goto <path>` | Opens a page of this run's app. |
| `ref <text>` | Prints the snapshot ref (`e14`) of the first line containing `<text>` literally. |
| `click <text>` | Clicks that element with the mouse. |
| `press <text>` | Focuses that element and presses Enter. |
| `type <text> <value>` | Fills that input and presses Enter. |
| `wait <js>` | Waits up to 20s for the expression to be true. |
| `js <js>` | Prints a value read from the page. |
| `orca <cmd> …` | Runs any other `orca` browser command, with `--page` and `--json` added for you (for example `$S orca click --element e7`). |

To see the names you can target, run `$S orca snapshot | jq -r .result.snapshot`.

Stable handles, as the snapshot shows them:
- **Slots:** `columnheader "<Name>#<digits>"` for a filled Slot, `columnheader "Empty slot"` for an empty one, and `columnheader "Stat"` for the hero cell.
- **Slot buttons:** `button "Change <Name>#<digits>"`, plus `button "ADD"` and `button "Remove"` inside the BattleTag form.
- **BattleTag input:** `combobox "BATTLETAG"`, with `aria-expanded` saying whether its Recent Players dropdown is open.
- **Recent Players dropdown:** `listbox "Recent Players"` containing `option "<Name>#<digits>"`. It opens when the input gets the cursor, narrows as you type, and picking an option places that Player straight away. It's a popover in the top layer, so it shows in screenshots.
- **Top bar:** `radio "COMPETITIVE"`, `radio "QUICK PLAY"`, `radio "PC"`, `radio "CONSOLE"`, `button "+ ADD PLAYER"`. The hero button is named after the current hero (`button "ANA"`, `button "ALL HEROES"`).
- **Hero picker:** a popover whose buttons are named after heroes.
- **Stat table:** `table "<Hero> stats"`, with sections `rowgroup "Sample Size"`, `"Fair Stats"`, `"Volume Stats"` and `"Best Stats"`.
- **Stat Rows:** a `rowheader` for the label. A Leader's cell is named `"<value>, leads"`.
- **CSS hooks for `wait`/`js`:** `.score` (one per Slot that has a Score), `.message` (Slot errors and statuses), `.add-player`.

Test Players with real data are listed in `docs/test-players.md`. For a BattleTag that's guaranteed not to exist, use `Ghost#9999`.

## Evidence

```bash
$S snap <name>   # evidence/<name>.aria.txt, the accessibility snapshot
$S shot <name>   # evidence/<name>.png, the viewport screenshot
```

Everything lands in `.verify-runs/<run-id>/evidence/`, next to `actions.log`, which records every `goto`/`click`/`press`/`type`/`orca`/`snap`/`shot` this run made. Name files `<feature>-<step>`.

Proof standards:
- Drive the real user path: URL, buttons, the BattleTag form. Never seed `localStorage` or call React internals to make a state appear. The one exception is reading values back with `js`.
- Capture the action and what it led to, not only the last screen. Take a snapshot before and after any change.
- Check side effects as well as what's on screen. The URL query (`js "location.search"`) is the Matchup's real state, and `recentPlayers` in `localStorage` is the Recent Players state.
- Data comes live from OverFast, and real Players keep playing. Assert on structure (Slot loaded, a Leader exists, `Leads N of M` appears), never on exact stat values.

## Cleanup

```bash
$S cleanup
```

Closes this run's Orca tab and stops only the Vite process it started. It never kills by process name. It then deletes the run's state, but keeps `.verify-runs/<run-id>/evidence/`. Run it after every attempt, including failed ones. Delete old evidence folders by hand when they're no longer needed.

## Feature map

`features/README.md` indexes the user-facing features, with one recipe per file. When a change touches a feature, drive every entry point its file lists.
