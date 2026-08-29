const autocannon = require('autocannon');
const axios = require('axios');

const run = async () => {
  // Register/login a real test user first to get a valid token
  const email = `loadtest-${Date.now()}@example.com`;
  await axios.post('http://localhost:5000/api/auth/register', {
    name: 'Load Test',
    email,
    password: 'password123',
  });
  const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
    email,
    password: 'password123',
  });
  const token = loginRes.data.token;

  console.log('Load testing GET /api/files (authenticated, Redis-cached)...\n');

  const result = await autocannon({
    url: 'http://localhost:5000/api/files',
    connections: 50,
    duration: 10,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  console.log(autocannon.printResult(result));
};

run();