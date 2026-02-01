import { env } from "../env.ts"
import { clerkMiddleware, clerkClient, requireAuth, getAuth } from "@clerk/express";
import express, {response} from "express";

const app = express();

app.use(clerkMiddleware());

// to test if clerk is connected to our backend, currently checks all users in the clerk dashboard
// REMOVE WHEN DONE TESTING -k
app.get("/", async (req, res) => {
    const getUsers = await clerkClient.users.getUserList();

    res.json(getUsers);
})

app.listen(env.PORT, () => {
    console.log(`Server is running on http://localhost:${env.PORT}`)})
