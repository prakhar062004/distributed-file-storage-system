const crypto = require('crypto');

const hash = (key) => {
  return crypto.createHash('md5').update(key).digest('hex');
};

class ConsistentHashRing {
  constructor(nodes, virtualNodesPerNode = 100) {
    this.virtualNodesPerNode = virtualNodesPerNode;
    this.ring = new Map(); // hash -> nodeId
    this.sortedHashes = [];
    this.nodes = {}; // nodeId -> node object

    nodes.forEach((node) => this.addNode(node));
  }

  addNode(node) {
    this.nodes[node.nodeId] = node;
    for (let i = 0; i < this.virtualNodesPerNode; i++) {
      const virtualKey = `${node.nodeId}#${i}`;
      const h = hash(virtualKey);
      this.ring.set(h, node.nodeId);
    }
    this._rebuildSortedHashes();
  }

  removeNode(nodeId) {
    delete this.nodes[nodeId];
    for (let i = 0; i < this.virtualNodesPerNode; i++) {
      const virtualKey = `${nodeId}#${i}`;
      const h = hash(virtualKey);
      this.ring.delete(h);
    }
    this._rebuildSortedHashes();
  }

  _rebuildSortedHashes() {
    this.sortedHashes = Array.from(this.ring.keys()).sort();
  }

  /**
   * Finds the node responsible for a given key by hashing the key,
   * then walking clockwise around the ring to the nearest virtual node.
   */
  getNode(key) {
    if (this.sortedHashes.length === 0) return null;

    const keyHash = hash(key);

    // Find the first hash in the ring that is >= keyHash (binary search)
    let low = 0;
    let high = this.sortedHashes.length - 1;
    let result = this.sortedHashes[0]; // wrap around by default

    for (let i = 0; i < this.sortedHashes.length; i++) {
      if (this.sortedHashes[i] >= keyHash) {
        result = this.sortedHashes[i];
        break;
      }
    }

    const nodeId = this.ring.get(result);
    return this.nodes[nodeId];
  }
}

module.exports = ConsistentHashRing;