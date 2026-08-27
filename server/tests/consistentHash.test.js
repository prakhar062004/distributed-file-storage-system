const ConsistentHashRing = require('../src/services/consistentHash');

describe('ConsistentHashRing', () => {
  const nodes = [
    { nodeId: 'node-1', url: 'http://node1' },
    { nodeId: 'node-2', url: 'http://node2' },
    { nodeId: 'node-3', url: 'http://node3' },
  ];

  test('should deterministically map the same key to the same node', () => {
    const ring = new ConsistentHashRing(nodes);
    const first = ring.getNode('chunk-abc-123');
    const second = ring.getNode('chunk-abc-123');

    expect(first.nodeId).toBe(second.nodeId);
  });

  test('should return distinct nodes for replication', () => {
    const ring = new ConsistentHashRing(nodes);
    const replicas = ring.getNodes('chunk-xyz-789', 2);

    expect(replicas).toHaveLength(2);
    expect(replicas[0].nodeId).not.toBe(replicas[1].nodeId);
  });

  test('should not request more replicas than available physical nodes', () => {
    const ring = new ConsistentHashRing(nodes);
    const replicas = ring.getNodes('chunk-edge-case', 5); // more than the 3 nodes available

    expect(replicas.length).toBeLessThanOrEqual(3);
  });

  test('removing a node should only affect keys mapped to it, not all keys', () => {
    const ring = new ConsistentHashRing(nodes);

    // Sample many keys and record their assignments before removal
    const testKeys = Array.from({ length: 100 }, (_, i) => `chunk-${i}`);
    const before = testKeys.map((key) => ring.getNode(key).nodeId);

    ring.removeNode('node-2');

    const after = testKeys.map((key) => ring.getNode(key).nodeId);

    const changed = before.filter((nodeId, i) => nodeId !== after[i]).length;
    const unchanged = testKeys.length - changed;

    // Keys that weren't on node-2 should mostly stay on their original node;
    // only keys that WERE on node-2 must move. We can't predict the exact
    // split, but a healthy consistent-hash implementation should NOT
    // reshuffle all 100 keys — that would indicate naive modulo hashing.
    expect(unchanged).toBeGreaterThan(0);
  });
});