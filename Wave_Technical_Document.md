# Wave — Campus Delivery Platform
## Full Technical Specification & Project Document

**Version:** 1.2.0  
**Date:** June 2026  
**Institution (Pilot):** Ashesi University, Berekuso, Ghana  
**Document Type:** Technical Specification, Architecture Guide & Project Plan

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Overview](#2-product-overview)
3. [User Roles & Permissions](#3-user-roles--permissions)
4. [Feature Specifications](#4-feature-specifications)
5. [Tech Stack](#5-tech-stack)
6. [System Architecture](#6-system-architecture)
7. [Database Schema](#7-database-schema)
8. [API Design](#8-api-design)
9. [Third-Party Integrations](#9-third-party-integrations)
10. [Security Design](#10-security-design)
11. [Design System](#11-design-system)
12. [Testing Strategy](#12-testing-strategy)
13. [Project Timeline & Milestones](#13-project-timeline--milestones)
14. [Cost Analysis](#14-cost-analysis)
15. [Deployment & DevOps](#15-deployment--devops)
16. [Future Roadmap](#16-future-roadmap)

---

## 1. Executive Summary

**Wave** is a mobile-first campus delivery platform designed to serve university communities in Ghana. The platform connects students with local vendors and a network of verified campus riders. Students can place "Buy For Me" orders — where a rider purchases an item on their behalf from participating shops — or request deliveries from checkpoints to their campus location.

Wave launches at **Ashesi University** as the pilot institution, with architecture built to scale horizontally to additional universities without code changes.

### Core Value Propositions

- **Students** get affordable, scheduled deliveries from off-campus shops without leaving campus.
- **Riders/Partners** earn income on a flexible schedule with transparent order management.
- **Shops** reach a captive campus audience and manage their online storefront easily.
- **The Platform** operates at near-zero infrastructure cost in its early phase using free tiers of best-in-class tools.

---

## 2. Product Overview

### 2.1 What is "Buy For Me"?

A student selects a shop, describes or selects an item, and a rider physically goes to that shop, purchases the item using the student's prepaid balance, and delivers it to a campus drop-off point. This is distinct from a shop directly dispatching orders.

### 2.2 Delivery Schedule

| Day       | Type              | Surcharge |
|-----------|-------------------|-----------|
| Sunday    | Standard Delivery | None      |
| Wednesday | Standard Delivery | None      |
| Other Days| Special Order     | +Premium  |

### 2.3 Discount Structure

Students who complete **6 cumulative deliveries** unlock a **20% loyalty discount** on subsequent delivery fees.

### 2.4 Checkpoints

Physical handoff locations (e.g., campus gate, library, hostel entrance) are pre-defined. Riders deliver to checkpoints; students collect from there using a PIN-based verification system.

---

## 3. User Roles & Permissions

```
┌─────────────────────────────────────────────────────────────┐
│                        WAVE PLATFORM                        │
├──────────────┬──────────────────┬───────────────────────────┤
│   STUDENT    │  RIDER/PARTNER   │          SHOP             │
├──────────────┼──────────────────┼───────────────────────────┤
│ Place orders │ View open orders │ List products             │
│ View shops   │ Accept orders    │ Toggle product status     │
│ View status  │ Mark delivered   │ Accept / cancel orders    │
│ Pay via PS   │ Verified profile │ View order history        │
│ PIN confirm  │ View earnings    │ Dashboard                 │
│ See history  │                  │                           │
└──────────────┴──────────────────┴───────────────────────────┘
                         │
                  ┌──────┴──────┐
                  │    ADMIN    │
                  │  (Internal) │
                  │ Verify riders│
                  │ Manage users │
                  │ View reports │
                  └─────────────┘
```

### 3.1 Role Matrix

| Permission                        | Student | Rider | Shop | Admin |
|-----------------------------------|---------|-------|------|-------|
| Create profile                    | ✅      | ✅    | ✅   | ✅    |
| Place "Buy For Me" order          | ✅      | ❌    | ❌   | ❌    |
| View available shops              | ✅      | ✅    | ❌   | ✅    |
| View available checkpoints        | ✅      | ✅    | ❌   | ✅    |
| Pay with Paystack                 | ✅      | ❌    | ❌   | ❌    |
| See delivery PIN                  | ✅      | ❌    | ❌   | ✅    |
| Accept/reject order               | ❌      | ✅    | ✅   | ✅    |
| Manage product listings           | ❌      | ❌    | ✅   | ✅    |
| Set product status                | ❌      | ❌    | ✅   | ✅    |
| Onboarding verification required  | ❌      | ✅    | ✅   | —     |
| Access admin dashboard            | ❌      | ❌    | ❌   | ✅    |

---

## 4. Feature Specifications

### 4.1 Student Features

#### 4.1.1 Profile
- Full name, student ID, university (Ashesi pilot), phone number, profile photo
- Delivery address preferences (linked to checkpoints)
- Delivery count tracker (for loyalty discount)
- Payment history

#### 4.1.2 Place a "Buy For Me" Order
```
Flow:
  1. Student opens app → "New Order"
  2. Select Shop from available shops list
  3. Describe item OR select from shop's listed products
  4. Choose delivery day (Sunday or Wednesday)
  5. Choose checkpoint for delivery
  6. Review order summary + estimated fee
  7. Apply 20% discount if eligible (≥ 6 deliveries)
  8. Pay via Paystack (card / mobile money)
  9. Order confirmed → PIN generated and sent to student
 10. Student receives notification when order is at checkpoint
 11. Student shows/enters PIN to rider at checkpoint
```

#### 4.1.3 Special Order Requests
- Available on non-standard days (Mon, Tue, Thu, Fri, Sat)
- Requires premium surcharge (configured by admin, e.g. +30%)
- Must be placed at least 24 hours in advance

#### 4.1.4 Order Tracking
- Real-time status updates: `Placed → Confirmed → Rider Assigned → En Route → At Checkpoint → Delivered`
- Push notifications at each stage
- In-app order history

#### 4.1.5 Available Shops
- Browse all verified shops by category (Food, Stationery, Clothing, etc.)
- See shop operating hours
- See product listings with status (Available / Out of Stock / Not Serving)

#### 4.1.6 Available Checkpoints
- Map view and list view of all campus checkpoints
- See which checkpoints are active for the current delivery window

---

### 4.2 Rider / Partner Features

#### 4.2.1 Onboarding & Verification
```
Flow:
  1. Rider signs up with name, phone, Ghana Card / student ID
  2. Uploads ID photo + selfie for verification
  3. Admin reviews and approves/rejects
  4. Approved rider receives access to full app
```

#### 4.2.2 Profile
- Personal details, ID info, university affiliation
- Earnings summary
- Completed deliveries count
- Active/Inactive availability toggle

#### 4.2.3 Order Feed
- View all open orders available for pickup (filtered by checkpoint proximity)
- Order card shows: pickup shop, item description, checkpoint, payout

#### 4.2.4 Accept an Order
```
Flow:
  1. Rider sees available order
  2. Taps "Accept" → order locked to this rider
  3. Rider goes to shop, purchases item (reimbursed from student's payment)
  4. Rider delivers to checkpoint
  5. Student scans/enters PIN
  6. Rider marks "Delivered" → PIN verified by system
  7. Payout credited to rider's wallet
```

---

### 4.3 Shop Features

#### 4.3.1 Shop Profile
- Shop name, logo, description, category
- Operating hours
- Location / physical address
- Contact number

#### 4.3.2 Product Listings
- Add products: name, description, price, photo, category
- Set product status:
  - **Active** — visible to students, can be ordered
  - **Out of Stock** — visible but not orderable
  - **Not Serving** — hidden from students entirely

#### 4.3.3 Order Management
- View incoming orders (with item details + student note)
- **Accept** order → notifies rider
- **Cancel** order → notifies student + triggers refund
- Order history with status timeline

---

### 4.4 Admin Features (Internal Dashboard)

- View and manage all users (students, riders, shops)
- Rider verification queue (approve / reject with reason)
- Configure checkpoints (add, activate, deactivate)
- Set special order surcharge percentage
- View platform-wide order analytics
- Manage discount thresholds
- Trigger manual refunds

---

## 5. Tech Stack

> **Philosophy:** Maximum capability at minimum cost. All selected services have generous free tiers sufficient for MVP and early growth at a single university (~500–2000 users).
>
> **Database Decision:** Supabase's free tier pauses the database after 7 days of inactivity — unacceptable for a live delivery app. The stack below solves this by splitting Supabase's responsibilities: **Neon.tech** handles the PostgreSQL database (free, never pauses, serverless), while **Supabase** is retained only for Auth, Storage, and Realtime — none of which pause. When Wave outgrows free tiers, a one-line connection string change migrates the database to **DigitalOcean Managed PostgreSQL ($15/mo)** with zero application code changes.

### 5.1 Frontend — Mobile App

| Layer        | Technology           | Reason                                                          |
|--------------|----------------------|-----------------------------------------------------------------|
| Framework    | **React Native (Expo)** | Single codebase for iOS + Android; huge community; free tooling |
| Navigation   | React Navigation v6  | Industry standard, free                                         |
| State Mgmt   | Zustand              | Lightweight, simple, no boilerplate                             |
| UI Components| NativeWind (Tailwind for RN) | Rapid UI development with utility classes               |
| Forms        | React Hook Form + Zod | Type-safe validation, minimal re-renders                       |
| Maps         | React Native Maps    | Google Maps SDK integration for checkpoint display              |
| Notifications| Expo Notifications   | Push notifications (APNs + FCM) without ejecting               |
| HTTP Client  | Axios + React Query  | Caching, retry logic, background refetch                        |

### 5.2 Admin Dashboard — Web

| Layer      | Technology      | Reason                                        |
|------------|-----------------|-----------------------------------------------|
| Framework  | **Next.js 14**  | Free hosting on Vercel, SSR + API routes      |
| Styling    | Tailwind CSS    | Fast, consistent UI                           |
| Charts     | Recharts        | Free, React-native charting                   |
| Auth       | Supabase Auth   | Unified with backend                          |

### 5.3 Backend

| Layer           | Technology            | Reason                                                          |
|-----------------|-----------------------|-----------------------------------------------------------------|
| Runtime         | **Node.js**           | JS everywhere, massive ecosystem                               |
| Framework       | **Fastify**           | Faster than Express, schema validation built-in                |
| Language        | TypeScript            | Type safety, fewer runtime bugs                                |
| ORM             | **Prisma**            | Type-safe DB queries, migrations, free                         |
| Database        | **Neon.tech (PostgreSQL 16)** | Free tier, **never pauses**, serverless, Prisma-compatible, branching for dev/prod |
| Auth            | **Supabase Auth** + JWT | Row-level security, social login support — free, does not pause |
| File Storage    | **Supabase Storage**  | Product photos, ID uploads (1 GB free) — does not pause        |
| Real-time       | **Supabase Realtime** | WebSocket-based order status updates — does not pause          |
| Queue / Jobs    | **Supabase Edge Functions** (cron via pg_cron) | Scheduled tasks, discount check       |
| Hosting         | **Railway** (free tier) | Node.js hosting, simple deploy, env management               |
| DB Upgrade Path | **DigitalOcean Managed PostgreSQL** ($15/mo) | One connection-string swap when Neon free tier is outgrown |

### 5.4 Payments

| Service     | Technology          | Reason                                              |
|-------------|---------------------|-----------------------------------------------------|
| Payment     | **Paystack**        | Ghana-native, supports card + MTN/Vodafone MoMo     |
| Webhooks    | Paystack Webhooks   | Real-time payment event confirmation                |

### 5.5 Notifications

| Channel    | Technology              | Cost          |
|------------|-------------------------|---------------|
| Push       | Expo Push Notifications | Free          |
| SMS backup | Paystack SMS / Termii   | Pay-per-use   |

### 5.6 DevOps & Tooling

| Tool          | Purpose                              | Cost                  |
|---------------|--------------------------------------|-----------------------|
| GitHub        | Version control                      | Free                  |
| GitHub Actions| CI/CD pipelines                      | Free                  |
| Vercel        | Admin dashboard hosting              | Free                  |
| Railway       | Backend API hosting                  | Free (starter)        |
| Neon.tech     | PostgreSQL 16 database (primary DB)  | Free (0.5 GB, no pause)|
| Supabase      | Auth + Storage + Realtime only       | Free                  |
| Expo EAS      | App builds & OTA updates             | Free (limited)        |
| Sentry        | Error monitoring                     | Free (5k errors/mo)   |
| Postman       | API documentation & testing          | Free                  |
| DigitalOcean  | DB upgrade path (when ready)         | $15/mo (not yet)      |

---

## 6. System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                │
│                                                                     │
│   ┌──────────────────┐    ┌──────────────────┐                     │
│   │  Mobile App      │    │  Admin Dashboard  │                     │
│   │  (React Native   │    │  (Next.js)        │                     │
│   │   + Expo)        │    │  Vercel hosted    │                     │
│   └────────┬─────────┘    └────────┬──────────┘                    │
└────────────┼──────────────────────┼──────────────────────────────┘
             │   HTTPS / WS          │   HTTPS
┌────────────┼──────────────────────┼──────────────────────────────┐
│            ▼          API LAYER   ▼                               │
│   ┌──────────────────────────────────────────────────────────┐   │
│   │           Fastify REST API (Node.js / TypeScript)        │   │
│   │                   Hosted on Railway                      │   │
│   │                                                          │   │
│   │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │   │
│   │  │  Auth    │  │  Orders  │  │  Shops   │  │ Riders │  │   │
│   │  │  Module  │  │  Module  │  │  Module  │  │ Module │  │   │
│   │  └──────────┘  └──────────┘  └──────────┘  └────────┘  │   │
│   │                                                          │   │
│   │  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │   │
│   │  │ Payments │  │  Notifs  │  │  Discount Engine      │  │   │
│   │  │ Module   │  │  Module  │  │  (delivery counter)   │  │   │
│   │  └──────────┘  └──────────┘  └──────────────────────┘  │   │
│   └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
             │                         │
┌────────────┼─────────────────────────┼─────────────────────────┐
│            ▼      DATA LAYER         ▼                          │
│                                                                 │
│   ┌──────────────────────┐   ┌──────────────────────────────┐  │
│   │   Neon.tech          │   │   Supabase (non-DB services) │  │
│   │   PostgreSQL 16      │   │                              │  │
│   │   (Primary Database) │   │   Auth (JWT, sessions)       │  │
│   │   Free — no pausing  │   │   Storage (photos, IDs)      │  │
│   │   Prisma ORM target  │   │   Realtime (WebSockets)      │  │
│   │                      │   │   Edge Functions (cron jobs) │  │
│   │   ── Upgrade Path ── │   │                              │  │
│   │   DigitalOcean PG    │   └──────────────────────────────┘  │
│   │   $15/mo (1 conn str)│                                      │
│   └──────────────────────┘   ┌──────────────────────────────┐  │
│                               │    External Services         │  │
│                               │  ┌────────────────────────┐ │  │
│                               │  │  Paystack API          │ │  │
│                               │  │  (Payments / MoMo)     │ │  │
│                               │  └────────────────────────┘ │  │
│                               │  ┌────────────────────────┐ │  │
│                               │  │  Expo Push Service     │ │  │
│                               │  │  (Notifications)       │ │  │
│                               │  └────────────────────────┘ │  │
│                               └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.1 Request Flow — Student Places Order

```
Student App
    │
    ├── 1. POST /orders  (with item, shop, checkpoint, day)
    │
    ▼
Fastify API
    ├── 2. Validate JWT token (Supabase Auth)
    ├── 3. Validate delivery day (Sun/Wed or special?)
    ├── 4. Check student discount eligibility
    ├── 5. Calculate total (item estimate + delivery fee ± discount ± surcharge)
    ├── 6. Create Paystack transaction → return payment URL
    │
    ▼
Student App
    ├── 7. Open Paystack checkout (WebView)
    │
    ▼
Paystack
    ├── 8. Payment processed → webhook to API
    │
    ▼
Fastify API
    ├── 9. Verify webhook signature
    ├── 10. Create order record in DB (status: CONFIRMED)
    ├── 11. Generate 6-digit PIN → stored hashed in DB
    ├── 12. Send PIN to student via push notification
    ├── 13. Notify available riders (Supabase Realtime broadcast)
    │
    ▼
Rider App
    └── 14. Rider sees new order in feed → accepts
```

---

## 7. Database Schema

> All tables include `created_at`, `updated_at` timestamps. UUIDs used as primary keys.

### 7.1 Core Tables

#### `universities`
```sql
CREATE TABLE universities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,  -- 'ashesi', 'legon', etc.
  city        TEXT NOT NULL,
  country     TEXT NOT NULL DEFAULT 'Ghana',
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
```

#### `profiles`
```sql
CREATE TABLE profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id),
  university_id   UUID REFERENCES universities(id),
  full_name       TEXT NOT NULL,
  phone           TEXT UNIQUE NOT NULL,
  student_id      TEXT,
  role            TEXT NOT NULL CHECK (role IN ('student', 'rider', 'shop_owner', 'admin')),
  avatar_url      TEXT,
  is_active       BOOLEAN DEFAULT TRUE,
  is_verified     BOOLEAN DEFAULT FALSE,  -- for riders/shops
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

#### `checkpoints`
```sql
CREATE TABLE checkpoints (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id  UUID REFERENCES universities(id),
  name           TEXT NOT NULL,
  description    TEXT,
  latitude       DECIMAL(9,6),
  longitude      DECIMAL(9,6),
  is_active      BOOLEAN DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);
```

#### `shops`
```sql
CREATE TABLE shops (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id       UUID REFERENCES profiles(id),
  university_id  UUID REFERENCES universities(id),
  name           TEXT NOT NULL,
  description    TEXT,
  category       TEXT NOT NULL,  -- 'food', 'stationery', 'clothing', 'other'
  logo_url       TEXT,
  phone          TEXT,
  location_text  TEXT,
  opening_time   TIME,
  closing_time   TIME,
  is_active      BOOLEAN DEFAULT TRUE,
  is_verified    BOOLEAN DEFAULT FALSE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);
```

#### `products`
```sql
CREATE TABLE products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     UUID REFERENCES shops(id),
  name        TEXT NOT NULL,
  description TEXT,
  price       DECIMAL(10,2) NOT NULL,
  image_url   TEXT,
  category    TEXT,
  status      TEXT NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'out_of_stock', 'not_serving')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
```

#### `orders`
```sql
CREATE TABLE orders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        UUID REFERENCES profiles(id),
  rider_id          UUID REFERENCES profiles(id),
  shop_id           UUID REFERENCES shops(id),
  checkpoint_id     UUID REFERENCES checkpoints(id),
  university_id     UUID REFERENCES universities(id),

  -- Order details
  item_description  TEXT NOT NULL,
  product_id        UUID REFERENCES products(id),  -- NULL if free-text "buy for me"
  item_price        DECIMAL(10,2),
  delivery_fee      DECIMAL(10,2) NOT NULL,
  discount_applied  DECIMAL(5,2) DEFAULT 0,        -- percentage
  surcharge_applied DECIMAL(5,2) DEFAULT 0,        -- percentage
  total_amount      DECIMAL(10,2) NOT NULL,

  -- Scheduling
  delivery_day      TEXT NOT NULL CHECK (delivery_day IN ('sunday', 'wednesday', 'special')),
  scheduled_date    DATE NOT NULL,
  is_special_order  BOOLEAN DEFAULT FALSE,

  -- Status
  status  TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN (
            'pending', 'payment_pending', 'confirmed',
            'rider_assigned', 'en_route', 'at_checkpoint',
            'delivered', 'cancelled', 'refunded'
          )),

  -- Payment
  paystack_ref      TEXT UNIQUE,
  paid_at           TIMESTAMPTZ,

  -- Delivery PIN (stored as bcrypt hash)
  delivery_pin_hash TEXT,
  delivered_at      TIMESTAMPTZ,

  notes             TEXT,
  cancellation_reason TEXT,

  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
```

#### `order_status_history`
```sql
CREATE TABLE order_status_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID REFERENCES orders(id),
  status      TEXT NOT NULL,
  changed_by  UUID REFERENCES profiles(id),
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

#### `rider_verifications`
```sql
CREATE TABLE rider_verifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id        UUID REFERENCES profiles(id),
  id_type         TEXT NOT NULL,  -- 'ghana_card', 'student_id', 'passport'
  id_number       TEXT NOT NULL,
  id_image_url    TEXT NOT NULL,
  selfie_url      TEXT NOT NULL,
  status          TEXT DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by     UUID REFERENCES profiles(id),
  rejection_reason TEXT,
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

#### `student_delivery_stats`
```sql
CREATE TABLE student_delivery_stats (
  student_id        UUID PRIMARY KEY REFERENCES profiles(id),
  total_deliveries  INT DEFAULT 0,
  discount_eligible BOOLEAN DEFAULT FALSE,
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
```

#### `rider_earnings`
```sql
CREATE TABLE rider_earnings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id    UUID REFERENCES profiles(id),
  order_id    UUID REFERENCES orders(id),
  amount      DECIMAL(10,2) NOT NULL,
  status      TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  paid_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

#### `platform_config`
```sql
CREATE TABLE platform_config (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Seed values:
INSERT INTO platform_config VALUES
  ('delivery_fee_base',           '5.00',  'Base delivery fee in GHS'),
  ('special_order_surcharge_pct', '30',    'Special order surcharge %'),
  ('loyalty_discount_pct',        '20',    'Discount % after 6 deliveries'),
  ('loyalty_threshold',           '6',     'Deliveries needed for discount');
```

---

## 8. API Design

Base URL: `https://api.wave.app/v1`

All requests require `Authorization: Bearer <jwt>` except auth endpoints.

### 8.1 Auth

| Method | Path                   | Description                        |
|--------|------------------------|------------------------------------|
| POST   | `/auth/register`       | Create account (all roles)         |
| POST   | `/auth/login`          | Login → return JWT                 |
| POST   | `/auth/logout`         | Invalidate session                 |
| POST   | `/auth/refresh`        | Refresh JWT token                  |
| PUT    | `/auth/change-password`| Update password                    |

### 8.2 Profiles

| Method | Path              | Description                        |
|--------|-------------------|------------------------------------|
| GET    | `/profile/me`     | Get own profile                    |
| PUT    | `/profile/me`     | Update own profile                 |
| POST   | `/profile/avatar` | Upload profile photo               |

### 8.3 Universities & Checkpoints

| Method | Path                            | Description                     |
|--------|---------------------------------|---------------------------------|
| GET    | `/universities`                 | List active universities        |
| GET    | `/universities/:id/checkpoints` | List checkpoints for a campus   |
| POST   | `/checkpoints` (admin)          | Add checkpoint                  |
| PUT    | `/checkpoints/:id` (admin)      | Edit checkpoint                 |

### 8.4 Shops

| Method | Path                      | Description                         |
|--------|---------------------------|-------------------------------------|
| GET    | `/shops`                  | List verified shops (student/rider) |
| GET    | `/shops/:id`              | Get shop details + products         |
| POST   | `/shops` (shop_owner)     | Create shop                         |
| PUT    | `/shops/:id` (shop_owner) | Update shop details                 |
| GET    | `/shops/my` (shop_owner)  | Get own shop                        |

### 8.5 Products

| Method | Path                           | Description                     |
|--------|--------------------------------|---------------------------------|
| GET    | `/shops/:id/products`          | List shop products              |
| POST   | `/shops/:id/products`          | Add product (shop_owner)        |
| PUT    | `/products/:id`                | Update product (shop_owner)     |
| PATCH  | `/products/:id/status`         | Toggle status (shop_owner)      |
| DELETE | `/products/:id`                | Remove product (shop_owner)     |

### 8.6 Orders

| Method | Path                            | Description                          |
|--------|---------------------------------|--------------------------------------|
| POST   | `/orders`                       | Place new order (student)            |
| GET    | `/orders/my`                    | Student's order history              |
| GET    | `/orders/available`             | Open orders feed (rider)             |
| GET    | `/orders/:id`                   | Order detail                         |
| PATCH  | `/orders/:id/accept`            | Rider accepts order                  |
| PATCH  | `/orders/:id/status`            | Update order status                  |
| PATCH  | `/orders/:id/deliver`           | Rider marks delivered (PIN required) |
| PATCH  | `/orders/:id/cancel`            | Cancel order (shop/student/admin)    |
| GET    | `/orders/shop`                  | Incoming orders (shop_owner)         |
| PATCH  | `/orders/:id/shop-accept`       | Shop confirms order                  |
| PATCH  | `/orders/:id/shop-cancel`       | Shop cancels order                   |

### 8.7 Payments

| Method | Path                        | Description                        |
|--------|-----------------------------|------------------------------------|
| POST   | `/payments/initiate`        | Init Paystack payment → return URL |
| POST   | `/payments/webhook`         | Paystack webhook (public)          |
| GET    | `/payments/verify/:ref`     | Verify payment status              |

### 8.8 Riders

| Method | Path                              | Description                  |
|--------|-----------------------------------|------------------------------|
| POST   | `/riders/verification`            | Submit ID + selfie           |
| GET    | `/riders/verification/status`     | Check own verification       |
| GET    | `/riders/earnings`                | View earnings history        |
| PATCH  | `/riders/availability`            | Toggle active status         |
| GET    | `/admin/riders/pending` (admin)   | List pending verifications   |
| PATCH  | `/admin/riders/:id/verify` (admin)| Approve or reject rider      |

### 8.9 Admin

| Method | Path                        | Description                     |
|--------|-----------------------------|---------------------------------|
| GET    | `/admin/stats`              | Platform overview dashboard     |
| GET    | `/admin/users`              | List all users                  |
| PUT    | `/admin/config`             | Update platform configuration   |
| POST   | `/admin/refund/:orderId`    | Trigger manual refund           |

---

## 9. Third-Party Integrations

### 9.1 Paystack Integration

```typescript
// Payment initiation
const initiatePayment = async (order: Order, student: Profile) => {
  const response = await axios.post(
    'https://api.paystack.co/transaction/initialize',
    {
      email: student.email,
      amount: Math.round(order.total_amount * 100), // Paystack uses kobo/pesewas
      reference: `WAVE-${order.id}-${Date.now()}`,
      callback_url: `${APP_URL}/payment/callback`,
      metadata: {
        order_id: order.id,
        student_id: student.id,
        custom_fields: [
          { display_name: 'Order ID', value: order.id },
          { display_name: 'Delivery Day', value: order.delivery_day }
        ]
      },
      channels: ['card', 'mobile_money'] // MTN MoMo, Vodafone Cash
    },
    { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } }
  );
  return response.data.data.authorization_url;
};

// Webhook verification
const verifyWebhookSignature = (body: string, signature: string): boolean => {
  const hash = crypto
    .createHmac('sha512', PAYSTACK_SECRET_KEY)
    .update(body)
    .digest('hex');
  return hash === signature;
};
```

### 9.2 Supabase Realtime — Order Updates

```typescript
// Rider subscribes to new orders feed
const subscribeToOrders = (universityId: string, onNewOrder: (order: Order) => void) => {
  return supabase
    .channel('orders-feed')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'orders',
        filter: `university_id=eq.${universityId}`
      },
      (payload) => onNewOrder(payload.new as Order)
    )
    .subscribe();
};

// Student subscribes to their order status
const subscribeToOrderStatus = (orderId: string, onUpdate: (status: string) => void) => {
  return supabase
    .channel(`order-${orderId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `id=eq.${orderId}`
      },
      (payload) => onUpdate((payload.new as Order).status)
    )
    .subscribe();
};
```

### 9.3 PIN Generation & Verification

```typescript
import bcrypt from 'bcrypt';
import crypto from 'crypto';

// Generate PIN at order confirmation
const generateDeliveryPin = async (): Promise<{ pin: string; hash: string }> => {
  const pin = crypto.randomInt(100000, 999999).toString();
  const hash = await bcrypt.hash(pin, 10);
  return { pin, hash };
};

// Verify PIN at delivery
const verifyDeliveryPin = async (
  inputPin: string,
  storedHash: string
): Promise<boolean> => {
  return bcrypt.compare(inputPin, storedHash);
};
```

---

## 10. Security Design

### 10.1 Authentication & Authorization

- All API routes protected with Supabase JWT middleware
- Role-based route guards (`requireRole('admin')`, `requireRole('rider')`, etc.)
- Supabase **Row Level Security (RLS)** policies enforce data access at DB level
- Students cannot read other students' order PINs
- Riders can only update orders assigned to them

### 10.2 RLS Policy Examples

```sql
-- Students can only see their own orders
CREATE POLICY "students_own_orders" ON orders
  FOR SELECT USING (auth.uid() = student_id);

-- Riders can only see confirmed/unassigned orders + their own
CREATE POLICY "riders_see_available_orders" ON orders
  FOR SELECT USING (
    status = 'confirmed' AND rider_id IS NULL
    OR rider_id = auth.uid()
  );

-- PIN hash never exposed to client
CREATE POLICY "no_pin_exposure" ON orders
  FOR SELECT USING (TRUE)
  WITH CHECK (delivery_pin_hash IS NULL);  -- strip PIN from all reads
```

### 10.3 Payment Security

- Paystack webhook signature verified on every request (HMAC-SHA512)
- Payment reference stored and checked for replay attacks
- All payment amounts validated server-side (never trust client-sent price)

### 10.4 Rider Verification Security

- ID photos and selfies stored in Supabase Storage with private bucket (no public URLs)
- Admin-only access via signed URLs (1-hour expiry)
- Verification status changes logged with admin ID

### 10.5 Input Validation

- All inputs validated with **Zod schemas** in both API (Fastify) and client (React Hook Form)
- SQL injection impossible via Prisma parameterized queries
- File uploads: type checked (image/jpeg, image/png only), max 5 MB, stored with UUID filename

---

## 11. Design System

> Full design decisions are being finalized. See `design.md`.

### Non-negotiable rules

1. No gradients.
2. No colored shadows.
3. No emoji.

### Brand

- **Primary color:** `#2EA64E` (Wave Green)
- **Components:** shadcn/ui, rethemed to Wave
- **Typeface:** Inter
- **Icons:** Lucide

All other design decisions — spacing, components, screen patterns, color usage — will be documented in `design.md` once the prototype has been reviewed and finalized.

---

## 12. Testing Strategy

### 11.1 Testing Pyramid

```
              ┌─────────────────────┐
              │    E2E Tests        │  ← Detox (mobile) / Playwright (admin)
              │  (Critical flows)   │    ~20 scenarios
              ├─────────────────────┤
              │  Integration Tests  │  ← Supertest + test DB
              │  (API + DB)         │    ~60 scenarios
              ├─────────────────────┤
              │    Unit Tests       │  ← Jest / Vitest
              │  (Business logic)   │    ~150 scenarios
              └─────────────────────┘
```

### 11.2 Unit Tests

**Test file:** `src/services/__tests__/discount.test.ts`

```typescript
describe('Discount Engine', () => {
  test('should not apply discount below threshold', () => {
    expect(calculateDiscount({ totalDeliveries: 5, baseAmount: 10 })).toBe(0);
  });

  test('should apply 20% at 6 deliveries', () => {
    expect(calculateDiscount({ totalDeliveries: 6, baseAmount: 10 })).toBe(2);
  });

  test('should apply 20% above threshold', () => {
    expect(calculateDiscount({ totalDeliveries: 10, baseAmount: 50 })).toBe(10);
  });
});

describe('Delivery Day Validation', () => {
  test('Sunday is standard delivery day', () => {
    expect(isStandardDeliveryDay(new Date('2026-06-28'))).toBe(true); // Sunday
  });

  test('Wednesday is standard delivery day', () => {
    expect(isStandardDeliveryDay(new Date('2026-07-01'))).toBe(true); // Wednesday
  });

  test('Monday requires special order flag', () => {
    expect(isStandardDeliveryDay(new Date('2026-06-29'))).toBe(false); // Monday
  });
});

describe('PIN Verification', () => {
  test('correct PIN returns true', async () => {
    const { pin, hash } = await generateDeliveryPin();
    expect(await verifyDeliveryPin(pin, hash)).toBe(true);
  });

  test('wrong PIN returns false', async () => {
    const { hash } = await generateDeliveryPin();
    expect(await verifyDeliveryPin('000000', hash)).toBe(false);
  });
});

describe('Order Total Calculation', () => {
  test('standard order with no discount', () => {
    const total = calculateOrderTotal({
      itemPrice: 20,
      deliveryFee: 5,
      discountPct: 0,
      surchargePct: 0
    });
    expect(total).toBe(25);
  });

  test('special order with surcharge', () => {
    const total = calculateOrderTotal({
      itemPrice: 20,
      deliveryFee: 5,
      discountPct: 0,
      surchargePct: 30
    });
    expect(total).toBe(26.5); // 5 * 1.30 + 20
  });

  test('eligible student discount on delivery fee', () => {
    const total = calculateOrderTotal({
      itemPrice: 20,
      deliveryFee: 5,
      discountPct: 20,
      surchargePct: 0
    });
    expect(total).toBe(24); // 5 * 0.80 + 20
  });
});
```

### 11.3 Integration Tests

**Test file:** `src/routes/__tests__/orders.test.ts`

```typescript
describe('POST /orders', () => {
  test('creates order with valid payload and returns payment URL', async () => {
    const res = await request(app)
      .post('/v1/orders')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        shop_id: testShop.id,
        checkpoint_id: testCheckpoint.id,
        item_description: 'Jollof Rice',
        delivery_day: 'sunday',
        scheduled_date: '2026-06-28'
      });

    expect(res.status).toBe(201);
    expect(res.body.payment_url).toBeDefined();
    expect(res.body.order.status).toBe('payment_pending');
  });

  test('rejects order on non-standard day without special flag', async () => {
    const res = await request(app)
      .post('/v1/orders')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        shop_id: testShop.id,
        checkpoint_id: testCheckpoint.id,
        item_description: 'Test',
        delivery_day: 'monday',
        scheduled_date: '2026-06-29',
        is_special_order: false
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('special order');
  });

  test('applies 20% discount for eligible student', async () => {
    // Set up student with 6 deliveries
    await db.studentDeliveryStats.update({
      where: { student_id: testStudent.id },
      data: { total_deliveries: 6, discount_eligible: true }
    });

    const res = await request(app)
      .post('/v1/orders')
      .set('Authorization', `Bearer ${studentToken}`)
      .send(validOrderPayload);

    expect(res.body.order.discount_applied).toBe(20);
  });
});

describe('PATCH /orders/:id/deliver', () => {
  test('accepts correct PIN and marks order delivered', async () => {
    const res = await request(app)
      .patch(`/v1/orders/${testOrder.id}/deliver`)
      .set('Authorization', `Bearer ${riderToken}`)
      .send({ pin: correctPin });

    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe('delivered');
  });

  test('rejects wrong PIN', async () => {
    const res = await request(app)
      .patch(`/v1/orders/${testOrder.id}/deliver`)
      .set('Authorization', `Bearer ${riderToken}`)
      .send({ pin: '000000' });

    expect(res.status).toBe(403);
  });
});

describe('Paystack Webhook', () => {
  test('valid webhook confirms order and sends PIN notification', async () => {
    const payload = {
      event: 'charge.success',
      data: { reference: testOrder.paystack_ref, status: 'success' }
    };
    const signature = generatePaystackSignature(JSON.stringify(payload));

    const res = await request(app)
      .post('/v1/payments/webhook')
      .set('x-paystack-signature', signature)
      .send(payload);

    expect(res.status).toBe(200);
    const order = await db.orders.findUnique({ where: { id: testOrder.id } });
    expect(order.status).toBe('confirmed');
    expect(order.delivery_pin_hash).toBeDefined();
  });

  test('rejects webhook with invalid signature', async () => {
    const res = await request(app)
      .post('/v1/payments/webhook')
      .set('x-paystack-signature', 'invalid')
      .send({ event: 'charge.success', data: {} });

    expect(res.status).toBe(401);
  });
});
```

### 11.4 E2E Test Scenarios (Detox)

| #  | Scenario                                     | Roles Involved       |
|----|----------------------------------------------|----------------------|
| 1  | Student registers, creates profile           | Student              |
| 2  | Student browses shops and product listings   | Student              |
| 3  | Student places Buy For Me order + pays       | Student              |
| 4  | Student receives PIN after payment confirmed | Student              |
| 5  | Rider registers and submits verification docs| Rider                |
| 6  | Admin approves rider                         | Admin                |
| 7  | Rider sees new order in feed                 | Rider                |
| 8  | Rider accepts order                          | Rider                |
| 9  | Rider delivers → student enters PIN          | Rider + Student      |
| 10 | Order marked delivered, earnings credited    | Rider                |
| 11 | Shop adds product + sets out of stock        | Shop Owner           |
| 12 | Shop cancels order → student refunded        | Shop Owner + Student |
| 13 | Student reaches 6 deliveries → discount shown| Student             |
| 14 | Student tries special order on Monday        | Student              |
| 15 | Admin views platform stats dashboard         | Admin                |

### 11.5 Testing Tools & Setup

```bash
# Install testing tools
npm install --save-dev jest @types/jest ts-jest supertest
npm install --save-dev @faker-js/faker  # Seed test data

# Test commands
npm run test:unit       # Jest unit tests
npm run test:integration # Supertest API tests
npm run test:e2e        # Detox E2E (requires simulator/device)
npm run test:coverage   # Coverage report (target: >80%)
```

### 11.6 Coverage Targets

| Layer          | Target   |
|----------------|----------|
| Unit Tests     | ≥ 90%    |
| Integration    | ≥ 75%    |
| E2E            | All critical paths |
| Overall        | ≥ 80%    |

---

## 13. Project Timeline & Milestones

### Phase Overview

```
PHASE 1: Foundation (Weeks 1–3)
PHASE 2: Core Features (Weeks 4–8)
PHASE 3: Integrations (Weeks 9–11)
PHASE 4: Testing & Polish (Weeks 12–14)
PHASE 5: Pilot Launch (Week 15)
```

---

### Phase 1 — Foundation (Weeks 1–3)

**Goal:** Project scaffold, auth, profiles, admin base

| Week | Task                                                   | Owner     |
|------|--------------------------------------------------------|-----------|
| 1    | Set up monorepo (apps/mobile, apps/admin, packages/api)| Dev       |
| 1    | Configure Supabase project, set env variables          | Dev       |
| 1    | Configure GitHub Actions CI pipeline                   | Dev       |
| 1    | Design Figma mockups (student app)                     | Designer  |
| 2    | Implement auth (register/login) — all roles            | Dev       |
| 2    | Build profile creation screens (student + rider)       | Dev       |
| 2    | Build profile API endpoints                            | Dev       |
| 2    | Set up Prisma + initial DB migrations                  | Dev       |
| 3    | Admin dashboard scaffold (Next.js)                     | Dev       |
| 3    | Admin: user list view, rider verification queue        | Dev       |
| 3    | Rider verification submission screen + API             | Dev       |
| 3    | Unit tests for auth + profiles                         | Dev       |

**Deliverable:** Users can register, log in, create profiles. Riders can submit verification. Admin can approve.

---

### Phase 2 — Core Features (Weeks 4–8)

**Goal:** Shops, products, orders (without payment)

| Week | Task                                                              | Owner |
|------|-------------------------------------------------------------------|-------|
| 4    | Shop creation + management screens (shop owner)                   | Dev   |
| 4    | Shop API endpoints (create, update, list)                         | Dev   |
| 5    | Product listing screens (shop owner: add/edit/status toggle)      | Dev   |
| 5    | Product API endpoints                                             | Dev   |
| 5    | Student: browse shops + products                                  | Dev   |
| 6    | Checkpoint management (admin) + viewing (student/rider)           | Dev   |
| 6    | Order placement screen (student: shop → item → day → checkpoint)  | Dev   |
| 7    | Order API (POST, GET, status updates)                             | Dev   |
| 7    | Order feed screen (rider)                                         | Dev   |
| 7    | Rider: accept order + status update flow                          | Dev   |
| 8    | Shop: order management screen (accept/cancel)                     | Dev   |
| 8    | Order status history + timeline view                              | Dev   |
| 8    | Discount engine + delivery counter logic                          | Dev   |
| 8    | Integration tests: order lifecycle                                | Dev   |

**Deliverable:** Full order flow from placement to delivery (without payment, using mock data).

---

### Phase 3 — Integrations (Weeks 9–11)

**Goal:** Paystack, push notifications, real-time updates, PIN

| Week | Task                                                        | Owner |
|------|-------------------------------------------------------------|-------|
| 9    | Paystack: payment initiation, checkout WebView              | Dev   |
| 9    | Paystack: webhook handler + signature verification          | Dev   |
| 9    | PIN generation on payment confirmed + push notification     | Dev   |
| 9    | PIN entry screen on delivery + API verification             | Dev   |
| 10   | Supabase Realtime: rider order feed updates                 | Dev   |
| 10   | Supabase Realtime: student order status updates             | Dev   |
| 10   | Expo push notification setup (FCM + APNs)                   | Dev   |
| 10   | Special order surcharge logic + scheduling rules            | Dev   |
| 11   | Rider earnings tracking + earnings screen                   | Dev   |
| 11   | Refund flow (admin-triggered, Paystack refund API)          | Dev   |
| 11   | Admin dashboard: stats, config editor, checkpoint manager   | Dev   |
| 11   | Integration tests: payments + webhook + PIN                 | Dev   |

**Deliverable:** End-to-end order flow with real payments, push notifications, and PIN delivery.

---

### Phase 4 — Testing & Polish (Weeks 12–14)

**Goal:** Bug fixes, UX polish, security audit, performance

| Week | Task                                                    | Owner     |
|------|---------------------------------------------------------|-----------|
| 12   | E2E test suite setup (Detox)                            | Dev       |
| 12   | Write all 15 E2E scenarios                              | Dev       |
| 12   | Bug fixes from E2E testing                              | Dev       |
| 13   | Security review: RLS policies, auth checks, input val.  | Dev       |
| 13   | UI polish: loading states, error messages, empty states | Designer  |
| 13   | Onboarding screens (first-launch walkthrough)           | Dev       |
| 13   | Accessibility: font sizes, contrast, screen reader      | Dev       |
| 14   | Performance: image optimization, query optimization      | Dev       |
| 14   | Internal beta with team members (eat your own food)     | All       |
| 14   | Bug fixes from internal beta                            | Dev       |
| 14   | Expo EAS build for TestFlight + internal Android APK    | Dev       |

**Deliverable:** Stable, tested, polished app ready for pilot.

---

### Phase 5 — Pilot Launch (Week 15)

**Goal:** Go live at Ashesi University

| Day      | Task                                                       |
|----------|------------------------------------------------------------|
| Day 1    | Onboard 3–5 pilot shops (manual setup with founders)       |
| Day 1    | Onboard 5–10 verified riders                               |
| Day 2    | Define and configure Ashesi checkpoints in admin           |
| Day 3    | Soft launch: 50 students (WhatsApp group invite)           |
| Day 3–5  | Monitor closely: Sentry errors, Paystack txns, orders      |
| Day 7    | First delivery Sunday — all hands                          |
| Day 10   | Collect feedback, prioritize fixes                         |
| Day 14   | Wider rollout if stable (all Ashesi students)              |

---

### Milestone Summary

| Milestone                    | Target Date  |
|------------------------------|-------------|
| M1: Auth + Profiles live     | Week 3      |
| M2: Orders flow complete     | Week 8      |
| M3: Payments + PIN live      | Week 11     |
| M4: E2E tested + polished    | Week 14     |
| M5: Ashesi Pilot Launch      | Week 15     |
| M6: 100 active student users | Week 18     |
| M7: Second university added  | Month 6     |

---

## 14. Cost Analysis

### Why Not Supabase Free for the Database?

Supabase's free tier pauses the PostgreSQL database after **7 days of inactivity**. For Wave, even a quiet exam week would take the entire platform offline silently until someone manually reactivates it. The solution is to split Supabase's responsibilities — keep it for Auth, Storage, and Realtime (none of which pause), and use **Neon.tech** for the database.

### Service Responsibility Split

| Service        | What It Does for Wave               | Pauses? | Free Tier              |
|----------------|--------------------------------------|---------|------------------------|
| **Neon.tech**  | PostgreSQL 16 database               | ❌ Never | 0.5 GB, 191 compute-hrs/mo |
| **Supabase**   | Auth + Storage + Realtime only       | ❌ Never | 1 GB storage, free auth |
| **Railway**    | Fastify API hosting                  | ❌ Never | 500 hrs/mo free        |
| **Vercel**     | Admin Next.js dashboard              | ❌ Never | Unlimited static/hobby  |

### Monthly Cost at Launch (0–500 users)

| Service            | Plan              | Monthly Cost      |
|--------------------|-------------------|-------------------|
| Neon.tech (DB)     | Free              | $0                |
| Supabase (Auth+)   | Free              | $0                |
| Railway (API)      | Starter           | $0 (500h free)    |
| Vercel (Admin)     | Hobby             | $0                |
| Expo EAS           | Free tier         | $0                |
| GitHub             | Free              | $0                |
| Sentry             | Free              | $0                |
| Paystack           | % per transaction | ~1.5% + ¢10/txn  |
| **Total Fixed**    |                   | **$0/mo**         |

### Cost Scaling & Upgrade Path

| Users      | Database              | API (Railway) | Auth/Storage   | Monthly Fixed |
|------------|-----------------------|---------------|----------------|---------------|
| 0–500      | Neon free             | Free          | Supabase free  | **$0**        |
| 500–2,000  | Neon free             | $5/mo         | Supabase free  | **$5**        |
| 2,000–5,000| **DigitalOcean $15/mo** | $20/mo      | Supabase Pro ($25) | **~$60** |
| 5,000+     | DigitalOcean $50/mo   | $50/mo        | Supabase Pro ($25) | **~$125** |

### DigitalOcean Migration Trigger

Move from Neon to DigitalOcean Managed PostgreSQL when **any** of these are true:

- Neon free tier storage exceeds 0.5 GB
- Consistent daily active orders requiring guaranteed uptime SLA
- Wave is generating revenue sufficient to cover $15/mo easily

**Migration effort:** Change one environment variable — `DATABASE_URL` — in Railway. Prisma handles the rest. Zero application code changes required.

> DigitalOcean also provides **$200 in free credits for 60 days** for new accounts, enough to run the $15/mo plan free throughout the entire pilot phase.

> Paystack revenue from delivery fees covers all scaling costs well before they become significant.

---

## 15. Deployment & DevOps

### 14.1 Repository Structure

```
wave/
├── apps/
│   ├── mobile/          # React Native (Expo)
│   └── admin/           # Next.js admin dashboard
├── packages/
│   ├── api/             # Fastify API (Node.js)
│   ├── db/              # Prisma schema + migrations (targets Neon / DigitalOcean)
│   └── shared/          # Shared types, utils, zod schemas
├── .github/
│   └── workflows/
│       ├── ci.yml            # Tests on PR
│       ├── deploy-api.yml    # Railway deploy on main
│       └── deploy-admin.yml  # Vercel deploy on main
├── supabase/
│   ├── config/          # Auth + Storage + Realtime config only (no DB migrations)
│   └── seed-auth.sql    # Auth seed data for dev
└── docs/                # This document + ADRs
```

### 14.2 CI/CD Pipeline

```yaml
# .github/workflows/ci.yml
name: CI

on: [pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm run test:unit
      - run: npm run test:integration
        env:
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
          PAYSTACK_SECRET_KEY: ${{ secrets.PAYSTACK_TEST_KEY }}
```

### 14.3 Environment Variables

```env
# API — Core
DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/wave?sslmode=require  # Neon (free)
# DATABASE_URL=postgresql://...@db.digitalocean.com/wave  # ← swap here when upgrading to DO

# Supabase — Auth, Storage, Realtime only (NOT used for DB queries)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...

# Payments
PAYSTACK_SECRET_KEY=sk_live_...
PAYSTACK_WEBHOOK_SECRET=...

# App
JWT_SECRET=...
APP_URL=https://api.wave.app

# Mobile
EXPO_PUBLIC_API_URL=https://api.wave.app/v1
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_live_...

# Admin
NEXT_PUBLIC_API_URL=https://api.wave.app/v1
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### 14.4 Branching Strategy

Never push code directly to `main`. Use structured branches to keep production stable.

```
main                    → sacred; stable, deployed, or deployable code only (auto-deploys to Railway + Vercel)
develop                 → integration/staging; features merged and tested here before main
feature/feature-name    → new work (branch off develop). e.g. feature/user-authentication
bugfix/bug-description  → targeted fixes. e.g. bugfix/login-crash
```

**Workflow:**
1. Branch from `develop` for new features or bug fixes.
2. Open a PR into `develop` when work is ready for integration testing.
3. Merge `develop` into `main` only when the release is stable and deployable.
4. Do not commit or push directly to `main` unless explicitly required for an emergency hotfix.

---

## 16. Future Roadmap

### Version 1.1 (Month 3–4 after launch)
- In-app chat between student and rider
- Rider location sharing (live map during delivery)
- Rating system (student rates rider, rider rates student)
- Push notification for shop when new order arrives

### Version 1.2 (Month 5–6)
- Wallet top-up system (students pre-load GHS into Wave wallet)
- Bulk/group orders (multiple students combine into one delivery)
- Referral system (refer a friend → bonus credit)

### Version 2.0 — Multi-University Expansion (Month 6+)
- University switching in-app
- University-specific checkpoint and shop networks
- University admin role (manage their own institution)
- Partner university onboarding flow

### Version 2.1
- Shop analytics dashboard (views, orders, revenue charts)
- Student subscription plan (flat monthly fee for unlimited deliveries)
- Rider leaderboard + bonuses
- Dark mode

---

## Appendix A — Glossary

| Term             | Definition                                                              |
|------------------|-------------------------------------------------------------------------|
| Buy For Me       | Order type where a rider purchases an item on a student's behalf        |
| Checkpoint       | A physical campus location where orders are handed off                  |
| Standard Day     | Sunday or Wednesday — no surcharge applied                              |
| Special Order    | Order placed for a non-standard delivery day, incurs a premium fee      |
| Loyalty Discount | 20% off delivery fee after 6 completed deliveries                       |
| Delivery PIN     | A 6-digit code the student uses to confirm collection of their order    |
| RLS              | Row Level Security — Supabase/PostgreSQL feature restricting data access |

---

## Appendix B — Key Design Decisions (ADRs)

### ADR-001: React Native + Expo over Flutter
**Decision:** React Native with Expo  
**Reason:** Larger talent pool in Ghana, JavaScript shared with API, Expo OTA updates reduce App Store review cycles for quick fixes.

### ADR-002: Neon.tech for Database + Supabase for Auth/Storage/Realtime
**Decision:** Split Supabase's responsibilities. Neon.tech handles PostgreSQL; Supabase handles everything else.  
**Reason:** Supabase's free tier pauses the database after 7 days of inactivity — a critical failure for a live delivery platform. Neon.tech's free PostgreSQL never pauses, supports branching (dev/staging/prod databases), and is fully compatible with Prisma via a standard connection string. Supabase Auth, Storage, and Realtime are retained because they are unaffected by the pause policy and provide excellent free-tier limits. When the Neon free tier is outgrown, a single `DATABASE_URL` environment variable change migrates the database to DigitalOcean Managed PostgreSQL ($15/mo) with zero application code changes.

### ADR-003: Fastify over Express
**Decision:** Fastify  
**Reason:** Built-in schema validation (Zod/JSON Schema), significantly faster request handling, TypeScript-first. Minimal overhead for a lean API.

### ADR-004: Delivery fee discount on fee only, not item price
**Decision:** 20% discount applies to delivery fee, not the item purchase price  
**Reason:** Wave controls the delivery fee; item prices belong to the shop. Discounting the item would require subsidizing external shop prices.

### ADR-005: PIN verification at checkpoint, not QR code
**Decision:** 6-digit numeric PIN  
**Reason:** Works on any phone (including feature phones via SMS fallback), no camera requirement, faster UX at handoff, no additional library dependency.

---

*Document maintained by the Wave founding team. Last updated: June 2026. v1.3.0 — Design System section (11) rewritten to reference design.md as source of truth; section condensed to summary with pointers. design.md updated to v1.1.0 with Visual Reference section, segment controls, radio rows, expanded bottom sheet and nav specs.*
