# Compare stats

Once Players load, each Stat Row shows every Player's value, and the best value is marked as the Leader. Each Player's header shows their Score (how many Fair Stat rows they lead), their rank, and, in Competitive, the Season their stats come from. Two Players get a mirrored layout with the label in the middle; three or more get the label on the left.

## Sub-features

- `compare-leader`: the best value on a Stat Row is bold, tinted with its Slot Color, marked ▲, and its cell is named `"<value>, leads"`.
- `compare-score`: each loaded Slot shows `Leads N of M`, where M is the same for every Slot.
- `compare-sections`: Sample Size and Fair Stats are always open; Volume Stats and Best Stats are collapsed until opened.
- `compare-season`: Competitive headers show `Season N`; Quick Play headers don't.
- `compare-layout`: two Players are mirrored (value, label, value); three or more put the label first.

## How to get to it (user POV)

- Load any Matchup in which at least two Players have games on the chosen hero.

## Driving it with control.sh

Preconditions:

- `$S doctor` prints `HEALTHY`.

- **Two Players.** Run `$S goto '/?players=Jingwen-11594,JigglyPuff-11568&hero=ana&gamemode=competitive&platform=pc'` and then `$S wait "document.querySelectorAll('.score').length === 2"`.
- **Mirrored layout.** Run `$S js "document.querySelector('.stat-table').className"`. It includes `mirrored`.
- **Leaders and Score.** Run `$S js "document.querySelectorAll('[aria-label$=\", leads\"]').length"` (at least 1) and `$S js "[...document.querySelectorAll('.score')].map(s => s.textContent).join(' | ')"`. Each part matches `Leads N of M`, with the same M in both.
- **Season.** The snapshot shows `SEASON` in both headers.
- **Collapsed sections.** Run `$S press 'Volume Stats'`. The Volume Stats rows appear in the snapshot.
- **Three Players.** Run `$S goto '/?players=Jingwen-11594,JigglyPuff-11568,Alone2die-1446&hero=ana&gamemode=competitive&platform=pc'` and then `$S wait "document.querySelectorAll('.score').length === 3"`. `className` now includes `columns`, and each row's first cell is its `rowheader`.
- **Proof.** Take `$S snap compare-stats-three` and `$S shot compare-stats-three`.

## Gotchas

- Values change as the Test Players play. Assert on Leaders, Score format and layout, not on numbers.
- A Player missing a stat isn't compared on that row, so a row can have no Leader.
- The Score counts Fair Stat rows only. Volume and Best Leaders don't add to it.
