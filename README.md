# Medusa 2.0 Re-skinnable Ecommerce Starter

A Medusa 2.0 monorepo with a Next.js storefront, designed to be cloned and re-skinned for multiple brands by editing a single config file.

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | v20 LTS – **v24 LTS** (v25+ breaks the Next.js storefront — use `nvm use 24` if needed) |
| npm | v10+ |
| PostgreSQL | v15+ running locally |
| Git | any recent version |

> **Node version note:** If you are on Node 25+, switch down:
> ```bash
> nvm install 24
> nvm use 24
> ```

---

## Project structure

```
my-store/
├── apps/
│   ├── backend/          # Medusa 2.0 backend + Vite admin (port 9000)
│   └── storefront/       # Next.js storefront (port 8000)
└── turbo.json
```

---

## Running the project

### 1. Start the backend

```bash
cd apps/backend
npm run dev
```

- Admin UI: http://localhost:9000/app
- Health: `curl http://localhost:9000/health`

### 2. Start the storefront

In a second terminal:

```bash
cd apps/storefront
npm run dev
```

- Storefront: http://localhost:8000

---

## Spin up a new brand — checklist

1. **Clone this repo** into a new folder
2. **Edit `apps/storefront/src/brand.config.ts`** — set `storeName`, `tagline`, `colors`, `fonts`
3. **Swap logo / favicon**
   - Logo → `apps/storefront/public/images/logo.svg`
   - Favicon → `apps/storefront/public/favicon.ico`
4. **Configure backend env** — copy `apps/backend/.env.example` → `.env` and set:
   - `DATABASE_URL` (your PostgreSQL connection string)
   - `JWT_SECRET` + `COOKIE_SECRET` (run `openssl rand -hex 32` for each)
   - `STRIPE_API_KEY` + `STRIPE_WEBHOOK_SECRET` (optional — omit for manual payment)
5. **Configure storefront env** — copy `apps/storefront/.env.example` → `.env.local` and set:
   - `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` (Admin → Settings → API Keys)
   - Pixel IDs as needed (all optional — see Analytics section below)
6. **Create the database and migrate**:
   ```bash
   psql -U postgres -c "CREATE DATABASE mystore;"
   cd apps/backend
   npx medusa db:migrate
   npx medusa exec ./src/migration-scripts/initial-data-seed.ts
   ```
7. **Start both services** (see above)

---

## Branding system

All brand values live in one file: `apps/storefront/src/brand.config.ts`

```ts
const brand = {
  storeName: "My Store",
  tagline: "Quality products, delivered fast.",
  logoPath: "/images/logo.svg",
  faviconPath: "/favicon.ico",
  colors: {
    primary: "#000000",
    secondary: "#6B7280",
    background: "#FFFFFF",
    text: "#111827",
  },
  fonts: {
    heading: "Inter",   // any Google Fonts family name
    body: "Inter",
  },
}
```

Editing this one file re-skins:
- Page `<title>` and meta description
- Nav, footer, and checkout store name
- CSS custom properties (`--brand-primary`, `--brand-bg`, `--brand-font-heading`, etc.)
- Google Fonts loaded automatically
- Favicon

---

## Analytics / pixels

All pixel loading is env-driven. Nothing loads when a var is absent or empty.

| Env var | Provider | Events fired |
|---------|----------|--------------|
| `NEXT_PUBLIC_GTM_ID` | Google Tag Manager | all events via dataLayer push |
| `NEXT_PUBLIC_META_PIXEL_ID` | Meta Pixel | PageView, ViewContent, AddToCart, InitiateCheckout, Purchase |
| `NEXT_PUBLIC_TIKTOK_PIXEL_ID` | TikTok Pixel | ViewContent, AddToCart, InitiateCheckout, CompletePayment |
| `NEXT_PUBLIC_GADS_ID` | Google Ads | view_item, add_to_cart, begin_checkout, purchase |

The typed helper lives at `apps/storefront/src/lib/analytics/index.ts`. Import `trackAddToCart`, `trackPurchase`, etc. directly in any component.

---

## Stripe (optional)

Stripe is conditionally loaded in `apps/backend/medusa-config.ts`. Set both vars to enable:

```env
STRIPE_API_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Also install the plugin in the backend:

```bash
cd apps/backend
npm install @medusajs/payment-stripe
```

Without these vars, the store runs with the built-in manual (cash-on-delivery) payment provider — no errors, no Stripe code loaded.

---

## Environment variables reference

### Backend — `apps/backend/.env`

See `apps/backend/.env.example` for the full annotated list.

### Storefront — `apps/storefront/.env.local`

See `apps/storefront/.env.example` for the full annotated list.

> **Security:** `.env` and `.env.local` are in `.gitignore`. Never commit real secrets.
