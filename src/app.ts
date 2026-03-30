// src/app.ts
// THE ENTRY POINT
// We'll use same HTTP SERVER for both express and socket.io
// If EXPRESS and Socket.io ran on different ports, every websocket connection would need a different port - complication CORS etc.....

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';

import { initRedis, closeRedis} from './redis/client';
import { initSocketServer } from './socket/index';
import { prisma } from './db/prisma';
import authRoutes  from './routes/auth';
import roomRoutes from './routes/rooms';
import { logger } from './utils/logger';

const PORT = parseInt(process.env.PORT || '3000', 10);

async function boostrap(): Promise<void> {

    // 1. Connect Redis-----------------------------------
    await initRedis();


    // 2. Express app -------------------------------------
    const app = express();

    app.use(cors({
        origin: process.env.CLIENT_URL || '*',
        methods: ['GET', 'POST'],
        credentials: true,
    }));

    app.use(express.json({limit: '10kb'}));


    // 3. REST routes ---------------------------------------
    app.use('/auth', authRoutes);
    app.use('/rooms', roomRoutes);

    // Health check - load balancers and docker HEALTHCHECK hit this.
    app.get('/health', (_req, res) => {
        res.json({status: 'ok', timeStamp: new Date().toISOString()});
    });

    // 404 handler - catches any route not matched above
    app.use((_req, res) => {
        res.status(404).json({error: 'Not found'});
    });


    // 4. HTTP Server ----------------------------------------------
    // we create a raw http.server from the Express app.
    const httpServer = createServer(app);


    // 5. Socket.io server ------------------------------------------------
    // Attaches to  httpserver on the same port as express
    initSocketServer(httpServer);


    // 6. Listen ---------------------------------------------------
    await new Promise<void>((resolve) => {
        httpServer.listen(PORT, () => {
            logger.info(`Server is running on port http://localhost:${PORT}`);
            logger.info(`Websocket on port ws://localhost:${PORT}`);
            logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
            resolve();
        });
    });



    // 7. Graceful shutdown
    // Close Redis connections cleanly 
    // Disconnect Prisma - closes PostgreSQl connection pool
    const shutdown = async (signal: string) => {
        logger.info(`${signal} received - shutting down gracefully`);

        // stop accepting new connection
        httpServer.close(() => logger.info('HTTP server closed'));


        // close Redis and DB connections
        await closeRedis();
        await prisma.$disconnect();

        logger.info('Shutdown complete');
        process.exit(0);
    };

    
    // 8. Error handlers & Signals ---------------------------------
    
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    process.on('unhandledRejection', (reason) => {
        logger.error('Unhandled promise rejection:', reason);
        process.exit(1);
    });
 
    process.on('uncaughtException', (err) => {
        logger.error('Uncaught exception:', err);
        process.exit(1);
    });

}

boostrap().catch((err) => {
    logger.error('Boostrap error:', err);
    process.exit(1);
});