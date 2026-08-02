# framebound leaderboard trust model

the current supabase leaderboard is a casual public board, not an authoritative
competitive service.

- the vite client receives a public anonymous key;
- any public client can therefore reproduce allowed requests outside the game;
- peer-hosted runs are blocked from submission because the host controls their
  simulation;
- offline scores are still not cryptographically trustworthy;
- names and scores are validated before submission and sanitized again after
  reads;
- reads request only the displayed name and score columns, and scores outside
  the safe-integer range are rejected on both reads and writes;
- the shipped client has no bulk-delete operation.

the expected external rls policy is read plus narrowly validated insert for the
anonymous role, with update and delete denied. that policy has not been verified
from this repository because database dashboard access and a safe disposable
test table are not available here.

do not call the board “secure” or use it for prizes. making scores authoritative
requires a trusted verification service and an approved anti-cheat design; a
client-side key or a player-hosted p2p session cannot provide that, no matter how
many buzzwords get thrown at it.
