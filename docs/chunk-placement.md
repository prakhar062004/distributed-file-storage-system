# Chunk Placement Strategy

## Round Robin (initial implementation)

Chunks are assigned to nodes by cycling through the node list in order via an
in-memory counter. Simple, gives even distribution *while the node list is
stable*, but has a serious weakness: if a node is added or removed, the
modulo-based cycle shifts for nearly every subsequent chunk, since the node
count itself changed. In a system with real data volumes, this would mean
migrating almost all existing data just to accommodate one node change.

## Consistent Hashing (upgraded implementation)

Nodes and chunks are mapped onto the same circular hash space (a "ring").
A chunk is assigned to whichever node's position is next, clockwise, from
the chunk's own hash. When a node is added or removed, only the chunks that
fall between that node and its ring-neighbor need to move — everything else
stays exactly where it was.

### Virtual nodes

Each physical node is given 100 "virtual" positions scattered around the
ring (not just one). This smooths out distribution — with only one position
per node, a physical node could randomly own a much larger or smaller slice
of the ring than others. Averaging over 100 positions per node makes the
distribution converge toward even as more keys are hashed.

### Observed behavior at small scale (honest note)

In testing with a 4-chunk file, chunks landed 0 / 2 / 2 across the three
nodes — not perfectly even. This is expected and correct, not a bug:
consistent hashing guarantees *deterministic, stable* placement (same
chunkId always maps to the same node), not perfectly even placement on
every small sample. Distribution evens out statistically as chunk count
grows large (law of large numbers) — a file with thousands of chunks would
show much closer to a 33/33/33% split.

## Why the switch matters

Round robin optimizes for "even right now." Consistent hashing optimizes for
"stable over time as the cluster changes" — a small placement imbalance on
a handful of chunks is a much smaller cost than reshuffling nearly all
existing chunks every time the node topology changes. In a real system where
nodes join and leave routinely (scaling, failure, maintenance), this
trade-off strongly favors consistent hashing.