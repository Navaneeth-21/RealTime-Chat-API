//  src/socket/handlers/presence.ts

// READ RECEIPTS:
// When a user reads messages up to a certain point, they emit mark_as_read with the last messageid they saw. We upsert to DB and broadcast to the roomm so other users can see "seen by navaneeth".


import { Socket } from "socket.io";
import {
    ClientToServerEvents,
    ServerToClientEvents,
    SocketData,
} from '../../types/socket.types';
import { upsertReadReceipt, isRoomMember } from "../../db/queries";
import { logger } from "../../utils/logger";


type ChatSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

// registerPresenceHandlers
// Registers all presence-related events on this socket.

export function registerPresenceHandlers(socket: ChatSocket): void {

    // Typing -------------------------------------------------------
    socket.on('typing', ({ roomId, isTyping }) => {
        const user = socket.data.user;

        socket.to(roomId).emit('user_typing', {
            roomId,
            userId: user.id,
            username: user.username,
            isTyping,
        });
    });

    // Mark as read
    socket.on('mark_as_read', async ({ roomId, messageId}) => {
        try {
            const user = socket.data.user;

            // Verify membership
            const isMember = await isRoomMember(user.id, roomId);
            if (!isMember) return;

            // Persist the read position
            await upsertReadReceipt(user.id, roomId, messageId);

            // Broadcast to room so other clients can show "seen" indicatos
            socket.to(roomId).emit('message_read', {
                roomId,
                messageId,
                userId: user.id,
                timestamp: new Date().toISOString(),
            });
        
        } catch (err) {
            logger.error('Mark_as_read error:', err);
        }
    });
}