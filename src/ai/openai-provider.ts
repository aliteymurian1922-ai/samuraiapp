import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import { buildAiTools } from "@/ai/tools";
import { buildSystemPrompt } from "@/ai/system-prompt";
import type { AIChatParams, AIStreamEvent } from "@/ai/types";

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const MAX_TOOL_ROUNDS = 4;

export function isAiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

function toOpenAiTools(tools: ReturnType<typeof buildAiTools>): ChatCompletionTool[] {
  return Object.entries(tools).map(([name, def]) => ({
    type: "function",
    function: {
      name,
      description: def.description,
      parameters: def.parameters as Record<string, unknown>,
    },
  }));
}

export async function* streamSamuraiChat(params: AIChatParams & { workspaceName: string }): AsyncGenerator<AIStreamEvent> {
  if (!isAiConfigured()) {
    yield {
      type: "error",
      message:
        "برای فعال‌سازی Samurai AI، ابتدا OPENAI_API_KEY را در متغیرهای محیطی تنظیم کنید. سایر بخش‌های سامورایی بدون این کلید کار می‌کنند.",
    };
    return;
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const tools = buildAiTools(params.workspaceId);
  const openAiTools = toOpenAiTools(tools);

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: buildSystemPrompt({ workspaceName: params.workspaceName, userName: params.userId, userRole: params.userRole }) },
    ...params.history.map((m) => ({ role: m.role, content: m.content }) as ChatCompletionMessageParam),
    { role: "user", content: params.userMessage },
  ];

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await client.chat.completions.create({
        model: MODEL,
        messages,
        tools: openAiTools,
        tool_choice: "auto",
        temperature: 0.3,
      });

      const choice = response.choices[0];
      const message = choice.message;

      if (message.tool_calls && message.tool_calls.length > 0) {
        messages.push({ role: "assistant", content: message.content ?? "", tool_calls: message.tool_calls });

        for (const call of message.tool_calls) {
          if (call.type !== "function") continue;
          const toolName = call.function.name as keyof typeof tools;
          const tool = tools[toolName];
          let args: Record<string, unknown> = {};
          try {
            args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
          } catch {
            args = {};
          }

          if (!tool) {
            messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify({ error: "ابزار نامعتبر" }) });
            continue;
          }

          yield { type: "tool-call", name: toolName, args };

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await (tool.run as any)(args);

          if ("terminal" in tool && tool.terminal) {
            yield {
              type: "proposal",
              proposal: {
                type: (result as { type: string }).type as never,
                summary: (result as { summary: string }).summary,
                payload: (result as { payload: Record<string, unknown> }).payload,
              },
            };
            yield { type: "done" };
            return;
          }

          messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result).slice(0, 12000) });
        }
        continue;
      }

      const content = message.content ?? "متأسفم، پاسخی تولید نشد.";
      // Simulate a smooth token stream to the client for a responsive UX.
      const chunkSize = 6;
      for (let i = 0; i < content.length; i += chunkSize) {
        yield { type: "text-delta", delta: content.slice(i, i + chunkSize) };
      }
      yield { type: "done" };
      return;
    }

    yield { type: "text-delta", delta: "پاسخ در تعداد مراحل مجاز کامل نشد. لطفاً سؤال را ساده‌تر مطرح کنید." };
    yield { type: "done" };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[samurai-ai-error]", error);
    yield { type: "error", message: "ارتباط با Samurai AI با خطا مواجه شد. لطفاً دوباره تلاش کنید." };
  }
}
