import type { Request, Response } from "express";
import { clerkClient } from "@clerk/express";
import { db } from "../db/connection.ts";
import { accounts, profiles } from "../db/schema.ts";
import { isDev } from "../../env.ts";
import env from "../../env.ts";
import { eq } from "drizzle-orm";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

// POST /auth/account - persist a Clerk user (created via frontend SDK) in local DB
export async function createUserAccount(req: Request, res: Response) {
  try {
    const { userId, email } = req.body || {};
    if (!userId || !email) {
      return res.status(400).json({ message: "userId and email are required" });
    }
    if (!emailRegex.test(email)) {
      return res
        .status(400)
        .json({ message: "email is not a valid email address" });
    }

    try {
      await db.insert(accounts).values({
        id: userId,
        email,
      });
    } catch (insertErr: any) {
      console.error("Insert account error:", insertErr);
      const pgCode = insertErr?.code || insertErr?.pgCode;
      if (pgCode === "23505") {
        return res
          .status(409)
          .json({ message: "Account already exists for this userId or email" });
      }
      return res.status(500).json({
        message: insertErr?.message ?? "Database error",
        details: isDev() ? String(insertErr) : undefined,
      });
    }

    return res.status(201).json({
      id: userId,
      email,
    });
  } catch (error: any) {
    console.error("createUserAccount unexpected error:", error);
    return res
      .status(500)
      .json({ message: error?.message ?? "Unexpected error" });
  }
}

// POST /auth/login - server-side sign-in using Clerk and return session info (or set cookie)
export async function loginUser(req: Request, res: Response) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "email and password are required" });
    }
    if (!emailRegex.test(email)) {
      return res
        .status(400)
        .json({ message: "email is not a valid email address" });
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        message: `password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      });
    }

    // Require a server-side Clerk key to perform server-side sign-in and token exchange
    const clerkApiKey =
      env.CLERK_API_KEY ??
      env.CLERK_SECRET_KEY ??
      process.env.CLERK_SECRET_KEY ??
      process.env.CLERK_API_KEY;
    if (!clerkApiKey)
      return res
        .status(500)
        .json({ message: "Server is not configured with Clerk API key" });

    // Lookup the Clerk user by email to obtain user_id (prevents the "user_id must be included" 422 error)
    let clerkUser;
    try {
      const usersPage = await clerkClient.users.getUserList({
        emailAddress: [email],
        limit: 1,
      });
      clerkUser = usersPage?.data?.[0];
      if (!clerkUser)
        return res.status(401).json({ message: "Invalid email or password" });
    } catch (lookupErr: any) {
      console.error("Clerk user lookup error:", lookupErr);
      return res.status(502).json({ message: "Authentication service error" });
    }

    // Create a session for the user using Clerk REST sessions endpoint
    const sessionsUrl = "https://api.clerk.com/v1/sessions";
    let resp;
    try {
      resp = await fetch(sessionsUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Bearer ${clerkApiKey}`,
        },
        body: new URLSearchParams({
          user_id: clerkUser.id,
          password,
        }).toString(),
      });
    } catch (err: any) {
      console.error("Clerk sessions request failed:", err);
      return res
        .status(502)
        .json({ message: "Authentication service unreachable" });
    }

    const text = await resp.text();
    if (!resp.ok) {
      return res
        .status(resp.status >= 400 && resp.status < 600 ? resp.status : 502)
        .json({
          message: "Authentication failed",
          upstreamStatus: resp.status,
          upstreamBody: text,
        });
    }

    let json: any;
    try {
      json = JSON.parse(text);
    } catch (e) {
      json = text;
    }

    // Clerk may return different shapes; prefer a token (jwt/sessionToken/token) when available for mobile clients
    const token = json?.jwt ?? json?.token ?? json?.sessionToken ?? undefined;
    const sessionId = json?.id ?? json?.session_id ?? undefined;

    if (token) {
      return res.status(200).json({
        userId: clerkUser.id,
        email,
        token,
        message: "Signed in",
        method: "token",
      });
    }

    if (sessionId) {
      return res.status(200).json({
        userId: clerkUser.id,
        email,
        sessionId,
        message: "Signed in",
        method: "sessionId",
      });
    }

    // Fallback: authentication succeeded but no token/session id found
    return res
      .status(200)
      .json({ userId: clerkUser.id, email, message: "Signed in" });
  } catch (error: any) {
    console.error("loginUser unexpected error:", error);
    return res
      .status(500)
      .json({ message: error?.message ?? "Unexpected error" });
  }
}

// GET /auth/users - list Clerk user IDs (no auth; testing only)
export async function listUserIds(_req: Request, res: Response) {
  try {
    const usersPage = await clerkClient.users.getUserList();
    const userIds = usersPage.data.map((u) => u.id);
    return res.status(200).json(userIds);
  } catch (error: any) {
    return res
      .status(500)
      .json({ message: error?.message ?? "Unexpected error" });
  }
}

// POST /auth/refresh - refresh a session token using sessionId or an expired token
export async function refreshToken(req: Request, res: Response) {
  try {
    // Try body.sessionId first
    let sessionId: string | undefined = req.body?.sessionId;

    // If still no sessionId, allow several flexible token inputs:
    // - body.token: can be raw token, or 'Bearer <token>' (with or without angle brackets)
    // - Authorization header: case-insensitive 'Bearer <token>'
    if (!sessionId) {
      let tokenCandidate: string | undefined;

      // Accept token in body (token may be 'Bearer <...>' or raw)
      const bodyToken = req.body?.token;
      if (typeof bodyToken === "string" && bodyToken.trim()) {
        tokenCandidate = bodyToken.trim();
      }

      // If no body token, fall back to Authorization header (case-insensitive)
      if (!tokenCandidate) {
        const authHeader = (req.headers.authorization ??
          req.headers.Authorization ??
          "") as string;
        // Match 'Bearer <token>' case-insensitive, allow optional angle brackets
        const m = authHeader.match(/^\s*Bearer\s+<?(.+?)>?\s*$/i);
        if (m) tokenCandidate = m[1];
      }

      // Normalize tokenCandidate: strip surrounding quotes or angle brackets if any
      if (tokenCandidate) {
        tokenCandidate = tokenCandidate
          .replace(/^\s*["'`]?<?/, "")
          .replace(/>?["'`]?\s*$/, "");
      }

      // If we have a token candidate, try to decode JWT payload to extract sid/session_id
      if (tokenCandidate) {
        try {
          const parts = tokenCandidate.split(".");
          if (parts.length >= 2) {
            const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
            const payloadJson = Buffer.from(b64, "base64").toString("utf8");
            const payload = JSON.parse(payloadJson);
            sessionId = payload?.sid ?? payload?.session_id ?? sessionId;
          }
        } catch (e) {
          // ignore decode errors
        }
      }
    }

    if (!sessionId) {
      return res.status(400).json({
        message:
          "sessionId must be provided in body or extractable from Authorization token",
      });
    }

    const clerkApiKey =
      env.CLERK_API_KEY ??
      env.CLERK_SECRET_KEY ??
      process.env.CLERK_SECRET_KEY ??
      process.env.CLERK_SECRET;
    if (!clerkApiKey)
      return res.status(500).json({ message: "Server missing Clerk API key" });

    const url = `https://api.clerk.com/v1/sessions/${encodeURIComponent(sessionId)}/tokens`;
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${clerkApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const text = await resp.text();
      if (!resp.ok) {
        return res
          .status(resp.status >= 400 && resp.status < 600 ? resp.status : 502)
          .json({
            message: "failed to refresh token",
            upstreamStatus: resp.status,
            upstreamBody: text,
          });
      }
      let json: any;
      try {
        json = JSON.parse(text);
      } catch (e) {
        json = text;
      }
      const token = json?.jwt ?? json?.token ?? json?.sessionToken ?? undefined;
      if (token && typeof token === "string") {
        return res.status(200).json({ token });
      }
      return res.status(502).json({
        message: "no token returned from auth provider",
        upstreamBody: json,
      });
    } catch (err: any) {
      return res.status(502).json({
        message: "error contacting auth provider",
        details: String(err),
      });
    }
  } catch (err: any) {
    return res
      .status(500)
      .json({ message: err?.message ?? "Unexpected error" });
  }
}

// POST /auth/logout - revoke a Clerk session (server-side)
export async function logout(req: Request, res: Response) {
  try {
    // Accept sessionId in body or extract from token (same logic as refreshToken)
    let sessionId: string | undefined = req.body?.sessionId;

    if (!sessionId) {
      let tokenCandidate: string | undefined;
      const bodyToken = req.body?.token;
      if (typeof bodyToken === "string" && bodyToken.trim())
        tokenCandidate = bodyToken.trim();

      if (!tokenCandidate) {
        const authHeader = (req.headers.authorization ??
          req.headers.Authorization ??
          "") as string;
        const m = authHeader.match(/^\s*Bearer\s+<?(.+?)>?\s*$/i);
        if (m) tokenCandidate = m[1];
      }

      if (tokenCandidate) {
        tokenCandidate = tokenCandidate
          .replace(/^\s*["'`]?<?/, "")
          .replace(/>?["'`]?\s*$/, "");
        try {
          const parts = tokenCandidate.split(".");
          if (parts.length >= 2) {
            const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
            const payloadJson = Buffer.from(b64, "base64").toString("utf8");
            const payload = JSON.parse(payloadJson);
            sessionId = payload?.sid ?? payload?.session_id ?? sessionId;
          }
        } catch (e) {
          // ignore
        }
      }
    }

    if (!sessionId) {
      return res.status(400).json({
        message:
          "sessionId must be provided in body or extractable from Authorization token",
      });
    }

    const clerkApiKey =
      env.CLERK_API_KEY ??
      env.CLERK_SECRET_KEY ??
      process.env.CLERK_SECRET_KEY ??
      process.env.CLERK_SECRET;
    if (!clerkApiKey)
      return res.status(500).json({ message: "Server missing Clerk API key" });

    // Quick sanity check: ensure we're not accidentally using a publishable key (starts with 'pk_')
    if (typeof clerkApiKey === "string" && /^pk_/.test(clerkApiKey)) {
      return res.status(500).json({
        message:
          "Server is configured with a publishable Clerk API key. Use the Clerk secret key (server key) to revoke sessions.",
      });
    }

    // Try SDK-based revoke if available (safer, uses clerk client)
    try {
      const maybeSessions = (clerkClient as any).sessions;
      if (maybeSessions && typeof maybeSessions.revoke === "function") {
        try {
          await maybeSessions.revoke(sessionId);
          // clear cookies
          try {
            res.clearCookie("__session");
            res.clearCookie("session");
          } catch (e) {}
          return res.status(200).json({ message: "Signed out", sessionId });
        } catch (sdkErr) {
          // fall through to REST attempts below
          if (isDev())
            console.error(
              "SDK session revoke error (falling back to REST):",
              sdkErr,
            );
        }
      }
    } catch (e) {
      // ignore
    }

    const url = `https://api.clerk.com/v1/sessions/${encodeURIComponent(sessionId)}`;
    try {
      // Primary attempt: DELETE the session
      let resp = await fetch(url, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${clerkApiKey}` },
      });
      let text = await resp.text();

      // If DELETE is not allowed (405) or not OK, try common alternative revoke endpoints
      if (!resp.ok) {
        const altPaths = ["/revoke", "/expire"];
        for (const p of altPaths) {
          try {
            const altUrl = `${url}${p}`;
            const altResp = await fetch(altUrl, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${clerkApiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({}),
            });
            const altText = await altResp.text();
            if (altResp.ok) {
              resp = altResp;
              text = altText;
              break;
            }
          } catch (innerErr) {
            // ignore and try next alt path
          }
        }
      }

      if (!resp.ok) {
        // forward upstream error (include body and headers to help debug)
        const status =
          resp.status >= 400 && resp.status < 600 ? resp.status : 502;
        const hdrs: Record<string, string> = {};
        try {
          resp.headers.forEach((v, k) => {
            hdrs[k] = v;
          });
        } catch (e) {
          /* ignore */
        }
        if (isDev())
          console.error("Clerk revoke failed", {
            status: resp.status,
            headers: hdrs,
            body: text,
          });
        return res.status(status).json({
          message: "failed to revoke session",
          upstreamStatus: resp.status,
          upstreamBody: text,
          upstreamHeaders: hdrs,
        });
      }

      // Clear common cookie names (for browser flows). No-op for mobile.
      try {
        res.clearCookie("__session");
        res.clearCookie("session");
      } catch (e) {
        // ignore if clearCookie isn't configured the same way
      }

      return res.status(200).json({ message: "Signed out", sessionId });
    } catch (err: any) {
      return res.status(502).json({
        message: "error contacting auth provider",
        details: String(err),
      });
    }
  } catch (err: any) {
    return res
      .status(500)
      .json({ message: err?.message ?? "Unexpected error" });
  }
}

// DEV DEBUG: GET /auth/users/:userId/sessions - list Clerk sessions for a user (dev only)
export async function getUserSessions(req: Request, res: Response) {
  if (!isDev())
    return res
      .status(403)
      .json({ message: "Endpoint allowed in development only" });

  const userIdRaw = req.params.userId;
  const userId = Array.isArray(userIdRaw) ? userIdRaw[0] : userIdRaw;
  if (!userId)
    return res.status(400).json({ message: "userId path param required" });

  const clerkApiKey =
    env.CLERK_API_KEY ??
    env.CLERK_SECRET_KEY ??
    process.env.CLERK_SECRET_KEY ??
    process.env.CLERK_API_KEY;
  if (!clerkApiKey)
    return res.status(500).json({ message: "Server missing Clerk API key" });
  if (typeof clerkApiKey === "string" && /^pk_/.test(clerkApiKey))
    return res.status(500).json({
      message:
        "Server is configured with a publishable Clerk API key. Use the Clerk secret key.",
    });

  const url = `https://api.clerk.com/v1/users/${encodeURIComponent(userId)}/sessions`;
  try {
    let resp = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${clerkApiKey}`,
        "Content-Type": "application/json",
      },
    });
    let text = await resp.text();

    // If Clerk returns 404, try alternative query-based endpoint
    if (!resp.ok && resp.status === 404) {
      const altUrl = `https://api.clerk.com/v1/sessions?user_id=${encodeURIComponent(userId)}`;
      try {
        const altResp = await fetch(altUrl, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${clerkApiKey}`,
            "Content-Type": "application/json",
          },
        });
        const altText = await altResp.text();
        if (altResp.ok) {
          let altJson: any;
          try {
            altJson = JSON.parse(altText);
          } catch (e) {
            altJson = altText;
          }
          const sessions: any[] = Array.isArray(altJson)
            ? altJson
            : (altJson?.data ?? []);
          const out = sessions.map((s) => ({
            id: s.id ?? s.session_id ?? s.sid,
            status: s.status,
            last_active_at: s.last_active_at,
            created_at: s.created_at,
          }));
          return res.status(200).json({ sessions: out, source: "query" });
        }
        // fall through to original error handling below, but include alt response details
        // merge alt headers for debugging
        const altHdrs: Record<string, string> = {};
        try {
          altResp.headers.forEach((v, k) => {
            altHdrs[k] = v;
          });
        } catch (e) {}
        if (isDev())
          console.error("Clerk alt sessions fetch failed", {
            status: altResp.status,
            headers: altHdrs,
            body: altText,
          });
        // include alt info in main response
        text += `\n---\naltStatus:${altResp.status}\naltBody:${altText}`;
      } catch (altErr) {
        // ignore alt fetch error, continue to return original 404
        if (isDev()) console.error("Clerk alt sessions request error:", altErr);
      }
    }

    if (!resp.ok) {
      const hdrs: Record<string, string> = {};
      try {
        resp.headers.forEach((v, k) => {
          hdrs[k] = v;
        });
      } catch (e) {}
      // include clerk trace id if present in headers
      const clerkTrace =
        hdrs["x-clerk-trace-id"] ?? hdrs["x-clerk-trace-id".toLowerCase()];
      const payload: any = {
        message: "failed to fetch user sessions",
        upstreamStatus: resp.status,
        upstreamBody: text,
        upstreamHeaders: hdrs,
      };
      if (clerkTrace) payload.clerkTraceId = clerkTrace;
      return res
        .status(resp.status >= 400 && resp.status < 600 ? resp.status : 502)
        .json(payload);
    }

    let json: any;
    try {
      json = JSON.parse(text);
    } catch (e) {
      json = text;
    }
    const sessions: any[] = Array.isArray(json) ? json : (json?.data ?? []);
    const out = sessions.map((s) => ({
      id: s.id ?? s.session_id ?? s.sid,
      status: s.status,
      last_active_at: s.last_active_at,
      created_at: s.created_at,
    }));
    return res.status(200).json({ sessions: out });
  } catch (err: any) {
    return res.status(502).json({
      message: "error contacting auth provider",
      details: String(err),
    });
  }
}

// DEV DEBUG: GET /auth/sessions/:sessionId - get a single Clerk session object (dev only)
export async function getSessionById(req: Request, res: Response) {
  if (!isDev())
    return res
      .status(403)
      .json({ message: "Endpoint allowed in development only" });

  const sessionIdRaw = req.params.sessionId;
  const sessionId = Array.isArray(sessionIdRaw)
    ? sessionIdRaw[0]
    : sessionIdRaw;
  if (!sessionId)
    return res.status(400).json({ message: "sessionId path param required" });

  const clerkApiKey =
    env.CLERK_API_KEY ??
    env.CLERK_SECRET_KEY ??
    process.env.CLERK_SECRET_KEY ??
    process.env.CLERK_API_KEY;
  if (!clerkApiKey)
    return res.status(500).json({ message: "Server missing Clerk API key" });
  if (typeof clerkApiKey === "string" && /^pk_/.test(clerkApiKey))
    return res.status(500).json({
      message:
        "Server is configured with a publishable Clerk API key. Use the Clerk secret key.",
    });

  const url = `https://api.clerk.com/v1/sessions/${encodeURIComponent(sessionId)}`;
  try {
    const resp = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${clerkApiKey}`,
        "Content-Type": "application/json",
      },
    });
    const text = await resp.text();
    if (!resp.ok) {
      const hdrs: Record<string, string> = {};
      try {
        resp.headers.forEach((v, k) => {
          hdrs[k] = v;
        });
      } catch (e) {}
      return res
        .status(resp.status >= 400 && resp.status < 600 ? resp.status : 502)
        .json({
          message: "failed to fetch session",
          upstreamStatus: resp.status,
          upstreamBody: text,
          upstreamHeaders: hdrs,
        });
    }
    let json: any;
    try {
      json = JSON.parse(text);
    } catch (e) {
      json = text;
    }
    return res.status(200).json({ session: json });
  } catch (err: any) {
    return res.status(502).json({
      message: "error contacting auth provider",
      details: String(err),
    });
  }
}

// New: Update profile by account id - PUT /auth/profile/:accountId (or body.accountId)
export async function updateProfile(req: Request, res: Response) {
  try {
    const accountIdRaw =
      req.params?.accountId ?? req.body?.accountId ?? req.body?.userId;
    const accountId = Array.isArray(accountIdRaw)
      ? accountIdRaw[0]
      : accountIdRaw;
    if (!accountId)
      return res.status(400).json({
        message: "accountId (path param or body.accountId) is required",
      });

    const profileBody = req.body?.profile ?? req.body;
    const sexRaw = profileBody?.sex;
    const dobRaw = profileBody?.date_of_birth;
    const heightRaw = profileBody?.height_cm;
    const weightRaw = profileBody?.weight_kg;
    const diagnosedRaw = profileBody?.diagnosed_with;

    function normalizeSex(s: any) {
      if (!s) return undefined;
      const u = String(s).trim().toUpperCase();
      if (u === "M" || u === "MALE") return "MALE";
      if (u === "F" || u === "FEMALE") return "FEMALE";
      return undefined;
    }

    function normalizeDiagnosed(s: any) {
      if (!s) return undefined;
      const u = String(s)
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "_");
      // Check for TYPE_2_DIABETES variations
      if (u.includes("TYPE") && u.includes("2") && u.includes("DIABET"))
        return "TYPE_2_DIABETES";
      // Check for PRE_DIABETES variations (handles "prediabetes", "pre_diabetes", "pre diabetes", etc.)
      if (
        (u.includes("PRE") && u.includes("DIABET")) ||
        u === "PREDIABETES" ||
        u === "PRE_DIABETES"
      )
        return "PRE_DIABETES";
      // Check for NOT_APPLICABLE variations
      if (u.includes("NOT") && (u.includes("APPLIC") || u.includes("NA")))
        return "NOT_APPLICABLE";
      if (u === "NOT_APPLICABLE" || u === "NOTAPPLICABLE")
        return "NOT_APPLICABLE";
      // Check if it's already one of the valid enums
      if (["TYPE_2_DIABETES", "PRE_DIABETES", "NOT_APPLICABLE"].includes(u))
        return u;
      return undefined;
    }

    const sex = normalizeSex(sexRaw);
    let dateOfBirth: Date | undefined = undefined;
    if (dobRaw) {
      const parsed = new Date(dobRaw);
      if (!isNaN(parsed.getTime())) dateOfBirth = parsed;
      else
        return res
          .status(400)
          .json({ message: "date_of_birth is not a valid date" });
    }
    const height =
      typeof heightRaw === "number"
        ? heightRaw
        : heightRaw
          ? Number(heightRaw)
          : undefined;
    const weight =
      typeof weightRaw === "number"
        ? weightRaw
        : weightRaw
          ? Number(weightRaw)
          : undefined;
    const diagnosed_with = normalizeDiagnosed(diagnosedRaw);

    const updatePayload: any = {};
    if (sex) updatePayload.sex = sex;
    if (dateOfBirth) updatePayload.date_of_birth = dateOfBirth;
    if (Number.isFinite(height)) updatePayload.height_cm = height;
    if (Number.isFinite(weight)) updatePayload.weight_kg = weight;
    if (diagnosed_with) updatePayload.diagnosed_with = diagnosed_with;
    if (Object.keys(updatePayload).length === 0)
      return res
        .status(400)
        .json({ message: "No valid profile fields provided to update" });

    updatePayload.updated_at = new Date();

    try {
      await db
        .update(profiles)
        .set(updatePayload)
        .where(eq(profiles.account_id, accountId));
      return res.status(200).json({ message: "Profile updated", accountId });
    } catch (err: any) {
      console.error("Profile update error:", err);
      return res
        .status(500)
        .json({ message: err?.message ?? "Failed to update profile" });
    }
  } catch (err: any) {
    return res
      .status(500)
      .json({ message: err?.message ?? "Unexpected error" });
  }
}
// DELETE /auth/account/:accountId - soft delete user account
export async function deleteAccount(req: Request, res: Response) {
  try {
    const accountIdRaw = req.params.accountId;
    const accountId = Array.isArray(accountIdRaw)
      ? accountIdRaw[0]
      : accountIdRaw;

    if (!accountId) {
      return res
        .status(400)
        .json({ message: "accountId path param is required" });
    }

    // Check if account exists
    const [existingAccount] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);

    if (!existingAccount) {
      return res.status(404).json({ message: "Account not found" });
    }

    if (existingAccount.deleted_at) {
      return res.status(410).json({ message: "Account already deleted" });
    }

    // Soft delete: save original email, obfuscate email, set deleted_at
    await db
      .update(accounts)
      .set({
        deleted_at: new Date(),
        deleted_email: existingAccount.email,
        email: `deleted_${accountId}_${Date.now()}@deleted.com`,
      })
      .where(eq(accounts.id, accountId));

    return res.status(200).json({ message: "Account deleted successfully" });
  } catch (error: any) {
    console.error("deleteAccount error:", error);
    return res
      .status(500)
      .json({ message: error?.message ?? "Unexpected error" });
  }
}
