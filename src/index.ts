import env from "../env.ts"

// Ensure Clerk SDK sees a server-side API key at module import time. Prefer CLERK_API_KEY, fallback to CLERK_SECRET_KEY.
process.env.CLERK_API_KEY = process.env.CLERK_API_KEY ?? env.CLERK_API_KEY ?? env.CLERK_SECRET_KEY ?? process.env.CLERK_SECRET_KEY

import app from "./server.ts"

// Boot the API server (routes are mounted in server.ts, including /health)
app.listen(env.PORT, "0.0.0.0", () => {
    console.log(`Server is running on http://0.0.0.0:${env.PORT}`)
})
