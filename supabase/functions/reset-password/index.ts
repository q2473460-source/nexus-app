import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { email, nickname, newPassword } = await req.json();

    if (!email || !nickname || !newPassword) {
      return new Response(
        JSON.stringify({ error: "모든 필드를 입력해 주세요." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (typeof newPassword !== "string" || newPassword.length < 6) {
      return new Response(
        JSON.stringify({ error: "비밀번호는 6자 이상이어야 합니다." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Look up the user by email via the auth admin API.
    const { data: userList, error: listError } = await adminClient.auth.admin.listUsers();
    if (listError) {
      return new Response(
        JSON.stringify({ error: "사용자 조회 중 오류가 발생했습니다." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const targetUser = userList.users.find(
      (u) => (u.email ?? "").toLowerCase() === normalizedEmail,
    );

    if (!targetUser) {
      // Generic message to avoid leaking which emails are registered.
      return new Response(
        JSON.stringify({ error: "이메일 또는 닉네임이 일치하지 않습니다." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Verify nickname matches the profile for this user.
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("nickname")
      .eq("id", targetUser.id)
      .maybeSingle();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "이메일 또는 닉네임이 일치하지 않습니다." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (profile.nickname !== String(nickname).trim()) {
      return new Response(
        JSON.stringify({ error: "이메일 또는 닉네임이 일치하지 않습니다." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Update the user's password via the auth admin API.
    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      targetUser.id,
      { password: newPassword },
    );

    if (updateError) {
      return new Response(
        JSON.stringify({ error: "비밀번호 변경 중 오류가 발생했습니다." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "요청 처리 중 오류가 발생했습니다." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
