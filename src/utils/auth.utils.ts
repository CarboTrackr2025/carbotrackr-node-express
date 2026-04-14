import { desc, eq } from "drizzle-orm";
import { db } from "../db/connection.ts";
import { accounts, profiles } from "../db/schema.ts";

export default async function getProfileIdByAccountId(accountId: string) {
  try {
    const normalizedAccountId = accountId.trim();

    if (!normalizedAccountId) {
      return null;
    }

    const [result] = await db
      .select({
        profile_id: profiles.id,
        account_id: accounts.id,
      })
      .from(accounts)
      .innerJoin(profiles, eq(accounts.id, profiles.account_id))
      .where(eq(accounts.id, normalizedAccountId))
      .orderBy(desc(profiles.updated_at), desc(profiles.created_at))
      .limit(1);

    return result?.profile_id ?? null;
  } catch (error) {
    console.error("ERROR: getProfileIdByAccountId failed:", error);
    return null;
  }
}
