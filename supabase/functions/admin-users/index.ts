import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Role = "admin" | "pembimbing" | "siswa";

interface Payload {
  action: "create" | "create_with_placement" | "update" | "reset_password" | "set_active";
  user_id?: string;
  role?: Role;
  email?: string;
  password?: string;
  full_name?: string;
  phone?: string | null;
  address?: string | null;
  nip?: string | null;
  department?: string | null;
  nis?: string | null;
  nisn?: string | null;
  class_name?: string | null;
  major?: string | null;
  is_active?: boolean;
  company_id?: string;
  period_id?: string;
  start_date?: string;
  end_date?: string;
}

const PASSWORD_HINT =
  "Minimal 8 karakter, serta memuat huruf besar, huruf kecil, angka, dan simbol.";

function passwordProblem(password: string): string | null {
  if (password.length < 8) return "Kata sandi minimal 8 karakter.";
  if (!/[a-z]/.test(password)) return "Kata sandi harus memuat minimal satu huruf kecil.";
  if (!/[A-Z]/.test(password)) return "Kata sandi harus memuat minimal satu huruf besar.";
  if (!/[0-9]/.test(password)) return "Kata sandi harus memuat minimal satu angka.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Kata sandi harus memuat minimal satu simbol, misalnya ! atau #.";
  return null;
}

function friendlyAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("weak") || lower.includes("easy to guess") || lower.includes("pwned")) {
    return `Kata sandi terlalu lemah. ${PASSWORD_HINT}`;
  }
  if (lower.includes("already") && lower.includes("registered")) {
    return "Email sudah digunakan oleh akun lain.";
  }
  if (lower.includes("invalid")) {
    return "Email atau kata sandi salah.";
  }
  return message;
}

const EXTRA_TABLES: Record<string, { table: string; columns: string[] }> = {
  pembimbing: { table: "pembimbing_profiles", columns: ["nip", "department"] },
  siswa: { table: "siswa_profiles", columns: ["nis", "nisn", "class_name", "major"] },
};

function pickExtra(role: Role, payload: Payload) {
  const config = EXTRA_TABLES[role];
  if (!config) return null;
  const row: Record<string, string | null> = { profile_id: payload.user_id as string };
  for (const col of config.columns) {
    const value = (payload as Record<string, unknown>)[col];
    row[col] = typeof value === "string" ? value : null;
  }
  return { ...config, row };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      return json({ error: "Sesi tidak ditemukan. Silakan masuk kembali." }, 401);
    }
    const token = authHeader.slice(7);

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data: callerData, error: callerError } = await callerClient.auth.getUser(token);
    if (callerError || !callerData.user) {
      return json({ error: "Sesi tidak valid. Silakan masuk kembali." }, 401);
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const { data: callerProfile } = await admin
      .from("profiles")
      .select("id, role, is_active")
      .eq("id", callerData.user.id)
      .maybeSingle();

    const isAdmin = callerProfile?.role === "admin";
    const isPembimbing = callerProfile?.role === "pembimbing";
    if (!callerProfile || (!isAdmin && !isPembimbing) || !callerProfile.is_active) {
      return json({ error: "Anda tidak memiliki akses untuk mengelola akun." }, 403);
    }

    const payload = (await req.json()) as Payload;

    if (payload.action === "create" || payload.action === "create_with_placement") {
      // create_with_placement is pembimbing-only
      if (payload.action === "create_with_placement" && !isPembimbing) {
        return json({ error: "Hanya Pembimbing yang dapat membuat akun dengan penempatan." }, 403);
      }

      // Pembimbing can only create siswa accounts
      const role: Role = isPembimbing ? "siswa" : (payload.role as Role);
      const email = payload.email?.trim().toLowerCase();
      const password = payload.password;
      const fullName = payload.full_name?.trim();

      if (!role || !["pembimbing", "siswa"].includes(role)) {
        return json({ error: "Peran akun tidak valid." }, 400);
      }
      if (isPembimbing && role !== "siswa") {
        return json({ error: "Pembimbing hanya dapat membuat akun siswa." }, 400);
      }
      if (!email || !password || !fullName) {
        return json({ error: "Nama, email, dan kata sandi wajib diisi." }, 400);
      }
      const createPasswordIssue = passwordProblem(password);
      if (createPasswordIssue) {
        return json({ error: createPasswordIssue }, 400);
      }

      const { data: existing } = await admin
        .from("profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      if (existing) {
        return json({ error: "Email sudah digunakan oleh akun lain." }, 409);
      }

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
        app_metadata: { role },
      });
      if (createError || !created.user) {
        return json(
          { error: createError ? friendlyAuthError(createError.message) : "Gagal membuat akun." },
          400,
        );
      }

      const userId = created.user.id;

      const profileInsert: Record<string, unknown> = {
        id: userId,
        role,
        full_name: fullName,
        email,
        phone: payload.phone ?? null,
        address: payload.address ?? null,
        is_active: true,
      };
      if (role === "siswa") {
        profileInsert.must_change_password = true;
      }

      const { error: profileError } = await admin.from("profiles").insert(profileInsert);
      if (profileError) {
        await admin.auth.admin.deleteUser(userId);
        return json({ error: profileError.message }, 400);
      }

      const extra = pickExtra(role, { ...payload, user_id: userId });
      if (extra) {
        const { error: extraError } = await admin.from(extra.table).insert(extra.row);
        if (extraError) {
          return json({ error: extraError.message }, 400);
        }
      }

      // Handle placement creation for create_with_placement
      if (payload.action === "create_with_placement") {
        let warning: string | undefined;
        try {
          const { error: placementError } = await admin.from("placements").insert({
            student_id: userId,
            supervisor_id: callerProfile.id,
            company_id: payload.company_id,
            period_id: payload.period_id,
            start_date: payload.start_date,
            end_date: payload.end_date,
            status: "aktif",
          });
          if (placementError) {
            warning = `Akun siswa berhasil dibuat, tetapi penempatan gagal: ${placementError.message}`;
          }
        } catch (placementErr) {
          warning = `Akun siswa berhasil dibuat, tetapi penempatan gagal: ${
            placementErr instanceof Error ? placementErr.message : "Terjadi kesalahan."
          }`;
        }
        return json({ user_id: userId, ...(warning ? { warning } : {}) });
      }

      return json({ user_id: userId });
    }

    // Actions below are admin-only
    if (!isAdmin) {
      return json({ error: "Hanya Admin yang dapat melakukan aksi ini." }, 403);
    }

    const userId = payload.user_id;
    if (!userId) {
      return json({ error: "Akun tidak ditemukan." }, 400);
    }

    const { data: target } = await admin
      .from("profiles")
      .select("id, role, email, is_active")
      .eq("id", userId)
      .maybeSingle();
    if (!target) {
      return json({ error: "Akun tidak ditemukan." }, 404);
    }

    if (payload.action === "update") {
      const email = payload.email?.trim().toLowerCase();
      const fullName = payload.full_name?.trim();
      if (!fullName || !email) {
        return json({ error: "Nama dan email wajib diisi." }, 400);
      }

      if (target.role === "admin" && target.id === callerData.user.id && email !== target.email) {
        return json({ error: "Email akun yang sedang digunakan tidak dapat diubah." }, 400);
      }

      if (email !== target.email) {
        const { data: clash } = await admin
          .from("profiles")
          .select("id")
          .eq("email", email)
          .neq("id", userId)
          .maybeSingle();
        if (clash) {
          return json({ error: "Email sudah digunakan oleh akun lain." }, 409);
        }
        const { error: emailError } = await admin.auth.admin.updateUserById(userId, {
          email,
          email_confirm: true,
        });
        if (emailError) return json({ error: friendlyAuthError(emailError.message) }, 400);
      }

      if (payload.password) {
        const updatePasswordIssue = passwordProblem(payload.password);
        if (updatePasswordIssue) {
          return json({ error: updatePasswordIssue }, 400);
        }
        const { error: passwordError } = await admin.auth.admin.updateUserById(userId, {
          password: payload.password,
        });
        if (passwordError) return json({ error: friendlyAuthError(passwordError.message) }, 400);
      }

      const { error: updateError } = await admin
        .from("profiles")
        .update({
          full_name: fullName,
          email,
          phone: payload.phone ?? null,
          address: payload.address ?? null,
        })
        .eq("id", userId);
      if (updateError) return json({ error: updateError.message }, 400);

      const extra = pickExtra(target.role as Role, { ...payload, user_id: userId });
      if (extra) {
        const { error: extraError } = await admin
          .from(extra.table)
          .upsert(extra.row, { onConflict: "profile_id" });
        if (extraError) return json({ error: extraError.message }, 400);
      }

      return json({ user_id: userId });
    }

    if (payload.action === "reset_password") {
      const resetPasswordIssue = payload.password ? passwordProblem(payload.password) : "Kata sandi wajib diisi.";
      if (resetPasswordIssue) {
        return json({ error: resetPasswordIssue }, 400);
      }
      const { error } = await admin.auth.admin.updateUserById(userId, {
        password: payload.password as string,
      });
      if (error) return json({ error: friendlyAuthError(error.message) }, 400);
      return json({ user_id: userId });
    }

    if (payload.action === "set_active") {
      if (target.role === "admin") {
        return json({ error: "Akun Admin tidak dapat dinonaktifkan." }, 400);
      }
      if (target.id === callerData.user.id) {
        return json({ error: "Anda tidak dapat menonaktifkan akun sendiri." }, 400);
      }

      const activate = payload.is_active === true;
      if (!activate) {
        const { count } = await admin
          .from("placements")
          .select("id", { count: "exact", head: true })
          .eq("supervisor_id", userId)
          .in("status", ["draft", "aktif"]);
        if (target.role === "pembimbing" && (count ?? 0) > 0) {
          return json(
            { error: "Pembimbing masih memiliki siswa aktif. Pindahkan siswanya terlebih dahulu." },
            400,
          );
        }
      }

      const { error: banError } = await admin.auth.admin.updateUserById(userId, {
        ban_duration: activate ? "none" : "876000h",
      });
      if (banError) return json({ error: banError.message }, 400);

      const { error: activeError } = await admin
        .from("profiles")
        .update({ is_active: activate })
        .eq("id", userId);
      if (activeError) return json({ error: activeError.message }, 400);

      return json({ user_id: userId, is_active: activate });
    }

    return json({ error: "Aksi tidak dikenal." }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Terjadi kesalahan." }, 500);
  }
});
