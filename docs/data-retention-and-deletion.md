# Wave — Data retention, deletion, and what we hold

**Last updated:** 2026-08-25
**Decisions taken:** 2026-08-25 (owner)
**Covers:** review 07-privacy H1, H2, M3, and the "know how to delete a user's data"
compliance item.

Wave operates in Ghana under the Data Protection Act mindset: collect the minimum,
say what you hold, hold it only as long as it is needed, and be able to delete it on
request. This page is the operational version of that.

---

## 1. What Wave actually holds

### Personal data in Neon (Postgres)

| Table | Fields | Why it exists |
|-------|--------|---------------|
| `profiles` | `full_name`, `phone`, `email?`, `student_id?`, `avatar_url?`, `push_token?` | `phone` is the login identity. `email` is optional forever. `push_token` is a device address |
| `orders` | Delivery/pickup addresses via checkpoints, item text, notes, `paystack_ref`, `goods_paystack_ref` | The service itself, plus payment reconciliation |
| `order_status_history` | Who changed what, when | Dispute resolution |
| `rider_verifications` | `id_number`, `id_image_path`, `selfie_path`, review outcome | Rider identity checks. **The most sensitive data Wave holds** |
| `shop_suggestions` | Which student suggested which shop | Demand ranking |
| `student_delivery_stats` | Completed delivery count | Loyalty discount |

**Never stored in plaintext:** delivery PINs (bcrypt hash + AES ciphertext), passwords
(Supabase, bcrypt).

### Personal data in Supabase Storage

| Bucket | Contents | Access |
|--------|----------|--------|
| `verifications` | Rider government ID photographs and selfies | **Private.** Signed URLs only, 1-hour expiry, admin view only |
| `product-images` | Shop product photos | Public. Not personal data |

> The API reads `verifications` with the service-role key, which **bypasses Storage
> RLS**. Bucket privacy is therefore the only control on those photographs — there is
> no second layer. See `docs/supabase-dashboard-config.md`.

### Third parties that receive personal data

| Service | Receives | Notes |
|---------|----------|-------|
| Supabase | Phone number (auth identity) | Auth + storage |
| Paystack | Whatever the payer enters at checkout | Wave never sees or stores card/MoMo details |
| mNotify | Phone number + message body | OTP and delivery PIN SMS |
| Resend | Email address, when the student gave one | Transactional only — see §5 |
| Sentry | Error context **only** | `sendDefaultPii: false` is set explicitly on all four SDK inits |

---

## 2. Retention periods

| Data | Kept for | Then |
|------|----------|------|
| Orders, order history, payment references | **12 months** after the order | Delete |
| Profiles of inactive users | 12 months after last activity | Delete (see §4) |
| **Rejected** rider verifications (row + images) | **Delete immediately** on rejection | — |
| **Approved** rider verifications | While the rider is active | Delete when they leave the platform |
| Application logs (Render) | Platform default | No action needed |
| Sentry events | Sentry project default (90 days) | No action needed |

**Why 12 months for orders:** long enough to answer a Paystack chargeback or a tax
question, short enough to be defensible as minimisation. Shorter would leave a
late-arriving payment dispute with no record behind it.

**Why rejected ID photos go immediately:** there is no reason to hold a government ID
photograph belonging to somebody you declined. This is the single highest-risk item
in the whole dataset and the one with the clearest deletion trigger.

> **Not yet automated.** No scheduled job enforces any of this today. Until one
> exists, these are calendar obligations, not guarantees — a quarterly reminder to
> run the purge is the minimum honest implementation.

---

## 3. Who can see what

Enforced in code, with tests:

| Viewer | Sees student's name | Sees phone | Sees Ashesi ID |
|--------|--------------------|-----------|----------------|
| The student themselves | yes | yes | yes |
| **Rider — unclaimed feed** | **no** | **no** | **no** |
| Rider — after accepting | yes | yes | no |
| **Shop owner** | yes | **no** | **no** |
| Admin | yes | yes | yes |

The two "no"s that carry weight:

- `feedOrder` strips the student entirely from the unclaimed rider feed. Without it,
  anyone could sign up as a rider, never deliver, and harvest the contact details of
  every student ordering on campus — the feed polls every 10 seconds.
- `redactStudentContactForShop` does the same one step later for shops (added
  2026-08-25). A verified shop owner previously received every customer's phone
  number and Ashesi ID, on both `GET /orders/:id` and the whole-history
  `GET /orders/shop` list. Nothing in the shop UI ever read them.

---

## 4. Deleting a user on request

Manual and admin-run. Pilot scale does not justify a self-serve delete button, and an
irreversible action is a bad place for a first version.

**Before you start:** confirm the request came from the account holder — they must be
able to receive an OTP on the account's phone number. A deletion request is a
plausible way to attack someone else's account.

1. **Check for open obligations.** An order that is in flight, unpaid, or inside a
   refund window is not deletable yet. Settle it first.
2. **Supabase Auth** — delete the auth user (this is what owns the phone identity).
3. **Storage** — if a rider: delete their objects from `verifications`.
4. **Neon**, in this order (foreign keys):
   - `rider_verifications` rows for the profile
   - `student_delivery_stats` row
   - `shop_suggestions` rows (or null the student reference if the suggestion is
     still driving onboarding decisions — the *shop* is not personal data)
   - `order_status_history` for their orders
   - `orders`, unless inside the 12-month accounting window — see below
   - `profiles` row
5. **Record** what you did and when.

**If orders must be retained** for the accounting window, do not delete the profile
outright. Anonymise it instead: clear `full_name`, `phone`, `email`, `student_id`,
`avatar_url`, `push_token`, and set `is_active: false`. The order rows keep their
financial shape without identifying anyone.

> `phone` is `@unique`. Anonymising by blanking it will collide on a second user —
> write a placeholder like `deleted-<uuid>` rather than an empty string.

---

## 5. Email policy

Email is **transactional only**. The one email Wave sends is "the shop you suggested
is now on Wave", to a student who explicitly asked about that shop.

- Email is optional at signup and stays optional.
- Addresses are never sold, shared, or used for marketing.
- No bulk sends, no newsletters, no "re-engagement" campaigns.
- If that ever changes, it needs opt-in consent collected separately — an address
  given to receive one specific notification is not consent for anything else.

---

## 6. Open items

- [ ] Hosted terms and privacy pages (the in-app links exist; the URLs do not)
- [ ] A scheduled purge job, if the pilot extends beyond a few months
- [ ] Decide the retention rule for `student_id` specifically — it is stored as a
      plain string and is acceptable for the pilot, but it is institutional PII
