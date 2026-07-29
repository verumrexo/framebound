# gameplay parity checkpoint

date: 2026-07-27  
reference: `f8d6fe9` (2026-02-04, before the multiplayer work)  
status: evidence only; no gameplay behavior changed

this checkpoint separates migration regressions from older bugs before either one
gets mistaken for the game's intended design.

## reproduce

use the project's supported node runtime:

```sh
npm run trace:movement
npm run trace:weapon-rates
npm run trace:projectiles
```

the scripts execute the active systems. the historical movement calculation is a
literal model of the update order and constants in `f8d6fe9`.

## projectile visuals

the multiplayer migration moved `Projectile` into shared simulation code and
removed its draw method. that flattened projectile presentation into one generic
shape.

the active `ProjectileRenderer` now restores the pre-multiplayer `f8d6fe9`
palette and geometry:

- basic player shots are green;
- `rocket_le` is a long red rocket;
- `rocket_he` is blue;
- guided rockets are blue;
- ggbm is purple;
- cluster, mini, and tiny grenades each have separate geometry.

renderer-command tests pin those identities. this visual regression is already
fixed without changing projectile simulation.

## projectile impact behavior

the impact inconsistency is older than multiplayer. both `f8d6fe9` and the active
system only set `shouldExplode` for selected family members at selected collision
sites, while `Projectile.update()` explodes every rocket/grenade family on
timeout.

| projectile | timeout | enemy shield | enemy body | boss shield | boss body | wreck | asteroid | crate | enemy drone |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| rocket | explode | explode | explode | explode | explode | explode | explode | explode | explode |
| rocket_le | explode | vanish | vanish | vanish | vanish | vanish | vanish | vanish | vanish |
| rocket_he | explode | vanish | vanish | vanish | vanish | vanish | vanish | vanish | vanish |
| guided_rocket | explode | vanish | vanish | vanish | vanish | vanish | vanish | vanish | vanish |
| ggbm | explode | vanish | vanish | vanish | vanish | vanish | vanish | vanish | vanish |
| cluster_grenade | explode | explode | explode | vanish | vanish | vanish | vanish | vanish | explode |
| mini_grenade | explode | explode | explode | vanish | vanish | vanish | vanish | vanish | explode |
| tiny_grenade | explode | vanish | vanish | vanish | vanish | vanish | vanish | vanish | vanish |

so this is real bad code, but it is not evidence that multiplayer changed the
original impact rules. fixing it requires choosing a rule, because explosions add
aoe damage and can change balance.

the least surprising candidate is: every explosive family member explodes
whenever it is consumed, regardless of target type. that is not applied without
approval.

## weapon upgrade rates

the level-up system offers `velocityRateAdd` and `laserRateAdd`, but the active
weapon cooldown calculation never reads either stat. the upgrades currently do
nothing.

representative results:

| weapon | level | offered bonus | current cooldown | historical formula |
| --- | ---: | ---: | ---: | ---: |
| dart | 1 | +15% velocity rate | 1.0000s | 0.8696s |
| dart | 1 | +40% velocity rate | 1.0000s | 0.7143s |
| dart | 10 | +15% velocity rate | 0.9174s | 0.8065s |
| lps laser | 1 | +15% laser rate | 2.3000s | 2.0000s |
| lps laser | 1 | +40% laser rate | 2.3000s | 1.6429s |
| lps laser | 10 | +15% laser rate | 2.1101s | 1.8349s |

the trace includes every tested level and bonus. applying the disconnected
historical formula is a bug fix, but it changes live fire rate and therefore needs
approval.

## movement

assumptions:

- one second of held `w`, except the coast and dash scenarios;
- no collisions;
- base ship with mass `5`, zero part thrust, and permanent multipliers of `1`;
- one booster only in the dash scenario;
- historical reference is the exact `f8d6fe9` order: force, integrate, multiply
  velocity by `0.92` once per rendered frame, then clamp.

| scenario | hz | current speed | historical speed | current distance | historical distance |
| --- | ---: | ---: | ---: | ---: | ---: |
| held w, combat, level 1, 1s | 60 | 150.00 | 380.76 | 146.39 | 337.34 |
| held w, combat, level 1, 1s | 120 | 150.00 | 191.66 | 145.47 | 188.37 |
| held w, combat, level 1, 1s | 144 | 150.00 | 159.72 | 145.24 | 159.75 |
| held w 1s, coast 1s | 60 | 1.01 | 2.56 | 174.95 | 416.13 |
| held w 1s, coast 1s | 120 | 0.01 | 0.01 | 159.85 | 208.33 |
| held w 1s, coast 1s | 144 | 0.00 | 0.00 | 157.22 | 173.61 |
| held w, cleared room, level 1, 1s | 60 | 300.00 | 761.52 | 292.79 | 674.68 |
| held w, cleared room, level 1, 1s | 120 | 300.00 | 383.32 | 290.94 | 376.74 |
| held w, cleared room, level 1, 1s | 144 | 300.00 | 319.44 | 290.49 | 319.49 |
| held w, combat, level 10, 1s | 60 | 150.00 | 415.03 | 146.39 | 367.70 |
| held w, combat, level 10, 1s | 120 | 150.00 | 208.91 | 145.47 | 205.32 |
| held w, combat, level 10, 1s | 144 | 150.00 | 174.10 | 145.24 | 174.12 |
| held w+shift, one booster, 1.5s | 60 | 375.00 | 1149.37 | 553.88 | 1635.55 |
| held w+shift, one booster, 1.5s | 120 | 375.00 | 575.00 | 551.73 | 877.60 |
| held w+shift, one booster, 1.5s | 144 | 375.00 | 479.17 | 551.17 | 739.66 |

this table was refreshed after the approved 2026-07-28 cleared-room and dash
repairs. three separate problems were identified:

1. current combat movement remains capped at `150` and historical level scaling
   still does not affect sustained speed; cleared rooms now use the approved
   `300` cap;
2. the historical `0.92` per-frame damping makes the original movement radically
   refresh-rate dependent;
3. current dash force had two owners (`PlayerControlSystem` and `Ship`), although
   the current `375` dash cap hid much of the duplicate force.

the approved repair restores the cleared-room multiplier to the current movement
model (`150` combat cap, `300` cleared cap), fixes real booster detection, and
keeps one local dash force owner while the shared ship retains its server-side
fallback. the wider historical 60 hz movement normalization remains a separate
gameplay decision.

blindly pasting the historical code back would restore the 60 hz feel and restore
its refresh-rate bug. the recommended parity target is historical 60 hz movement
normalized by `dt`, with one dash owner. that needs explicit approval because it
will feel much faster than the current build.

## stacked level-ups

resource orbs continue processing after the first level-up trigger in a frame.
boss rewards can therefore cross multiple xp thresholds before the level-up
overlay gets control.

`LevelUpManager.triggerLevelUp()` replaces its current three choices each time.
the player gains every numeric level but only receives the final upgrade choice,
silently losing earlier upgrade rewards.

the direct fix is to queue one choice screen per earned level. that preserves the
stated one-upgrade-per-level rule but increases rewards compared with the broken
live behavior, so it remains approval-gated.

## floor route length

`LevelGenerator.generate(count, seed)` accepts a requested room count, and floor
progression passes larger values as depth rises (`15 + floor * 2`). the generator
never reads `count`.

the authored route always contains:

- one start room;
- three segments of two or three combat rooms;
- two special rooms;
- one boss room;
- zero or one side vault.

the result is 9–14 rooms at every floor depth. making the requested count real
would lengthen later floors and change pacing, reward density, and time to boss,
so this is documented rather than silently corrected.

## approval gates

before implementation, confirm these independently:

1. projectile impacts: make every rocket/grenade family explode on every consumed
   collision, or preserve another explicit matrix;
2. weapon rates: reconnect the historical velocity and laser rate formulas;
3. movement: target historical 60 hz feel with frame-rate-independent damping and
   one dash owner, or choose a different reference.
4. stacked level-ups: queue and grant one upgrade choice for every level earned in
   a multi-orb frame.
5. floor length: keep the current authored 9–14-room route at every depth, or
   define how the requested floor-size growth should extend that route.
