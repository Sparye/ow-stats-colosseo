# Test Players

Real, public Overwatch profiles to use when checking the app by hand or with the verify skill. All three have Competitive Ana games on PC (checked 2026-10-26).

| BattleTag | URL form |
| --- | --- |
| `Jingwen#11594` | `Jingwen-11594` |
| `JigglyPuff#11568` | `JigglyPuff-11568` |
| `Alone2die#1446` | `Alone2die-1446` |

A three-Player Ana Matchup in Competitive on PC:

```
/?players=Jingwen-11594,JigglyPuff-11568,Alone2die-1446&hero=ana&gamemode=competitive&platform=pc
```

These are other people's accounts, so the data changes as they play, and they can go private at any time. Assert on structure (a Slot loads, a Stat Row has a Leader, a Score appears), not on exact numbers. If one stops loading, check it with `curl -s -o /dev/null -w '%{http_code}' https://overfast-api.tekrop.fr/players/<URL form>/summary` and replace it here.

For states that real profiles can't reliably show (not found, private, no games), use the faked OverFast in `src/matchup/MatchupPage.test.tsx`. `Ghost-9999` is a safe tag that doesn't exist.
