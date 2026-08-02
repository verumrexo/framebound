# framebound part mechanics

status: architecture contract for future part work; individual mechanics remain
unapproved until designed with the user

## the short answer

new parts can have completely new mechanics without turning the code back into
one giant mess. they are not magically free, though. every mechanic needs an
explicit owner and must cross the same offline, save, rendering, and multiplayer
boundaries as the rest of the game.

## definition boundary

`PartDef` owns stable part data:

- id, name, type, footprint, art, and rarity;
- health, mass, weapon timing, and other serializable stats;
- no live game references, timers, callbacks, or hidden global state.

the parts library is validated at startup. mismatched ids, invalid dimensions,
non-finite stats, unsafe weapon cooldowns, and unknown weapon groups fail before
a run begins instead of corrupting one halfway through.

## mechanic boundary

when a new mechanic is approved, its implementation follows this order:

1. describe its serializable configuration in the part definition;
2. give its runtime behavior to a focused system;
3. let `game.js` compose or sequence that system without implementing it;
4. make the host own every multiplayer outcome while guests send intent only;
5. add its persistent state to saves and room snapshots when persistence matters;
6. keep drawing presentation-only and give the mechanic a distinct visual path;
7. cover offline behavior, malformed state, save/continue, and multiplayer parity.

a passive stat may reuse an existing owner. a warp gate, mine, decoy, hacking
dart, or stealth module will probably need a dedicated owner because pretending
those are ordinary bullets would be dumb and fragile.

## rules that keep this sane

- no mechanic-specific simulation branches in `game.js`;
- no client-authored damage, rewards, spawns, teleportation, or status effects;
- no gameplay mutation inside renderers;
- no functions stored in part definitions or save data;
- no new projectile family without its own collision and visual identity tests;
- no creative or balance values are chosen without approval.

this contract protects the architecture. it does not pre-design the mechanics.
we will still decide what each part actually does before implementing it.
