# Farkle

Seven-dice push-your-luck, against a straightforward heuristic companion. Svelte 5,
Threlte and Three.js; the rounded ruby dice, walnut, brass, maple and teal felt
follow [Can’t Stop](https://github.com/anicolao/cantstop). Tap the actual 3D dice
or use the visible keyboard-accessible dice buttons, keep a scoring subset, then
bank or roll again. Scoring suggestions can select a legal subset, including
three pairs even when the roll contains no 1s or 5s. Games resume with the same
anonymous browser identity.

## Development

Use Bun 1.3.10+ and Java 21 for isolated Firebase emulators:

```sh
bun install
bun run dev
```

Open http://127.0.0.1:5298. The default development command starts dedicated Auth
and Firestore emulators with the guarded `demo-farkle-local` project. No local
alternative database or application server is used. Copy `.env.example` to `.env`
for Vite production builds; the checked-in Firebase web configuration is public
client identification, not a server credential. `bun run dev` uses emulators
unless `VITE_FIREBASE_PROJECT_ID` is explicitly present in its process environment.

```sh
bun run check
bun run test:unit
bun run test:firebase
bun run test:e2e
bun run build
```

Browser tests run their own emulators on separate ports and use the real 3D
renderer. `artifacts/desktop.png` and `artifacts/phone.png` are generated captures.

## House rules

Seven dice, target 10,000, no opening minimum. Single 1 = 100; single 5 = 50.
Three 1s = 1,000; other triples = face × 100. Four through seven matching dice
double the triple for each extra die. A 1–6 straight = 1,500. Three distinct
pairs = 1,500. A seventh die must itself score when kept with those combinations.
Scoring finds the highest valid partition of the selected dice, with no leftovers.
Groups apply to a single keep action; dice kept earlier cannot extend a triple.
You can keep additional scoring subsets from the current roll before continuing.

At least one scoring subset must be kept after each roll before banking or
rerolling. Keeping all dice makes all seven available again (hot dice). A roll
with no scoring subset loses all turn points. The first player to bank 10,000
triggers one final reply turn for the opponent. Highest banked total then wins;
equal scores tie.

The companion takes the maximum scoring subset, preferring more dice on ties.
It banks at 750 or with one/two dice remaining, and banks when it would take the
winning lead. On a final reply it pushes until it beats the leader or farkles.

## Persistence and replay

The dedicated Firebase project is **farkle-game-anicolao**, with Firestore in
`northamerica-northeast2` and anonymous Auth. The ordered, versioned intent log
is canonical. Scores, dice, winners and turns are derived, never persisted.
See [the protocol](docs/PROTOCOL.md). History shows every committed choice;
download JSON or open it for read-only replay. The URL identifies the game with
`?table=<game-id>`; an explicit table URL takes precedence over the saved device
preference. Existing games acquire their URL on reload. Table links identify a
private game and do not grant another anonymous identity access. The save status
reports server-confirmed Firebase actions, pending writes, or cached/offline data.
Each preview has an independent
Firestore namespace. Local storage contains only the current game ID.

This is a trusted-client, single-human-versus-companion game. The owner’s tab
submits both actors’ actions. Rules enforce ownership, append-only writes, event
shapes and atomic revision advancement; the client validates game legality.
Seeded dice are reproducible and predictable, so this is not a competitive
anti-cheat implementation. Other humans and spectator sharing are outside PR1.

## DiceTower boundary

PR1 implements digital dice only. `RollSource` keeps roll generation outside the
scoring/action logic. A future physical DiceTower adapter needs a new versioned
protocol that records external observations (with device/roll identity) separately
from player choices. A physical observation must never be disguised as a seeded
digital roll. No hardware pairing or physical-roll UI is claimed in this version.

## CI and preview

Same-repository PRs publish independently of verification at
`https://anicolao.github.io/farkle/prNUMBER/`, with a link in the PR. Main publishes
at the repository root. Firebase public client values are GitHub repository
variables. Provision anonymous Auth and rules using:

```sh
bun x firebase deploy --only auth,firestore:rules --project farkle-game-anicolao
```

## License and provenance

GPL-3.0-only; see [LICENSE](LICENSE). `src/scene/Die.svelte` and
`src/scene/materials.ts` are adapted from Can’t Stop (same author, GPLv3).
Material scans retain their CC0 provenance in
[public/materials/SOURCES.md](public/materials/SOURCES.md).
