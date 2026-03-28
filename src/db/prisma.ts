// src/db/prisma.ts
// This file is for initializing and exporting a single PrismaClient instance to be used throughout the application.
// It prevents multiple instances of Prisma Client from being created in development during hot-reloads.


import { PrismaClient } from "@prisma/client";

const globalForPrisma  = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};


export const prisma = globalForPrisma.prisma ??
    new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}