import express from "express"
import type { Request, Response } from "express"
import authRoutes from "./routes/authRoutes.ts"
import contactRoutes from "./routes/contactRoutes.ts"
import dashboardRoutes from "./routes/dashboardRoutes.ts"
import faqsRoutes from "./routes/faqsRoutes.ts"
import foodLogsRoutes from "./routes/foodLogsRoutes.ts"
import healthRoutes from "./routes/healthRoutes.ts";
import reportRoutes from "./routes/reportRoutes.ts"
import scannerRoutes from "./routes/scannerRoutes.ts"
import settingsRoutes from "./routes/settingsRoutes.ts";


const app = express()


app.use(express.json())
app.use(express.urlencoded({ extended: true }))


app.use("/auth", authRoutes)
app.use("/contact", contactRoutes)
app.use("/dashboard", dashboardRoutes)
app.use("/faqs", faqsRoutes)
app.use("/food-logs", foodLogsRoutes)
app.use("/health", healthRoutes)
app.use("/reports", reportRoutes)
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