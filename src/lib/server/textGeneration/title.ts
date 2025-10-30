import { config } from "$lib/server/config";
import { generateFromDefaultEndpoint } from "$lib/server/generateFromDefaultEndpoint";
import { logger } from "$lib/server/logger";
import { MessageUpdateType, type MessageUpdate } from "$lib/types/MessageUpdate";
import type { Conversation } from "$lib/types/Conversation";
import { getReturnFromGenerator } from "$lib/utils/getReturnFromGenerator";
import { stripThinkBlocks } from "$lib/utils/stripThinkBlocks";

export async function* generateTitleForConversation(
	conv: Conversation,
	opts?: { apiKey?: string }
): AsyncGenerator<MessageUpdate, undefined, undefined> {
	try {
		const userMessage = conv.messages.find((m) => m.from === "user");
		// HACK: detect if the conversation is new
		if (conv.title !== "New Chat" || !userMessage) return;

		const prompt = userMessage.content;
		const modelForTitle = config.TASK_MODEL?.trim() ? config.TASK_MODEL : conv.model;
		const title =
			(await generateTitle(prompt, modelForTitle, { apiKey: opts?.apiKey })) ?? "New Chat";

		yield {
			type: MessageUpdateType.Title,
			title: stripThinkBlocks(title).trim() || "New Chat",
		};
	} catch (cause) {
		logger.error(Error("Failed whilte generating title for conversation", { cause }));
	}
}

export async function generateTitle(prompt: string, modelId?: string, opts?: { apiKey?: string }) {
	if (config.LLM_SUMMARIZATION !== "true") {
		// When summarization is disabled, use the first five words without adding emojis
		const firstFive = prompt.split(/\s+/g).slice(0, 5).join(" ");
		const stripped = stripThinkBlocks(firstFive).trim();
		return stripped || firstFive;
	}

	// Tools removed: no tool-based title path

	return await getReturnFromGenerator(
		generateFromDefaultEndpoint({
			messages: [{ from: "user", content: `Prompt to summarize: "${prompt}"` }],
			preprompt: `You are a titling assistant.
Summarize the user's request into a short title of at most 4 words.
Use the SAME language as the user's message.
Do not answer the question.
Do not include the word prompt into your response.
Do not include quotes, emojis, hashtags or trailing punctuation.
Return ONLY the title text.`,
			generateSettings: {
				max_tokens: 30,
			},
			modelId,
			apiKey: opts?.apiKey,
		})
	)
		.then((summary) => {
			const firstFive = prompt.split(/\s+/g).slice(0, 5).join(" ");
			const trimmed = stripThinkBlocks(String(summary ?? "")).trim();
			// Fallback: if empty, return first five words only (no emoji)
			return trimmed || stripThinkBlocks(firstFive).trim() || firstFive;
		})
		.catch((e) => {
			logger.error(e);
			const firstFive = prompt.split(/\s+/g).slice(0, 5).join(" ");
			return stripThinkBlocks(firstFive).trim() || firstFive;
		});
}
