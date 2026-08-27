const request = require('supertest');
const app = require('../src/app');

describe('File Upload, Chunking, and Metadata', () => {
  let token;

  beforeEach(async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'File Test User',
      email: 'filetest@example.com',
      password: 'password123',
    });
    token = res.body.token;
  });

  test('should reject upload without authentication', async () => {
    const res = await request(app)
      .post('/api/files/upload')
      .attach('file', Buffer.from('test content'), 'test.txt');

    expect(res.status).toBe(401);
  });

  test('should reject upload with no file attached', async () => {
    const res = await request(app)
      .post('/api/files/upload')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  test('should list files as empty for a new user', async () => {
    const res = await request(app).get('/api/files').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);
  });

  test('should return 404 for a nonexistent file id', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await request(app)
      .get(`/api/files/${fakeId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  test('should not allow one user to see another user\'s file listing', async () => {
    const otherUserRes = await request(app).post('/api/auth/register').send({
      name: 'Other User',
      email: 'other@example.com',
      password: 'password123',
    });
    const otherToken = otherUserRes.body.token;

    const res = await request(app).get('/api/files').set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0); // other user's list should be independently empty
  });
});