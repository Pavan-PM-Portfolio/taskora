// =============================================================================
// Taskora — admin-users Edge Function
//
// The only way to create accounts or change someone's role, status or password
// from the app. It runs with the service role; the database gives browsers no
// path to those columns at all (see the migration's grants and guards).
//
// Deploy:  ./scripts/deploy.sh functions
//
// POST { action, ... }   Authorization: Bearer <user access token>
//
//   list            {}                                           admin
//   create          { email, first_name?, last_name?, role,
//                     password?, require_change? }               admin
//   set_role        { user_id, role }                            admin
//   set_status      { user_id, status: 'active'|'deactivated' }  admin
//   reset_password  { user_id, password?, require_change? }      admin
//   update_user     { user_id, first_name?, last_name?, email? } admin
//   delete          { user_id }                                  admin
//
// Rules
//   * The caller must be an ACTIVE owner or admin.
//   * Owners can act on anyone. Admins can act only on members.
//   * Only owners can create or promote owners.
//   * Nobody changes their own role or status, or deletes themselves.
//   * The database itself refuses to leave the workspace without an owner.
// =============================================================================

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

type Role = "owner" | "admin" | "member";
type Profile = { id: string; email: string; role: Role; status: "active" | "deactivated" };

const ROLES: Role[] = ["owner", "admin", "member"];
const RANK: Record<Role, number> = { owner: 3, admin: 2, member: 1 };
const BAN_FOREVER = "876000h"; // ~100 years; Supabase has no permanent ban flag

const CORS = {
  "Access-Control-Allow-Origin": Deno.env.get("TASKORA_ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// 16 characters from an unambiguous alphabet, drawn with a CSPRNG and
// rejection sampling so every character is equally likely.
function generatePassword(length = 16): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const limit = 256 - (256 % alphabet.length);
  const out: string[] = [];
  while (out.length < length) {
    const bytes = crypto.getRandomValues(new Uint8Array(length * 2));
    for (const b of bytes) {
      if (b < limit && out.length < length) out.push(alphabet[b % alphabet.length]);
    }
  }
  return out.join("");
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function checkPassword(pw: string) {
  if (pw.length < 8) throw new HttpError(400, "Passwords need at least 8 characters.");
  if (pw.length > 72) throw new HttpError(400, "Passwords can be at most 72 characters.");
}

function friendly(message: string): string {
  if (/already been registered|already registered|duplicate key/i.test(message)) {
    return "An account with this email already exists.";
  }
  if (/at least one active owner/i.test(message)) {
    return "Taskora needs at least one active owner. Make someone else an owner first.";
  }
  return message;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    // ---- who is calling ------------------------------------------------------
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) throw new HttpError(401, "Sign in first.");
    const { data: who, error: whoErr } = await admin.auth.getUser(token);
    if (whoErr || !who?.user) throw new HttpError(401, "Your session has expired. Sign in again.");

    const caller = await getProfile(admin, who.user.id);
    if (!caller) throw new HttpError(403, "This login has no Taskora profile.");
    if (caller.status !== "active") throw new HttpError(403, "This account is deactivated.");
    if (caller.role !== "owner" && caller.role !== "admin") {
      throw new HttpError(403, "Only owners and admins can manage members.");
    }

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const action = str(body.action);

    // ---- helpers bound to this caller ---------------------------------------
    const canManage = (target: Profile) =>
      caller.role === "owner" || RANK[caller.role] > RANK[target.role];

    async function loadTarget(): Promise<Profile> {
      const id = str(body.user_id);
      if (!id) throw new HttpError(400, "user_id is required.");
      const target = await getProfile(admin, id);
      if (!target) throw new HttpError(404, "That member no longer exists.");
      if (target.id === caller.id) throw new HttpError(400, "You can't do that to your own account.");
      if (!canManage(target)) throw new HttpError(403, "Admins can only manage members. Ask an owner.");
      return target;
    }

    function parseRole(v: unknown): Role {
      const role = str(v).toLowerCase() as Role;
      if (!ROLES.includes(role)) throw new HttpError(400, "role must be owner, admin or member.");
      if (role === "owner" && caller.role !== "owner") {
        throw new HttpError(403, "Only owners can make someone an owner.");
      }
      return role;
    }

    // ---- list ----------------------------------------------------------------
    if (action === "list") {
      const { data: profiles, error } = await admin
        .from("profiles")
        .select("id, email, first_name, last_name, full_name, avatar_url, role, status, created_at")
        .order("created_at", { ascending: true });
      if (error) throw error;

      // last sign-in lives in auth, not in profiles
      const lastSeen = new Map<string, string | null>();
      for (let page = 1; page <= 20; page++) {
        const { data, error: listErr } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
        if (listErr) break;
        for (const u of data.users) lastSeen.set(u.id, u.last_sign_in_at ?? null);
        if (data.users.length < 1000) break;
      }
      return json({
        users: (profiles ?? []).map((p) => ({ ...p, last_sign_in_at: lastSeen.get(p.id) ?? null })),
      });
    }

    // ---- create --------------------------------------------------------------
    if (action === "create") {
      const email = str(body.email).toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, "Enter a valid email address.");
      const role = parseRole(body.role ?? "member");
      const firstName = str(body.first_name);
      const lastName = str(body.last_name);
      const chosen = str(body.password);
      if (chosen) checkPassword(chosen);
      const password = chosen || generatePassword();

      const { data: created, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: { taskora_role: role },
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
          full_name: [firstName, lastName].filter(Boolean).join(" "),
          must_change_pw: body.require_change !== false,
        },
      });
      if (error) throw new HttpError(400, friendly(error.message));

      // The auth trigger creates the profile. If a project was set up without
      // the migration, fail loudly rather than leave a login nobody can use.
      const profile = await getProfile(admin, created.user.id);
      if (!profile) {
        await admin.auth.admin.deleteUser(created.user.id);
        throw new HttpError(500, "The account was created but no profile appeared. Run the database migration, then try again.");
      }
      return json({ ok: true, user_id: created.user.id, email, role: profile.role, password, generated: !chosen });
    }

    // ---- set_role ------------------------------------------------------------
    if (action === "set_role") {
      const target = await loadTarget();
      const role = parseRole(body.role);
      if (role === target.role) return json({ ok: true, role });
      if (target.status !== "active") throw new HttpError(400, "Reactivate this member before changing their role.");

      const { error } = await admin.from("profiles").update({ role }).eq("id", target.id);
      if (error) throw new HttpError(400, friendly(error.message));
      await admin.auth.admin.updateUserById(target.id, { app_metadata: { taskora_role: role } });
      return json({ ok: true, user_id: target.id, role });
    }

    // ---- set_status ----------------------------------------------------------
    if (action === "set_status") {
      const target = await loadTarget();
      const status = str(body.status);
      if (status !== "active" && status !== "deactivated") {
        throw new HttpError(400, "status must be active or deactivated.");
      }
      if (status === target.status) return json({ ok: true, status });

      if (status === "deactivated") {
        // profile first: the database refuses if this is the last owner, and we
        // must not ban someone we then can't mark as deactivated
        const { error } = await admin.from("profiles").update({ status }).eq("id", target.id);
        if (error) throw new HttpError(400, friendly(error.message));
        const { error: banErr } = await admin.auth.admin.updateUserById(target.id, { ban_duration: BAN_FOREVER });
        if (banErr) {
          await admin.from("profiles").update({ status: "active" }).eq("id", target.id);
          throw new HttpError(400, banErr.message);
        }
      } else {
        const { error: unbanErr } = await admin.auth.admin.updateUserById(target.id, { ban_duration: "none" });
        if (unbanErr) throw new HttpError(400, unbanErr.message);
        const { error } = await admin.from("profiles").update({ status }).eq("id", target.id);
        if (error) throw new HttpError(400, friendly(error.message));
      }
      return json({ ok: true, user_id: target.id, status });
    }

    // ---- reset_password ------------------------------------------------------
    if (action === "reset_password") {
      const target = await loadTarget();
      const chosen = str(body.password);
      if (chosen) checkPassword(chosen);
      const password = chosen || generatePassword();

      const { data: current } = await admin.auth.admin.getUserById(target.id);
      const { error } = await admin.auth.admin.updateUserById(target.id, {
        password,
        user_metadata: { ...(current?.user?.user_metadata ?? {}), must_change_pw: body.require_change !== false },
      });
      if (error) throw new HttpError(400, error.message);
      return json({ ok: true, user_id: target.id, password, generated: !chosen });
    }

    // ---- update_user ---------------------------------------------------------
    if (action === "update_user") {
      const target = await loadTarget();
      const patch: Record<string, string | null> = {};
      if (body.first_name !== undefined) patch.first_name = str(body.first_name) || null;
      if (body.last_name !== undefined) patch.last_name = str(body.last_name) || null;

      if (body.email !== undefined) {
        const email = str(body.email).toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, "Enter a valid email address.");
        // the auth trigger copies the new email onto the profile
        const { error } = await admin.auth.admin.updateUserById(target.id, { email, email_confirm: true });
        if (error) throw new HttpError(400, friendly(error.message));
      }
      if (Object.keys(patch).length) {
        const { error } = await admin.from("profiles").update(patch).eq("id", target.id);
        if (error) throw new HttpError(400, error.message);
      }
      return json({ ok: true, user_id: target.id });
    }

    // ---- delete --------------------------------------------------------------
    if (action === "delete") {
      const target = await loadTarget();
      // Mark them deactivated first: their person record keeps its name on old
      // tickets, and the last-owner guard runs before anything is destroyed.
      if (target.status === "active") {
        const { error } = await admin.from("profiles").update({ status: "deactivated" }).eq("id", target.id);
        if (error) throw new HttpError(400, friendly(error.message));
      }
      await admin.storage.from("avatars").remove([`${target.id}.jpg`]).catch(() => null);
      const { error } = await admin.auth.admin.deleteUser(target.id);
      if (error) throw new HttpError(400, friendly(error.message));
      return json({ ok: true, user_id: target.id });
    }

    throw new HttpError(400, `Unknown action: ${action || "(none)"}`);
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message }, err.status);
    const message = err instanceof Error ? err.message : String(err);
    console.error("admin-users failed:", message);
    return json({ error: friendly(message) }, 500);
  }
});

async function getProfile(client: SupabaseClient, id: string): Promise<Profile | null> {
  const { data, error } = await client
    .from("profiles")
    .select("id, email, role, status")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}
