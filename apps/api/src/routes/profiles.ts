import { Hono, type Context } from "hono";
import { z } from "zod";
import { AppError } from "../errors/app-error.js";
import { successResponse } from "../lib/api-response.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { createAuthMiddleware, createCsrfMiddleware } from "../middleware/auth.js";
import type { AuthProvider, AuthUser } from "../services/auth/types.js";
import type { ProfileService } from "../services/profiles/profile-service.js";

type Variables = { authUser: AuthUser; authSessionToken: string };
const profileInput = z.object({
  displayName: z.string().trim().min(1).max(120), institution: z.string().trim().max(160).optional(),
  roleLabel: z.enum(["student", "teacher", "other"]), bio: z.string().trim().max(500).optional(),
});
const organizerInput = profileInput.extend({ termsAccepted: z.literal(true) });

export function createProfileRoutes(auth: AuthProvider, service: ProfileService, webOrigin: string) {
  const routes = new Hono<{ Variables: Variables }>();
  const requireAuth = createAuthMiddleware(auth);
  const csrf = createCsrfMiddleware(webOrigin);
  routes.get("/", requireAuth, asyncHandler(async (c) => successResponse(c, await service.getForSession(c.get("authUser").id, c.get("authSessionToken")))));
  routes.post("/active", requireAuth, csrf, asyncHandler(async (c) => {
    let body: unknown;
    try { body = await c.req.json(); } catch { throw new AppError(400, "Request body must be valid JSON"); }
    const input = z.object({ type: z.enum(["participant", "organizer"]) }).parse(body);
    const profile = await service.switch(c.get("authUser").id, c.get("authSessionToken"), input.type);
    return successResponse(c, { profile });
  }));
  routes.post("/organizer", requireAuth, csrf, asyncHandler(async (c: Context<{ Variables: Variables }>) => {
    let body: unknown;
    try { body = await c.req.json(); } catch { throw new AppError(400, "Request body must be valid JSON"); }
    const { termsAccepted: _termsAccepted, ...input } = organizerInput.parse(body);
    const profile = await service.createOrganizer(c.get("authUser").id, input);
    return successResponse(c, { profile }, profile.approvalStatus === "pending" ? 202 : 201);
  }));
  routes.patch("/participant", requireAuth, csrf, asyncHandler(async (c) => {
    let body: unknown;
    try { body = await c.req.json(); } catch { throw new AppError(400, "Request body must be valid JSON"); }
    const input = profileInput.parse(body);
    const profile = await service.updateParticipant(c.get("authUser").id, input);
    return successResponse(c, { profile });
  }));
  return routes;
}
