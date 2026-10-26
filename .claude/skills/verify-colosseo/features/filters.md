# Filters

The top bar sets what every Player in the Matchup is compared on: the Gamemode (Competitive or Quick Play), the Platform (PC or Console), and the Hero Scope (one hero, or All Heroes). Each choice is stored in the URL and applies to all Slots at once.

## Sub-features

- `filter-gamemode`: switches between `gamemode=competitive` and `gamemode=quickplay`.
- `filter-platform`: switches between `platform=pc` and `platform=console`.
- `filter-hero`: the hero button opens a picker, grouped by role, with All Heroes at the top. Picking a hero closes the picker and changes `hero=`.

## How to get to it (user POV)

- The Gamemode and Platform toggles in the top bar.
- The hero button in the top bar, named after the current hero.
- A shared URL with `hero=`, `gamemode=` and `platform=` set.

## Driving it with control.sh

Preconditions:

- `$S doctor` prints `HEALTHY`.

- **Start.** Run `$S goto '/?players=Jingwen-11594,JigglyPuff-11568&hero=ana&gamemode=competitive&platform=pc'` and then `$S wait "document.querySelectorAll('.score').length === 2"`.
- **Gamemode.** Run `$S orca click --element $($S ref 'radio "QUICK PLAY"')` and then `$S wait "location.search.includes('gamemode=quickplay')"`. The Season labels disappear from the Slot headers.
- **Platform.** Run `$S orca click --element $($S ref 'radio "CONSOLE"')` and then `$S wait "location.search.includes('platform=console')"`. Each Slot shows a stat table or a no-games message for Console.
- **Hero picker.** Run `$S press 'button "ANA"'`. The snapshot shows the `Choose a hero` popover with the role headings `Tank`, `Damage` and `Support`. Then run `$S press 'button "Kiriko"'` and `$S wait "location.search.includes('hero=kiriko')"`. The table becomes `table "Kiriko stats"`, and the popover is closed.
- **All Heroes.** Run `$S press 'button "KIRIKO"'`, then `$S press 'button "All Heroes"'`, then `$S wait "location.search.includes('hero=all-heroes')"`. The table becomes `table "All Heroes stats"`.
- **Proof.** Take `$S snap filters-final` and `$S shot filters-final`.

## Gotchas

- The hero button's name changes with the hero, so take a fresh `ref` after every pick.
- Inside the popover, hero buttons may appear in mixed case (`"Kiriko"`) while the top-bar button is uppercase (`"KIRIKO"`). Use the snapshot to check which you're targeting.
- Switching Gamemode or Platform re-fetches every Player. Wait on `.score` or `.message` before asserting.
