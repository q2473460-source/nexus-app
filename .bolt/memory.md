# Project memory

## Product intent & audience

- Real-time chat application with room-based messaging and image uploads.
- Korean-language product (UI labels, role names in Korean: 방장/부방장).
- Room creators and designated moderators manage participants.
- Password reset feature added for unauthenticated users who forgot credentials.

## Brand personality & voice

- Production-quality, polished UI; explicitly "beautiful, not cookie cutter."
- Existing dark theme must be preserved across all new features.
- User communicates in Korean; code/UI labels in Korean where user-facing.

## Visual design & UX direction

- Dark UI aesthetic already established; new components must match it.
- Tailwind CSS + Lucide React icons only; no extra UI/icon packages.
- Path alias `@/` → `src/` for all project module imports; avoid deep relative paths.
- React hooks expected; JSX syntax.
- Login screen: "비밀번호 재설정" link shown below password input field (login mode only).
- Password reset modal: dark-themed, matches existing modal style (e.g., JoinPasswordModal).
- Modal fields: 이메일, 닉네임, 새 비밀번호 (6자 이상); "비밀번호 변경" submit button.
- Error messages use unified text to avoid leaking account existence info: "이메일 또는 닉네임이 일치하지 않습니다".
- Success state shows completion screen within modal.

## Decisions, constraints & rationale

- Supabase used for auth and database; `persistSession: true` for auto-login — logout only via explicit button (profile/settings tab).
- Room roles enforced at DB level via RLS/security rules, not just UI: vice-host cannot edit room info or kick hosts/other vice-hosts; DB rejects such attempts.
- `room_members` table holds role field linked to host/vice-host/member logic.
- `profiles` table stores nickname; `auth.users` stores email — must join/verify both server-side.
- Kicked users removed from member list in real-time and auto-exited immediately.
- Existing login/signup, real-time messaging, image-upload logic must never be broken when adding features.
- Room title edits reflect immediately in chat header via update callback.
- Password reset implemented via Supabase Edge Function (service-role key) — never expose service-role key to client.
- Edge Function verifies email↔nickname match against `profiles` joined with `auth.users`, then updates password via Admin API.
- Client calls Edge Function endpoint directly; no `SECURITY DEFINER` RPC needed for password change itself.
- New password minimum length: 6 characters (client + server validated).
- Unified error message on mismatch to prevent account enumeration.
- Build issue encountered: JSX fragment closing tags (`</>`) corrupted during edits — verify tag integrity after file modifications.

## Open questions & assumptions

- Exact `room_members` schema/migration details inferred; column names not fully confirmed.
- Room cover image storage (Supabase Storage bucket name) assumed but not explicitly named.
- Whether vice-host can see room settings menu inferred as fully hidden for non-hosts.
- Edge Function deployment URL/name not confirmed in this turn; assumed deployed to project's Supabase instance.
- Whether email verification or OTP flow should replace instant reset for stronger security — user explicitly requested instant change; security tradeoff noted but not enforced.