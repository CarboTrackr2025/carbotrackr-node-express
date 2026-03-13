import env from "../env.ts"
import express from "express"
import type { Request, Response } from "express"
import authRoutes from "./routes/authRoutes.ts"
import contactRoutes from "./routes/contactRoutes.ts"
import dashboardRoutes from "./routes/dashboardRoutes.ts"
import faqsRoutes from "./routes/faqsRoutes.ts"
import foodLogsRoutes from "./routes/foodLogsRoutes.ts"
import healthRoutes from "./routes/healthRoutes.ts"
import reportRoutes from "./routes/reportRoutes.ts"
import scannerRoutes from "./routes/scannerRoutes.ts"
import settingsRoutes from "./routes/settingsRoutes.ts"
import { clerkClient, clerkMiddleware } from "@clerk/express"


const app = express()



app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Lightweight CORS middleware to support cookies/credentials in development and controlled environments.
// - echoes back the request Origin as Access-Control-Allow-Origin (safer than '*') so the browser will accept credentials
// - sets Access-Control-Allow-Credentials so cookies can be sent/accepted by browsers
// - handles preflight OPTIONS requests
app.use((req: Request, res: Response, next) => {
    const origin = req.headers.origin || ""
    // In production you should replace this with a specific allowed origin from configuration
    if (origin) {
        res.header('Access-Control-Allow-Origin', origin)
    } else {
        res.header('Access-Control-Allow-Origin', '*')
    }
    res.header('Access-Control-Allow-Credentials', 'true')
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')

    if (req.method === 'OPTIONS') {
        return res.sendStatus(200)
    }

    next()
})

app.use(clerkMiddleware())


// Root route: temporary test endpoint to return only Clerk userIds (no auth required)
app.get("/", async (req: Request, res: Response) => {
    try {
        const usersPage = await clerkClient.users.getUserList()
        const userIds = usersPage.data.map(u => u.id)
        return res.status(200).json(userIds)
    } catch (error: any) {
        return res.status(500).json({
            status: "Error",
            message: error?.message ?? "Unexpected error",
            timestamp: new Date().toISOString(),
        })
    }
})



app.use("/auth", authRoutes)
app.use("/contact", contactRoutes)
app.use("/dashboard", dashboardRoutes)
app.use("/faqs", faqsRoutes)
app.use("/food-logs", foodLogsRoutes)
app.use("/health", healthRoutes)
app.use("/report", reportRoutes)
app.use("/scanner", scannerRoutes)
app.use("/settings", settingsRoutes)


app.get("/health", (req: Request, res: Response) => {
    res.status(200)
        .json({
            status: "OK",
            timestamp: new Date().toISOString(),
            service: "CarboTrackr API",
        })
})


app.use((req: Request, res: Response)=> {
    res.status(404)
        .json({
            status: "Not Found",
            message: `Cannot ${req.method} ${req.originalUrl}`,
            timestamp: new Date().toISOString(),
        })
})


export { app }


export default app