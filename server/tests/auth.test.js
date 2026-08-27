const request = require('supertest');
const app = require('../src/app');

describe('Authentication', () => {
  const testUser = {
    name: 'Test User',
    email: 'test@example.com',
    password: 'password123',
  };

  test('should register a new user', async () => {
    const res = await request(app).post('/api/auth/register').send(testUser);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe(testUser.email);
    expect(res.body.user.password).toBeUndefined(); // password must never be returned
  });

  test('should reject registration with a duplicate email', async () => {
    await request(app).post('/api/auth/register').send(testUser);
    const res = await request(app).post('/api/auth/register').send(testUser);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  test('should reject registration with missing fields', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'incomplete@example.com' });

    expect(res.status).toBe(400);
  });

  test('should log in with correct credentials', async () => {
    await request(app).post('/api/auth/register').send(testUser);
    const res = await request(app).post('/api/auth/login').send({
      email: testUser.email,
      password: testUser.password,
    });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  test('should reject login with wrong password', async () => {
    await request(app).post('/api/auth/register').send(testUser);
    const res = await request(app).post('/api/auth/login').send({
      email: testUser.email,
      password: 'wrongpassword',
    });

    expect(res.status).toBe(401);
  });

  test('should reject login with non-existent email — same error as wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'nobody@example.com',
      password: 'whatever',
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials'); // must match wrong-password error exactly
  });

  test('should access protected route with valid token', async () => {
    const registerRes = await request(app).post('/api/auth/register').send(testUser);
    const token = registerRes.body.token;

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(testUser.email);
  });

  test('should reject protected route without a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('should reject protected route with an invalid token', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer invalid.token.here');
    expect(res.status).toBe(401);
  });
});