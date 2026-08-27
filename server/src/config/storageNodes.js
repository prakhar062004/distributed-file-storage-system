const isDocker = process.env.RUNNING_IN_DOCKER === 'true';

const STORAGE_NODES = [
  {
    nodeId: 'node-1',
    url: isDocker ? 'http://storage-node-1:5001' : 'http://localhost:5001',
  },
  {
    nodeId: 'node-2',
    url: isDocker ? 'http://storage-node-2:5002' : 'http://localhost:5002',
  },
  {
    nodeId: 'node-3',
    url: isDocker ? 'http://storage-node-3:5003' : 'http://localhost:5003',
  },
];

module.exports = STORAGE_NODES;