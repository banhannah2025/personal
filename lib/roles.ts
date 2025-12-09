type PublicMetadata = Record<string, unknown> | undefined | null;

function parseAdminList(raw?: string | null) {
  if (!raw) return [];
  return raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

const serverAdmins =
  typeof window === "undefined"
    ? parseAdminList(process.env.SITE_ADMIN ?? process.env.NEXT_PUBLIC_SITE_ADMINS)
    : [];

const clientAdmins = parseAdminList(process.env.NEXT_PUBLIC_SITE_ADMINS ?? "");

function isEnvAdmin(email?: string | null) {
  if (!email) return false;
  const normalized = email.toLowerCase();
  if (typeof window === "undefined") {
    return serverAdmins.includes(normalized);
  }
  return clientAdmins.includes(normalized);
}

export function isAdminFromMetadata(metadata: PublicMetadata, email?: string | null) {
  if (metadata) {
    const role = metadata.role;
    if (typeof role === "string" && role.toLowerCase() === "admin") {
      return true;
    }
    if (metadata.isAdmin === true) {
      return true;
    }
  }
  return isEnvAdmin(email);
}
