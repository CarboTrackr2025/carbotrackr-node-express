import express from "express"
import type { Request, Response } from "express"

const app = express()
app.use(express.json())

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