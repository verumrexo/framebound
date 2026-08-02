# save format

## current format: version 2

version 2 stores an exact run snapshot:

- level seed, floor, biome, score, xp, gold, and level threshold;
- player position, rotation, velocity, and dash state;
- ship hp, parts, permanent level-up stats, and weapon runtime state;
- hangar inventory and tainted-run state;
- current room coordinates and per-room visited, cleared, and locked state;
- surviving asteroids, crates, wrecks, shops, chests, and loose rewards in every
  generated room;
- active enemies, bosses, projectiles, drones, and reward drops;
- vault payment, chest, ambush, and wave progress;
- the active boss exit portal position when one exists.

continue validates the data, regenerates the floor once from the saved seed,
rebuilds the ship in staging, restores the saved random-generator position, and
then hydrates the exact room and active-world state.

the short delay between vault waves restarts after continue. transient cosmetic
effects such as explosions, damage numbers, and notifications are not persisted.
neither changes gameplay rewards or room progression.

## version 1 migration

valid version-one saves migrate in memory and remain usable. their old checkpoint
contract still treats visited rooms as cleared because the missing entity state
cannot be invented. old cleared-boss saves also retain the exit-portal repair.
the next successful save writes version 2.
