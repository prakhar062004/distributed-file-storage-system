const request = require('supertest');
const app = require('../src/app');

describe('File Sharing & Permissions', () => {
  let ownerToken, otherToken, otherUserEmail;

  beforeEach(async () => {
    const ownerRes = await request(app).post('/api/auth/register').send({
      name: 'Owner',
      email: 'owner@example.com',
      password: 'password123',
    });
    ownerToken = ownerRes.body.token;

    otherUserEmail = 'recipient@example.com';
    const otherRes = await request(app).post('/api/auth/register').send({
      name: 'Recipient',
      email: otherUserEmail,
      password: 'password123',
    });
    otherToken = otherRes.body.token;
  });

  test('should return 404 (not 403) for a share request on a nonexistent file', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await request(app)
      .post(`/api/files/${fakeId}/share`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: otherUserEmail, permission: 'READ' });

    expect(res.status).toBe(404);
  });

  test('should reject sharing with an invalid permission level', async () => {
    // Using a fake file id is fine here — validation should fail before ownership is even checked
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await request(app)
      .post(`/api/files/${fakeId}/share`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: otherUserEmail, permission: 'ADMIN' }); // not a valid tier

    expect(res.status).toBe(400);
  });

  test('should reject sharing a file with yourself implicitly via missing target', async () => {
    const res = await request(app)
      .post('/api/files/507f1f77bcf86cd799439011/share')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ permission: 'READ' }); // missing email

    expect(res.status).toBe(400);
  });

  test('non-owner should see empty "shared with me" list when nothing has been shared', async () => {
    const res = await request(app)
      .get('/api/files/shared-with-me')
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(200);
    expect(res.body.files).toHaveLength(0);
  });
});