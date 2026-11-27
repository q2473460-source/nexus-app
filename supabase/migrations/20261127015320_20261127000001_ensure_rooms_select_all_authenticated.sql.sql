/*
# Ensure rooms SELECT is available to all authenticated users

## Context
The `rooms_select` policy was already `USING (true)` to `authenticated`,
but this migration drops and recreates it explicitly to guarantee that
every logged-in user can see ALL rooms regardless of membership status.
This is the foundation for the "search all rooms" feature.

## Changes
1. Drops the existing `rooms_select` policy (idempotent).
2. Recreates it as `USING (true)` for `TO authenticated` — all logged-in
   users can read every row in `rooms`.
3. No grants changes needed — `authenticated` already has SELECT.

## Security
- SELECT is intentionally public among authenticated users (open chat discovery).
- INSERT / UPDATE / DELETE policies remain owner-only (unchanged).
*/

DROP POLICY IF EXISTS "rooms_select" ON rooms;

CREATE POLICY "rooms_select"
ON rooms FOR SELECT
TO authenticated
USING (true);
