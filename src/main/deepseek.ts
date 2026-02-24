import { DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL } from "./constants";

export type DeepseekMessage = { role: "system" | "user" | "assistant"; content: string };
export type DeepseekChatRequest = {
  messages: DeepseekMessage[];
  model?: "deepseek-chat" | "deepseek-reasoner";
  max_tokens?: number;
};

export async function deepseekChat(req: DeepseekChatRequest): Promise<{ content: string }> {
  const model = req.model ?? "deepseek-reasoner";

  const res = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: req.messages,
      stream: false,
      max_tokens: req.max_tokens ?? 2048,
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`DeepSeek error ${res.status}: ${txt}`);
  }

  const data = (await res.json()) as any;
  const content = data?.choices?.[0]?.message?.content ?? "";
  return { content };
}