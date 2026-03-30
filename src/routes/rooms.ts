// src/routes/rooms.ts

// ENDPOINTS:
// GET /rooms - list of rooms the user belongs to
// POST /rooms - create a new room
// GET /rooms/:id/messages - paginated message history

// WHY HTTP FOR HISTORY (not WebSocket):
// HTTP is stateless and cacheable — the browser can cache paginated results.
// Clients can retry on failure independently.
// WebSocket is ideal for streaming/real-time, not bulk data fetches.
//
// PAGINATION STRATEGY — cursor-based, not page-number:
// Page numbers break when new messages arrive ("page 2" shifts forward).
// A cursor (a message ID) is a stable anchor point — load messages
// older than this ID regardless of what new messages have arrived.


import { Router, Request, Response } from 'express';
import { httpAuthMiddleware } from '../middleware/auth';
import { prisma } from '../db/prisma';
import { 
    getRoomHistory, 
    getUserRooms, 
    getRoomById,
} from '../db/queries';
import { getRecentMessages } from '../redis/cache';
import { logger } from '../utils/logger';

const router = Router();

// Apply authentication to all room routes
router.use(httpAuthMiddleware);

/**
 * GET /rooms
 * Returns all rooms the authenticated user is a member of.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const rooms = await getUserRooms(req.user!.id);
    return res.json({rooms});
  } catch (err) {
    logger.error('Error fetching user rooms', err);
    return res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});



/**
 * POST /rooms
 * Create a new chat room and creator gets OWNER role.
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, description, isPrivate } = req.body as { 
        name?: string; 
        description?: string
        isPrivate?: boolean;
   };

    if (!name?.trim()) {
      return res.status(400).json({ error: 'Room name is required' });
    }

    // $transaction: Prisma wraps these two inserts in BEGIN/COMMIT.
    // If either fails, it issues ROLLBACK automatically.

    const room = await prisma.$transaction(async (tx) => {
        const r = await tx.room.create({
        data: {
            name: name.trim(),
            description: description?.trim(),
            isPrivate: isPrivate ?? false,
        },
        });

        await tx.roomMember.create({
        data: {
            roomId: r.id,
            userId: req.user!.id,
            role: 'OWNER',
        },
        });
        return r;
    });

    return res.status(201).json({ room });
    } catch (err) {
    logger.error('Error creating room', err);
    return res.status(500).json({ error: 'Failed to create room' });
    }

});


// GET /rooms/:id/messages
// Query params:
//   limit  — number of messages (default 50, max 100)
//   cursor — messageId to paginate from (load messages older than this)
//
// Strategy:
//   First load (no cursor) → try Redis cache → fall back to PostgreSQL
//   Pagination (cursor set) → always PostgreSQL (cache has no cursor support)
router.get('/:id/messages', async (req: Request, res: Response) => {
  try {
    const roomId = req.params.id;
    const limit  = Math.min(parseInt(req.query.limit as string || '50', 10), 100);
    const cursor = req.query.cursor as string | undefined;
 
    // Verify room exists
    const room = await getRoomById(roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });
 
    let messages;
 
    if (!cursor) {
      // First load: Redis cache (fast O(1) read)
      messages = await getRecentMessages(roomId);
 
      // Cache miss — fall back to DB and warm the cache implicitly
      // (next cacheMessage call will populate it)
      if (!messages.length) {
        messages = await getRoomHistory(roomId, limit);
      }
    } else {
      // Pagination: bypass cache, go straight to DB with cursor
      messages = await getRoomHistory(roomId, limit, cursor);
    }
 
    return res.json({
      messages,
      // hasMore is a hint to the client: "there are older messages to load"
      // It's not 100% precise but avoids an extra COUNT query.
      hasMore: messages.length === limit,
    });
 
  } catch (err) {
    logger.error('GET /rooms/:id/messages error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
 
export default router;
