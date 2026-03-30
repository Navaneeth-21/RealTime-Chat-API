// src/socket/handlers/room.ts

// ROOM JOIN FLOW:
// 1. Validate room exists
// 2. Add user to DB membership (upsert — idempotent)
// 3. socket.join(roomId) — adds this socket to the Socket.io room
//    (this is what makes io.to(roomId).emit() reach this socket)
// 4. Load recent messages: try Redis cache first, fall back to DB
// 5. Emit room_history to THIS socket only (not the whole room)
// 6. Emit user_joined to EVERYONE ELSE in the room
// 7. Update Redis online-user set

// ROOM LEAVE FLOW:
// 1. socket.leave(roomId) — removes socket from Socket.io room
// 2. Remove from online-user Redis set
// 3. Emit user_left to the room
// (We intentionally do NOT remove the DB membership on leave —
//  leave means "close this chat window", not "exit the room forever")


import { Server, Socket} from "socket.io";
import {
    ClientToServerEvents,
    ServerToClientEvents,
    SocketData,
    AckResponse,
    SocketErrorCode,
} from '../../types/socket.types';
import {
    getRoomById,
    joinRoom,
    leaveRoom,
    getRoomHistory,
} from "../../db/queries";
import {
    getRecentMessages,
    addOnlineUser,
    removeOnlineUser,
} from "../../redis/cache";
import { logger } from "../../utils/logger";
import { join } from "path";


type ChatSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

type ChatServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

// registerRoomHandlers
// Registers all room-related events on this socket.
export function registerRoomHandlers(socket: ChatSocket, io: ChatServer): void {
    
    // Join Room ------------------------------------------------------------------
    socket.on('join_room', async ({roomId}, ack) => {
        try {
            const user = socket.data.user;

            // 1. Verify room exists
            const room = await getRoomById(roomId);
            if (!room) {
                return ack({ success: false, error: SocketErrorCode.ROOM_NOT_FOUND });
            }

            // 2. persist membership(upsert)
            await joinRoom(user.id, roomId);

            // 3. socket.join(roomId)
            await socket.join(roomId);

            // 4. Load recent messages
            let history = await getRecentMessages(roomId);
            if(!history.length) {
                history = await getRoomHistory(roomId, 50);
            }

            // 5. Send history to this socket only
            socket.emit('room_history', history);

            // 6. Notify others in the room
            socket.to(roomId).emit('user_joined', {
                roomId,
                user: {
                    id: user.id,
                    username: user.username,
                    avatar: user.avatar ?? undefined,
                },
                timestamp: new Date().toISOString(),
            });

            // 7. Mark user as online in this room
            await addOnlineUser(roomId, user.id);

            // 8. Ack success
            ack({ success: true});
            logger.info(`User ${user.username} joined room ${roomId}`);
        
        } catch (err) {
            logger.error('Join_room error:', err);
            ack({ success: false, error: SocketErrorCode.INTERNAL_ERROR});
        }
    });

    // Leave Room ----------------------------------------------------------------------------
    socket.on('leave_room', async ({roomId}) => {
        try {
            const user = socket.data.user;

            // 1. Leave the Socket.io room
            await socket.leave(roomId);

            // 2. Remove from online-user
            await removeOnlineUser(roomId, user.id);

            // 3. Notify others in the room
            io.to(roomId).emit('user_left', {
                roomId,
                user: {
                    id: user.id,
                    username: user.username,
                    avatar: user.avatar ?? undefined,
                },
                timestamp: new Date().toISOString(),
            });

            logger.info(`User ${user.username} left room ${roomId}`);
        
        } catch (err) {
            logger.error('Leave_room error:', err);
        }
    });
}


// Handle Disconnection

export async function handleDisconnect(
  socket: ChatSocket,
  io: ChatServer
): Promise<void> {
  const user = socket.data.user;
  if (!user) return;
 
  // socket.rooms is a Set of room IDs this socket was in.
  // We iterate and clean up each one.
  for (const roomId of socket.rooms) {
    if (roomId === socket.id) continue; // skip the socket's own room
 
    await removeOnlineUser(roomId, user.id);
 
    io.to(roomId).emit('user_left', {
      roomId,
      user: { id: user.id, username: user.username, avatar: user.avatar },
      timestamp: new Date().toISOString(),
    });
  }
 
  logger.info(`Socket disconnected: ${user.username} (${socket.id})`);
}
