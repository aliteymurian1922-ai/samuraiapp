export function isTrustedRequestOrigin(
  origin: string | null,
  host: string | null,
): boolean {
  if (!origin || !host) return false;

  try {
    const originHost = new URL(origin).host.toLowerCase();
    return originHost === host.trim().toLowerCase();
  } catch {
    return false;
  }
}
