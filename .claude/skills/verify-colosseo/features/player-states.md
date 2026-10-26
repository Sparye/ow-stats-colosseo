# Player states

A Slot whose Player can't be compared explains why in its own header, while the rest of the Matchup carries on. A Player may not be found (a typo or a hidden Private Profile), may have no games on the hero, may be a Private Profile, or may fail to load.

## Sub-features

- `state-not-found`: shows `Player not found. Check the BattleTag (it's case-sensitive) and that the profile is public.`, sometimes followed by `Try again after <time>.`
- `state-no-games`: shows `No <Hero> games in <Gamemode> on <Platform>`.
- `state-private`: shows `This profile is private. …`
- `state-error`: shows `Couldn't load stats` with a Retry link.

## How to get to it (user POV)

- Type or link a BattleTag that doesn't exist, or one with the wrong capitalization.
- Pick a hero the Player has never played in that Gamemode and Platform.

## Driving it with control.sh

Preconditions:

- `$S doctor` prints `HEALTHY`.
- None of the Test Players has Competitive Genji games on PC (checked 2026-10-26).

- **Not found.** Run `$S goto '/?players=Jingwen-11594,Ghost-9999&hero=ana&gamemode=competitive&platform=pc'` and then `$S wait "document.body.innerText.includes('Player not found')"`. The `Ghost#9999` Slot shows the not-found message, and the Jingwen Slot still loads.
- **Wrong case.** Run `$S goto '/?players=jingwen-11594,JigglyPuff-11568&hero=ana&gamemode=competitive&platform=pc'`. The `jingwen#11594` Slot shows the not-found message.
- **No games.** Run `$S goto '/?players=Jingwen-11594,JigglyPuff-11568&hero=genji&gamemode=competitive&platform=pc'` and then `$S wait "document.querySelectorAll('.message').length === 2"`. Both Slots read `No Genji games in Competitive on PC`.
- **Proof.** Take `$S snap player-states-not-found` and `$S shot player-states-not-found` after the first step, and the same for no games.

## Gotchas

- Private Profiles and load errors can't be produced on demand with real profiles. `src/matchup/MatchupPage.test.tsx` covers them with a fake OverFast; report them as not driven rather than faking them in the browser.
- OverFast caches a 404 and may add `Try again after …`. That's expected.
- If a Test Player plays Genji, the no-games step stops reproducing. Pick another hero missing from `curl -s 'https://overfast-api.tekrop.fr/players/<id>/stats?gamemode=competitive&platform=pc' | jq -r 'keys'`.
