# Recent Players

Every BattleTag input opens a Recent Players dropdown when it gets the cursor, listing BattleTags whose profile loaded before in this browser, newest first. Typing narrows the list, and picking an option (mouse, or ↓ and Enter) places that Player straight away. A Slot isn't offered Players in other Slots, but its Change form offers the Player already in it. A BattleTag that was never found is never remembered.

## Sub-features

- `recent-remember`: a Player whose summary loads is saved to `recentPlayers`, including Private Profiles and Players with no games.
- `recent-suggest`: the dropdown lists remembered Players as `Name#1234`, directly under the input.
- `recent-pick`: picking an option places that Player without pressing Add.
- `recent-filter`: typing narrows the options; Escape closes the list and ↓ reopens it.
- `recent-exclude-others`: Players in other Slots are left out of a Slot's suggestions.
- `recent-own-slot`: a Change form suggests the Player already in that Slot, since putting them back is allowed.
- `recent-skip-missing`: a BattleTag that 404s is never saved.

## How to get to it (user POV)

- Click **Change** on a filled Slot. The BattleTag input that opens suggests from the list.
- Use the BattleTag input in an empty Slot, for example after **+ Add player**.

## Driving it with control.sh

Preconditions:

- This is a fresh run (`$S launch`), so `$S js "localStorage.getItem('recentPlayers')"` prints `null`.

- **Load two Players.** Run `$S goto '/?players=Jingwen-11594,JigglyPuff-11568&hero=ana&gamemode=competitive&platform=pc'` and then `$S wait "document.querySelectorAll('.score').length === 2"`. Both Slots show `LEADS`.
- **Remembered on load.** Run `$S js "localStorage.getItem('recentPlayers')"`. It prints `["Jingwen-11594","JigglyPuff-11568"]`.
- **Own Player only.** Run `$S click 'button "Change Jingwen#11594"'` and then `$S js "JSON.stringify([...document.querySelectorAll('[role=option]')].map(o => o.textContent))"`. It prints `["Jingwen#11594"]`: JigglyPuff is in the other Slot, so only Jingwen can go back here.
- **Swap a Player.** Run `$S type 'combobox "BATTLETAG"' 'Alone2die#1446'` and then `$S wait "location.search.includes('Alone2die-1446') && document.querySelectorAll('.score').length === 2"`. Slot 1 shows `Alone2die#1446`.
- **Swapped-out Player is suggested.** Run `$S click 'button "Change Alone2die#1446"'` and then the same `js` options read. It prints `["Alone2die#1446","Jingwen#11594"]`: the Slot's own Player, then the one it replaced, and not JigglyPuff. Take `$S snap recent-players-suggest` and `$S shot recent-players-suggest`. The screenshot shows the dropdown directly under Slot 1's empty input, whose placeholder is `Alone2die#1446`.
- **Placement.** Run `$S js "(() => { const i = document.querySelector('[role=combobox]').getBoundingClientRect(), l = document.querySelector('[role=listbox]').getBoundingClientRect(); return [l.top - i.bottom, l.left - i.left].join(',') })()"`. It prints `4,0`: 4px below the input, left edges aligned.
- **Pick with the mouse.** Run `$S click 'option "Jingwen#11594"'` and then `$S wait "location.search.includes('Jingwen-11594')"`. Slot 1 shows `Jingwen#11594` without Add being pressed.
- **Back to Alone2die.** Run `$S click 'button "Change Jingwen#11594"'` and `$S click 'option "Alone2die#1446"'`, then `$S click 'button "Change Alone2die#1446"'` again, so the next step starts from the same Matchup.
- **Missing tag isn't saved.** Run `$S type 'combobox "BATTLETAG"' 'Ghost#9999'` and then `$S wait "document.body.innerText.includes('Player not found')"`. After that, `$S js "localStorage.getItem('recentPlayers')"` still has exactly the three real tags and no `Ghost-9999`.

## Gotchas

- The list closes when the input loses the cursor. Interacting with the page from script (`js`) doesn't move focus, but switching Orca tabs can.
- The dropdown is a popover placed from the input's position, so check placement after any layout change (three Slots put the input at the right edge).
- Only `launch` resets storage. Running this recipe twice in one run starts with the first pass's Players already saved, so launch a new run instead of clearing storage by hand.
- The order is by when a Player was last seen loaded, and any change to the Matchup re-saves the Players still in it. After the Ghost step, storage reads `["JigglyPuff-11568","Alone2die-1446","Jingwen-11594"]`. Assert on which tags are present, not on their order across steps.
