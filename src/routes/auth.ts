// src/routes/auth.ts

// ENDPOINTS:
// POST auth/register - create account, return JWT
// POST auth/login - verify credentials, return JWT

import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db/prisma";
import { generateToken } from "../middleware/auth";
import { logger } from "../utils/logger";

const router = Router();

// POST - /auth/register ----------------------------------------------------------------------------

router.post("/register", async (req: Request, res: Response) => {
    try {
        const { email, username, password} = req.body as {
            email?: string;
            username?: string;
            password?: string;
        };

        // validation
        if (!email?.trim() || !username?.trim() || !password){
            return res.status(400).json({error: 'Missing required fields'});
        }

        if (password.length < 8) {
            return res.status(400).json({error: 'Password must be atleast 8 characters long'});
        }

        if (username.length < 3 || username.length > 20) {
            return res.status(400).json({error: 'Username must be between 3 and 20 characters long'});
        }

        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            return res.status(400).json({error: 'Username can only contain letters, numbers and underscores'})
        }
        
        // check if user is already existed or not
        const existing = await prisma.user.findFirst({
            where:  { OR: [{ email: email.toLowerCase() }, { username }] },
            select: { id : true },
        });

        if (existing) {
            return res.status(409).json({error: 'email or username already taken'});
        }

        // hash the password and save for new user
        const hashed = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                email: email.toLowerCase().trim(),
                username: username.trim(),
                password: hashed,
            },

            select: {
                id: true,
                email: true,
                username: true,
                password: true,
                avatar: true,
            },
        });

        // token generation
        const token = generateToken({
            id: user.id,
            email: user.email,
            username: user.username,
            avatar: user.avatar ?? undefined,
        });

        return res.status(201).json({token, user});
    } catch (err) {
        logger.error('Registration error', err);
        return res.status(500).json({error: 'Registration failed'});
    }
});


// POST /auth/login --------------------------------------------------------------------

router.post('/login', async (req: Request, res: Response) => {

    try {
        const {email, password} = req.body as {
            email?: string,
            password?: string,
        }

        if (!email?.trim() || !password) {
            return res.status(400).json({error: 'Missing required fields'});
        }

        const user = await prisma.user.findUnique({
            where : {email: email.toLowerCase().trim()},
        });

        // constant time comparison - run bcrypt if user not found also
        // so response time is identical whether email exists or not

        const DUMMY = '$2a$10$vnioesvjosejpkvr['
        const valid = user ? (await bcrypt.compare(password, user.password)) : (await bcrypt.compare(password, DUMMY), false);

        if(!user || !valid) {
            return res.status(401).json({error: 'Invalid credentials'});
        }


        const token = generateToken({
            id: user.id,
            email: user.email,
            username: user.username,
            avatar: user.avatar ?? undefined,
        });

        return res.status(200).json({
            token,
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                avatar: user.avatar ?? undefined,
            },
        });

    } catch (err) {
        logger.error('Login error', err);
        return res.status(500).json({error: 'Internal server Error'});
    }
});

export default router;