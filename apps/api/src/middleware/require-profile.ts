import type { MiddlewareHandler } from "hono";
import type { AuthUser } from "../services/auth/types.js";
import type { ProfileService } from "../services/profiles/profile-service.js";

type Variables = { authUser: AuthUser; authSessionToken: string };
export function requireProfileType(service: ProfileService | undefined, type: "participant" | "organizer"): MiddlewareHandler<{ Variables: Variables }> {
  return async (c, next) => {
    if (service) await service.assertActiveType(c.get("authUser").id, c.get("authSessionToken"), type);
    await next();
  };
}
