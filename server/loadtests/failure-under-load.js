const axios = require('axios');
const FormData = require('form-data');

const run = async () => {
  const email = `failuretest-${Date.now()}@example.com`;
  await axios.post('http://localhost:5000/api/auth/register', {
    name: 'Failure Load Test',
    email,
    password: 'password123',
  });
  const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
    email,
    password: 'password123',
  });
  const token = loginRes.data.token;

  console.log('Uploading a test file...');
  const form = new FormData();
  form.append('file', Buffer.from('Content for failure-under-load test'), 'failtest.txt');
  const uploadRes = await axios.post('http://localhost:5000/api/files/upload', form, {
    headers: { ...form.getHeaders(), Authorization: `Bearer ${token}` },
  });
  const fileId = uploadRes.data.file._id;

  console.log('\n>>> Now manually stop a storage node (e.g. `docker stop storage-node-2`), then press Enter here to continue <<<\n');
  await new Promise((resolve) => process.stdin.once('data', resolve));

  console.log('Firing 20 concurrent downloads of the same file while a node is down...\n');

  const downloadOne = async (i) => {
    const start = Date.now();
    try {
      await axios.get(`http://localhost:5000/api/files/${fileId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'arraybuffer',
      });
      return { success: true, durationMs: Date.now() - start };
    } catch (err) {
      return { success: false, durationMs: Date.now() - start, error: err.message };
    }
  };

  const start = Date.now();
  const results = await Promise.all(Array.from({ length: 20 }, (_, i) => downloadOne(i)));
  const totalMs = Date.now() - start;

  const successes = results.filter((r) => r.success);
  const failures = results.filter((r) => !r.success);
  const avgDuration = successes.reduce((sum, r) => sum + r.durationMs, 0) / (successes.length || 1);

  console.log(`Total wall time for 20 concurrent downloads (with a node down): ${totalMs}ms`);
  console.log(`Succeeded: ${successes.length}/20, Failed: ${failures.length}/20`);
  console.log(`Average individual download duration: ${avgDuration.toFixed(0)}ms`);
  console.log('\n(Remember to restart the stopped node: docker start storage-node-2)');
};

run();