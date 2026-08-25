# Supabase Config

Holds Auth, Storage, and Realtime configuration only — **no database migrations**.
Wave's database is Neon.tech PostgreSQL 16, managed entirely through
`packages/db/prisma/schema.prisma`. See ADR-002 in `Wave_Technical_Document.md`.

Once a Supabase project exists for this pilot:
- Configure phone-based auth (students register by phone, not email).
- Create a private `verifications` storage bucket for rider ID/selfie uploads (no public URLs, signed URLs only, 1-hour expiry).
- Create a `product-images` bucket for shop product photos.
- Enable Realtime on the `orders` table only after RLS policies are applied (see GOTCHA-004 in `debug.md`).

**Full dashboard checklist (bucket privacy, SMS hook, verification steps):**
[`docs/supabase-dashboard-config.md`](../../docs/supabase-dashboard-config.md)
