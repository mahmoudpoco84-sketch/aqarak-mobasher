const SITE_URL = "https://www.aqarakmobasher.com";
const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://qqrluwyrkpiypacenzho.supabase.co";
// Public anon key (already shipped in the client bundle); RLS limits it to approved listings.
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxcmx1d3lya3BpeXBhY2VuemhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE2NDM4NzUsImV4cCI6MjEwNzIxOTg3NX0.G0tKvGQ0hjcn_l_GB2oUZd1J3LnKDBK1W3zNPZGrMKQ";

const STATIC_PAGES = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/search", changefreq: "daily", priority: "0.9" },
  { path: "/about", changefreq: "monthly", priority: "0.6" },
  { path: "/contact", changefreq: "monthly", priority: "0.6" },
  { path: "/register", changefreq: "yearly", priority: "0.4" },
  { path: "/login", changefreq: "yearly", priority: "0.4" },
  { path: "/privacy", changefreq: "yearly", priority: "0.3" },
  { path: "/terms", changefreq: "yearly", priority: "0.3" },
];

const PAGE_SIZE = 1000;
const MAX_URLS = 50000;

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function urlEntry({ loc, lastmod, changefreq, priority }) {
  return [
    "  <url>",
    `    <loc>${escapeXml(loc)}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    "  </url>",
  ]
    .filter(Boolean)
    .join("\n");
}

async function fetchApprovedProperties() {
  const properties = [];

  for (let offset = 0; properties.length < MAX_URLS; offset += PAGE_SIZE) {
    const query = new URLSearchParams({
      select: "id,updated_at,created_at",
      status: "eq.approved",
      order: "created_at.desc",
      limit: String(PAGE_SIZE),
      offset: String(offset),
    });

    const response = await fetch(`${SUPABASE_URL}/rest/v1/properties?${query}`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Supabase responded with ${response.status}`);
    }

    const rows = await response.json();
    properties.push(...rows);

    if (rows.length < PAGE_SIZE) break;
  }

  return properties;
}

module.exports = async function handler(req, res) {
  const today = new Date().toISOString().slice(0, 10);

  let properties = [];
  try {
    properties = await fetchApprovedProperties();
  } catch (error) {
    console.error("sitemap: failed to load properties", error);
  }

  const entries = [
    ...STATIC_PAGES.map((page) =>
      urlEntry({
        loc: `${SITE_URL}${page.path}`,
        lastmod: today,
        changefreq: page.changefreq,
        priority: page.priority,
      })
    ),
    ...properties.map((property) =>
      urlEntry({
        loc: `${SITE_URL}/property/${property.id}`,
        lastmod: toDate(property.updated_at || property.created_at),
        changefreq: "weekly",
        priority: "0.8",
      })
    ),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>
`;

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader(
    "Cache-Control",
    "public, s-maxage=3600, stale-while-revalidate=86400"
  );
  res.status(200).send(xml);
};
