# Overwatch Stats Colosseo

A site where Overwatch players line up their career stats on one hero and see, stat by stat, who comes out ahead.

## Language

### The comparison

**Matchup**:
A comparison of two to five Players on one Hero Scope, Gamemode and Platform, all shared across every Player in it.
_Avoid_: Comparison, versus, battle

**Player**:
An Overwatch account taking part in a Matchup, identified by its BattleTag (`Name#1234`).
_Avoid_: User, profile, account, contender

**Recent Players**:
BattleTags that loaded before in this browser, suggested when typing a BattleTag.
_Avoid_: History, favorites, saved players

**Slot**:
A Player's position in a Matchup, numbered 1 to 5 from left to right.
_Avoid_: Column, side, seat

**Slot Color**:
The fixed color that marks a Slot, the same for everyone who views the Matchup.
_Avoid_: Team color, theme, palette

**Hero Scope**:
The hero a Matchup is about: either a single hero or "All Heroes".
_Avoid_: Hero filter, hero selection

**Gamemode**:
Quick Play or Competitive.
_Avoid_: Mode, queue

**Platform**:
PC or Console.

**Season**:
The one Competitive season a Player's Competitive stats cover: the last season they played, which can differ between Players. Quick Play stats cover every season.

**Benchmark**:
An optional extra column after the Slots showing how everyone playing the hero does, for comparing a Matchup with the field. It isn't a Player, so it has no Slot, Slot Color, Leader or Score.
_Avoid_: Ghost slot, average player

**Rank Tier**:
A Competitive division, such as Gold, without its 1 to 5 number. The division above Grandmaster counts as Grandmaster, since OverFast's global stats include it there.
_Avoid_: Rank (which includes the number), league

### Heroes

**Hitpoints**:
How much damage a hero can take, made up of health, armor and shields. A hero's own, not a Player's stat.
_Avoid_: HP, life

**Ability**:
One of a hero's skills, with an icon, a name and a description.
_Avoid_: Skill, power

**Subrole**:
A narrower kind of hero within its role, such as Stalwart among tanks.

### Stats

**Stat Row**:
One stat in a Matchup, showing its label and each Player's value.
_Avoid_: Line, entry, metric

**Fair Stat**:
A stat that doesn't depend on how long someone has played, such as a per-10-minute average, a percentage, or a per-life ratio.
_Avoid_: Normalized stat, average stat

**Volume Stat**:
A running total that grows with playtime, such as total healing done.
_Avoid_: Raw stat, total

**Best Stat**:
A single-game or single-life record, such as most eliminations in a game.
_Avoid_: Record, high score

**Sample Size**:
How much a Player's numbers are based on: their time played and games played under the Matchup's Hero Scope, Gamemode and Platform.

**Global Win Rate**:
How often a hero wins across everyone playing it, optionally at one Rank Tier, from one region or the average of all three counted equally.
_Avoid_: Average win rate, field win rate

**Rank-Adjusted Win Rate**:
A Player's win rate minus the Global Win Rate on that hero at their own Rank Tier for its role, in percentage points, such as "+4.2 vs Gold". A Player with no rank for that role has none. With the Rank-adjusted toggle on, it decides the win rate row's Leader.
_Avoid_: Relative win rate, win rate delta

**Lower-Is-Better Stat**:
A stat where the smaller value wins, such as deaths. Every other stat is higher-is-better.

**Leader**:
A Player highlighted on a Stat Row for having the best value. Players tied for best are all Leaders, unless every compared Player is tied, in which case there are none. Only Players who have the stat are compared, and a Stat Row needs at least two of them to have a Leader.
_Avoid_: Winner, best player

**Score**:
How many Stat Rows a Player leads in the section on show (Fair, Volume or Best Stats), out of that section's Stat Rows that have a Leader. A shared lead counts for every Player tied for it.
_Avoid_: Wins, points

**Private Profile**:
A Player whose career stats are hidden by Blizzard, so they can't be compared. It doesn't stop the rest of the Matchup.
