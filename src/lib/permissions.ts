export type MembershipRole = "owner" | "admin" | "manager" | "member" | "viewer";

export type Capability =
  | "workspace.manage"
  | "workspace.delete"
  | "members.invite"
  | "members.manage"
  | "members.remove"
  | "crm.view"
  | "crm.create"
  | "crm.update"
  | "crm.delete"
  | "crm.fields.manage"
  | "automation.view"
  | "automation.manage"
  | "project.create"
  | "project.update"
  | "project.delete"
  | "project.archive"
  | "task.create"
  | "task.update"
  | "task.delete"
  | "task.assign"
  | "comment.create"
  | "comment.delete_any"
  | "meeting.create"
  | "meeting.delete"
  | "report.view"
  | "ai.use"
  | "ai.write_actions"
  | "settings.manage";

const ROLE_RANK: Record<MembershipRole, number> = {
  owner: 5,
  admin: 4,
  manager: 3,
  member: 2,
  viewer: 1,
};

// Capability -> minimum role rank required.
const CAPABILITY_MIN_ROLE: Record<Capability, number> = {
  "workspace.manage": ROLE_RANK.admin,
  "workspace.delete": ROLE_RANK.owner,
  "members.invite": ROLE_RANK.admin,
  "members.manage": ROLE_RANK.admin,
  "members.remove": ROLE_RANK.admin,
  "crm.view": ROLE_RANK.viewer,
  "crm.create": ROLE_RANK.member,
  "crm.update": ROLE_RANK.member,
  "crm.delete": ROLE_RANK.manager,
  "crm.fields.manage": ROLE_RANK.manager,
  "automation.view": ROLE_RANK.viewer,
  "automation.manage": ROLE_RANK.manager,
  "project.create": ROLE_RANK.manager,
  "project.update": ROLE_RANK.manager,
  "project.delete": ROLE_RANK.admin,
  "project.archive": ROLE_RANK.manager,
  "task.create": ROLE_RANK.member,
  "task.update": ROLE_RANK.member,
  "task.delete": ROLE_RANK.manager,
  "task.assign": ROLE_RANK.manager,
  "comment.create": ROLE_RANK.member,
  "comment.delete_any": ROLE_RANK.manager,
  "meeting.create": ROLE_RANK.member,
  "meeting.delete": ROLE_RANK.manager,
  "report.view": ROLE_RANK.member,
  "ai.use": ROLE_RANK.viewer,
  "ai.write_actions": ROLE_RANK.member,
  "settings.manage": ROLE_RANK.admin,
};

export function can(role: MembershipRole, capability: Capability): boolean {
  return ROLE_RANK[role] >= CAPABILITY_MIN_ROLE[capability];
}

export function isAtLeast(role: MembershipRole, target: MembershipRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[target];
}

export const ROLE_LABELS_FA: Record<MembershipRole, string> = {
  owner: "مالک",
  admin: "مدیر ارشد",
  manager: "مدیر پروژه",
  member: "عضو",
  viewer: "بازدیدکننده",
};

export class ForbiddenError extends Error {
  constructor(message = "شما دسترسی لازم برای انجام این عملیات را ندارید.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function assertCan(role: MembershipRole, capability: Capability) {
  if (!can(role, capability)) {
    throw new ForbiddenError();
  }
}
