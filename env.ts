import { z } from "zod"
import { env as loadEnv } from "custom-env"

process.env.NODE_ENV = process.env.NODE_ENV || "development"

const isProduction = process.env.NODE_ENV === "production"
const isDevelopment = process.env.NODE_ENV === "development"
const isTest = process.env.NODE_ENV === "test"

if (isDevelopment)
{
    loadEnv()
}
else if (isTest)
{
    loadEnv("test")
}

const envSchema = z.object({
    NODE_ENV: z
        .enum(["development", "production", "test"])
        .default("development"),

    PORT: z.coerce.number().positive().default(3000),

    DATABASE_URL: z.string().startsWith("postgresql://"),
    // DATABASE_POOL_MIN: z.coerce.number().positive().default(2),
    // DATABASE_POOL_MAX: z
    //     .coerce
    //     .number()
    //     .positive()
    //     .default(isProduction ? 50 : 10),

    GOOGLE_GEMINI_API_KEY: z.string().min(39),

    FAT_SECRET_CONSUMER_KEY: z.string().min(32),
    FAT_SECRET_CONSUMER_SECRET: z.string().min(32),

    // Clerk server keys (optional)
    CLERK_API_KEY: z.string().optional(),
    CLERK_SECRET_KEY: z.string().optional(),

    // LOG_LEVEL: z
    //     .enum(["error", "warn", "info", "debug"])
    //     .default(isProduction ? "info" : "debug")
})

export type Env = z.infer<typeof envSchema>

let env: Env

try
{
    env = envSchema.parse(process.env)
}
catch(e)
{
    if (e instanceof z.ZodError)
    {
        console.log("Invalid environment variables:")
        console.error(z.prettifyError(e))

        process.exit(1)
    }
    throw e
}

export const isProd = () => env.NODE_ENV === "production"
export const isDev = () => env.NODE_ENV === "development"
export const isTesting = () => env.NODE_ENV === "test"

export { env }
export default env