import "server-only";
import { db } from "@/db";
import { memberships, workspaces } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getActiveWorkspaceId, getCurrentUser, type SessionUser } from "@/lib/auth/session";
import { UnauthorizedError } from "@/lib/api-response";
import type { MembershipRole } from "@/lib/permissions";

export type WorkspaceSummary = {
  id: string;
  name: string;
  slug: string;
  teamType: string | null;
  logoColor: string | null;
  role: MembershipRole;
};

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export async function getUserWorkspaces(userId: string): Promise<WorkspaceSummary[]> {
  const rows = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      teamType: workspaces.teamType,
      logoColor: workspaces.logoColor,
      role: memberships.role,
      createdAt: workspaces.createdAt,
    })
    .from(memberships)
    .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
    .where(eq(memberships.userId, userId))
    .orderBy(workspaces.createdAt);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    teamType: r.teamType,
    logoColor: r.logoColor,
    role: r.role as MembershipRole,
  }));
}

export type WorkspaceContext = {
  user: SessionUser;
  workspace: WorkspaceSummary;
  role: MembershipRole;
};

/**
 * Resolves the current user + their active workspace membership.
 * Falls back to the first workspace the user belongs to if no active
 * workspace cookie is set (or it points to a workspace they left).
 */
export async function requireWorkspaceContext(): Promise<WorkspaceContext> {
  const user = await requireUser();
  const workspaceList = await getUserWorkspaces(user.id);

  if (workspaceList.length === 0) {
    throw new UnauthorizedError("ابتدا باید یک Workspace ایجاد کنید.");
  }

  const activeId = await getActiveWorkspaceId();
  const workspace = workspaceList.find((w) => w.id === activeId) ?? workspaceList[0];

  return { user, workspace, role: workspace.role };
}

export async function requireMembership(workspaceId: string, userId: string) {
  const rows = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.workspaceId, workspaceId), eq(memberships.userId, userId)))
    .limit(1);
  if (!rows[0]) throw new UnauthorizedError("شما عضو این Workspace نیستید.");
  return rows[0];
}
