# Benchmark and Rank-Adjusted Win Rate

With a single hero, the Benchmark toggle adds a faded column after the Slots with the hero's Global Win Rate, pick rate and ban rate. In Competitive, each Player's win rate has their Rank-Adjusted Win Rate under it, such as "+4.2 vs Gold", and the Rank-adjusted toggle makes that decide the win rate row's Leader.

## Sub-features

- `benchmark-toggle`: `switch "BENCHMARK"` adds `benchmark=on` and the `columnheader "Benchmark"`. Disabled on All Heroes.
- `benchmark-tier`: `combobox "Rank tier"` defaults to the Players' highest Rank Tier for the hero's role and changes `tier=`. Not shown in Quick Play.
- `benchmark-region`: `combobox "Region"` defaults to All regions and changes `region=`. Its hover says what's averaged.
- `rank-adjusted-note`: `.win-rate-note` under each ranked Player's win rate, in Competitive with a single hero.
- `rank-adjusted-toggle`: `switch "RANK-ADJUSTED"` adds `adjusted=on`, moves the win rate row's Leader and the Score, and shows "No rank" for Players without a rank. Disabled in Quick Play and on All Heroes.

## How to get to it (user POV)

- The two switches in the controls row, once a hero is picked.
- The two pickers in the Benchmark's header.
- A shared URL with `benchmark=on`, `tier=`, `region=` or `adjusted=on`.

## Driving it with control.sh

Preconditions:

- `$S doctor` prints `HEALTHY`.
- The ranked Test Players in `docs/test-players.md` still have a Support rank.

- **Start.** Run `$S goto '/?players=TeKrop-2217,Alone2die-1446,JigglyPuff-11568&hero=ana&gamemode=competitive&platform=pc'` and then `$S wait "document.querySelectorAll('.score').length === 3 && document.querySelectorAll('.win-rate-note').length === 1"`.
- **Rank-adjusted.** Run `$S click 'switch "RANK-ADJUSTED"'` and then `$S wait "location.search.includes('adjusted=on')"`. Only one Player has a rank, so the win rate row has no Leader, the other two show "No rank", and each Score's "of" drops by one.
- **Benchmark.** Run `$S goto '/?players=TeKrop-2217,Seagull-1894&hero=ana&gamemode=competitive&platform=pc'`, `$S wait "document.querySelectorAll('.score').length === 2"`, `$S click 'switch "BENCHMARK"'` and then `$S wait "document.querySelector('.benchmark-rates')?.textContent.includes('Pick')"`. The title is "Avg Diamond Ana", and the win rate row ends in a percentage while other rows end in "—".
- **Pickers.** Run `$S orca select --element $($S ref 'combobox "Region"') --value asia` and then `$S wait "location.search.includes('region=asia')"`. Run `$S orca select --element $($S ref 'combobox "Rank tier"') --value gold` and then `$S wait "document.querySelector('.benchmark-title').textContent === 'Avg Gold Ana'"`.
- **Quick Play.** Run `$S click 'radio "QUICK PLAY"'` and then `$S wait "location.search.includes('gamemode=quickplay')"`. The Rank tier picker, ban rate and `.win-rate-note`s are gone, and `switch "RANK-ADJUSTED"` is disabled.
- **All Heroes.** Run `$S goto '/?players=TeKrop-2217,Seagull-1894&hero=all-heroes&benchmark=on'`. Both switches are disabled with "Pick a hero", and there's no Benchmark column.
- **Proof.** Take `$S snap benchmark-final` and `$S shot benchmark-final`.

## Gotchas

- Real Players' numbers rarely make the raw and adjusted Leaders differ between two ranked Players, since the Global Win Rate only varies a few points between Rank Tiers. The faked OverFast in `src/matchup/MatchupPage.test.tsx` covers that case.
- `$S orca viewport` is undone by `$S goto`, so set it after navigating.
- Each All-regions average is 3 requests per Rank Tier, so give them a moment after any change. Wait on `.benchmark-rates` or `.win-rate-note`.
