const redisClient = require('../config/redis');
const crypto = require('crypto');

/**
 * Attempts to acquire a distributed lock. Returns a unique lock token if
 * successful, or null if the lock is already held by someone else.
 * The lock auto-expires via TTL, so a crashed holder can never deadlock
 * the system permanently.
 */
const acquireLock = async (lockKey, ttlMs = 30000) => {
  const token = crypto.randomBytes(16).toString('hex');
  // 'NX' = only set if the key does NOT already exist — this is the atomic
  // compare-and-set operation that makes this safe under concurrency.
  const result = await redisClient.set(lockKey, token, 'PX', ttlMs, 'NX');
  return result === 'OK' ? token : null;
};

/**
 * Releases a lock, but ONLY if the caller still holds it (token matches).
 * This prevents accidentally releasing a lock that a different process
 * has since acquired after our own TTL expired.
 */
const releaseLock = async (lockKey, token) => {
  const currentToken = await redisClient.get(lockKey);
  if (currentToken === token) {
    await redisClient.del(lockKey);
    return true;
  }
  return false;
};

module.exports = { acquireLock, releaseLock };