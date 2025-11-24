import { goto, invalidate } from "$app/navigation";
import { base } from "$app/paths";
import { tick } from "svelte";
import { type Message, MessageRole } from "$lib/types/Message";
import {
	MessageReasoningUpdateType,
	MessageUpdateStatus,
	MessageUpdateType,
} from "$lib/types/MessageUpdate";
import { UrlDependency } from "$lib/types/UrlDependency";
import file2base64 from "$lib/utils/file2base64";
import { fetchMessageUpdates } from "$lib/utils/messageUpdates";
import { addChildren } from "$lib/utils/tree/addChildren";
import { addSibling } from "$lib/utils/tree/addSibling";
import { updateDebouncer } from "$lib/utils/updates.js";
import type { v4 } from "uuid";
import { ERROR_MESSAGES } from "$lib/stores/errors";

export interface WriteMessageContext {
	page: { params: { id: string } };
	messages: Message[];
	messagesPath: Message[];
	data: { rootMessageId: string };
	files: File[];
	settings: {
		disableStream: boolean;
		personas?: Array<{ id: string; name: string }>;
	};
	isAborted: () => boolean;
	branchState: {
		messageId: string;
		personaId: string;
		personaName: string;
	} | null;

	setLoading: (val: boolean) => void;
	setPending: (val: boolean) => void;
	setFiles: (val: File[]) => void;
	setError: (val: string) => void;
	setIsAborted: (val: boolean) => void;
	setTitleUpdate: (val: { title: string; convId: string }) => void;
	onTitleUpdate?: (title: string) => void;
	onMessageCreated?: (id: string) => void;
	updateBranchState: (val: unknown) => void;
	invalidate: typeof invalidate;
	goto: typeof goto;
}

export interface WriteMessageParams {
	prompt?: string;
	messageId?: ReturnType<typeof v4>;
	isRetry?: boolean;
	isContinue?: boolean;
	personaId?: string;
}

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

	let navigateToMessageId: string | null = null;

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

		let messageToWriteToId: Message["id"] | undefined = undefined;

		if (isContinue && messageId) {
			if ((ctx.messages.find((msg) => msg.id === messageId)?.children?.length ?? 0) > 0) {
				ctx.setError("Can only continue the last message");
			} else {
				messageToWriteToId = messageId;
			}
		} else if (isRetry && messageId) {
			const messageToRetry = ctx.messages.find((message) => message.id === messageId);

			if (!messageToRetry) {
				ctx.setError("Message not found");
			}

			if (messageToRetry?.from === MessageRole.User && prompt) {
				const newUserMessageId = addSibling(
					{
						messages: ctx.messages,
						rootMessageId: ctx.data.rootMessageId,
					},
					{
						from: MessageRole.User,
						content: prompt,
						files: messageToRetry.files,
						...(messageToRetry.branchedFrom && {
							branchedFrom: messageToRetry.branchedFrom,
						}),
					},
					messageId
				);
				messageToWriteToId = addChildren(
					{
						messages: ctx.messages,
						rootMessageId: ctx.data.rootMessageId,
					},
					{
						from: MessageRole.Assistant,
						content: "",
						personaResponses: [],
						...(messageToRetry.branchedFrom && {
							branchedFrom: messageToRetry.branchedFrom,
						}),
					},
					newUserMessageId
				);

				if (messageToRetry.branchedFrom) {
					const persona = ctx.settings.personas?.find(
						(p) => p.id === messageToRetry.branchedFrom?.personaId
					);
					ctx.updateBranchState({
						messageId: messageToRetry.branchedFrom.messageId,
						personaId: messageToRetry.branchedFrom.personaId,
						personaName: persona?.name || messageToRetry.branchedFrom.personaId,
					});
					navigateToMessageId = newUserMessageId;
				}

				ctx.onMessageCreated?.(messageToWriteToId);
			} else if (messageToRetry?.from === MessageRole.Assistant) {
				messageToWriteToId = addSibling(
					{
						messages: ctx.messages,
						rootMessageId: ctx.data.rootMessageId,
					},
					{
						from: MessageRole.Assistant,
						content: "",
						personaResponses: [],
						...(messageToRetry.branchedFrom && {
							branchedFrom: messageToRetry.branchedFrom,
						}),
					},
					messageId
				);

				if (messageToRetry.branchedFrom) {
					const persona = ctx.settings.personas?.find(
						(p) => p.id === messageToRetry.branchedFrom?.personaId
					);
					ctx.updateBranchState({
						messageId: messageToRetry.branchedFrom.messageId,
						personaId: messageToRetry.branchedFrom.personaId,
						personaName: persona?.name || messageToRetry.branchedFrom.personaId,
					});
					navigateToMessageId = messageToWriteToId;
				}
				ctx.onMessageCreated?.(messageToWriteToId);
			}
		} else {
			const newUserMessageId = addChildren(
				{
					messages: ctx.messages,
					rootMessageId: ctx.data.rootMessageId,
				},
				{
					from: MessageRole.User,
					content: prompt ?? "",
					files: base64Files,
					...(ctx.branchState && {
						branchedFrom: {
							messageId: ctx.branchState.messageId,
							personaId: ctx.branchState.personaId,
						},
					}),
				},
				messageId
			);

			if (!ctx.data.rootMessageId) {
				ctx.data.rootMessageId = newUserMessageId;
			}

			messageToWriteToId = addChildren(
				{
					messages: ctx.messages,
					rootMessageId: ctx.data.rootMessageId,
				},
				{
					from: MessageRole.Assistant,
					content: "",
					personaResponses: [],
					...(ctx.branchState && {
						branchedFrom: {
							messageId: ctx.branchState.messageId,
							personaId: ctx.branchState.personaId,
						},
					}),
				},
				newUserMessageId
			);

			ctx.onMessageCreated?.(messageToWriteToId);
		}

		const userMessage = ctx.messages.find((message) => message.id === messageId);
		const messageToWriteTo = ctx.messages.find((message) => message.id === messageToWriteToId);
		if (!messageToWriteTo) {
			throw new Error("Message to write to not found");
		}

		const messageUpdatesAbortController = new AbortController();

		const messageUpdatesIterator = await fetchMessageUpdates(
			conversationId,
			{
				base,
				inputs: prompt,
				messageId,
				isRetry,
				isContinue,
				files: isRetry ? userMessage?.files : base64Files,
				personaId,
				branchedFrom: ctx.branchState
					? {
							messageId: ctx.branchState.messageId,
							personaId: ctx.branchState.personaId,
						}
					: undefined,
			},
			messageUpdatesAbortController.signal
		).catch((err) => {
			ctx.setError(err.message);
		});
		if (messageUpdatesIterator === undefined) return;

		ctx.setFiles([]);
		let buffer = "";
		let lastUpdateTime = new Date();

		let reasoningBuffer = "";
		let reasoningLastUpdate = new Date();

		const personaBuffers = new Map<string, string>();
		const personaLastUpdateTimes = new Map<string, Date>();

		for await (const update of messageUpdatesIterator) {
			if (ctx.isAborted()) {
				messageUpdatesAbortController.abort();
				return;
			}

			if (update.type === MessageUpdateType.Stream) {
				update.token = update.token.replaceAll("\0", "");
			}

			const isHighFrequencyUpdate =
				(update.type === MessageUpdateType.Reasoning &&
					update.subtype === MessageReasoningUpdateType.Stream) ||
				update.type === MessageUpdateType.Stream ||
				update.type === MessageUpdateType.Persona ||
				(update.type === MessageUpdateType.Status &&
					update.status === MessageUpdateStatus.KeepAlive);

			if (!isHighFrequencyUpdate) {
				messageToWriteTo.updates = [...(messageToWriteTo.updates ?? []), update];
			}
			const currentTime = new Date();

			if (update.type === MessageUpdateType.PersonaInit) {
				messageToWriteTo.personaResponses = update.personas.map((p) => ({
					personaId: p.personaId,
					personaName: p.personaName,
					personaOccupation: p.personaOccupation,
					personaStance: p.personaStance,
					content: "",
				}));
			} else if (update.type === MessageUpdateType.Persona) {
				if (!messageToWriteTo.personaResponses) {
					messageToWriteTo.personaResponses = [];
				}

				let personaResponse = messageToWriteTo.personaResponses.find(
					(pr) => pr.personaId === update.personaId
				);
				if (!personaResponse) {
					personaResponse = {
						personaId: update.personaId,
						personaName: update.personaName,
						personaOccupation: update.personaOccupation,
						personaStance: update.personaStance,
						content: "",
					};
					messageToWriteTo.personaResponses.push(personaResponse);
				}

				if (update.updateType === "stream" && update.token && !ctx.settings.disableStream) {
					const personaBuffer = personaBuffers.get(update.personaId) || "";
					const newBuffer = personaBuffer + update.token;
					personaBuffers.set(update.personaId, newBuffer);

					const lastUpdate = personaLastUpdateTimes.get(update.personaId) || new Date(0);
					if (currentTime.getTime() - lastUpdate.getTime() > updateDebouncer.maxUpdateTime) {
						personaResponse.content += newBuffer;
						personaBuffers.set(update.personaId, "");
						personaLastUpdateTimes.set(update.personaId, currentTime);
					}
					ctx.setPending(false);
				} else if (update.updateType === "finalAnswer" && update.text) {
					personaResponse.content = update.text;
					personaResponse.interrupted = update.interrupted;
				} else if (update.updateType === "routerMetadata" && update.route && update.model) {
					personaResponse.routerMetadata = {
						route: update.route,
						model: update.model,
					};
				} else if (update.updateType === "status" && update.error) {
					personaResponse.interrupted = true;
					personaResponse.content = personaResponse.content || `Error: ${update.error}`;
				}
			} else if (update.type === MessageUpdateType.Stream && !ctx.settings.disableStream) {
				buffer += update.token;
				if (currentTime.getTime() - lastUpdateTime.getTime() > updateDebouncer.maxUpdateTime) {
					messageToWriteTo.content += buffer;
					buffer = "";
					lastUpdateTime = currentTime;
				}
				ctx.setPending(false);
			} else if (
				update.type === MessageUpdateType.Status &&
				update.status === MessageUpdateStatus.Error
			) {
				ctx.setError(update.message ?? "An error has occurred");
			} else if (update.type === MessageUpdateType.Title) {
				ctx.setTitleUpdate({
					title: update.title,
					convId: conversationId,
				});
				ctx.onTitleUpdate?.(update.title);
			} else if (update.type === MessageUpdateType.File) {
				messageToWriteTo.files = [
					...(messageToWriteTo.files ?? []),
					{ type: "hash", value: update.sha, mime: update.mime, name: update.name },
				];
			} else if (update.type === MessageUpdateType.Reasoning) {
				if (!messageToWriteTo.reasoning) {
					messageToWriteTo.reasoning = "";
				}
				if (update.subtype === MessageReasoningUpdateType.Stream) {
					reasoningBuffer += update.token;
					if (
						currentTime.getTime() - reasoningLastUpdate.getTime() >
						updateDebouncer.maxUpdateTime
					) {
						messageToWriteTo.reasoning += reasoningBuffer;
						reasoningBuffer = "";
						reasoningLastUpdate = currentTime;
					}
				}
			} else if (update.type === MessageUpdateType.RouterMetadata) {
				messageToWriteTo.routerMetadata = {
					route: update.route,
					model: update.model,
				};
			} else if (update.type === MessageUpdateType.FinalAnswer) {
				messageToWriteTo.content = update.text;
				messageToWriteTo.interrupted = update.interrupted;
				ctx.setPending(false);
			}
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

		if (navigateToMessageId) {
			await tick();
			const url = new URL(window.location.href);
			url.searchParams.set("msgId", navigateToMessageId);
			url.searchParams.set("scrollTo", "true");
			await ctx.goto(url.toString(), { replaceState: false, noScroll: true });
		}
	}
}
