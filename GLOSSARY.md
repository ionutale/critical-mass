# Critical Mass

A neon reactor arcade puzzle. The player fuses elements on a reactor grid, balancing Score against escalating Heat.

## Language

**Run**:
One arcade session, from a fresh reactor to Overload.
_Avoid_: Game, round, session

**Turn**:
One action by the player, followed by drawing back to hand size.
_Avoid_: Move, step

**Reactor**:
The square grid of cells the player places tiles into.
_Avoid_: Board, field, stage

**Cell**:
One position on the Reactor.
_Avoid_: Slot, space

**Tile**:
An Element occupying a Cell.
_Avoid_: Piece, block, token

**Card**:
An Element in the player's Hand that can be placed as a Tile.
_Avoid_: Piece, minion

**Deck**:
The draw pile of Element Cards.
_Avoid_: Library, stack

**Hand**:
The Cards currently available to play.
_Avoid_: Grip

**Element**:
A real light element with a Valence.
_Avoid_: Atom, material, resource

**Valence**:
The integer property of an Element that governs whether and how it fuses.
_Avoid_: Charge, tier, level

**Fusion**:
A rule-driven combination of two neighbouring Elements whose Valences allow it; the pair becomes one Element of higher Valence.
_Avoid_: Merge, combine, reaction, recipe

**Chain**:
The successive Fusions that follow from a single placement.
_Avoid_: Combo, cascade

**Heat**:
The escalating overload resource that rises with Turns and Fusions and ends the Run at its cap.
_Avoid_: Pressure, temperature, danger

**Heat floor**:
The minimum Heat, rising each Turn, that prevents cooling from outrunning the clock.
_Avoid_: Minimum, baseline

**Overload**:
The failure state reached when Heat hits the cap.
_Avoid_: Meltdown, death, loss

**Stabilize**:
The action that spends a Card and a Turn to reduce Heat.
_Avoid_: Vent, cool, cooldown

**Scrap**:
A free, once-per-turn removal of one Tile.
_Avoid_: Delete, discard, destroy

**Gesture**:
A direct-manipulation input on the Reactor or Hand: drag, swipe, or press.
_Avoid_: Interaction, control

**Drag**:
Moving a Card or Tile with the pointer or finger and releasing to commit or cancel.
_Avoid_: Pull

**Swipe**:
A directional shortcut gesture: up on the Reactor Stabilizes, dragging a Tile off Scraps, down cancels.
_Avoid_: Drag

**Choreography**:
The continuous motion that carries objects between states so changes read as movement, never teleportation.
_Avoid_: Animation, transition

**Preview**:
The predicted Chain, result, and Heat cost shown before a placement is committed.
_Avoid_: Forecast, simulation

**Upgrade**:
A Card or modifier drafted at a Heat Milestone.
_Avoid_: Perk, power-up, module

**Build**:
The set of Cards and modifiers assembled during a Run.
_Avoid_: Archetype, loadout

**Score**:
The points earned in a Run, driven by Chain length and result Rarity.
_Avoid_: Points, XP

**Rarity**:
The value class of a result Element, which multiplies its Score contribution.
_Avoid_: Tier, quality

**Milestone**:
A quarter of the Heat bar; reaching one grants an Upgrade.
_Avoid_: Checkpoint, threshold, level

**Meta unlock**:
A persistent option earned across Runs that widens choices without raising stats.
_Avoid_: Research, progression, upgrade
