# Overwatch Stats Colosseo — v1 spec

*Hero stats, head to head.*

Domain terms (**Matchup**, **Player**, **Slot**, **Slot Color**, **Hero Scope**, **Season**, **Namecard**, **Title**, **Endorsement**, **Stat Row**, **Fair Stat**, **Volume Stat**, **Best Stat**, **Sample Size**, **Leader**, **Score**, **Hero Pool**, **Shared Hero**, **Private Profile**) are defined in [`GLOSSARY.md`](../GLOSSARY.md) and used here exactly as defined.

## Stack and hosting

- Static single-page app: **Vite + React + TypeScript**, **TanStack Router** (Matchup state in typed, validated URL search params) and **TanStack Query** (per-Player fetching and caching). No backend, no TanStack Start. See [ADR 0001](adr/0001-static-spa-calling-overfast-directly.md).
- OverFast base URL comes from `VITE_OVERFAST_URL` and defaults to `https://overfast-api.tekrop.fr`. All OverFast calls go through one client module.
- Hosted free on **Cloudflare Pages** at https://ow-stats-colosseo.pages.dev. `npm run deploy` builds and uploads `dist/` per `wrangler.jsonc`; with no `404.html`, unknown paths fall back to the SPA.

## The Matchup

- Holds **2 to 5 Players**. It starts with two empty Slots. Players can't be reordered in v1.
- **"+ Add player"** sits in the top bar, at the right end of the row with the filters, so it's seen before the stats. It's hidden (not disabled) once there are 5 Slots. Clicking it adds an empty Slot, puts the cursor in that Slot's BattleTag input, and scrolls the table sideways to show it if needed.
- An empty Slot shows the BattleTag form with an **Add** button.
- A filled Slot has a **Change** button at the right end of its name row, in the same spot as Add, and in every Slot, even in the two-Player layout. Change turns the header back into the BattleTag form, with the cursor in an empty input whose placeholder is the current tag. It's left empty so the Recent Players dropdown isn't narrowed down to that one tag. **Add** with a new tag swaps the Player while keeping the Slot's position and color. **Add** on an empty input, or with the same tag, puts the same Player back. There's no Cancel.
- When there are **more than two Slots**, the form also shows a **Remove** link. That covers both the Change form and empty Slots. A Matchup never goes below two Slots.
- One **Hero Scope** (a single hero or All Heroes), one **Gamemode** (Quick Play / Competitive) and one **Platform** (PC / Console), shared by every Player.
- Defaults: Hero Scope **All Heroes**, Gamemode **Competitive**, Platform **PC**.
- The hero picker lists every hero from `GET /heroes`, with portraits. It opens from the **hero cell**, the header-row cell beside the Player headers (between them with two Players, in the pinned label column with more):
  - With a hero picked, the cell shows its portrait, its name and a **Change Hero** button.
  - With All Heroes, "All Heroes" sits in a portrait-sized box where the portrait would be, with a **Select Hero** button below. The cell keeps the same height either way, so the header row doesn't jump.
  - Picking a hero keeps the page scrolled where it was.

### URL

```
/?players=Name-1234,Other-5678,Third-9012&hero=ana&gamemode=competitive&platform=pc
```

- `players` lists BattleTags in Slot order, with `#` replaced by `-`.
- `hero` is a hero key or `all-heroes`.
- `stats` is `volume`, `best` or `heroes` when the table is showing those; it's left out for Fair Stats, where every Matchup starts. `heroes` on a single hero falls back to Fair Stats.
- Invalid or unknown values fall back to the defaults. Anything after the 5th Player is dropped.

## Adding a Player

1. The user types an exact BattleTag (`Name#1234`). A malformed tag is rejected inline.
2. A Player already in the Matchup (case-insensitive comparison) is rejected with "Already in this Matchup".
3. Fetch `GET /players/{Name-1234}/summary`. On a **404**, the Slot shows the not-found message below. Blizzard hides some **Private Profiles** entirely, so a 404 can mean either a mistyped BattleTag or a Private Profile.

### Recent Players

Every BattleTag input offers **Recent Players** in a dropdown directly under it: the last 20 BattleTags whose summary loaded (so Private Profiles and Players with no games count, but a 404 never does), newest first. They're kept in this browser's `localStorage`, with the casing that last loaded, since BattleTags are case-sensitive. A Slot isn't offered Players who are in other Slots, since they'd be turned away, but its Change form does offer the Player already in it. The dropdown opens when the input gets the cursor and narrows to tags containing what's typed. Picking one with the mouse, or with ↓/↑ and Enter, places that Player straight away, without pressing Add. Escape closes it. It's our own popover, not the browser's `<datalist>`, whose native popup some embedded browsers (Orca's preview) draw away from the input. If storage is blocked, nothing is suggested and nothing else changes.

> **Changed during build:** the spec originally said to fix capitalisation by searching `GET /players?name=`. OverFast's search turned out to be case-sensitive as well (`tekrop` and `Tekrop` find nothing; only `TeKrop` does), so there's nothing to fall back on. The error message tells the user instead.

## Data fetching

- For each Player, fetch **one** `GET /players/{id}/stats?gamemode=&platform=` (no `hero` parameter). It returns labelled stats for every hero they've played plus `all-heroes`, at about 30 KB. Switching hero reads from this response without another request. Changing Gamemode or Platform triggers a new fetch.
- Header data comes from `GET /players/{id}/summary`.
- OverFast returns the same empty stats for a **Private Profile** and for a Player with no games at all. Only then, check `GET /players?name={Name-1234}`, whose result carries `is_public`. A Player who has stats but not for the chosen hero gets the "no games" message without this check.
- On All Heroes, also fetch one `GET /players/{id}/stats/summary?gamemode=&platform=` per Player, for the Heroes section. It's about 5–10 KB. It's asked for as soon as the Heroes tab is on offer, because the tab's bar shows before it's opened, and not at all on a single hero. If it fails, only that Player's Hero Pool is missing: the Slot and its Stat Rows carry on.
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
- **Score** = Stat Rows the Player leads ÷ Stat Rows that have a Leader, in the section on show (Fair, Volume or Best), shown as "Leads 9 of 14". It changes with the section tab. In the Heroes section it counts Shared Heroes instead (see Heroes section). A shared lead counts for each tied Player. Sample Size rows never count.
## Layout

Top to bottom:

1. Top bar: site name, then a row with the Gamemode / Platform toggles on the left and "+ Add player" at the right end.
2. **Player headers**: a thin strip in the Slot Color, then avatar, BattleTag, Title and Endorsement, Competitive rank, Change button and Score (see Player flair). In Competitive, the rank line also shows the **Season** the stats come from (`competitive.{platform}.season` in the summary). Blizzard only publishes Competitive stats for a Player's last season played, and OverFast keeps no history ([overfast-api#30](https://github.com/TeKrop/overfast-api/issues/30)), so combined multi-season Competitive stats aren't possible. The label makes it visible when Players' seasons differ. Quick Play shows no season. The rank shown is for the hero's role on the chosen Platform; for All Heroes it's the highest role rank. Headers aren't mirrored in the two-Player layout; only the values are.
3. **Section tabs**: Fair Stats, Volume Stats, Best Stats, on All Heroes also Heroes, then the **Sample Size** rows.
4. One of **Fair Stats** (the default), **Volume Stats** or **Best Stats**, each with the hero's own stats first, then general ones, under a one-line note saying what kind of stats they are, or the **Heroes** section. Only one section shows at a time; the others are a click away (see Section tabs).
5. Footer: "Not affiliated with or endorsed by Blizzard Entertainment. Data from OverFast API."

### Player flair

These all come from the summary the header already loads, so they add no requests. Anything a Player doesn't have is left out, and nothing else moves: Scores still line up along the bottom of the header row.

- **Namecard**: a faint background under the Slot Color strip, cropped from the left to keep the art on its right, and fading out towards the left. It's faint enough that the BattleTag, rank and Score stay readable on even an all-black Namecard. The Change form doesn't show it.
- **Title**: under the BattleTag, wrapping if it's long.
- **Endorsement**: the level's icon and number, beside the Title, with "Endorsement level N" on hover. OverFast's level 0 means it found no information, so that shows nothing.

### Section tabs

Slanted tabs under the header row switch which section shows, so no section is ever a long scroll away. There are three on a single hero, and a fourth, Heroes, on All Heroes. Each tab carries a thin bar split in Slot Colors by how many of that section's rows each Player leads, so the Matchup's shape shows before opening it (a long Volume bar for the Player with the most playtime is the usual sight). The open tab's section is also what the Score in each Player header counts.

- Click a tab, use ←/→/Home/End on a focused tab, or press **F**, **V**, **B** or **H** anywhere on the page except while typing or in a popover. **H** does nothing on a single hero. Screens with a mouse show the key on each tab.
- Switching while scrolled into the Stat Rows brings the table back to the top of the Sample Size, right under the stuck band, so the new section starts from its first row.
- The choice lives in the URL (`stats`), so a shared link opens on the same section.
- On phones the tabs drop the word "Stats".

### Heroes section

Only on All Heroes, since it's about all of a Player's heroes at once. Picking a single hero anywhere, including from this section, moves to Fair Stats. The Sample Size rows stay above it.

- **Hero Pool** row: under each Player, their heroes as small portraits, most time played first and sized by time played, with the top hero biggest. **Shared Heroes** have an orange ring and full color; the others are grayed down, so the overlap shows at a glance. The top 8 show, then a "+N more" button that shows the rest. Heroes with no games (a brief swap, which OverFast reports with a 0% win rate) aren't in a Hero Pool.
- **Tally** row: "Leads on 7 of 11 shared heroes" per Player, out of the Shared Heroes that have a Leader. Those two numbers are also that Player's Score while this section is open.
- One row per **Shared Hero**: its portrait and name, then each Player's win rate, KDA and games, or "—" for a Player who hasn't played it. The Leader is on win rate and looks like a Stat Row's Leader. Heroes that can have a Leader come first, then the most played across all Players.
- Under **3 games** a Player's win rate is dimmed and can't lead or be compared, and a note above the rows says so. A hero needs two Players with 3 or more games to have a Leader, and if none does, the note says that as well.
- Clicking a portrait, or anywhere on a Shared Hero's row, sets the Hero Scope to that hero and opens its Fair Stats, from the top of the table.
- Two Players share the mirrored layout (the Hero Pool row runs outward from the label, biggest first), and 3–5 Players the column layout, so everything sits under its Player's header. Phones don't scroll the page sideways.
- A Player still loading shows "Loading…", one whose request failed shows "Couldn't load this Hero Pool", and one with no games shows "—". They're left out of the comparison until they load.

On screens at least 700px tall, the controls row and the header row (Player headers, hero cell and section tabs) stick to the top of the page as one band while the Stat Rows scroll under it. The site name scrolls away. The band has a solid background across the full screen width, and a soft shadow under it once Stat Rows are underneath. On shorter screens nothing sticks: the band would cover too many Stat Rows. Changing any control keeps the page scrolled where it was.

Layout depends on how many Players there are:

- **2 Players**: Player 1's value on the left, the stat label in the middle, Player 2's value on the right.
- **3–5 Players**: the stat label on the left, then one value column per Slot. With 4–5 Players the label column narrows (about 10rem instead of 15rem) and long labels wrap onto two lines.
- **Narrow screens with 3+ Players**: the label column stays pinned and the value columns scroll sideways inside the table. A soft shadow on an edge shows there are columns hidden on that side. The header row scrolls sideways with the Stat Rows, whichever one is swiped, even while it's stuck to the top. The page itself never scrolls sideways. The 2-Player layout fits a phone screen as is.

### Width

Like an inline database in Notion, the text stays compact and only the table grows:

- The top bar and footer sit in a **centered column about 900px wide**, the width of the 2-Player table. On narrower screens they fill the screen with 16px gutters.
- The **table** breaks out of that column, growing evenly on both sides so it stays centered. It's only as wide as its columns need (the label column plus about 13rem per Slot), never stretched to fill the screen, and at most the screen width minus gutters. Past that it scrolls sideways as above. Five Players fit a 1280px-wide screen without scrolling.
- The width snaps when a Slot is added or removed, with no animation.
- **Player headers never widen their column.** The BattleTag input shrinks, Add / Change / Remove stay visible, and long BattleTags and Titles wrap.

## Highlighting

- A Leader's value is **bold** on a light tint of their **Slot Color**, with a small **▲** next to it so the lead doesn't rely on color alone.

## Slot Colors

Each Slot has a fixed color, the same for everyone. There are no color settings, nothing about them is stored in the browser, and team names and codes never appear. The colors come from Overwatch League teams, using values listed in the [`owl-colors`](https://www.npmjs.com/package/owl-colors) package (copied, not a dependency).

| Slot | Color | Source |
| --- | --- | --- |
| 1 | `#0072CE` blue | Dallas Fuel |
| 2 | `#D22630` red | Shanghai Dragons |
| 3 | `#97D700` green | Houston Outlaws |
| 4 | `#3C1053` purple | Los Angeles Gladiators |
| 5 | `#FB7299` pink | Hangzhou Spark |

> **Changed after v1:** the per-viewer Team Order, its Settings panel and `localStorage` were removed, along with the team code shown in each header.

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
| Player not found (404) | "Player not found. Check the BattleTag (it's case-sensitive) and that the profile is public." When OverFast's 404 carries `next_check_at`, add "Try again after {local time}.", since until then OverFast repeats the 404 without asking Blizzard. |
| **Private Profile** (found, but empty stats and `is_public: false`) | "This profile is private. They can make it public in Overwatch under Options → Social → Career Profile Visibility." |
| No games on the Hero Scope | "No Ana games in Competitive" (hero and Gamemode filled in) |
| OverFast is down or rate-limiting | "Couldn't load stats", with a Retry button |

## Testing

- **Vitest**, written test-first, for the rules that decide outcomes:
  - BattleTag parsing and normalisation
  - Fair / Volume / Best sorting, plus Lower-Is-Better detection
  - Leader selection (ties, all tied, missing values, fewer than 2 values)
  - Score
  - URL search-param parsing and its fallbacks
  - Hero Pools, Shared Heroes, their Leaders and the tally
- A few component tests (React Testing Library) with OverFast responses faked: the 2-Player and 3+-Player layouts, a Private Profile in one Slot, Leader highlighting, Change / Remove, "+ Add player" focusing the new Slot, and the Heroes section.
- No browser end-to-end tests in v1.

## Out of scope for v1

- Searching for Players as you type (beyond the case-correction fallback)
- Reordering Players
- Each Player having their own Gamemode or Platform
- Dark mode
- Team names, codes or logos anywhere in the Matchup
- Any settings
- More than 5 Players
