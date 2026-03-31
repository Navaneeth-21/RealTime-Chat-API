// src/redis/pubsub.ts

// Redis pub/sub acts as a cross-server message bus between muliple instance at a time

import {Server} from 'socket.io';
import { getPublisher, getSubscriber } from './client';
import {
    ClientToServerEvents,
    ServerToClientEvents,
    SocketData,
    MessageDTO,
} from '../types/socket.types';
import { logger } from '../utils/logger';


// Channel helpers

const CHANNEL_PREFIX = 'chat';

export const channels = {
    room: (roomId: string) => `${CHANNEL_PREFIX}:${roomId}`,
};


// Envelope shape
// Everything published to Redis is wrapped in this envelope.

interface PubSubEnvelope {
    type: 'new_message' | 'user_joined' | 'user_left' | 'typing';
    roomId: string;
    payload: unknown;
}

// publishMessage
// called by the messaage handler after a message is created

export async function publishMessage(message: MessageDTO): Promise<void> {
    const envelope: PubSubEnvelope = {
        type: 'new_message',
        roomId: message.roomId,
        payload: message,
    };
    await getPublisher().publish(
        channels.room(message.roomId), 
        JSON.stringify(envelope)
    );
}


// initSubscriber
// This is called once at startup, not per room.

export async function initSubscriber(
    io: Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>
): Promise<void> {
    const sub = getSubscriber();

    await sub.subscribe(`${CHANNEL_PREFIX}:*`, (message, channel) => {
        try{
            const envelope = JSON.parse(message) as PubSubEnvelope;
            const {type, roomId, payload} = envelope;
            
            switch (type) {
                case 'new_message':
                    io.to(roomId).emit('new_message', payload as MessageDTO);
                    break;
                    
                case 'user_joined':
                case 'user_left':
                    break;
                            
                default:
                logger.warn(`Unknown envelope type: ${type} on channel: ${channel}`);
                            }
        }catch (err) {
            logger.error('Failed to process pub/sub message:', err);
        }
    });

    logger.info(`Redis subscriber listening on ${CHANNEL_PREFIX}:*`);
}