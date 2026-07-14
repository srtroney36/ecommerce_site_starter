import { hasPermission } from "./permissions"

/**
 * Best-effort client-side access layer for the admin dashboard.
 *
 * Medusa v2 exposes no API to remove core sidebar items or wrap core pages per
 * user, so this installs a single, session-long DOM controller that:
 *   1. Hides sidebar nav links to sections the user can't read.
 *   2. Overlays a friendly "No access" panel when they land on a forbidden route.
 *
 * The backend guard is still the real security boundary — this only improves UX.
 * Everything here is wrapped defensively: if the DOM doesn't match, it no-ops and
 * the app behaves exactly as before (never breaks the admin).
 */

// /app/<segment> -> resource (mirrors the backend policy aliases)
const APP_ALIASES: Record<string, string> = {
  orders: "orders",
  "draft-orders": "draft_orders",
  products: "products",
  categories: "categories",
  collections: "collections",
  inventory: "inventory",
  reservations: "inventory",
  "price-lists": "price_lists",
  customers: "customers",
  "customer-groups": "customer_groups",
  promotions: "promotions",
  campaigns: "promotions",
  "gift-cards": "gift_cards",
  // custom pages
  brands: "brands",
  homepage: "homepage",
  "product-cards": "products",
  "quick-order": "orders",
  "sales-insights": "sales_insights",
  "store-settings": "store_settings",
  "access-control": "rbac",
}

// /app/settings/<sub> -> resource
const SETTINGS_ALIASES: Record<string, string> = {
  regions: "regions",
  taxes: "tax",
  "tax-regions": "tax",
  locations: "stock_locations",
  "sales-channels": "sales_channels",
  "api-key-management": "api_keys",
  "publishable-api-keys": "api_keys",
  "secret-api-keys": "api_keys",
  users: "users",
  store: "settings",
  "product-tags": "product_tags",
  "product-types": "product_types",
  "return-reasons": "returns",
  reservations: "inventory",
  workflows: "settings",
  notifications: "settings",
  profile: "__self", // the user's own account — never gate
}

const RESOURCE_LABELS: Record<string, string> = {
  orders: "Orders",
  draft_orders: "Draft Orders",
  products: "Products",
  categories: "Categories",
  collections: "Collections",
  inventory: "Inventory",
  price_lists: "Price Lists",
  customers: "Customers",
  customer_groups: "Customer Groups",
  promotions: "Promotions",
  gift_cards: "Gift Cards",
  regions: "Regions",
  tax: "Tax",
  stock_locations: "Locations",
  sales_channels: "Sales Channels",
  api_keys: "API Keys",
  users: "Users",
  settings: "Settings",
  product_tags: "Product Tags",
  product_types: "Product Types",
  returns: "Returns",
  brands: "Brands",
  homepage: "Homepage",
  sales_insights: "Sales Insights",
  store_settings: "Store Settings",
  rbac: "Access Control",
}

function resourceForAppPath(pathname: string | null | undefined): string | null {
  if (!pathname) return null
  const parts = pathname.split("/").filter(Boolean) // ["app", seg, ...]
  if (parts[0] !== "app") return null
  const seg = parts[1]
  if (!seg) return null
  if (seg === "settings") {
    const sub = parts[2]
    if (!sub) return null // settings hub itself — don't gate
    const res = SETTINGS_ALIASES[sub]
    if (res === "__self") return null
    return res ?? "settings"
  }
  return APP_ALIASES[seg] ?? null
}

// null => unrestricted (super admin or still loading) — never hide/overlay.
let currentPerms: string[] | null = null
let installed = false
let scheduled = false

function allowed(resource: string): boolean {
  if (currentPerms === null) return true
  return hasPermission(currentPerms, resource, "read")
}

function hideNav() {
  const anchors = document.querySelectorAll<HTMLAnchorElement>('a[href^="/app/"]')
  anchors.forEach((a) => {
    const res = resourceForAppPath(a.getAttribute("href"))
    const target = (a.closest("li") as HTMLElement) || a
    const shouldHide = !!res && !allowed(res)
    if (shouldHide) {
      target.style.display = "none"
      target.dataset.rbacHidden = "1"
    } else if (target.dataset.rbacHidden === "1") {
      target.style.display = ""
      delete target.dataset.rbacHidden
    }
  })
}

function buildOverlay(resource: string): HTMLElement {
  const label = RESOURCE_LABELS[resource] || resource.replace(/_/g, " ")
  const el = document.createElement("div")
  el.id = "rbac-access-overlay"
  el.className = "bg-ui-bg-base"
  el.style.cssText =
    "position:absolute;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;padding:2rem;"
  el.innerHTML =
    '<div style="text-align:center;max-width:26rem;">' +
    '<div class="text-ui-fg-base" style="font-weight:600;font-size:1.05rem;margin-bottom:.35rem;">No access to ' +
    label +
    "</div>" +
    '<div class="text-ui-fg-subtle" style="font-size:.85rem;line-height:1.45;">' +
    "You don't have permission to view this section. Contact an administrator if you need access." +
    "</div></div>"
  return el
}

function syncOverlay() {
  const res = resourceForAppPath(window.location.pathname)
  const existing = document.getElementById("rbac-access-overlay")
  const blocked = !!res && !allowed(res)
  if (blocked) {
    const main = document.querySelector("main")
    if (!main) return
    if (getComputedStyle(main).position === "static") {
      ;(main as HTMLElement).style.position = "relative"
    }
    if (!existing) main.appendChild(buildOverlay(res as string))
  } else if (existing) {
    existing.remove()
  }
}

function apply() {
  try {
    hideNav()
    syncOverlay()
  } catch {
    /* never break the admin */
  }
}

function scheduleApply() {
  if (scheduled) return
  scheduled = true
  requestAnimationFrame(() => {
    scheduled = false
    apply()
  })
}

function install() {
  if (installed) return
  installed = true
  try {
    const patch = (type: "pushState" | "replaceState") => {
      const orig = history[type]
      history[type] = function (this: History, ...args: any[]) {
        const ret = orig.apply(this, args as any)
        scheduleApply()
        return ret
      } as any
    }
    patch("pushState")
    patch("replaceState")
    window.addEventListener("popstate", scheduleApply)
    window.addEventListener("resize", scheduleApply)
    // Re-apply whenever the shell re-renders (nav rebuilt / content swapped).
    // Only childList is observed, so our own style tweaks don't retrigger it.
    const mo = new MutationObserver(() => scheduleApply())
    mo.observe(document.body, { childList: true, subtree: true })
  } catch {
    /* ignore */
  }
}

export function updateAccessGuard(permissions: string[], isSuperAdmin: boolean) {
  currentPerms = isSuperAdmin ? null : permissions
  install()
  apply()
}
