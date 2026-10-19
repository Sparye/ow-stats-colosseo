# Overwatch Stats Colosseo — v1 spec

*Hero stats, head to head.*

Domain terms (**Matchup**, **Player**, **Slot**, **Team Order**, **Hero Scope**, **Stat Row**, **Fair Stat**, **Volume Stat**, **Best Stat**, **Sample Size**, **Leader**, **Score**, **Private Profile**) are defined in [`GLOSSARY.md`](../GLOSSARY.md) and used here exactly as defined.

## Stack and hosting

- Static single-page app: **Vite + React + TypeScript**, **TanStack Router** (Matchup state in typed, validated URL search params) and **TanStack Query** (per-Player fetching and caching). No backend, no TanStack Start. See [ADR 0001](adr/0001-static-spa-calling-overfast-directly.md).
- OverFast base URL comes from `VITE_OVERFAST_URL` and defaults to `https://overfast-api.tekrop.fr`. All OverFast calls go through one client module.
- Hosted on **Cloudflare Pages**.

## The Matchup

- Holds **2 to 5 Players**. It starts with two empty Slots. "+ Add player" appears until there are 5. Each Slot has a × to remove its Player, but a Matchup never goes below two Slots. Players can't be reordered in v1.
- One **Hero Scope** (a single hero or All Heroes), one **Gamemode** (Quick Play / Competitive) and one **Platform** (PC / Console), shared by every Player.
- Defaults: Hero Scope **All Heroes**, Gamemode **Competitive**, Platform **PC**.
- The hero picker lists every hero from `GET /heroes`, with portraits.

### URL

```
/?players=Name-1234,Other-5678,Third-9012&hero=ana&gamemode=competitive&platform=pc
```

- `players` lists BattleTags in Slot order, with `#` replaced by `-`.
- `hero` is a hero key or `all-heroes`.
- Invalid or unknown values fall back to the defaults. Anything after the 5th Player is dropped.
- Team colors are **not** in the URL (see Team Order).

## Adding a Player

1. The user types an exact BattleTag (`Name#1234`). A malformed tag is rejected inline.
2. A Player already in the Matchup (case-insensitive comparison) is rejected with "Already in this Matchup".
3. Fetch `GET /players/{Name-1234}/summary`. On a **404**, the Slot shows "Player not found (BattleTags are case-sensitive)".

> **Changed during build:** the spec originally said to fix capitalisation by searching `GET /players?name=`. OverFast's search turned out to be case-sensitive as well (`tekrop` and `Tekrop` find nothing; only `TeKrop` does), so there's nothing to fall back on. The error message tells the user instead.

## Data fetching

- For each Player, fetch **one** `GET /players/{id}/stats?gamemode=&platform=` (no `hero` parameter). It returns labelled stats for every hero they've played plus `all-heroes`, at about 30 KB. Switching hero reads from this response without another request. Changing Gamemode or Platform triggers a new fetch.
- Header data comes from `GET /players/{id}/summary`.
- OverFast returns the same empty stats for a **Private Profile** and for a Player with no games at all. Only then, check `GET /players?name={Name-1234}`, whose result carries `is_public`. A Player who has stats but not for the chosen hero gets the "no games" message without this check.
- Each Player loads, fails and retries on their own (one TanStack Query per Player per request). One slow or broken Slot never blocks the others.
- Stat labels come from the API's `label` field. Values are formatted by kind:
  - durations (in seconds) → `h:mm:ss` / `m:ss`
  - percentages and accuracy → `%`
  - per-10 averages → as given
  - large counts → thousands separators

## Stat sorting (Fair / Volume / Best)

Stats are sorted by their API key, with a short list of manual fixes for any hero where these rules get it wrong:

| Kind | Rule |
| --- | --- |
| **Best Stat** | key contains `_most_in_` or `_best` (checked first) |
| **Fair Stat** | `win_percentage`, or key ends in `_avg_per_10_min`, `_per_life`, or `accuracy` |
| **Volume Stat** | everything else |

**Sample Size** rows are `time_played` and `games_played`. They are always shown and never get a Leader.

**Lower-Is-Better Stats** are any key containing `deaths`. Every other stat is higher-is-better.

## Leader and Score

- On each Stat Row, only Players who have a value are compared. A row needs **at least 2** values to have a Leader.
- Every Player tied for the best value is a Leader, **unless every compared Player is tied**, in which case there is none.
- A Player without the stat shows "—".
- **Score** = Fair Stat rows the Player leads ÷ Fair Stat rows that have a Leader, shown as "Leads 9 of 14". A shared lead counts for each tied Player. Volume and Best Stats never count.

## Layout

Top to bottom:

1. Top bar: site name, Gamemode / Platform toggles, hero picker, gear icon for Settings.
2. **Player headers**: avatar, BattleTag, team code, Score, and Competitive rank. The rank shown is for the hero's role on the chosen Platform; for All Heroes it's the highest role rank. Namecard, title and endorsement aren't shown. The header bar uses the Slot's team color.
3. **Sample Size** rows.
4. **Fair Stats**: the hero's own stats first, then general ones.
5. **Volume Stats**: collapsible, collapsed by default.
6. **Best Stats**: collapsible, collapsed by default.
7. Footer: "Not affiliated with or endorsed by Blizzard Entertainment. Data from OverFast API."

Layout depends on how many Players there are:

- **2 Players**: Player 1's value on the left, the stat label in the middle, Player 2's value on the right.
- **3–5 Players**: the stat label on the left, then one value column per Slot.
- **Narrow screens with 3+ Players**: the label column stays pinned and the value columns scroll sideways inside the table. The page itself never scrolls sideways. The 2-Player layout fits a phone screen as is.

## Highlighting

- A Leader's value is **bold** on a light tint of their Slot's team color, with a small **▲** next to it so the lead doesn't rely on color alone.
- Text on full-strength team-color bars is black or white, whichever has more contrast.

## Team Order and Settings

- Each Slot's color comes from the viewer's **Team Order**. Players can't pick a color per Matchup.
- **Default Team Order**:
  1. Dallas Fuel (DAL, `#0072CE`)
  2. Shanghai Dragons (SHD, `#D22630`)
  3. Houston Outlaws (HOU, `#97D700`)
  4. Los Angeles Gladiators (GLA, `#3C1053`)
  5. Hangzhou Spark (HZS, `#FB7299`)
- **Settings** opens from the gear icon. It has one dropdown per Slot listing all 20 teams, each with a color preview and code. A team already used in another Slot can't be picked. There's a "Reset to default" button, and changes apply straight away to the Matchup on screen.
- Settings holds **only the Team Order** and saves it in `localStorage`. Every read and write is wrapped in try/catch. If storage is unavailable, the default order is used without any error shown.
- No team logos: a team is shown only as its color and three-letter code.

### Team highlight colors

Each team uses one bright color, picked from its official colors as listed in the [`owl-colors`](https://www.npmjs.com/package/owl-colors) package. The values are copied into our own table; the package itself is GPL-3.0 and is not a dependency.

| Code | Team | Color |
| --- | --- | --- |
| ATL | Atlanta Reign | `#910F1B` |
| BOS | Boston Uprising | `#174B97` |
| CDH | Chengdu Hunters | `#FFA000` |
| DAL | Dallas Fuel | `#0072CE` |
| FLA | Florida Mayhem | `#CF4691` |
| GLA | Los Angeles Gladiators | `#3C1053` |
| GZC | Guangzhou Charge | `#67A2B2` |
| HOU | Houston Outlaws | `#97D700` |
| HZS | Hangzhou Spark | `#FB7299` |
| LDN | London Spitfire | `#59CBE8` |
| NYE | New York Excelsior | `#0F57EA` |
| PAR | Paris Eternal | `#8D042D` |
| PHI | Philadelphia Fusion | `#F99E29` |
| SEO | Seoul Dynasty | `#AA8A00` |
| SFS | San Francisco Shock | `#FC4C02` |
| SHD | Shanghai Dragons | `#D22630` |
| TOR | Toronto Defiant | `#C10021` |
| VAL | Los Angeles Valiant | `#1888C6` |
| VAN | Vancouver Titans | `#2FB228` |
| WAS | Washington Justice | `#990034` |

## Look and feel

- **Light only** in v1. All colors are defined as tokens in one place, so a dark mode can be added later.
- The Overwatch League website is a **reference, not a template**: clean and light, with plenty of white space and thin dividers between Stat Rows, and no heavy shadows or gradients.
- Starting points:
  - white page with light-gray panels and near-black text
  - OWL orange (`#F99E1A`) used sparingly for brand, selected and focus states
  - bold, condensed, all-caps labels (Barlow Condensed)
  - numbers in Barlow with equal-width digits, so values line up down each column

## Errors

Every error appears inside that Player's Slot. The rest of the Matchup keeps working.

| Situation | Message |
| --- | --- |
| Player not found (after the case fallback) | "Player not found (BattleTags are case-sensitive)" |
| **Private Profile** | "This profile is private" |
| No games on the Hero Scope | "No Ana games in Competitive" (hero and Gamemode filled in) |
| OverFast is down or rate-limiting | "Couldn't load stats", with a Retry button |

## Testing

- **Vitest**, written test-first, for the rules that decide outcomes:
  - BattleTag parsing and normalisation
  - Fair / Volume / Best sorting, plus Lower-Is-Better detection
  - Leader selection (ties, all tied, missing values, fewer than 2 values)
  - Score
  - URL search-param parsing and its fallbacks
  - Team Order storage and its fallback
- A few component tests (React Testing Library) with OverFast responses faked: the 2-Player and 3+-Player layouts, a Private Profile in one Slot, and Leader highlighting.
- No browser end-to-end tests in v1.

## Out of scope for v1

- Searching for Players as you type (beyond the case-correction fallback)
- Reordering Players
- Each Player having their own Gamemode or Platform
- Dark mode
- Team logos
- Settings beyond Team Order
- More than 5 Players
