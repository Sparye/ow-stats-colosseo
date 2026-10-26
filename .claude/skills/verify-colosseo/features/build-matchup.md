# Build a Matchup

A user lines up two to five Players by typing BattleTags into Slots. They can add Slots, swap the Player in a Slot with Change, and remove Slots once there are more than two. Every change is reflected in the URL's `players` list, in Slot order.

## Sub-features

- `matchup-add`: typing a BattleTag into an empty Slot and pressing Add fills that Slot.
- `matchup-add-slot`: **+ Add player** adds an empty Slot with the cursor in it, and the button disappears at five Slots.
- `matchup-change`: Change reopens the form with an empty, focused input whose placeholder is the current tag. A new tag swaps the Player while keeping the Slot, and Add on an empty input puts the same Player back.
- `matchup-remove`: Remove appears only when there are more than two Slots.
- `matchup-validate`: a malformed tag shows `Enter a BattleTag like Name#1234`, and a duplicate shows `Already in this Matchup`.

## How to get to it (user POV)

- Open the site with no `players` in the URL. Two empty Slots show the BattleTag form.
- Use **+ Add player** at the right end of the top bar.
- Use **Change** on a filled Slot.
- Open a shared URL with `?players=Name-1234,...`.

## Driving it with control.sh

Preconditions:

- `$S doctor` prints `HEALTHY`.

- **Empty start.** Run `$S goto '/?hero=ana&gamemode=competitive&platform=pc'`. The snapshot shows two `columnheader "Empty slot"`.
- **Add first Player.** Run `$S type 'combobox "BATTLETAG"' 'Jingwen#11594'` and then `$S wait "location.search.includes('Jingwen-11594')"`. Slot 1 becomes `columnheader "Jingwen#11594"`.
- **Add second Player.** Run `$S type 'combobox "BATTLETAG"' 'JigglyPuff#11568'` and then `$S wait "document.querySelectorAll('.score').length === 2"`. Both Slots show `LEADS`.
- **Malformed tag.** Run `$S press 'button "+ ADD PLAYER"'` and then `$S type 'combobox "BATTLETAG"' 'nonsense'`. An alert reads `Enter a BattleTag like Name#1234`, and the URL is unchanged.
- **Duplicate.** Run `$S type 'combobox "BATTLETAG"' 'jingwen#11594'`. An alert reads `Already in this Matchup`.
- **Third Player.** Run `$S type 'combobox "BATTLETAG"' 'Alone2die#1446'` and then `$S wait "document.querySelectorAll('.score').length === 3"`. The stat label column moves to the left.
- **Change, same Player back.** Run `$S press 'button "Change JigglyPuff#11568"'`. `$S js "document.activeElement.value + '|' + document.activeElement.placeholder"` prints `|JigglyPuff#11568`, and a Remove link appears. Run `$S press 'button "ADD"'`; the Slot shows `columnheader "JigglyPuff#11568"` again and the URL is unchanged.
- **Change, new Player.** Run `$S press 'button "Change JigglyPuff#11568"'`. Then run `$S type 'combobox "BATTLETAG"' 'Ghost#9999'` and `$S js "location.search"`. Slot 2 now holds `Ghost-9999`, in the same position.
- **Remove.** Run `$S press 'button "Change Ghost#9999"'`, then `$S orca click --element $($S ref 'button "Remove"')`, then `$S js "location.search"`. The players are `Jingwen-11594,Alone2die-1446`.
- **Proof.** Take `$S snap build-matchup-final` and `$S shot build-matchup-final`.

## Gotchas

- `type` presses Enter, which submits the form. That's the same as pressing Add.
- With two Slots, there's no Remove, so a Remove that's missing is correct there.
- Five Slots hide **+ Add player** entirely; `ref` will fail to find it, which is the expected result.
- A Slot added with **+ Add player** but left empty isn't in the URL. Reloading drops it.
