// src/socket/handlers/message.ts

// WHAT HAPPENS WHEN A MESSAGE IS SENT:
//
// 1. Client emits send_message({ roomId, content, type })
// 2. We validate: is the content non-empty? Is it under the limit?
// 3. We verify: is this user actually a member of the room?
// 4. We persist: INSERT into PostgreSQL (source of truth)
// 5. We cache: LPUSH into Redis (fast retrieval on room join)
// 6. We publish: to Redis pub/sub channel (cross-server broadcast)
// This trigger the subscriber in all the instances, which then emit new_message to their local socket.io rooms.


import { Socket } from "socket.io";
import {
    ClientToServerEvents,
    ServerToClientEvents,
    SocketData,
    SendMessagePayload,
    MessageDTO,
    SocketErrorCode,
    MessageType,        // ← Import MessageType enum
} from '../../types/socket.types';
import { isRoomMember, persistMessage } from "../../db/queries";
import { cacheMessage } from "../../redis/cache";
import { publishMessage } from "../../redis/pubsub";
import { logger } from "../../utils/logger";

const MAX_MESSAGE_LENGTH = 2000;

type ChatSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;


export function registerMessageHandlers(socket: ChatSocket): void {
    socket.on('send_message', async (payload: SendMessagePayload, ack?: Function) => {
        try {
            const { roomId, content, type } = payload;
            const user = socket.data.user;

            if (!user) {
                if (ack && typeof ack === 'function') {
                    ack({ success: false, error: SocketErrorCode.UNAUTHORIZED });
                }
                return;
            }

            // 1. Validate input
            if (!content || !content.trim()) {
                if (ack && typeof ack === 'function') {
                    ack({ success: false, error: 'Message cannot be empty' });
                }
                return;
            }

            if (content.length > MAX_MESSAGE_LENGTH) {
                if (ack && typeof ack === 'function') {
                    ack({ 
                        success: false, 
                        error: `Message is too long. Maximum ${MAX_MESSAGE_LENGTH} characters allowed.` 
                    });
                }
                return;
            }

            // 2. Verify room membership
            const isMember = await isRoomMember(user.id, roomId);
            if (!isMember) {
                if (ack && typeof ack === 'function') {
                    ack({ success: false, error: SocketErrorCode.NOT_A_MEMBER });
                }
                return;
            }

            // 3. Determine message type (default to TEXT)
            const messageType = type || MessageType.TEXT;

            // 4. Persist message to PostgreSQL
            const message: MessageDTO = await persistMessage(
                user.id,
                roomId,
                content.trim(),
                messageType   // ← Now correctly typed
            );

            // 5. Cache in Redis (fire and forget)
            cacheMessage(message).catch(err => 
                logger.error('Failed to cache message:', err)
            );

            // 6. Publish to Redis pub/sub for cross-server broadcasting
            await publishMessage(message);

            logger.info(`Message sent by ${user.username} to room ${roomId}`);

            // 7. Send success acknowledgement to the sender
            if (ack && typeof ack === 'function') {
                ack({ success: true, data: message });
            }

        } catch (err: any) {
            logger.error('Send_message error:', err);

            if (ack && typeof ack === 'function') {
                ack({ 
                    success: false, 
                    error: SocketErrorCode.INTERNAL_ERROR 
                });
            }
        }
    });
}