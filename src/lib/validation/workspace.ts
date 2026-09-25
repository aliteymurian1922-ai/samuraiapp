import { z } from "zod";

export const teamTypes = [
  "software",
  "marketing",
  "sales",
  "agency",
  "startup",
  "other",
] as const;

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(2, "نام Workspace را وارد کنید.").max(120),
  teamType: z.enum(teamTypes).default("software"),
  memberCount: z.enum(["1-5", "6-15", "16-50", "50+"]).default("1-5"),
  firstProjectName: z.string().trim().max(160).optional(),
});
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export const inviteMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email("ایمیل معتبر نیست."),
  role: z.enum(["admin", "manager", "member", "viewer"]).default("member"),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(["owner", "admin", "manager", "member", "viewer"]),
});
