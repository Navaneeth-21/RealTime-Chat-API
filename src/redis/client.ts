// src/redis/client.ts

// we create exactly three clients:
// 1. publisher: for publishing messages to channels
// 2. subscriber: for subscribing to channels and receiving messages
// 3. cache: for caching data


import { createClient, RedisClientType } from 'redis';
import { logger } from '../utils/logger';


// factory function to create a Redis client
// we use a factory function to create clients with different purposes (publisher, subscriber, cache)

async function createRedisClient(name: string): Promise<RedisClientType> {
  const client = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
      // Exponential backoff reconnect — waits 100ms, 200ms, 400ms... up to 3s
      reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
    },
  }) as RedisClientType;


// surface errors to our logger instead of crashing the app
client.on('error', (err) => logger.error(`Redis [${name}] error:`, err));
client.on('connect', () => logger.info(`Redis [${name}] connected`));
client.on('reconnecting', () => logger.warn(`Redis [${name}] reconnecting...`));

await client.connect();
return client;

}

// create and export the three clients
// we export them as promises so that they can be used immediately in other parts of the app without worrying about connection timing

let _publisher: RedisClientType;
let _subscriber: RedisClientType;
let _cache: RedisClientType;

export async function initRedis(): Promise<void> {
    [_publisher, _subscriber, _cache] = await Promise.all([
        createRedisClient('publisher'),
        createRedisClient('subscriber'),
        createRedisClient('cache'),
    ]);
    logger.info('All Redis clients initialized');
}

// Throw an error if someone tries to access the clients before they are initialized

export function getPublisher(): RedisClientType {
    if (!_publisher) {
        throw new Error('Redis publisher client not initialized');
    }
    return _publisher;
}

export function getSubscriber(): RedisClientType {
    if (!_subscriber) {
        throw new Error('Redis subscriber client not initialized');
    }
    return _subscriber;
}

export function getCacheClient(): RedisClientType {
    if (!_cache) {
        throw new Error('Redis cache client not initialized');
    }
    return _cache;
}

// shutdown function to gracefully close all clients when the app is terminating

export async function closeRedis(): Promise<void> {

    await Promise.all([
        _publisher?.quit(),
        _subscriber?.quit(),
        _cache?.quit(),
    ]);
    logger.info('Redis connections are closed');
}
