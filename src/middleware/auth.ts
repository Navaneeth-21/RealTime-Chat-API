/*** src/middleware/auth.ts

 * 2 AUTH CONTEXTS:
 * 1. HTTP middleware - for Express REST routes
 * 2. WebSocket middleware - for socket.io connections

**/


import { Request, Response, NextFunction } from 'express';
import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

import {
  JWTPayload,
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from '../types/socket.types';

// Extend Express Request globally
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

// -------------- HTTP AUTH MIDDLEWARE --------------------
export function httpAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    if (!token) {
      res.status(401).json({ error: 'Unauthorized' });
      return;                    
    }

    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET || 'fallback-secret'
    ) as JWTPayload;

    req.user = payload;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
}

// -------------- SOCKET AUTH MIDDLEWARE --------------------
export function socketAuthMiddleware(
  socket: Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>,
  next: (err?: Error) => void
): void {
  try {
    let token: string | undefined;

    // Detailed debug logging
    logger.info('*** SOCKET HANDSHAKE DEBUG *****');
    logger.info(`Socket ID: ${socket.id}`);
    logger.info(`Auth object: ${JSON.stringify(socket.handshake.auth)}`);
    logger.info(`Headers.authorization: ${socket.handshake.headers.authorization}`);
    logger.info(`Query.token: ${socket.handshake.query.token}`);

    // 1. From auth object
    if (socket.handshake.auth?.token) {
      token = socket.handshake.auth.token as string;
      logger.info('Token found in socket.handshake.auth.token');
    }
    // 2. From Authorization header
    else if (socket.handshake.headers.authorization) {
      const header = socket.handshake.headers.authorization as string;
      token = header.startsWith('Bearer ') ? header.slice(7) : header;
      logger.info('Token found in headers.authorization');
    }
    // 3. From query parameter 
    else if (socket.handshake.query.token) {
      token = socket.handshake.query.token as string;
      logger.info('Token found in query.token');
    }

    if (!token) {
      logger.warn('No token found in any location');
      return next(new Error('Unauthorized'));
    }

    // Clean Bearer prefix
    token = token.startsWith('Bearer ') ? token.slice(7) : token;
    logger.info(`Cleaned token (first 20 chars): ${token.substring(0, 20)}...`);

    // Verify JWT
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET || 'fallback-secret'
    ) as JWTPayload;

    socket.data.user = {
      id: payload.id,
      username: payload.username,
      email: payload.email,
      avatar: payload.avatar,
    };

    logger.info(`SUCCESS: Socket authenticated for ${payload.username}`);
    logger.info(`JWT_SECRET used: ${process.env.JWT_SECRET}`);
    next();

  } catch (err: any) {
  logger.error(`AUTH ERROR FULL: ${JSON.stringify(err, null, 2)}`);
  logger.error(`MESSAGE: ${err.message}`);
  next(new Error('Unauthorized'));
}
}

// ---------- TOKEN GENERATOR -----------------------------------------------------------
export function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, process.env.JWT_SECRET as string, { 
    expiresIn: "7d" 
  });
}