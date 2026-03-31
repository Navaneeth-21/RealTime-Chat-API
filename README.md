# Real-time Chat API

A robust and scalable ***real-time chat API*** built with Node.js, TypeScript, Socket.io, Redis, and PostgreSQL. This project provides the backend services for a modern chat application, featuring user authentication, room management, real-time messaging, and presence tracking.

# Problem Statement
Most chat apps in portfolios are using polling, no auth, no persistence, and break the moment two server instances run. This project builds the real thing: a horizontally scalable, authenticated, real-time messaging API that works across multiple server instances using Redis as the message bus. It's a production-ready backend for a chat application.

This project solves the following problems:
 - Delayed message delivery
 - High database load
 - Poor scalability in chat apps

## Features

- **User Authentication**: Secure user registration and login using JWT and bcrypt.
- **Room Management**: Create, join, and list chat rooms.
- **Real-time Messaging**: Send and receive messages in real-time using Socket.io.
- **Presence Tracking**: See which users are online and in which rooms.
- **Message History**: Paginated message history for chat rooms.
- **Scalability**: Utilizes Redis for caching and pub/sub to enable horizontal scaling.
- **Database**: PostgreSQL with Prisma for type-safe database access.
- **Graceful Shutdown**: Ensures clean shutdown of server and database connections.

## Tech Stack

- **Backend**: Node.js, Express.js
- **Real-time Communication**: Socket.io
- **Database**: PostgreSQL (via Prisma ORM)
- **Caching & Pub/Sub**: Redis
- **Language**: TypeScript
- **Authentication**: JWT (JSON Web Tokens), bcrypt
- **Deployment**: Supabase(postgres), Upstash(redis), Render(application host)

## Architecture Overview

The application is designed to be scalable and maintainable.

- **Express.js**: Handles HTTP requests for authentication, room management, and message history.
- **Socket.io**: Manages persistent WebSocket connections for real-time communication.
- **Redis**:
  - **Caching**: Caches recent messages to reduce database load.
  - **Pub/Sub**: Broadcasts messages across multiple server instances at a time.
- **PostgreSQL**: The primary data store for users, rooms, and messages.
- **Prisma ORM**: Provides a type-safe API for database operations.

## API Endpoints

All endpoints are prefixed with `/`.

### Auth

- `POST /auth/register`: Register a new user.
- `POST /auth/login`: Log in a user.

### Rooms

- `GET /rooms`: Get a list of rooms the user is a member of.
- `POST /rooms`: Create a new room.
- `GET /rooms/:id/messages`: Get paginated message history for a room.

## WebSocket Events

### Client to Server

- `message:send`: Send a message to a room.
- `room:join`: Join a room.
- `room:leave`: Leave a room.
- `presence:update`: Update the user's presence status.

### Server to Client

- `message:receive`: Receive a new message.
- `room:user-joined`: A user has joined the room.
- `room:user-left`: A user has left the room.
- `presence:updated`: A user's presence has been updated.
- `error`: If an error has occurred.

## Database Schema

The database schema is defined in `prisma/schema.prisma` and includes the following models:

- `User`: Stores user information.
- `Room`: Stores information about chat rooms.
- `Message`: Stores individual chat messages.
- `RoomMember`: Manages the relationship between users and rooms.
- `ReadReceipt`: Tracks when a user has read a message.

## Getting Started

### Prerequisites

- Node.js (v20 or higher)
- npm

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/your-username/realtime-chat-api.git
    cd realtime-chat-api
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Set up environment variables by copying `.env.example` to `.env` and fill with you original values:
    ```bash
    cp .env.example .env
    ```
4.  Running the migrations
    ```bash
    npx prisma generate
    ```
5. Testing
    ```bash
    ts-node src/test-multiuser.ts
   ```

### Running the App

- **Development**:
  ```bash
  npm run dev
  npx prisma migrate dev
  ```
- **Production**:
  ```bash
  npm run build
  npm run start
  npx prisma migrate deploy
  ```

## Environment Variables

The following environment variables are required:

- `DATABASE_URL`: The connection string for the PostgreSQL database.
- `REDIS_URL`: The connection string for the Redis instance.
- `PORT`: The port for the server to run on.
- `JWT_SECRET`: A secret key for signing JWTs.
- `CLIENT_URL`: The URL of the client application for CORS.
- `MAX_CACHE_MESSAGES`: The maximum number of messages to cache in Redis.
- `TTL_SECONDS`: The time-to-live for cached messages in Redis.



## Contributing

Contributions are Open! Feel free to submit a pull request or to contact me.

