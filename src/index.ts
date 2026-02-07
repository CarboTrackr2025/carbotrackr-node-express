import { env } from "../env.ts"
import app from "./server.ts"

// Boot the API server (routes are mounted in server.ts, including /health)
app.listen(env.PORT, () => {
    console.log(`Server is running on http://localhost:${env.PORT}`)
})
