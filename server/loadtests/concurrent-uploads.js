const axios = require('axios');

const CONCURRENT_UPLOADS = 10;

const run = async () => {
  const email = `uploadtest-${Date.now()}@example.com`;
  await axios.post('http://localhost:5000/api/auth/register', {
    name: 'Upload Load Test',
    email,
    password: 'password123',
  });
  const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
    email,
    password: 'password123',
  });
  const token = loginRes.data.token;

  console.log(`Firing ${CONCURRENT_UPLOADS} concurrent uploads...\n`);

  const FormData = require('form-data');

  const uploadOne = async (i) => {
    const form = new FormData();
    form.append('file', Buffer.from(`Load test content for upload #${i}`), `loadtest-${i}.txt`);

    const start = Date.now();
    try {
      await axios.post('http://localhost:5000/api/files/upload', form, {
        headers: { ...form.getHeaders(), Authorization: `Bearer ${token}` },
      });
      return { success: true, durationMs: Date.now() - start };
    } catch (err) {
      return { success: false, durationMs: Date.now() - start, error: err.message };
    }
  };

  const start = Date.now();
  const results = await Promise.all(
    Array.from({ length: CONCURRENT_UPLOADS }, (_, i) => uploadOne(i))
  );
  const totalMs = Date.now() - start;

  const successes = results.filter((r) => r.success);
  const failures = results.filter((r) => !r.success);
  const avgDuration = successes.reduce((sum, r) => sum + r.durationMs, 0) / (successes.length || 1);

  console.log(`Total wall time for ${CONCURRENT_UPLOADS} concurrent uploads: ${totalMs}ms`);
  console.log(`Succeeded: ${successes.length}, Failed: ${failures.length}`);
  console.log(`Average individual upload duration: ${avgDuration.toFixed(0)}ms`);
  if (failures.length > 0) {
    console.log('Failure reasons:', failures.map((f) => f.error));
  }
};

run();