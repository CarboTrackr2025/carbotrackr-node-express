## How can I get my environment variables?
#### DATABASE_URL
1. Sign in to Neon [`https://neon.com`] using our organizational account or personal account.
2. Create a new project or select an existing one.
3. Click the project to open the dashboard
4. Click the "Connect" button on the top right corner of the dashboard.
5. In the "Connection Details" section, locate the "Connection String" field.

#### GOOGLE_GEMINI_API_KEY
1. Navigate to Google AI Studio [`https://aistudio.google.com`] and use your Google account to sign in.
2. Click the "Create API Key" button to generate a new API key. 
3. Create a Project or select an existing one
4. Name your Project
5. Click the Key to view and copy the API key.


## How to do database commands with Drizzle related
1. Make sure that package.json contains the following scripts so that you can run the commands easily:
```    
    "db:generate": "drizzle-kit generate",
    "db:push": "drizzle-kit push",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio",
    "db:seed": "node src/db/seed.ts",
```
2. Difference of db:push vs db:generate + db:migrate
- Use `db:push` to test the database schema changes quickly during development. 
- It will sync the database schema directly to match your TypeScript schema without creating migration files.
- Use `db:generate` followed by `db:migrate` for production-ready changes.
3. What is `db:studio`?
- `db:studio` launches the Drizzle Studio, a web-based GUI for managing your database schema and data.
- It allows you to visualize your database structure, run queries, and manage data easily (somewhat similar with Neon dashboard).
4. How to seed the database?
- Create a seed file at `src/db/seed.ts` where you can write scripts to populate your database with initial data.
- Run the seed script using `npm run db:seed`