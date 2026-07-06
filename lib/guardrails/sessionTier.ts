/**
 * Placeholder for future RBAC (deferred to Phase 2, once real authentication
 * exists). Every session is "anonymous" today — there is no real "trusted" or
 * "admin" tier yet, and no behavior currently differs by tier. This just
 * gives call sites (e.g. logging) a stable shape to extend later without a
 * rewrite. Do NOT add tier-differentiated behavior here until real auth
 * lands.
 */
export type SessionTier = "anonymous" | "trusted" | "admin";

export function getSessionTier(_sessionId: string): SessionTier {
  return "anonymous";
}
