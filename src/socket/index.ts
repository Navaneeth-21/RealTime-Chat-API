// src/socket/index.ts

// This is the wiring file
// It creates the socket.io Server and attaches to middleware

import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import {
    ClientToServerEvents,
    ServerToClientEvents,
    SocketData,
} from '../types/socket.types';

import { socketAuthMiddleware } from "../middleware/auth";
import { registerMessageHandlers } from "./handlers/message";
import { registerRoomHandlers, handleDisconnect } from "./handlers/room";
import { registerPresenceHandlers } from "./handlers/presence";
import { initSubscriber } from "../redis/pubsub";
import { logger } from "../utils/logger";

export function initSocketServer(
    httpServer: HttpServer
): Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData> {

    const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(
        httpServer,
        {
            cors: {
                origin: process.env.CLIENT_URL || '*',
                methods: ['GET', 'POST'],
                credentials: true,
            },
            pingTimeout: 60000,
            pingInterval: 25000,
            transports: ['websocket', 'polling'],
        }
    );

    // ---------------------------- GLOBAL DEBUG -----------------------
    io.engine.on("connection_error", (err) => {
        logger.error("ENGINE CONNECTION ERROR:");
        logger.error(`Code: ${err.code}`);
        logger.error(`Message: ${err.message}`);
        logger.error(`Context: ${JSON.stringify(err.context || {})}`);
    });

    // --------------------- AUTH MIDDLEWARE ------------------
    const ENABLE_AUTH = true; 

    if (ENABLE_AUTH) {
        io.use((socket, next) => {
            logger.info("=== INCOMING SOCKET HANDSHAKE ===");
            logger.info(`ID: ${socket.id}`);
            logger.info(`Auth: ${JSON.stringify(socket.handshake.auth)}`);
            logger.info(`Headers: ${JSON.stringify(socket.handshake.headers)}`);
            logger.info(`Query: ${JSON.stringify(socket.handshake.query)}`);

            socketAuthMiddleware(socket, (err) => {
                if (err) {
                    logger.error(`AUTH FAILED: ${err.message}`);

                    // VERY IMPORTANT: send proper error to client
                    return next(new Error("Unauthorized"));
                }

                logger.info("✅ AUTH SUCCESS");
                next();
            });
        });
    } else {
        logger.warn("AUTH DISABLED (DEBUG MODE)");
    }

    // ----------------------- CONNECTION ----------------------
    io.on('connection', (socket) => {

        // Prevent crash if auth failed or disabled
        const user = socket.data?.user;

        if (!user) {
            logger.warn(`Connected WITHOUT USER: ${socket.id}`);
        } else {
            logger.info(`✅ Socket connected: ${user.username} (${socket.id})`);
        }

        // ----------------- REGISTER HANDLERS -----------------
        registerMessageHandlers(socket);
        registerRoomHandlers(socket, io);
        registerPresenceHandlers(socket);

        // ---------------- DISCONNECT -----------------
        socket.on('disconnect', (reason) => {
            logger.info(`🔌 Socket disconnected: ${user?.username || "unknown"} - ${reason}`);

            handleDisconnect(socket, io).catch(err =>
                logger.error('Socket disconnect error:', err)
            );
        });

        // ---------------- SOCKET ERROR -----------------
        socket.on('error', (err) => {
            logger.error('Socket runtime error:', err);

            socket.emit('error', {
                code: 'INTERNAL_ERROR',
                message: err.message || 'Unknown error',
            });
        });
    });

    // ----------------- REDIS -----------------
    initSubscriber(io).catch(err => {
        logger.error('Failed to init Redis subscriber:', err);
        process.exit(1);
    });

    logger.info(' Socket.io server initialised');

    return io;
}