const autocannon = require('autocannon');

const run = async () => {
  console.log('Load testing GET /api/health (baseline, no auth/DB involved)...\n');

  const result = await autocannon({
    url: 'http://localhost:5000/api/health',
    connections: 50,
    duration: 10,
  });

  console.log(autocannon.printResult(result));
};

run();