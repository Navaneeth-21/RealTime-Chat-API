// src/db/queries.ts
// This file contains all the database query functions using Prisma Client. 
// It also includes type mapping to convert Prisma models into the DTOs expected by the socket events.

import { prisma }         from './prisma';
import { MessageDTO, UserDTO, RoomDTO, MessageType } from '../types/socket.types';
import { logger }         from '../utils/logger';

// Payload type helpers ----------------------------------------------

const _roomWithCountQuery = () =>
  prisma.room.findFirst({
    include: { _count: { select: { members: true } } },
  });

const _membershipWithRoomQuery = () =>
  prisma.roomMember.findFirst({
    include: {
      room: {
        include: { _count: { select: { members: true } } },
      },
    },
  });

type RoomWithCount      = NonNullable<Awaited<ReturnType<typeof _roomWithCountQuery>>>;
type MembershipWithRoom = NonNullable<Awaited<ReturnType<typeof _membershipWithRoomQuery>>>;

// Type mapper helpers ------------------------------------------------- 

function toMessageDTO(msg: {
  id: string;
  content: string;
  type: string;
  createdAt: Date;
  roomId: string;
  sender: { id: string; username: string; avatar: string | null };
}): MessageDTO {
  return {
    id:        msg.id,
    roomId:    msg.roomId,
    content:   msg.content,
    type:      msg.type as MessageType,
    createdAt: msg.createdAt.toISOString(),
    sender: {
      id:       msg.sender.id,
      username: msg.sender.username,
      avatar:   msg.sender.avatar ?? undefined,
    },
  };
}

function toRoomDTO(room: RoomWithCount): RoomDTO {
  return {
    id:          room.id,
    name:        room.name,
    description: room.description ?? undefined,
    memberCount: room._count.members,
  };
}

// Messages ------------------------------------------------ 

export async function persistMessage(
  senderId: string,
  roomId:   string,
  content:  string,
  type:     MessageType = MessageType.TEXT
): Promise<MessageDTO> {
  const msg = await prisma.message.create({
    data: { senderId, roomId, content, type },
    include: {
      sender: { select: { id: true, username: true, avatar: true } },
    },
  });
  return toMessageDTO(msg);
}

export async function getRoomHistory(
  roomId:  string,
  limit:   number = 50,
  cursor?: string
): Promise<MessageDTO[]> {
  let cursorDate: Date | undefined;

  if (cursor) {
    const pivot = await prisma.message.findUnique({
      where:  { id: cursor },
      select: { createdAt: true },
    });
    cursorDate = pivot?.createdAt;
  }

  const messages = await prisma.message.findMany({
    where: {
      roomId,
      ...(cursorDate ? { createdAt: { lt: cursorDate } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take:    limit,
    include: {
      sender: { select: { id: true, username: true, avatar: true } },
    },
  });

  return messages.reverse().map(toMessageDTO);
}

// Rooms ---------------------------------------------------------------------- 

export async function isRoomMember(userId: string, roomId: string): Promise<boolean> {
  const membership = await prisma.roomMember.findUnique({
    where: { userId_roomId: { userId, roomId } },
  });
  return !!membership;
}

export async function joinRoom(userId: string, roomId: string): Promise<void> {
  await prisma.roomMember.upsert({
    where:  { userId_roomId: { userId, roomId } },
    create: { userId, roomId },
    update: {},
  });
}

export async function leaveRoom(userId: string, roomId: string): Promise<void> {
  await prisma.roomMember.deleteMany({ where: { userId, roomId } });
}

export async function getAllRooms(): Promise<RoomDTO[]> {
  const rooms = await prisma.room.findMany({
    include: { _count: { select: { members: true } } },
  });
  return rooms.map((room: RoomWithCount) => toRoomDTO(room));
}

export async function getRoomById(roomId: string): Promise<RoomDTO | null> {
  const room = await prisma.room.findUnique({
    where:   { id: roomId },
    include: { _count: { select: { members: true } } },
  });
  if (!room) return null;
  return toRoomDTO(room);
}

export async function getUserRooms(userId: string): Promise<RoomDTO[]> {
  const memberships = await prisma.roomMember.findMany({
    where:   { userId },
    include: {
      room: {
        include: { _count: { select: { members: true } } },
      },
    },
    orderBy: { joinedAt: 'desc' },
  });
  return memberships.map((m: MembershipWithRoom) => toRoomDTO(m.room));
}

// Read receipts ---------------------------------------------------------------- 

export async function upsertReadReceipt(
  userId:    string,
  roomId:    string,
  messageId: string
): Promise<void> {
  await prisma.readReceipt.upsert({
    where:  { userId_roomId: { userId, roomId } },
    create: { userId, roomId, messageId },
    update: { messageId },
  });
}

// Users ----------------------------------------------------------------------- 

export async function getUserById(userId: string): Promise<UserDTO | null> {
  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { id: true, username: true, avatar: true },
  });
  if (!user) return null;
  return { id: user.id, username: user.username, avatar: user.avatar ?? undefined };
}