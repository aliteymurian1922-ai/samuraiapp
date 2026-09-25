export type ChatRole = "system" | "user" | "assistant" | "tool";

export type ChatMessage = {
  role: ChatRole;
  content: string;
  name?: string;
  toolCallId?: string;
};

export type ActionProposalType = "create_project" | "create_tasks" | "create_meeting";

export type ActionProposal = {
  type: ActionProposalType;
  summary: string;
  payload: Record<string, unknown>;
};

export type AIStreamEvent =
  | { type: "text-delta"; delta: string }
  | { type: "tool-call"; name: string; args: Record<string, unknown> }
  | { type: "proposal"; proposal: ActionProposal }
  | { type: "done" }
  | { type: "error"; message: string };

export type AIChatParams = {
  workspaceId: string;
  userId: string;
  userRole: string;
  history: ChatMessage[];
  userMessage: string;
};
