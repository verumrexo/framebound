# framebound multiplayer direction

date approved: 2026-07-25  
status: protocol, host authority, signaling, webrtc, reconnect tokens,
full-resync, the host/join-code menu, and the approved co-op contract are
implemented locally; the public render signaling relay is live and passed the
real health, host, join, and signal-relay smoke. second-device packaged proof
remains open

## the simple version

framebound multiplayer will be peer to peer.

- one player clicks **host game**;
- that player's game instance runs the authoritative game session;
- the game produces a short join code;
- friends click **join game** and enter the code;
- gameplay traffic travels directly between the players;
- no paid, always-running framebound game server is required.

the current socket.io lobby/server is a legacy prototype. the replacement now
uses socket.io only for tiny signaling messages; gameplay moves onto direct
webrtc data channels after the handshake. the legacy gameplay path stays
available until the replacement passes full gameplay parity.

## connection model

the session uses a host-and-guests layout, not a full mesh:

```text
guest ─┐
guest ─┼── host game
guest ─┘
```

- guests send inputs and requests to the host;
- the host runs the shared simulation and decides movement corrections, damage, deaths, drops, rewards, room state, and progression;
- the host sends snapshots and confirmed gameplay events back to every guest;
- guests may predict their own movement and presentation, but prediction never creates authoritative outcomes.

webrtc data channels carry the gameplay traffic. a small signaling service exchanges temporary connection information behind the join code. it does not simulate the game and does not stay involved after peers connect.

## cost and connection limits

- normal sessions should connect directly and have no dedicated-server hosting bill;
- a free-tier signaling service should be enough because it only exchanges tiny temporary messages;
- stun can help peers discover a direct route;
- some restrictive routers cannot make a direct connection without a turn relay;
- a paid relay is not part of the approved zero-cost first version, so those networks may fail to connect until an optional relay is added.

## rules for the implementation

- offline gameplay remains the behavior reference.
- networking must use the same shared simulation code as offline play.
- peer packets receive the same type, size, range, and rate validation as server packets.
- session codes expire and cannot expose private gameplay state.
- the signaling provider sits behind an adapter so it can be replaced without rewriting multiplayer.
- the legacy socket.io path is removed only after peer-to-peer play passes the browser harness and two-desktop-instance release gates.
- peer-hosted scores are not trusted for a public leaderboard.

## approved co-op rules

approved on 2026-07-28:

- xp and gold are shared by the team;
- gold orbs fly to the nearest living player, but their value enters the shared
  wallet;
- parts and ship builds are individual;
- naturally dropped parts belong to the player who picks them up;
- health orbs heal the player who picks them up;
- a shop purchase uses shared gold and belongs only to the buyer;
- xp is shared, but every player receives and selects their own upgrade card;
- the shared simulation stays paused until every connected player has selected
  an upgrade;
- any living player can trigger a room exit or boss portal, which pulls the
  whole team through;
- only the host pauses the shared simulation;
- enemies target the nearest living player;
- a circler stays locked to the player it latched onto until that target dies;
- hive modules work for every player; friendly drones follow the player whose
  hive deployed them, while enemy drones target the nearest living player;
- friendly fire is off;
- version one supports four total players;
- version one does not scale difficulty with player count;
- the host owns the run and save;
- the session ends if the host quits or crashes; there is no host migration.

## approved death rule

approved on 2026-07-28:

- an individual death does not pause or end the run while a teammate lives;
- the dead player spectates a living teammate and sends no movement or weapon
  input;
- a full-team wipe ends the run;
- killing the floor boss immediately resurrects every dead player at full
  health, at their corpse position, before anybody enters the portal.

the host now owns this state, enemy direct hits and explosions can damage guest
ships, death/suspension flags replicate to spectators, and boss death restores
all dead host-owned ships. enemies select the nearest living player, while a
circler keeps its latched target until that target dies.

## implementation path

1. finish save and room ownership so one simulation state can be serialized reliably.
2. extract the authoritative shared simulation from `Game`.
3. define a versioned transport-independent protocol for inputs, snapshots, events, resync, and errors.
4. introduce a transport interface with offline loopback, legacy socket.io, and webrtc implementations.
5. add host/join signaling and short-lived session codes.
6. add separate reliable control and low-latency state channels where testing proves they are useful.
7. add reconnect/full-resync and explicitly handle host departure.
8. run two real browser clients, then two desktop app instances, through movement, combat, rooms, rewards, disconnects, malformed packets, latency, and packet loss.
9. replace the legacy online-lobby ui and remove the dedicated game server after parity is proven.

steps 1 through 5 now have tested code. reconnect tokens and full authoritative
resync are also implemented below the ui. two real browser peers now pass
signaling, direct connection, input/snapshot round trip, disconnect, resume, and
full resync. unanswered join codes, stalled webrtc negotiation, reconnect
exhaustion, host departure, and temporary data-channel backpressure now have
bounded outcomes instead of hanging or silently losing persistent fire intent.
host ping/pong heartbeats and a guest authority watchdog also recover silent
half-open channels while normal, paused, delayed, dropped, and out-of-order
traffic has deterministic convergence coverage.
the main menu now exposes **host game** and **join game** and waits for
authoritative synchronization before starting either side. the signaling
service has a free render blueprint and its public health, host/join, and relay
smoke passes. production builds use the deployed url; full gameplay parity and
the second-device native route proof are still open.

the packaged macos smoke now proves that two native instances reach the
signaling service, exchange offer/answer messages, and exchange bounded ice
candidates. native background suspension was also disabled after it froze the
host as soon as the guest took focus. the same-mac direct route is not yet a
successful data channel: webkit exposes only server-reflexive candidates, and
the timeout is consistent with this router not supporting same-nat hairpinning.
a second physical device or an optional turn relay is still required to prove
the final native route.

## completion gate

- clicking **host game** creates a joinable session without port forwarding;
- clicking **join game** connects with a short code;
- both players see the same world and outcomes;
- forged guest packets cannot create damage, rewards, weapons, or progression;
- disconnect and resync behavior is explicit and tested;
- offline gameplay, movement, controls, timing, visuals, and audio remain unchanged.
