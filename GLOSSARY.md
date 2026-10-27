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
