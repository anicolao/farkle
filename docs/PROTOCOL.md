# Intent protocol 1

A table lives at `spaces/{preview}/games/{uuid}`. The document holds only owner
UID, lastEvent ID, and revision. Its `events/{retryId}` subcollection is ordered
by revision. Revisions start at zero and are contiguous. Each immutable envelope
has `{id, revision, actor, action}`; actors are 0 (human) and 1 (companion).

The first action is `{type:'begin', protocol:1, source:'digital', seed:uint32}`.
Subsequent actions are `{type:'roll'}`, `{type:'keep', dice:number[]}`,
`{type:'bank'}`, or `{type:'next'}` (acknowledge a farkle). Dice IDs are positions
in that roll, not values. A keep consumes exactly those IDs; all selected dice
must score. Each roll index mixes the game seed with a fixed integer constant
and uses the versioned Mulberry32 implementation. The remaining dice count
determines the number of derived faces. Rendering never supplies game outcomes.

`replay` validates order, duplicate IDs, attribution, protocol and legal choices.
The immutable reducer derives dice, turn points, banked scores, handoff, hot dice,
final reply and winner. Personal UI state and animation timing never enter events.
Protocol-1 algorithms must remain stable when a later protocol is introduced.

Appending validates against replay, then transactionally reads the head and retry
ID. A previously committed identical retry succeeds without another event. A
reused ID with different content fails. A stale revision fails; the snapshot
listener recovers the current ordered log. Successful transactions atomically
write the event and advance the revision. Only committed events are presented.
Firestore offline transactions fail visibly; there is no silent offline backend.

Rules reject other identities, event changes/deletions, missing atomic events,
revision gaps, outcome fields and malformed action envelopes. They do not execute
the game reducer or prove seeded fairness. A malicious owner can forge legal-shape
logs; imported or downloaded logs are checked by the reducer before presentation.

The initial UI resumes only under its original anonymous Auth identity. Clearing
browser storage loses that identity; exported logs remain readable but do not
restore ownership. Preview namespaces isolate game data, not Auth identities.

A future DiceTower protocol must add an external roll observation envelope with
source/device/roll identity, validated faces, actor and expected revision. It
must distinguish observations from choices and prevent duplicates/out-of-turn
physical readings. Keep/bank choices should use the same reducer semantics. No
unverified device protocol or hardware transport is embedded in protocol 1.

## Existing DiceTower stream

The sibling DiceTower project's `docs/FIREBASE.md` specifies
`rolls/{towerUID}/{eventUUID}` in its **own Realtime Database**, not in Farkle's
Firestore. Each reading has `schemaVersion`, `eventId`, `rollId`, `kind`, capture
and receipt timestamps, model identity, `experimental`, count, total, and indexed
dice values/confidences/boxes. These are experimental observations, not player
confirmations. `recognitionChanged` can update the same roll without a new throw;
movement can produce a new roll with exactly the same faces.

A future read adapter must preserve `(towerUID, rollId, eventId)`, establish a
per-turn freshness boundary, require the expected remaining count (seven after
hot dice), validate count/total/d6 faces, and request human verification before
committing a physical observation. It must not score every `recognitionChanged`
message as another throw or consume old history when reconnecting. Timestamp
ordering alone cannot prove a player intended to roll. The documented recognition
prototype originally targeted one to six dice; seven-die reliability needs
hardware validation. Farkle remains Firestore-backed even if a future adapter
reads DiceTower's external stream.
