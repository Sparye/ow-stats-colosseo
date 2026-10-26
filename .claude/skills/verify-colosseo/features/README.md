# Overwatch Stats Colosseo verification map

This directory is the maintained source for verifying what users see in Overwatch Stats Colosseo. Read this index before driving the app, then use the matching feature file as the recipe. Terms (Matchup, Slot, Leader, Score, Recent Players) are defined in `GLOSSARY.md`, and the intended behavior is in `docs/spec.md`.

## Baseline preconditions

- `$S launch` started this run (`S=.claude/skills/verify-colosseo/scripts/control.sh`), and `$S doctor` prints `HEALTHY`.
- A fresh run starts with `localStorage` empty, because `launch` clears it for the run's origin.
- OverFast is reachable, and the Test Players in `docs/test-players.md` still load.
- Never drive a dev server or tab this run didn't start.

## Driving conventions

- Start each recipe with a `goto` to the URL it names, rather than relying on where the last recipe left the page.
- Target elements by the accessible names the snapshot shows. Labels styled with `text-transform: uppercase` show up uppercased (`button "ADD"`, `combobox "BATTLETAG"`), while `aria-label`s keep their case (`button "Change Jingwen#11594"`).
- Use `click` for buttons and options, and confirm every action took effect with `wait`. Orca's input delivery is unreliable:
  - The first click after a `goto` often does nothing; retry it once.
  - Keys (`press`, `type`) do nothing while the tab's document doesn't have focus (`$S js "document.hasFocus()"` prints `false`).
  - Sometimes no input reaches the tab at all. To check, arm a listener with `$S js "(window.__ev = [], addEventListener('pointerdown', e => __ev.push(e.target.tagName), true), 1)"`, click, then read `$S js "JSON.stringify(__ev)"`. If it's empty, ask the user to bring the verification tab to the front in Orca. Never fake the action with a script-dispatched click.
- Wait on page state with `wait "<js>"`. `orca wait --text` doesn't match uppercased labels.
- Treat commands as literal; keep quoted names unchanged.

## Proof and skip reporting

- UI proof is an `.aria.txt` snapshot plus a `.png` screenshot, both showing the Matchup's BattleTags.
- Any change of state is backed by a second read: `js "location.search"` for the Matchup, and `js "localStorage.getItem('recentPlayers')"` for Recent Players.
- Name each artifact `<feature>-<step>` so it can be traced to its feature and entry point.
- When an entry point can't be reached, report the command you tried and the precondition that wasn't met. Don't count a different path as proof of it.

## Feature entry contract

Each feature file has an H1 title, one paragraph on what the user sees, and then exactly four H2 sections: `Sub-features`, `How to get to it (user POV)`, `Driving it with control.sh`, and `Gotchas`.

## Features

- [Build a Matchup](./build-matchup.md): adding, changing and removing Players, and BattleTag validation.
- [Recent Players](./recent-players.md): suggesting BattleTags that loaded before, and never ones that didn't.
- [Filters](./filters.md): Gamemode, Platform and Hero Scope.
- [Compare stats](./compare-stats.md): Leaders, Score, the stat sections, Season labels and layout by Player count.
- [Player states](./player-states.md): not found, no games and could-not-load messages in a Slot.
