import { Request, Response, Router } from "express";
import { db } from "../db";
import { NewUser, users } from "../db/schema";
import { eq } from "drizzle-orm";
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";
import { auth, AuthRequest } from "../middleware/auth";
import { UUID } from "crypto";

const authRouter = Router();

interface SignUpRequest extends Request {
    body: {
        name: string;
        email: string;
        password: string;
    }
}

interface LoginBody {
    email: string;
    password: string;

}

authRouter.post("/signup", async (req: SignUpRequest, res: Response) => {
    try {
        //get request body
        const { name, email, password } = req.body
        //check if the user already exists
        const existingUser = await db.select().from(users).where(eq(users.email, email))
        if (existingUser.length) {
            res.status(400).json({ error : "user is already exists!" })
            return
        }
        //hashed password
        const hashedPassword = await bcryptjs.hash(password, 8);
        //create a new user and store in db
        const newUser: NewUser = {
            name, email, password: hashedPassword,
        }
        const [user] = await db.insert(users).values(newUser).returning()
        res.status(201).json(user)
    } catch (e) {
        res.status(500).json({ error: e })
    }
})

authRouter.post("/login", async (req: Request<{}, {}, LoginBody>, res: Response) => {
    try {
        //get request body
        const { email, password } = req.body
        //check if the user doesn't exists
        const [existingUser] = await db.select().from(users).where(eq(users.email, email))
        if (!existingUser) {
            res.status(400).json({ error: "Use with this email doesn't exists!" })
            return
        }
        //compare password
        const isMatch = await bcryptjs.compare(password, existingUser.password);
        //create a new user and store in db
        if (!isMatch) {
            res.status(400).json({ error: "Incorrect password" })
            return
        }
        const token = jwt.sign({ id: existingUser.id }, "passwordKey")
        res.json({ token, ...existingUser })
    } catch (e) {
        res.status(500).json({ error: e })
    }
})

authRouter.post("/tokenIsValid", async (req, res) => {
    try {
        //get the header
        const token = req.header("x-auth-token");
        //verify if the token is valid
        if (!token) {
            res.json(false)
            return
        }
        const verified = jwt.verify(token, "passwordKey")
        if (!verified) {
            res.json(false)
            return
        }
        //get the user data if the token is valid
        const verifiedToken = verified as { id: UUID }
        const [user] = await db.select().from(users).where(eq(users.id, verifiedToken.id));
        if (!user) {
            res.json(false)
            return
        }
        res.json(true)
    } catch (e) {
        res.status(500).json(false)
    }
})

authRouter.get("/", auth, async (req: AuthRequest, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: "User not found" })
            return
        }
        const [user] = await db.select().from(users).where(eq(users.id, req.user))
        res.json({ ...user, token: req.token })
    } catch (e) {
        res.status(500).json(false)
    }
})

export default authRouter