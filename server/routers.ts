import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { clearOwnerCookie, getOwnerAuth, loginOwner, publishDraft, readOwnerSettings, readPublishedSettings, resetDraft, saveDraftSettings, updateOwnerPassword } from "./academy";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";

async function requireOwner(req: Parameters<typeof getOwnerAuth>[0]) {
  const auth = await getOwnerAuth(req);
  if (!auth) throw new TRPCError({ code: "UNAUTHORIZED", message: "Owner authentication required" });
  return auth;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  academy: router({
    settings: publicProcedure.query(() => readPublishedSettings()),
  }),
  owner: router({
    status: publicProcedure.query(async ({ ctx }) => {
      const auth = await getOwnerAuth(ctx.req);
      return { authenticated: Boolean(auth), mustChangePassword: auth?.owner.mustChangePassword ?? false };
    }),
    login: publicProcedure.input(z.object({ password: z.string().min(1).max(200) })).mutation(async ({ ctx, input }) => {
      const result = await loginOwner(ctx.req, ctx.res, input.password);
      if (!result.ok) {
        if (result.reason === "rate_limited") throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many attempts. Try again in a few minutes." });
        throw new TRPCError({ code: "UNAUTHORIZED", message: "That password was not accepted." });
      }
      return result;
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      clearOwnerCookie(ctx.res);
      return { success: true } as const;
    }),
    settings: publicProcedure.query(async ({ ctx }) => {
      await requireOwner(ctx.req);
      return readOwnerSettings();
    }),
    changePassword: publicProcedure.input(z.object({ password: z.string().min(8).max(200) })).mutation(async ({ ctx, input }) => {
      const auth = await requireOwner(ctx.req);
      await updateOwnerPassword(auth, input.password);
      return { success: true } as const;
    }),
    saveDraft: publicProcedure.input(z.object({ settings: z.any() })).mutation(async ({ ctx, input }) => {
      const auth = await requireOwner(ctx.req);
      return saveDraftSettings(input.settings, auth);
    }),
    publish: publicProcedure.mutation(async ({ ctx }) => {
      const auth = await requireOwner(ctx.req);
      return publishDraft(auth);
    }),
    resetDraft: publicProcedure.mutation(async ({ ctx }) => {
      const auth = await requireOwner(ctx.req);
      return resetDraft(auth);
    }),
  }),
});

export type AppRouter = typeof appRouter;
