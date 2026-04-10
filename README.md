## How can I get my environment variables?
#### DATABASE_URL
1. Sign in to Neon [`https://neon.com`] using our organizational account or personal account.
2. Create a new project or select an existing one.
3. Click the project to open the dashboard
4. Click the "Connect" button on the top right corner of the dashboard.\
5. Make sure to allow Connection Pooling (by toggling the switch) for better performance.
5. In the "Connection Details" section, locate the "Connection String" field.
6. Copy the connection string provided. This string is your DATABASE_URL.
7. Note for athAIna/CarboTrackr developers: Create your own database or select existing database [CarboTrackr_ForAllDevs] for development purposes.


#### GOOGLE_GEMINI_API_KEY
1. Navigate to Google AI Studio [`https://aistudio.google.com`] and use your Google account to sign in.
2. Click the "Create API Key" button to generate a new API key. 
3. Create a Project or select an existing one
4. Name your Project
5. Click the Key to view and copy the API key.
6. Test the API Key with Postman or any API testing tool to ensure it works correctly.
7. Note for athAIna/CarboTrackr developers: Choose the Default Gemini Project for development purposes


#### FAT_SECRET_CONSUMER_KEY and FAT_SECRET_CONSUMER_SECRET (CAN ALSO CHOOSE FAT_SECRET_CLIENT_ID AND FAT_SECRET_CLIENT_SECRET BASED ON YOUR PREFERENCE)
1. Go to FatSecret and sign in or create a new account at [`https://platform.fatsecret.com/platform-api`].
2. Login to your FatSecret account.
3. Navigate to the Hamburger Icon (three horizontal lines) on the top left corner
4. Go to "Dashboard" Section
5. Choose "Generate/View API Keys" button
6. Go to REST API OAuth 1.0 Credentials (Make sure that the key names "Consumer Key" and "Consumer Secret" are visible)
7. Copy both keys to use as FAT_SECRET_CONSUMER_KEY and FAT_SECRET_CONSUMER_SECRET
8. Important API notes/demos:
- https://platform.fatsecret.com/docs/v4/foods.search
- https://platform.fatsecret.com/docs/guides
- https://platform.fatsecret.com/api-demo#food-api
9. Use URL based integration instead of Method based integration as suggested in the documentation.
10. Test the API Key with Postman or any API testing tool to ensure it works correctly.

#### CLERK_API_KEY
1. Sign in to Clerk at [`https://clerk.com`] using your organizational account or personal account.
2. Create a new application or select an existing one.
3. Navigate to the "Configure your application" section.
4. Navigate to API keys tab.
5. From the quick copy, select Express
4. Copy the CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY to use in your environment variables.
5. Test the API Key with Postman or any API testing tool to ensure it works correctly. 
6. Note for Note from King- "Use the Athaina account's API key so that the settings will align"

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


## How to run the application?
1. Make sure to do npm install to install all dependencies.
2. Always double-check the package.json scripts to see what commands are available.
3. Run the application using `npm run dev` for development mode
4. Locally, test the application health by navigating to `http://localhost:[port]/health` in your web browser or using an API testing tool like Postman.


## How to test API endpoints?
1. Use Postman or any API testing tool of your choice.
2. Make sure the application is running (using `npm run dev`).
3. Use the appropriate HTTP methods (GET, POST, PUT, DELETE) to test the API endpoints defined in the routes folder.
4. Include necessary headers and body data as required by the endpoints.
5. Check the responses and status codes to ensure the endpoints are functioning correctly.


## Reminders
#### db folder
- It contains all database-related files, including schema definitions, migration scripts, and seed data.
#### controller folder
- It handles the business logic and processes incoming requests, interacting with the database as needed.
#### middleware folder
- It contains functions that process requests before they reach the controllers, such as authentication, validation, and logging.
#### routes folder
- It defines the API endpoints and maps them to the corresponding controller functions.
#### utils folder 
- It is for helper functions that can be used across the application.
