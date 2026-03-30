// src/redis/cache.ts

// when a user opens a chat room, the first thing they need is the recent message history. Hitting postgresql for every join would be come waste of time.
// So Redis stores the last N messages per room in a list.


import { getCacheClient } from "./client";
import { MessageDTO } from "../types/socket.types";
import { logger } from "../utils/logger";


const keys = {
    roomMessages: (roomId: string) => `room:${roomId}:messages`,
    onlineUsers: (roomId: string) => `room:${roomId}:online`,
};

const MAX_MESSAGES = parseInt(process.env.MAX_CACHE_MESSAGES || '50');
const TTL_SECONDS = parseInt(process.env.TTL_SECONDS || '3600');


// cache Message
// called after every new message is created
// LPUSH - pushes msg JOSN to the head of the list (newest first)
// LTRIM - trims the list to MAX_CACHE_MESSAGES (drops oldest)
// EXPIRE - refreshes the TTL so active rooms stay cached (e.g., for every 1 min)

export async function cacheMessage(message: MessageDTO): Promise<void> {
    try {
        const redis = getCacheClient();
        const key = keys.roomMessages(message.roomId);
        const value = JSON.stringify(message);

        const pipeline = redis.multi();
        pipeline.lPush(key, value);
        pipeline.lTrim(key, 0, MAX_MESSAGES - 1);
        pipeline.expire(key, TTL_SECONDS);
        await pipeline.exec();
    
    } catch (err) {
        logger.error('Failed to cache message:', err);
    }
}


// getRecentMessages
// Items are stored newest-first so we should reverse the chronlogical order

export async function getRecentMessages(roomId: string): Promise<MessageDTO[]> {
    try {
        const redis = getCacheClient();
        const key = keys.roomMessages(roomId);
        const items = await redis.lRange(key, 0, -1);

        if (!items.length) return [];

        return items
            .map(item => JSON.parse(item) as MessageDTO)
            .reverse();

    } catch (err) {
        logger.error('Failed to get recent messages:', err);
        return [];  
    }
}


// When a room is deleted or a message is moderated out
export async function deleteRoomMessages(roomId: string): Promise<void> {
    try {
        const redis = getCacheClient();
        await redis.del(keys.roomMessages(roomId));
    } catch (err) {
        logger.error('Failed to delete room messages:', err);
    }
}


//  Online User Tracking
//  Redis keep tracking of which users are currently in a room


// addOnlineUser
// called when a user joins a room
// SADD - adds the user ID to a set (ensures uniqueness)

export async function addOnlineUser(roomId: string, userId: string): Promise<void> {
    try {
        const redis = getCacheClient();
        const key = keys.onlineUsers(roomId);
        await redis.sAdd(key, userId);
        await redis.expire(key, 86400) // 24 hrs safety TTL
    } catch (err) {
        logger.error('Failed to add online user:', err);
    }
}


// removeOnlineUser
// called when a user disconnects or leaves a room

export async function removeOnlineUser(roomId: string, userId: string): Promise<void> {
    try {
        const redis = getCacheClient();
        await redis.sRem(keys.onlineUsers(roomId), userId);
    } catch (err) {
        logger.error('Failed to remove online user:', err)
    }
}

 
// fetching the list of all user IDs currently active in a specific room

export async function getOnlineUsers(roomId: string): Promise<string[]> {
    try {
        const redis = getCacheClient();
        return await redis.sMembers(keys.onlineUsers(roomId));
    } catch (err) {
        logger.error('Failed to get online users:', err);
        return [];
    }
}









