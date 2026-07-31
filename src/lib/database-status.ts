const PLACEHOLDER_PARTS = new Set(["host", "user", "password", "database"]);

export function hasUsablePostgresUrl() {
  const raw = process.env.DATABASE_URL;
  if (!raw || !/^(postgresql|postgres):\/\//.test(raw)) return false;

  try {
    const url = new URL(raw);
    const parts = [
      url.hostname,
      decodeURIComponent(url.username),
      decodeURIComponent(url.password),
      url.pathname.replace(/^\//, ""),
    ].map((part) => part.toLowerCase());

    return !parts.some((part) => PLACEHOLDER_PARTS.has(part));
  } catch {
    return false;
  }
}
