# Route53 Clone

A functional clone of the **AWS Route53 console** — recreating the DNS
management *user experience* (hosted zones, records, navigation, search,
pagination, modals) with real persistence, rather than implementing actual
DNS resolution.

Built for the **Scaler SDE Fullstack Assignment**.

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router, TypeScript, Tailwind CSS) |
| Backend | FastAPI (Python) |
| Database | SQLite (via SQLAlchemy ORM) |

---

## 1. Project Summary (STAR)

> A quick, recruiter-friendly summary of *why* this project exists and *what*
> it demonstrates, using the **Situation – Task – Action – Result** framework.

**Situation**
AWS Route53 is the industry-standard DNS management service, but it's a paid,
production system — not something a developer can freely experiment with or
show off in a portfolio. The assignment brief called for a full-stack clone
that captures the *console experience* of managing hosted zones and DNS
records, without needing an AWS account or real domain infrastructure.

**Task**
Design and build a full-stack application that:
- Faithfully reproduces the Route53 console's core workflows (create/view/
  edit/delete hosted zones and DNS records, search, pagination, modals).
- Persists real data (not mocked state) through a proper API and database.
- Visually matches the AWS Console aesthetic closely enough to feel authentic.
- Goes beyond the minimum spec with genuinely useful "power user" features.

**Action**
- Built a **FastAPI backend** with a clean router-per-resource structure
  (`auth`, `zones`, `records`), SQLAlchemy ORM models, and Pydantic schemas
  for request/response validation.
- Built a **Next.js (App Router + TypeScript) frontend** with one route per
  screen, a shared Axios API client that auto-attaches auth tokens, and a
  reusable component library (`Modal`, `Pagination`, `SearchInput`, etc.)
  styled to match AWS's navy top bar / orange buttons / blue links.
- Modeled the database relationships the way real DNS works: one hosted zone
  owns many DNS records, deleting a zone cascades to its records, and
  creating a zone auto-generates its `NS` record — just like Route53 does.
- Added five bonus features (detailed in [Section 6](#6-bonus-features-explained))
  that a real infrastructure engineer would actually want: BIND zone file
  import/export, JSON export, bulk operations, dark mode, and keyboard
  shortcuts.

**Result**
A working, deployable full-stack app where every CRUD action is backed by a
real SQLite database, the UI is close enough to the real console that it's
immediately familiar, and the codebase is organized cleanly enough (routers,
schemas, contexts, shared UI components) to extend with real features later.
All core requirements plus all five bonus features were implemented and
verified end-to-end.

---

## 2. Key Terms (for reviewers unfamiliar with DNS/Route53)

| Term | Definition |
|---|---|
| **Hosted Zone** | A container for all the DNS records belonging to one domain (e.g. `example.com`). Think of it as "the DNS settings page for one website." |
| **DNS Record** | A single rule inside a hosted zone that tells the internet how to resolve a name, e.g. "`www.example.com` → `192.0.2.1`." |
| **Record Type** | The *kind* of rule a DNS record represents. This project supports `A`, `AAAA`, `CNAME`, `TXT`, `MX`, `NS`, `PTR`, `SRV`, `CAA` — the most common real-world types. |
| **TTL (Time To Live)** | How long (in seconds) a DNS answer should be cached before it's re-checked. Lower TTL = faster updates propagate, more lookup traffic. |
| **NS Record** | A record that tells the internet *which servers* are authoritative for a zone. Real Route53 auto-creates one per zone; this clone does too. |
| **BIND Zone File** | A plain-text, industry-standard file format for describing all the DNS records of a domain in one file (used by the BIND DNS server software and widely supported for import/export). |
| **Routing Policy** | The strategy used to decide *which* value to return when a record has multiple values (e.g. Simple, Weighted, Failover). This clone implements `Simple` routing. |

---

## 3. Setup Instructions

### Prerequisites
- Node.js 20.9+ (Node 22 LTS recommended)
- Python 3.11+
- npm

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

uvicorn app.main:app --reload --port 8000
```

The API is now running at `https://route53-clone-final.onrender.com`
(or `http://localhost:8000` if run locally).
Interactive API docs (Swagger UI): append `/docs` to the base URL.

On first run, the backend automatically:
- Creates `route53.db` (a SQLite file) with all required tables.
- Seeds one demo user so you can log in immediately: **username `admin`,
  password `admin123`**.

### Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:3000`. The frontend talks to the backend at the URL
configured in `frontend/.env.local` (defaults to
`https://route53-clone-final.onrender.com`).

Log in with `admin` / `admin123`.

### Running both at once

Two terminals, one for each command above. There is no monorepo tooling —
this keeps the setup simple and matches the `frontend/` + `backend/`
folder structure required by the assignment.

---

## 4. Architecture Overview

```
┌──────────────────┐        HTTP / JSON        ┌──────────────────┐        ┌──────────────┐
│   Next.js (TS)   │  ───────────────────────►  │     FastAPI      │  ────► │    SQLite     │
│  (frontend/)     │  ◄───────────────────────  │   (backend/)     │  ◄──── │ route53.db   │
└──────────────────┘                             └──────────────────┘        └──────────────┘
```

**Why this split matters:** the frontend never touches the database
directly — every read/write goes through the FastAPI layer, which is the
only thing that owns the SQLite file. This mirrors how the real Route53
console talks to AWS's backend APIs rather than a database directly, and
means the backend could be swapped or scaled independently of the UI.

### Frontend (`frontend/`)

| Path | Responsibility |
|---|---|
| `src/app/**/page.tsx` | Next.js App Router — one route per screen |
| `src/lib/api.ts` | Single Axios instance; attaches the session token to every request and redirects to `/login` on a 401 (unauthorized) |
| `src/lib/auth-context.tsx` | React context wrapping login/logout state, persisted to `localStorage` so a page refresh keeps you logged in |
| `src/lib/toast-context.tsx` | Global toast notifications for create/update/delete feedback |
| `src/components/layout/` | `TopNav`, `SideNav`, `AppShell` (auth guard + page chrome) — styled to resemble the real AWS Console (navy top bar, orange primary buttons, blue links) |
| `src/components/ui/` | Shared building blocks: `Modal`, `ConfirmDialog`, `Pagination`, `SearchInput`, `Badge`, `PageHeader`, `EmptyState` |
| `src/components/zones/`, `src/components/records/` | Feature-specific create/edit forms |

### Backend (`backend/`)

| Path | Responsibility |
|---|---|
| `app/main.py` | FastAPI app entry point — CORS setup, table creation, demo user seed |
| `app/models.py` | SQLAlchemy ORM models (`User`, `HostedZone`, `DNSRecord`) |
| `app/schemas.py` | Pydantic request/response schemas — this is what validates incoming data and shapes API responses |
| `app/auth.py` | Mocked bearer-token auth dependency (see [Section 7](#7-whats-implemented-vs-mocked) for what "mocked" means here) |
| `app/routers/` | One router per resource: `auth_router`, `zones`, `records` |
| `app/database.py` | SQLite engine/session setup |
| `app/bind_utils.py` | Parser/serializer for BIND zone file import & export |

---

## 5. Database Schema

Three tables, all stored in `backend/route53.db`.

### `users`
| Column | Type | Notes |
|---|---|---|
| id | string (UUID) | Primary key |
| username | string | Unique |
| password | string | Plaintext — **mocked auth only, not production-safe** |
| session_token | string | Set on login, cleared on logout; nullable |
| created_at | datetime | |

### `hosted_zones`
| Column | Type | Notes |
|---|---|---|
| id | string (UUID) | Primary key |
| domain_name | string | e.g. `example.com`, unique |
| comment | text | Optional description |
| zone_type | string | `Public` or `Private` |
| record_count | integer | Denormalized count, kept in sync on every record create/delete |
| created_at | datetime | |
| updated_at | datetime | |

### `dns_records`
| Column | Type | Notes |
|---|---|---|
| id | string (UUID) | Primary key |
| hosted_zone_id | string | Foreign key → `hosted_zones.id`, cascades on delete |
| name | string | e.g. `www.example.com` |
| record_type | string | One of `A, AAAA, CNAME, TXT, MX, NS, PTR, SRV, CAA` |
| value | text | Record value(s), newline-separated for multi-value records |
| ttl | integer | Seconds, default `300` |
| routing_policy | string | Default `Simple` |
| created_at | datetime | |
| updated_at | datetime | |

**Relationship:** one `HostedZone` → many `DNSRecord`s, with
`ON DELETE CASCADE` (deleting a zone deletes all of its records
automatically). As in real Route53, creating a hosted zone automatically
creates an `NS` record for it.

---

## 6. Bonus Features (explained)

The assignment's baseline scope was full CRUD for zones and records. On top
of that, five extra features were implemented — each chosen to mirror a real
capability that a DNS engineer would actually rely on:

- **BIND zone file import** — upload a `.zone`/`.txt` file on a hosted
  zone's detail page and it's parsed server-side (`app/bind_utils.py`) into
  individual DNS records automatically. Handles `$ORIGIN`/`$TTL` directives,
  comments, and all nine supported record types. Invalid or empty files
  return a clear validation error instead of failing silently.
- **Export (JSON & BIND)** — every hosted zone has an Export menu offering
  either format, available both for a single zone and for a multi-select of
  zones/records at once.
- **Dark mode** — a toggle in the top nav, persisted to `localStorage` and
  applied via a `.dark` CSS class + custom properties, so there's no
  flash-of-wrong-theme on page reload.
- **Keyboard shortcuts** — `Ctrl/Cmd+K` focuses the current page's search
  box, `N` opens the create modal (zone or record, depending on the page),
  `Esc` closes the open modal, and `?` opens a shortcuts help dialog.
- **Bulk operations** — checkboxes on both the hosted zones table and the
  records table enable "Delete selected," "Export selected," and (for
  records) "Change TTL" across multiple rows at once — each destructive
  action gated behind a confirmation dialog.

---

## 7. What's implemented vs. mocked

Being explicit about scope, so it's clear what's a real, persisted feature
versus a deliberate placeholder.

**Fully implemented (persisted in SQLite, verified end-to-end):**
- Login / logout / session persistence (survives a page refresh)
- Hosted Zones: create, view, edit, delete, search, pagination
- DNS Records: create, view, edit, delete, search, filter by type, pagination
- Toast notifications on every create/update/delete
- Confirmation modal before every destructive delete

**Bonus features implemented:** see [Section 6](#6-bonus-features-explained) above.

**Mocked / out of scope (placeholder "Coming soon" pages, per assignment scope):**
- Dashboard, Traffic Policies, Health Checks, Resolver, Profiles — present
  in the nav for visual completeness, but not functional
- IAM / AWS Accounts / Organizations / Billing — not present at all, since
  they're outside what the assignment asked for

**Important caveat on auth:** the `password` column is stored in plaintext
and the "bearer token" is a simple opaque string, not a signed JWT. This is
intentional for the scope of the assignment (a mocked auth layer), but it
means this backend **should not be used as-is for anything beyond a demo.**

---

## 8. API Overview

Base URL: `https://route53-clone-final.onrender.com`. Every route **except**
`/api/auth/login` and `/api/health` requires an
`Authorization: Bearer <token>` header.

### Auth
| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/login` | Exchange username/password for a session token |
| POST | `/api/auth/logout` | Invalidate the current session token |
| GET | `/api/auth/me` | Get the current logged-in user |

### Hosted Zones
| Method | Path | Description |
|---|---|---|
| GET | `/api/hosted-zones?search=&page=&page_size=` | List zones (searchable, paginated) |
| POST | `/api/hosted-zones` | Create a zone |
| GET | `/api/hosted-zones/{zone_id}` | Get one zone |
| PUT | `/api/hosted-zones/{zone_id}` | Update comment / type |
| DELETE | `/api/hosted-zones/{zone_id}` | Delete a zone (and its records) |

### DNS Records (nested under a zone)
| Method | Path | Description |
|---|---|---|
| GET | `/api/hosted-zones/{zone_id}/records?search=&record_type=&page=&page_size=` | List records (searchable, filterable by type, paginated) |
| POST | `/api/hosted-zones/{zone_id}/records` | Create a record |
| GET | `/api/hosted-zones/{zone_id}/records/{record_id}` | Get one record |
| PUT | `/api/hosted-zones/{zone_id}/records/{record_id}` | Update a record |
| DELETE | `/api/hosted-zones/{zone_id}/records/{record_id}` | Delete a record |
| POST | `/api/hosted-zones/{zone_id}/records/import` | Import records from an uploaded BIND zone file |
| GET | `/api/hosted-zones/{zone_id}/records/export?format=json\|bind&ids=` | Export all (or selected) records |
| POST | `/api/hosted-zones/{zone_id}/records/bulk-delete` | Delete multiple records by id |
| POST | `/api/hosted-zones/{zone_id}/records/bulk-update-ttl` | Set TTL on multiple records at once |

### Hosted Zone bulk / export
| Method | Path | Description |
|---|---|---|
| GET | `/api/hosted-zones/{zone_id}/export?format=json\|bind` | Export a zone and all its records |
| POST | `/api/hosted-zones/bulk-delete` | Delete multiple hosted zones by id |

Full interactive documentation with request/response schemas is
auto-generated by FastAPI at `/docs` (Swagger) and `/redoc`.

---

## 9. Deployment Notes

- **Frontend:** deploys cleanly to Vercel — set `NEXT_PUBLIC_API_URL` to
  your deployed backend URL as an environment variable.
- **Backend:** deploys to any host that runs a long-lived Python process
  (Render, Railway, Fly.io). SQLite is a single file, so make sure your host
  gives you **persistent disk** (not ephemeral storage) if you want data to
  survive restarts/redeploys.