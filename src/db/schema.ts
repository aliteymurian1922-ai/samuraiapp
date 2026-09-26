import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  bigint,
  real,
  boolean,
  jsonb,
  primaryKey,
  index,
  uniqueIndex,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
export const membershipRoleEnum = pgEnum("membership_role", [
  "owner",
  "admin",
  "manager",
  "member",
  "viewer",
]);

export const projectStatusEnum = pgEnum("project_status", [
  "active",
  "on_hold",
  "completed",
  "archived",
]);

export const priorityEnum = pgEnum("priority_level", [
  "critical",
  "high",
  "medium",
  "low",
]);

export const dependencyTypeEnum = pgEnum("dependency_type", ["blocks", "blocked_by"]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "assignment",
  "mention",
  "comment",
  "due_date",
  "overdue",
  "project_update",
  "ai_alert",
  "system",
]);

export const notificationPriorityEnum = pgEnum("notification_priority", [
  "critical",
  "important",
  "low",
]);

export const aiRoleEnum = pgEnum("ai_role", ["system", "user", "assistant", "tool"]);

export const meetingParticipantStatusEnum = pgEnum("meeting_participant_status", [
  "invited",
  "accepted",
  "declined",
  "attended",
]);

export const crmLeadStatusEnum = pgEnum("crm_lead_status", [
  "new",
  "contacted",
  "qualified",
  "unqualified",
  "converted",
]);

export const crmDealStatusEnum = pgEnum("crm_deal_status", [
  "open",
  "won",
  "lost",
]);

export const crmActivityTypeEnum = pgEnum("crm_activity_type", [
  "call",
  "message",
  "email",
  "meeting",
  "note",
  "task",
]);

// ---------------------------------------------------------------------------
// Users & Auth
// ---------------------------------------------------------------------------
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 120 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  avatarColor: varchar("avatar_color", { length: 20 }).default("#4f46e5"),
  locale: varchar("locale", { length: 10 }).default("fa"),
  timezone: varchar("timezone", { length: 60 }).default("Asia/Tehran"),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("users_email_idx").on(t.email)]);

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 255 }).notNull(),
  userAgent: varchar("user_agent", { length: 255 }),
  ip: varchar("ip", { length: 64 }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("sessions_token_hash_idx").on(t.tokenHash),
  index("sessions_user_id_idx").on(t.userId),
]);

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 255 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("password_reset_token_hash_idx").on(t.tokenHash)]);

// ---------------------------------------------------------------------------
// Workspaces & Membership
// ---------------------------------------------------------------------------
export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 120 }).notNull(),
  slug: varchar("slug", { length: 140 }).notNull(),
  teamType: varchar("team_type", { length: 40 }).default("software"),
  logoColor: varchar("logo_color", { length: 20 }).default("#4338ca"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("workspaces_slug_idx").on(t.slug)]);

export const memberships = pgTable("memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: membershipRoleEnum("role").notNull().default("member"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("memberships_workspace_user_idx").on(t.workspaceId, t.userId),
  index("memberships_user_idx").on(t.userId),
]);

// ---------------------------------------------------------------------------
// CRM
// ---------------------------------------------------------------------------
export const crmCompanies = pgTable("crm_companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 180 }).notNull(),
  industry: varchar("industry", { length: 120 }),
  website: varchar("website", { length: 300 }),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 255 }),
  ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("crm_companies_workspace_idx").on(t.workspaceId),
  index("crm_companies_owner_idx").on(t.ownerId),
]);

export const crmContacts = pgTable("crm_contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  companyId: uuid("company_id").references(() => crmCompanies.id, { onDelete: "set null" }),
  name: varchar("name", { length: 160 }).notNull(),
  jobTitle: varchar("job_title", { length: 120 }),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 255 }),
  ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
  source: varchar("source", { length: 80 }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("crm_contacts_workspace_idx").on(t.workspaceId),
  index("crm_contacts_company_idx").on(t.companyId),
  index("crm_contacts_owner_idx").on(t.ownerId),
]);

export const crmLeads = pgTable("crm_leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 160 }).notNull(),
  companyName: varchar("company_name", { length: 180 }),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 255 }),
  source: varchar("source", { length: 80 }),
  status: crmLeadStatusEnum("status").notNull().default("new"),
  estimatedValue: bigint("estimated_value", { mode: "number" }),
  ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
  notes: text("notes"),
  convertedAt: timestamp("converted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("crm_leads_workspace_idx").on(t.workspaceId),
  index("crm_leads_status_idx").on(t.workspaceId, t.status),
  index("crm_leads_owner_idx").on(t.ownerId),
]);

export const crmPipelines = pgTable("crm_pipelines", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("crm_pipelines_workspace_idx").on(t.workspaceId),
]);

export const crmPipelineStages = pgTable("crm_pipeline_stages", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  pipelineId: uuid("pipeline_id").notNull().references(() => crmPipelines.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  color: varchar("color", { length: 20 }).default("#94a3b8"),
  position: integer("position").notNull().default(0),
  probability: integer("probability").notNull().default(0),
  isWon: boolean("is_won").notNull().default(false),
  isLost: boolean("is_lost").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("crm_pipeline_stages_pipeline_idx").on(t.pipelineId, t.position),
  uniqueIndex("crm_pipeline_stages_position_idx").on(t.pipelineId, t.position),
]);

export const crmDeals = pgTable("crm_deals", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  pipelineId: uuid("pipeline_id").notNull().references(() => crmPipelines.id, { onDelete: "cascade" }),
  stageId: uuid("stage_id").notNull().references(() => crmPipelineStages.id, { onDelete: "restrict" }),
  companyId: uuid("company_id").references(() => crmCompanies.id, { onDelete: "set null" }),
  contactId: uuid("contact_id").references(() => crmContacts.id, { onDelete: "set null" }),
  title: varchar("title", { length: 200 }).notNull(),
  value: bigint("value", { mode: "number" }).notNull().default(0),
  status: crmDealStatusEnum("status").notNull().default("open"),
  ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
  source: varchar("source", { length: 80 }),
  expectedCloseAt: timestamp("expected_close_at", { withTimezone: true }),
  lostReason: varchar("lost_reason", { length: 300 }),
  wonAt: timestamp("won_at", { withTimezone: true }),
  lostAt: timestamp("lost_at", { withTimezone: true }),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("crm_deals_workspace_idx").on(t.workspaceId),
  index("crm_deals_pipeline_stage_idx").on(t.pipelineId, t.stageId),
  index("crm_deals_owner_idx").on(t.ownerId),
  index("crm_deals_company_idx").on(t.companyId),
  index("crm_deals_contact_idx").on(t.contactId),
]);

export const crmProducts = pgTable("crm_products", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 180 }).notNull(),
  sku: varchar("sku", { length: 80 }),
  unitPrice: bigint("unit_price", { mode: "number" }).notNull().default(0),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("crm_products_workspace_idx").on(t.workspaceId),
  uniqueIndex("crm_products_workspace_sku_idx").on(t.workspaceId, t.sku),
]);

export const crmDealProducts = pgTable("crm_deal_products", {
  dealId: uuid("deal_id").notNull().references(() => crmDeals.id, { onDelete: "cascade" }),
  productId: uuid("product_id").notNull().references(() => crmProducts.id, { onDelete: "restrict" }),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: bigint("unit_price", { mode: "number" }).notNull().default(0),
}, (t) => [
  primaryKey({ columns: [t.dealId, t.productId] }),
  index("crm_deal_products_product_idx").on(t.productId),
]);

export const crmActivities = pgTable("crm_activities", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  companyId: uuid("company_id").references(() => crmCompanies.id, { onDelete: "cascade" }),
  contactId: uuid("contact_id").references(() => crmContacts.id, { onDelete: "cascade" }),
  leadId: uuid("lead_id").references(() => crmLeads.id, { onDelete: "cascade" }),
  dealId: uuid("deal_id").references(() => crmDeals.id, { onDelete: "cascade" }),
  type: crmActivityTypeEnum("type").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  note: text("note"),
  dueAt: timestamp("due_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  assignedTo: uuid("assigned_to").references(() => users.id, { onDelete: "set null" }),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("crm_activities_workspace_idx").on(t.workspaceId, t.createdAt),
  index("crm_activities_deal_idx").on(t.dealId),
  index("crm_activities_lead_idx").on(t.leadId),
  index("crm_activities_contact_idx").on(t.contactId),
]);

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------
export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 160 }).notNull(),
  description: text("description"),
  status: projectStatusEnum("status").notNull().default("active"),
  priority: priorityEnum("priority").notNull().default("medium"),
  color: varchar("color", { length: 20 }).default("#4f46e5"),
  startDate: timestamp("start_date", { withTimezone: true }),
  dueDate: timestamp("due_date", { withTimezone: true }),
  progress: integer("progress").notNull().default(0),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("projects_workspace_idx").on(t.workspaceId),
  index("projects_status_idx").on(t.workspaceId, t.status),
]);

export const projectMembers = pgTable("project_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  isOwner: boolean("is_owner").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("project_members_unique_idx").on(t.projectId, t.userId)]);

export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 60 }).notNull(),
  color: varchar("color", { length: 20 }).default("#6366f1"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("tags_workspace_name_idx").on(t.workspaceId, t.name)]);

// ---------------------------------------------------------------------------
// Task Statuses (customizable per project)
// ---------------------------------------------------------------------------
export const taskStatuses = pgTable("task_statuses", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 60 }).notNull(),
  color: varchar("color", { length: 20 }).default("#94a3b8"),
  order: integer("order").notNull().default(0),
  isDone: boolean("is_done").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("task_statuses_project_idx").on(t.projectId)]);

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------
export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  statusId: uuid("status_id").notNull().references(() => taskStatuses.id, { onDelete: "restrict" }),
  parentTaskId: uuid("parent_task_id"),
  title: varchar("title", { length: 220 }).notNull(),
  description: text("description"),
  priority: priorityEnum("priority").notNull().default("medium"),
  assigneeId: uuid("assignee_id").references(() => users.id, { onDelete: "set null" }),
  creatorId: uuid("creator_id").references(() => users.id, { onDelete: "set null" }),
  startDate: timestamp("start_date", { withTimezone: true }),
  dueDate: timestamp("due_date", { withTimezone: true }),
  estimatedMinutes: integer("estimated_minutes"),
  actualMinutes: integer("actual_minutes").notNull().default(0),
  position: real("position").notNull().default(0),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("tasks_project_idx").on(t.projectId),
  index("tasks_status_idx").on(t.statusId),
  index("tasks_assignee_idx").on(t.assigneeId),
  index("tasks_workspace_idx").on(t.workspaceId),
  index("tasks_parent_idx").on(t.parentTaskId),
  index("tasks_due_date_idx").on(t.dueDate),
]);

export const taskDependencies = pgTable("task_dependencies", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  dependsOnTaskId: uuid("depends_on_task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  type: dependencyTypeEnum("type").notNull().default("blocked_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("task_dependencies_unique_idx").on(t.taskId, t.dependsOnTaskId)]);

export const taskTags = pgTable("task_tags", {
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  tagId: uuid("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.taskId, t.tagId] })]);

export const checklistItems = pgTable("checklist_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 220 }).notNull(),
  isDone: boolean("is_done").notNull().default(false),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("checklist_items_task_idx").on(t.taskId)]);

// ---------------------------------------------------------------------------
// Comments & Attachments
// ---------------------------------------------------------------------------
export const comments = pgTable("comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
  authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
  parentCommentId: uuid("parent_comment_id"),
  body: text("body").notNull(),
  mentions: jsonb("mentions").$type<string[]>().default([]),
  editedAt: timestamp("edited_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("comments_task_idx").on(t.taskId),
  index("comments_project_idx").on(t.projectId),
]);

export const attachments = pgTable("attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
  uploaderId: uuid("uploader_id").references(() => users.id, { onDelete: "set null" }),
  fileName: varchar("file_name", { length: 200 }).notNull(),
  fileUrl: text("file_url").notNull(),
  fileType: varchar("file_type", { length: 80 }),
  fileSize: integer("file_size"),
  provider: varchar("provider", { length: 40 }).notNull().default("external_link"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("attachments_task_idx").on(t.taskId),
  index("attachments_project_idx").on(t.projectId),
]);

// ---------------------------------------------------------------------------
// Time Tracking
// ---------------------------------------------------------------------------
export const timeEntries = pgTable("time_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  durationMinutes: integer("duration_minutes"),
  note: varchar("note", { length: 300 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("time_entries_task_idx").on(t.taskId),
  index("time_entries_user_idx").on(t.userId),
]);

// ---------------------------------------------------------------------------
// Meetings
// ---------------------------------------------------------------------------
export const meetings = pgTable("meetings", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  title: varchar("title", { length: 200 }).notNull(),
  agenda: text("agenda"),
  notes: text("notes"),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }).notNull(),
  location: varchar("location", { length: 200 }),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("meetings_workspace_idx").on(t.workspaceId),
  index("meetings_start_idx").on(t.startTime),
]);

export const meetingParticipants = pgTable("meeting_participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  meetingId: uuid("meeting_id").notNull().references(() => meetings.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: meetingParticipantStatusEnum("status").notNull().default("invited"),
}, (t) => [uniqueIndex("meeting_participants_unique_idx").on(t.meetingId, t.userId)]);

export const actionItems = pgTable("action_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  meetingId: uuid("meeting_id").notNull().references(() => meetings.id, { onDelete: "cascade" }),
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
  title: varchar("title", { length: 220 }).notNull(),
  assigneeId: uuid("assignee_id").references(() => users.id, { onDelete: "set null" }),
  dueDate: timestamp("due_date", { withTimezone: true }),
  isDone: boolean("is_done").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("action_items_meeting_idx").on(t.meetingId)]);

// ---------------------------------------------------------------------------
// Notifications, Activity, Audit
// ---------------------------------------------------------------------------
export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: notificationTypeEnum("type").notNull(),
  priority: notificationPriorityEnum("priority").notNull().default("important"),
  title: varchar("title", { length: 200 }).notNull(),
  body: text("body"),
  link: varchar("link", { length: 300 }),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("notifications_user_idx").on(t.userId, t.isRead),
  index("notifications_workspace_idx").on(t.workspaceId),
]);

export const activities = pgTable("activities", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
  type: varchar("type", { length: 60 }).notNull(),
  entityType: varchar("entity_type", { length: 40 }).notNull(),
  entityId: uuid("entity_id"),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }),
  message: varchar("message", { length: 400 }).notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("activities_workspace_idx").on(t.workspaceId, t.createdAt),
  index("activities_project_idx").on(t.projectId),
]);

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
  actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
  action: varchar("action", { length: 80 }).notNull(),
  entityType: varchar("entity_type", { length: 40 }).notNull(),
  entityId: uuid("entity_id"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  ip: varchar("ip", { length: 64 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("audit_logs_workspace_idx").on(t.workspaceId, t.createdAt)]);

// ---------------------------------------------------------------------------
// AI
// ---------------------------------------------------------------------------
export const aiConversations = pgTable("ai_conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 200 }).default("گفتگوی جدید"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("ai_conversations_user_idx").on(t.userId)]);

export const aiMessages = pgTable("ai_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").notNull().references(() => aiConversations.id, { onDelete: "cascade" }),
  role: aiRoleEnum("role").notNull(),
  content: text("content").notNull(),
  toolCalls: jsonb("tool_calls").$type<Record<string, unknown>[]>().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("ai_messages_conversation_idx").on(t.conversationId)]);

export const aiInsights = pgTable("ai_insights", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 40 }).notNull(),
  severity: varchar("severity", { length: 20 }).notNull().default("info"),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description").notNull(),
  data: jsonb("data").$type<Record<string, unknown>>().default({}),
  dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("ai_insights_workspace_idx").on(t.workspaceId, t.createdAt)]);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------
export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(memberships),
  sessions: many(sessions),
}));

export const workspacesRelations = relations(workspaces, ({ many }) => ({
  memberships: many(memberships),
  projects: many(projects),
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
  workspace: one(workspaces, { fields: [memberships.workspaceId], references: [workspaces.id] }),
  user: one(users, { fields: [memberships.userId], references: [users.id] }),
}));

export const crmCompaniesRelations = relations(crmCompanies, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [crmCompanies.workspaceId], references: [workspaces.id] }),
  owner: one(users, { fields: [crmCompanies.ownerId], references: [users.id] }),
  contacts: many(crmContacts),
  deals: many(crmDeals),
}));

export const crmContactsRelations = relations(crmContacts, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [crmContacts.workspaceId], references: [workspaces.id] }),
  company: one(crmCompanies, { fields: [crmContacts.companyId], references: [crmCompanies.id] }),
  owner: one(users, { fields: [crmContacts.ownerId], references: [users.id] }),
  deals: many(crmDeals),
}));

export const crmPipelinesRelations = relations(crmPipelines, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [crmPipelines.workspaceId], references: [workspaces.id] }),
  stages: many(crmPipelineStages),
  deals: many(crmDeals),
}));

export const crmPipelineStagesRelations = relations(crmPipelineStages, ({ one, many }) => ({
  pipeline: one(crmPipelines, { fields: [crmPipelineStages.pipelineId], references: [crmPipelines.id] }),
  deals: many(crmDeals),
}));

export const crmProductsRelations = relations(crmProducts, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [crmProducts.workspaceId], references: [workspaces.id] }),
  dealProducts: many(crmDealProducts),
}));

export const crmDealProductsRelations = relations(crmDealProducts, ({ one }) => ({
  deal: one(crmDeals, { fields: [crmDealProducts.dealId], references: [crmDeals.id] }),
  product: one(crmProducts, { fields: [crmDealProducts.productId], references: [crmProducts.id] }),
}));

export const crmDealsRelations = relations(crmDeals, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [crmDeals.workspaceId], references: [workspaces.id] }),
  pipeline: one(crmPipelines, { fields: [crmDeals.pipelineId], references: [crmPipelines.id] }),
  stage: one(crmPipelineStages, { fields: [crmDeals.stageId], references: [crmPipelineStages.id] }),
  company: one(crmCompanies, { fields: [crmDeals.companyId], references: [crmCompanies.id] }),
  contact: one(crmContacts, { fields: [crmDeals.contactId], references: [crmContacts.id] }),
  owner: one(users, { fields: [crmDeals.ownerId], references: [users.id] }),
  activities: many(crmActivities),
  products: many(crmDealProducts),
}));

export const projectsRelations = relations(projects, ({ many, one }) => ({
  workspace: one(workspaces, { fields: [projects.workspaceId], references: [workspaces.id] }),
  members: many(projectMembers),
  tasks: many(tasks),
  statuses: many(taskStatuses),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, { fields: [tasks.projectId], references: [projects.id] }),
  status: one(taskStatuses, { fields: [tasks.statusId], references: [taskStatuses.id] }),
  assignee: one(users, { fields: [tasks.assigneeId], references: [users.id] }),
  comments: many(comments),
  attachments: many(attachments),
  checklistItems: many(checklistItems),
}));

export const taskStatusesRelations = relations(taskStatuses, ({ one, many }) => ({
  project: one(projects, { fields: [taskStatuses.projectId], references: [projects.id] }),
  tasks: many(tasks),
}));
