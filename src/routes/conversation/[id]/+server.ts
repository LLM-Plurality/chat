import { config } from "$lib/server/config";
import { authCondition, requiresUser } from "$lib/server/auth";
import { collections } from "$lib/server/database";
import { models, validModelIdSchema } from "$lib/server/models";
import { ERROR_MESSAGES } from "$lib/stores/errors";
import type { Message } from "$lib/types/Message";
import { error } from "@sveltejs/kit";
import { ObjectId } from "mongodb";
import { z } from "zod";
import {
	MessageReasoningUpdateType,
	MessageUpdateStatus,
	MessageUpdateType,
	type MessageUpdate,
} from "$lib/types/MessageUpdate";
import { uploadFile } from "$lib/server/files/uploadFile";
import { convertLegacyConversation } from "$lib/utils/tree/convertLegacyConversation";
import { isMessageId } from "$lib/utils/tree/isMessageId";
import { buildSubtree } from "$lib/utils/tree/buildSubtree.js";
import { addChildren } from "$lib/utils/tree/addChildren.js";
import { usageLimits } from "$lib/server/usageLimits";
import { textGeneration } from "$lib/server/textGeneration";
import type { TextGenerationContext } from "$lib/server/textGeneration/types";
import { logger } from "$lib/server/logger.js";
import { getUserHFToken } from "$lib/server/userTokens";

export async function POST({ request, locals, params, getClientAddress }) {
	const id = z.string().parse(params.id);
	const convId = new ObjectId(id);
	const promptedAt = new Date();

	const userId = locals.user?._id ?? locals.sessionId;

	// check user
	if (!userId) {
		error(401, "Unauthorized");
	}

	// check if the user has access to the conversation
	const convBeforeCheck = await collections.conversations.findOne({
		_id: convId,
		...authCondition(locals),
	});

	if (convBeforeCheck && !convBeforeCheck.rootMessageId) {
		const res = await collections.conversations.updateOne(
			{
				_id: convId,
			},
			{
				$set: {
					...convBeforeCheck,
					...convertLegacyConversation(convBeforeCheck),
				},
			}
		);

		if (!res.acknowledged) {
			error(500, "Failed to convert conversation");
		}
	}

	const conv = await collections.conversations.findOne({
		_id: convId,
		...authCondition(locals),
	});

	if (!conv) {
		error(404, "Conversation not found");
	}

	// register the event for ratelimiting
	await collections.messageEvents.insertOne({
		type: "message",
		userId,
		createdAt: new Date(),
		expiresAt: new Date(Date.now() + 60_000),
		ip: getClientAddress(),
	});

	const messagesBeforeLogin = config.MESSAGES_BEFORE_LOGIN
		? parseInt(config.MESSAGES_BEFORE_LOGIN)
		: 0;

	// guest mode check
	if (!locals.user?._id && requiresUser && messagesBeforeLogin) {
		const totalMessages =
			(
				await collections.conversations
					.aggregate([
						{ $match: { ...authCondition(locals), "messages.from": "assistant" } },
						{ $project: { messages: 1 } },
						{ $limit: messagesBeforeLogin + 1 },
						{ $unwind: "$messages" },
						{ $match: { "messages.from": "assistant" } },
						{ $count: "messages" },
					])
					.toArray()
			)[0]?.messages ?? 0;

		if (totalMessages > messagesBeforeLogin) {
			error(429, "Exceeded number of messages before login");
		}
	}
	if (usageLimits?.messagesPerMinute) {
		// check if the user is rate limited
		const nEvents = Math.max(
			await collections.messageEvents.countDocuments({
				userId,
				type: "message",
				expiresAt: { $gt: new Date() },
			}),
			await collections.messageEvents.countDocuments({
				ip: getClientAddress(),
				type: "message",
				expiresAt: { $gt: new Date() },
			})
		);
		if (nEvents > usageLimits.messagesPerMinute) {
			error(429, ERROR_MESSAGES.rateLimited);
		}
	}

	if (usageLimits?.messages && conv.messages.length > usageLimits.messages) {
		error(
			429,
			`This conversation has more than ${usageLimits.messages} messages. Start a new one to continue`
		);
	}

	// fetch the model
	const model = models.find((m) => m.id === conv.model);

	if (!model) {
		error(410, "Model not available anymore");
	}

	const userApiKeyOverride =
		locals.user?._id && locals.user?.authProvider === "huggingface"
			? await getUserHFToken(locals.user._id)
			: null;

	const endpointOptions = userApiKeyOverride ? { apiKey: userApiKeyOverride } : undefined;

	// finally parse the content of the request
	const form = await request.formData();

	const json = form.get("data");

	if (!json || typeof json !== "string") {
		error(400, "Invalid request");
	}

	const {
		inputs: newPrompt,
		id: messageId,
		is_retry: isRetry,
		is_continue: isContinue,
		persona_id: personaId,
		branched_from: branchedFrom,
	} = z
		.object({
			id: z.string().uuid().refine(isMessageId).optional(), // parent message id to append to for a normal message, or the message id for a retry/continue
			inputs: z.optional(
				z
					.string()
					.min(1)
					.transform((s) => s.replace(/\r\n/g, "\n"))
			),
			is_retry: z.optional(z.boolean()),
			is_continue: z.optional(z.boolean()),
			persona_id: z.optional(z.string()), // Optional: specific persona to regenerate
			branched_from: z.optional(
				z.object({
					messageId: z.string(),
					personaId: z.string(),
				})
			), // Optional: branch metadata
			files: z.optional(
				z.array(
					z.object({
						type: z.literal("base64").or(z.literal("hash")),
						name: z.string(),
						value: z.string(),
						mime: z.string(),
					})
				)
			),
		})
		.parse(JSON.parse(json));

	const inputFiles = await Promise.all(
		form
			.getAll("files")
			.filter((entry): entry is File => entry instanceof File && entry.size > 0)
			.map(async (file) => {
				const [type, ...name] = file.name.split(";");

				return {
					type: z.literal("base64").or(z.literal("hash")).parse(type),
					value: await file.text(),
					mime: file.type,
					name: name.join(";"),
				};
			})
	);

	if (usageLimits?.messageLength && (newPrompt?.length ?? 0) > usageLimits.messageLength) {
		error(400, "Message too long.");
	}

	// each file is either:
	// base64 string requiring upload to the server
	// hash pointing to an existing file
	const hashFiles = inputFiles?.filter((file) => file.type === "hash") ?? [];
	const b64Files =
		inputFiles
			?.filter((file) => file.type !== "hash")
			.map((file) => {
				const blob = Buffer.from(file.value, "base64");
				return new File([blob], file.name, { type: file.mime });
			}) ?? [];

	// check sizes
	// todo: make configurable
	if (b64Files.some((file) => file.size > 10 * 1024 * 1024)) {
		error(413, "File too large, should be <10MB");
	}

	const uploadedFiles = await Promise.all(b64Files.map((file) => uploadFile(file, conv))).then(
		(files) => [...files, ...hashFiles]
	);

	// we will append tokens to the content of this message
	let messageToWriteToId: Message["id"] | undefined = undefined;
	// used for building the prompt, subtree of the conversation that goes from the latest message to the root
	let messagesForPrompt: Message[] = [];

	if (isContinue && messageId) {
		// if it's the last message and we continue then we build the prompt up to the last message
		// we will strip the end tokens afterwards when the prompt is built
		if ((conv.messages.find((msg) => msg.id === messageId)?.children?.length ?? 0) > 0) {
			error(400, "Can only continue the last message");
		}
		messageToWriteToId = messageId;
		messagesForPrompt = buildSubtree(conv, messageId);
	} else if (isRetry && messageId) {
		// Two cases:
		// 1. Retrying a user message with newPrompt = editing the user's input
		// 2. Retrying an assistant message = regenerating assistant response(s)

		const messageToRetry = conv.messages.find((message) => message.id === messageId);

		if (!messageToRetry) {
			error(404, "Message not found");
		}

		// Import addSibling for retry logic
		const { addSibling } = await import("$lib/utils/tree/addSibling.js");

		if (messageToRetry.from === "user" && newPrompt) {
			// Editing user message: create sibling with new content, then new assistant response
			const newUserMessageId = addSibling(
				conv,
				{
					from: "user",
					content: newPrompt,
					files: uploadedFiles,
					createdAt: new Date(),
					updatedAt: new Date(),
					// Use branchedFrom from request if exists, otherwise copy from original
					...((branchedFrom || messageToRetry.branchedFrom) && {
						branchedFrom: branchedFrom ?? messageToRetry.branchedFrom,
					}),
				},
				messageId
			);

			// Get the newly created user message to check for branchedFrom
			const newUserMessage = conv.messages.find((m) => m.id === newUserMessageId);

			messageToWriteToId = addChildren(
				conv,
				{
					from: "assistant",
					content: "",
					createdAt: new Date(),
					updatedAt: new Date(),
					// Copy branchedFrom from user message if it exists
					...(newUserMessage?.branchedFrom && {
						branchedFrom: newUserMessage.branchedFrom,
					}),
				},
				newUserMessageId
			);
			messagesForPrompt = buildSubtree(conv, newUserMessageId);
		} else if (messageToRetry.from === "user" && !newPrompt) {
			// Branching from existing user message without editing
			messageToWriteToId = addChildren(
				conv,
				{
					from: "assistant",
					content: "",
					createdAt: new Date(),
					updatedAt: new Date(),
					// Use branchedFrom from request if exists, otherwise copy from original
					...((branchedFrom || messageToRetry.branchedFrom) && {
						branchedFrom: branchedFrom ?? messageToRetry.branchedFrom,
					}),
				},
				messageId
			);
			messagesForPrompt = buildSubtree(conv, messageId);
		} else if (messageToRetry.from === "assistant") {
			// Regenerating assistant response: create new sibling response
			messageToWriteToId = addSibling(
				conv,
				{
					from: "assistant",
					content: "",
					createdAt: new Date(),
					updatedAt: new Date(),
					// Use branchedFrom from request if exists, otherwise copy from original
					...((branchedFrom || messageToRetry.branchedFrom) && {
						branchedFrom: branchedFrom ?? messageToRetry.branchedFrom,
					}),
				},
				messageId
			);
			messagesForPrompt = buildSubtree(conv, messageId);
			messagesForPrompt.pop(); // don't need the old assistant message in the prompt
		} else {
			error(400, "Invalid retry request");
		}
	} else {
		// just a normal linear conversation, so we add the user message
		// and the blank assistant message back to back

		if (conv.messages.length > 0) {
			if (!messageId) {
				error(400, "Parent message ID is required");
			}
			const parent = conv.messages.find((m) => m.id === messageId);
			if (!parent) {
				error(404, "Parent message not found");
			}
		}

		const newUserMessageId = addChildren(
			conv,
			{
				from: "user",
				content: newPrompt ?? "",
				files: uploadedFiles,
				createdAt: new Date(),
				updatedAt: new Date(),
				// Add branchedFrom from request if it exists
				...(branchedFrom && {
					branchedFrom,
				}),
			},
			messageId
		);

		messageToWriteToId = addChildren(
			conv,
			{
				from: "assistant",
				content: "",
				createdAt: new Date(),
				updatedAt: new Date(),
				// Copy branchedFrom from request if it exists
				...(branchedFrom && {
					branchedFrom,
				}),
			},
			newUserMessageId
		);
		// build the prompt from the user message
		messagesForPrompt = buildSubtree(conv, newUserMessageId);
	}

	const messageToWriteTo = conv.messages.find((message) => message.id === messageToWriteToId);
	if (!messageToWriteTo) {
		error(500, "Failed to create message");
	}
	if (messagesForPrompt.length === 0) {
		error(500, "Failed to create prompt");
	}

	// update the conversation with the new messages
	await collections.conversations.updateOne(
		{ _id: convId },
		{ $set: { messages: conv.messages, title: conv.title, updatedAt: new Date() } }
	);

	let doneStreaming = false;
	let clientDetached = false;

	let lastTokenTimestamp: undefined | Date = undefined;

	const persistConversation = async () => {
		await collections.conversations.updateOne(
			{ _id: convId },
			{ $set: { messages: conv.messages, title: conv.title, updatedAt: new Date() } }
		);
	};

	// we now build the stream
	const stream = new ReadableStream({
		async start(controller) {
			messageToWriteTo.updates ??= [];

			// Send immediate "Started" status for optimistic UI feedback
			const startedEvent = {
				type: MessageUpdateType.Status,
				status: MessageUpdateStatus.Started,
				messageId: messageToWriteToId,
			};
			try {
				controller.enqueue(JSON.stringify(startedEvent) + "\n");
			} catch (err) {
				// Client may have disconnected already
			}

			async function update(event: MessageUpdate) {
				if (!messageToWriteTo || !conv) {
					throw Error("No message or conversation to write events to");
				}

				// Add token to content or skip if empty
				if (event.type === MessageUpdateType.Stream) {
					if (event.token === "") return;
					messageToWriteTo.content += event.token;

					if (!lastTokenTimestamp) {
						lastTokenTimestamp = new Date();
					}
					lastTokenTimestamp = new Date();
				} else if (
					event.type === MessageUpdateType.Reasoning &&
					event.subtype === MessageReasoningUpdateType.Stream
				) {
					messageToWriteTo.reasoning ??= "";
					messageToWriteTo.reasoning += event.token;
				}

				// Set the title
				else if (event.type === MessageUpdateType.Title) {
					// Always strip <think> markers from titles when saving
					const sanitizedTitle = event.title.replace(/<\/?think>/gi, "").trim();
					conv.title = sanitizedTitle;
					await collections.conversations.updateOne(
						{ _id: convId },
						{ $set: { title: conv?.title, updatedAt: new Date() } }
					);
				}

				// Set the final text and the interrupted flag
				else if (event.type === MessageUpdateType.FinalAnswer) {
					messageToWriteTo.interrupted = event.interrupted;
					messageToWriteTo.content = initialMessageContent + event.text;
				}

				// Add file
				else if (event.type === MessageUpdateType.File) {
					messageToWriteTo.files = [
						...(messageToWriteTo.files ?? []),
						{ type: "hash", name: event.name, value: event.sha, mime: event.mime },
					];
				}

				// Store router metadata if this is the virtual router (Omni)
				else if (event.type === MessageUpdateType.RouterMetadata) {
					if (model?.isRouter) {
						messageToWriteTo.routerMetadata = {
							route: event.route,
							model: event.model,
						};
					}
				}

				// Append to the persistent message updates if it's not a stream update
				if (
					event.type !== MessageUpdateType.Stream &&
					!(
						event.type === MessageUpdateType.Status &&
						event.status === MessageUpdateStatus.KeepAlive
					) &&
					!(
						event.type === MessageUpdateType.Reasoning &&
						event.subtype === MessageReasoningUpdateType.Stream
					)
				) {
					messageToWriteTo?.updates?.push(event);
				}

				// Avoid remote keylogging attack executed by watching packet lengths
				// by padding the text with null chars to a fixed length
				// https://cdn.arstechnica.net/wp-content/uploads/2024/03/LLM-Side-Channel.pdf
				if (event.type === MessageUpdateType.Stream) {
					event = { ...event, token: event.token.padEnd(16, "\0") };
				}

				messageToWriteTo.updatedAt = new Date();

				const enqueueUpdate = async () => {
					if (clientDetached) return;
					try {
						controller.enqueue(JSON.stringify(event) + "\n");
						if (event.type === MessageUpdateType.FinalAnswer) {
							controller.enqueue(" ".repeat(4096));
						}
					} catch (err) {
						clientDetached = true;
						logger.info(
							{ conversationId: convId.toString() },
							"Client detached during message streaming"
						);
					}
				};

				await enqueueUpdate();

				if (clientDetached) {
					await persistConversation();
				}
			}

			let hasError = false;
			const initialMessageContent = messageToWriteTo.content;

			// Get current persona definition (may have been updated since conversation creation)
			const userSettings = await collections.settings.findOne(authCondition(locals));
			const activePersonaIds = userSettings?.activePersonas ?? [];

			// Get all active personas
			const activePersonas = activePersonaIds
				.map((id) => userSettings?.personas?.find((p) => p.id === id && !p.archived))
				.filter((p): p is import("$lib/types/Persona").Persona => p !== undefined && !p.archived);

			// Determine if we should use multi-persona mode (includes single persona for consistency)
			const useMultiPersona = activePersonas.length >= 1;

			if (!useMultiPersona) {
				// Use current persona prompt (reflects any edits)
				const preprompt = conv.preprompt ?? "";

				// Update conversation's preprompt to reflect current persona
				await collections.conversations.updateOne(
					{ _id: conv._id },
					{ $set: { preprompt, updatedAt: new Date() } }
				);

				// Update conv object with current preprompt
				conv.preprompt = preprompt;

				try {
					const ctx: TextGenerationContext = {
						model,
						endpoint: await model.getEndpoint(endpointOptions),
						conv,
						messages: messagesForPrompt,
						assistant: undefined,
						isContinue: isContinue ?? false,
						promptedAt,
						ip: getClientAddress(),
						username: locals.user?.username,
						authToken: endpointOptions?.apiKey,
						// Force-enable multimodal if user settings say so for this model
						forceMultimodal: Boolean(userSettings?.multimodalOverrides?.[model.id]),
					};
					// run the text generation and send updates to the client
					for await (const event of textGeneration(ctx)) await update(event);
				} catch (e) {
					hasError = true;
					await update({
						type: MessageUpdateType.Status,
						status: MessageUpdateStatus.Error,
						message: (e as Error).message,
					});
					logger.error(e);
				} finally {
					// check if no output was generated
					if (!hasError && messageToWriteTo.content === initialMessageContent) {
						await update({
							type: MessageUpdateType.Status,
							status: MessageUpdateStatus.Error,
							message: "No output was generated. Something went wrong.",
						});
					}
				}
			} else {
				// Multi-persona mode - parallel generation for all active personas
				const { multiPersonaTextGeneration } = await import(
					"$lib/server/textGeneration/multiPersona"
				);
				const { generateTitleForConversation } = await import("$lib/server/textGeneration/title");

				// Check if this is a retry for a specific persona
				const isPersonaRetry = isRetry && personaId;

				// If retrying a specific persona, get the previous message's persona responses
				const previousMessage = isPersonaRetry
					? conv.messages.find((msg) => msg.id === messageId)
					: null;

				// Initialize persona responses structure
				if (isPersonaRetry && previousMessage?.personaResponses) {
					// Copy all previous persona responses
					messageToWriteTo.personaResponses = previousMessage.personaResponses.map((pr) => {
						if (pr.personaId === personaId) {
							// For the persona being regenerated, reset content
							return {
								personaId: pr.personaId,
								personaName: pr.personaName,
								personaOccupation: pr.personaOccupation,
								personaStance: pr.personaStance,
								content: "",
								updates: [],
							};
						} else {
							// Keep other personas' responses as-is
							return { ...pr };
						}
					});
				} else {
					// Normal generation: initialize empty responses for all personas
					messageToWriteTo.personaResponses = activePersonas.map((p) => ({
						personaId: p.id,
						personaName: p.name,
						personaOccupation: p.jobSector,
						personaStance: p.stance,
						content: "",
						updates: [],
					}));
				}

				try {
					// Generate title if needed (do this once, not per-persona)
					if (conv.title === "New Chat") {
						for await (const titleUpdate of generateTitleForConversation(conv, {
							apiKey: endpointOptions?.apiKey,
						})) {
							await update(titleUpdate);
						}
					}

					// Filter out system messages to prevent contamination
					// Each persona will get their own prompt via the preprompt parameter
					const messagesWithoutSystem = messagesForPrompt.filter((msg) => msg.from !== "system");

					const ctx: TextGenerationContext = {
						model,
						endpoint: await model.getEndpoint(endpointOptions),
						conv,
						messages: messagesWithoutSystem,
						assistant: undefined,
						isContinue: isContinue ?? false,
						promptedAt,
						ip: getClientAddress(),
						username: locals.user?.username,
						authToken: endpointOptions?.apiKey,
						forceMultimodal: Boolean(userSettings?.multimodalOverrides?.[model.id]),
					};

					// Determine which personas to generate for
					let personasToGenerate = activePersonas;

					// Check if this is a retry for a specific persona
					if (isPersonaRetry && personaId) {
						const persona = userSettings?.personas?.find((p) => p.id === personaId);
						personasToGenerate = persona ? [persona] : [];
					}
					// Note: branchedFrom is used for message filtering/display, not persona restriction
					// Users can switch personas within a branch by using the persona selector

					// Run multi-persona text generation (preprocessing happens once inside)
					for await (const event of multiPersonaTextGeneration(ctx, personasToGenerate)) {
						// Handle persona-specific updates
						if (event.type === MessageUpdateType.Persona) {
							const personaResponse = messageToWriteTo.personaResponses?.find(
								(pr) => pr.personaId === event.personaId
							);

							if (personaResponse) {
								if (event.updateType === "stream" && event.token) {
									personaResponse.content += event.token;
								} else if (event.updateType === "finalAnswer" && event.text) {
									personaResponse.content = event.text;
									personaResponse.interrupted = event.interrupted;
								} else if (event.updateType === "routerMetadata" && event.route && event.model) {
									personaResponse.routerMetadata = {
										route: event.route,
										model: event.model,
									};
								}
							}
						}

						await update(event);
					}
				} catch (e) {
					hasError = true;
					await update({
						type: MessageUpdateType.Status,
						status: MessageUpdateStatus.Error,
						message: (e as Error).message,
					});
					logger.error(e);
				} finally {
					// Check if at least one persona generated output
					const hasAnyOutput = messageToWriteTo.personaResponses?.some(
						(pr) => pr.content.length > 0
					);
					if (!hasError && !hasAnyOutput) {
						await update({
							type: MessageUpdateType.Status,
							status: MessageUpdateStatus.Error,
							message: "No output was generated from any persona. Something went wrong.",
						});
					}
				}
			}

			await persistConversation();

			// used to detect if cancel() is called bc of interrupt or just because the connection closes
			doneStreaming = true;
			if (!clientDetached) {
				controller.close();
			}
		},
		async cancel() {
			if (doneStreaming) return;
			clientDetached = true;
			await persistConversation();
		},
	});

	// Todo: maybe we should wait for the message to be saved before ending the response - in case of errors
	return new Response(stream, {
		headers: {
			"Content-Type": "application/jsonl",
		},
	});
}

export async function DELETE({ locals, params }) {
	const convId = new ObjectId(params.id);

	const conv = await collections.conversations.findOne({
		_id: convId,
		...authCondition(locals),
	});

	if (!conv) {
		error(404, "Conversation not found");
	}

	await collections.conversations.deleteOne({ _id: conv._id });

	return new Response();
}

export async function PATCH({ request, locals, params }) {
	const values = z
		.object({
			title: z.string().trim().min(1).max(100).optional(),
			model: validModelIdSchema.optional(),
		})
		.parse(await request.json());

	const convId = new ObjectId(params.id);

	const conv = await collections.conversations.findOne({
		_id: convId,
		...authCondition(locals),
	});

	if (!conv) {
		error(404, "Conversation not found");
	}

	// Only include defined values in the update, with title sanitized
	const updateValues = {
		...(values.title !== undefined && { title: values.title.replace(/<\/?think>/gi, "").trim() }),
		...(values.model !== undefined && { model: values.model }),
	};

	await collections.conversations.updateOne(
		{
			_id: convId,
		},
		{
			$set: updateValues,
		}
	);

	return new Response();
}
