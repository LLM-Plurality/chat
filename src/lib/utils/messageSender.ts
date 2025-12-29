import { tick } from "svelte";
import { UrlDependency } from "$lib/types/UrlDependency";
import file2base64 from "$lib/utils/file2base64";
import { ERROR_MESSAGES } from "$lib/stores/errors";
import type { WriteMessageContext, WriteMessageParams } from "$lib/types/MessageContext";
import { ConversationTreeManager } from "./message/ConversationTreeManager";
import { MessageStreamHandler } from "./message/MessageStreamHandler";
import { base } from "$app/paths";

export type { WriteMessageContext, WriteMessageParams };

export async function writeMessage(
	ctx: WriteMessageContext,
	params: WriteMessageParams
): Promise<void> {
	const {
		prompt,
		messageId = ctx.messagesPath.at(-1)?.id ?? undefined,
		isRetry = false,
		isContinue = false,
		personaId,
	} = params;

	const conversationId = ctx.page.params.id;
	if (!conversationId) {
		console.error("No conversation ID available");
		return;
	}

	const treeManager = new ConversationTreeManager(ctx);
	const streamHandler = new MessageStreamHandler(ctx, treeManager);

	try {
		ctx.setIsAborted(false);
		ctx.setLoading(true);
		ctx.setPending(true);

		const base64Files = await Promise.all(
			(ctx.files ?? []).map((file) =>
				file2base64(file).then((value) => ({
					type: "base64" as const,
					value,
					mime: file.type,
					name: file.name,
				}))
			)
		);

		const { messageToWriteToId, navigateToMessageId } = treeManager.prepareMessageForWrite(
			params,
			base64Files
		);
		const userMessage = ctx.messages.find((message) => message.id === messageId);

		await streamHandler.handleStream(
			conversationId,
			{
				base,
				prompt,
				messageId,
				isRetry,
				isContinue,
				files: isRetry ? userMessage?.files : base64Files,
				personaId,
			},
			messageToWriteToId
		);

		if (navigateToMessageId) {
			await tick();
			const url = new URL(window.location.href);
			url.searchParams.set("msgId", navigateToMessageId);
			url.searchParams.set("scrollTo", "true");
			await ctx.goto(url.toString(), { replaceState: false, noScroll: true });
		}
	} catch (err) {
		if (err instanceof Error && err.message.includes("overloaded")) {
			ctx.setError("Too much traffic, please try again.");
		} else if (err instanceof Error && err.message.includes("429")) {
			ctx.setError(ERROR_MESSAGES.rateLimited);
		} else if (err instanceof Error) {
			ctx.setError(err.message);
		} else {
			ctx.setError(ERROR_MESSAGES.default);
		}
		console.error(err);
	} finally {
		await ctx.invalidate(UrlDependency.Conversation);
		await ctx.invalidate(UrlDependency.ConversationList);

		ctx.setLoading(false);
		ctx.setPending(false);
	}
}
