import "server-only";
import { db } from "@/db";
import { workspaces, memberships, projects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { slugify } from "@/lib/utils";
import type { CreateWorkspaceInput } from "@/lib/validation/workspace";
import { createProject } from "@/server/projects";
import { createTask } from "@/server/tasks";

async function uniqueSlug(base: string) {
  const raw = slugify(base);
  let candidate = raw;
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await db.select().from(workspaces).where(eq(workspaces.slug, candidate)).limit(1);
    if (!existing[0]) return candidate;
    attempt += 1;
    candidate = `${raw}-${attempt}`;
  }
}

export async function createWorkspaceWithOwner(userId: string, input: CreateWorkspaceInput) {
  const slug = await uniqueSlug(input.name);

  const [workspace] = await db
    .insert(workspaces)
    .values({
      name: input.name,
      slug,
      teamType: input.teamType,
      createdBy: userId,
      onboardingCompletedAt: new Date(),
    })
    .returning();

  await db.insert(memberships).values({ workspaceId: workspace.id, userId, role: "owner" });

  if (input.firstProjectName?.trim()) {
    const project = await createProject(workspace.id, userId, {
      name: input.firstProjectName.trim(),
      description: null,
      priority: "medium",
      color: "#4f46e5",
      startDate: null,
      dueDate: null,
      memberIds: [],
    });

    const starterTasks = [
      "تعریف اهداف و محدوده پروژه",
      "تشکیل تیم اجرایی",
      "برنامه‌ریزی زمان‌بندی اولیه",
    ];
    for (const title of starterTasks) {
      await createTask(workspace.id, userId, {
        projectId: project.id,
        title,
        priority: "medium",
        tagIds: [],
      });
    }
  }

  return workspace;
}

export async function getWorkspaceBySlugOrId(idOrSlug: string) {
  const rows = await db.select().from(workspaces).where(eq(workspaces.id, idOrSlug)).limit(1);
  return rows[0] ?? null;
}

export async function countWorkspaceProjects(workspaceId: string) {
  const rows = await db.select().from(projects).where(eq(projects.workspaceId, workspaceId));
  return rows.length;
}
