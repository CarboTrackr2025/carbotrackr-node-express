import { db } from "../db/connection.ts"
import { accounts, profiles } from "../db/schema.ts"
import { eq } from "drizzle-orm"

export default async function getProfileIdByAccountId(accountId) {
    try {
        const [result] = await db
            .select({
                profile_id: profiles.id,
                account_id: accounts.id,
            })
            .from(accounts)
            .innerJoin(profiles, eq(accounts.id, profiles.account_id))
            .where(eq(accounts.id, accountId))
            .limit(1);


        return result?.profile_id ?? null;
    } catch (error) {
        console.error("ERROR: getProfileIdByAccountId failed:", error);
        return null;
    }
}