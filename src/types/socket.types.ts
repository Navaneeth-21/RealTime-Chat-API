// src/types/socket.types.ts

// --- Payloads sent from client to server ---

export interface SendMessagePayload{
    roomId: string;  // ID of the chat room
    content: string; // The actual message content (text, image URL, or file URL)
    type?: MessageType;  // defaults to TEXT 
}

export interface JoinRoomPayload {
    roomId: string;
}

export interface LeaveRoomPayload {
    roomId: string;
}

export interface TypingPayload {
    roomId: string;
    isTyping: boolean; // true if the user is currently typing, false otherwise
}

export interface MarkAsReadPayload {
    roomId: string;
    messageId: string; // ID of the message to mark as read
}


// Events sent from client to server

export interface ClientToServerEvents {
    send_message: (payload: SendMessagePayload, ack: (res: AckResponse) => void) => void;
    join_room: (payload: JoinRoomPayload, ack: (res: AckResponse) => void) => void;
    leave_room: (payload: LeaveRoomPayload) => void;
    typing: (payload: TypingPayload) => void;
    mark_as_read: (payload: MarkAsReadPayload) => void;
}



//  Events  sent from server to client

export interface ServerToClientEvents {
    new_message: (message: MessageDTO) => void;
    user_joined: (event: UserRoomEvent) => void;
    user_left: (event: UserRoomEvent) => void;
    user_typing: (event: TypingEvent) => void;
    message_read: (event: ReadReceiptEvent) => void;
    error: (error: SocketError) => void;
    room_history: (messages: MessageDTO[]) => void;
}


// Data stored on each instance of the socket connection

export interface SocketData {
    user: AuthUser;
}


//  Data Transfer Objects (DTOs)

export interface MessageDTO {
    id: string;
    roomId: string;
    content: string;
    type: MessageType;
    createdAt: string; // ISO timestamp
    sender: {
        id: string;
        username: string;
        avatar?: string;
    };
}

export interface UserDTO {
    id: string;
    username: string;
    avatar?: string;
}

export interface RoomDTO {
    id: string;
    name: string;
    description?: string;
    memberCount: number;
    lastMessage?: MessageDTO;
}


//  Event shapes emitted by the server

export interface UserRoomEvent {
    roomId: string;
    user: UserDTO;
    timestamp: string; 
}

export interface TypingEvent {
    roomId: string;
    userId: string;
    username: string;
    isTyping: boolean;
}

export interface ReadReceiptEvent {
    roomId: string;
    userId: string;
    messageId: string;
    timestamp: string;
}

export interface SocketError {
    code: string; // In case like 'ROOM_NOT_FOUND', 'UNAUTHORIZED', etc.
    message: string; // error message
}


//  Acknowledgment response
// Client sends an event and passes a callback function (ack) that the server calls it with success or error.

export interface AckResponse<T = undefined> {
    success: boolean;
    data?: T;
    error?: string;
}

// -------------- Auth types -----------------------

export interface AuthUser {
    id: string;
    username: string;
    email: string;
    avatar?: string;
}

export interface JWTPayload  extends AuthUser {
    iat: number;  // issued at
    exp: number;  // expired at

}

//  Enums

export enum MessageType {
    TEXT = 'TEXT',
    IMAGE = 'IMAGE',
    FILE = 'FILE',
    SYSTEM = 'SYSTEM', // like "John joined the room" 
}

export enum SocketErrorCode {
    UNAUTHORIZED = 'UNAUTHORIZED',
    ROOM_NOT_FOUND = 'ROOM_NOT_FOUND',
    NOT_A_MEMBER = 'NOT_A_MEMBER',
    MESSAGE_TOO_LONG = 'MESSAGE_TOO_LONG',
    RATE_LIMITED = 'RATE_LIMITED',
    INTERNAL_ERROR = 'INTERNAL_ERROR',
}


