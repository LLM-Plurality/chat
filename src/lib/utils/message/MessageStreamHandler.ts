import {
	MessageReasoningUpdateType,
	MessageUpdateStatus,
	MessageUpdateType,
} from "$lib/types/MessageUpdate";
import { fetchMessageUpdates } from "$lib/utils/messageUpdates";
import { updateDebouncer } from "$lib/utils/updates.js";
import type { WriteMessageContext } from "$lib/types/MessageContext";
import type { ConversationTreeManager } from "./ConversationTreeManager";

export class MessageStreamHandler {
	constructor(
		private ctx: WriteMessageContext,
		private treeManager: ConversationTreeManager
	) {}

	public async handleStream(
		conversationId: string,
		params: {
			base: string;
			prompt?: string;
			messageId?: string;
			isRetry: boolean;
			isContinue: boolean;
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			files?: any[];
			personaId?: string;
		},
		messageToWriteToId: string
	) {
		const messageToWriteTo = this.ctx.messages.find((m) => m.id === messageToWriteToId);
		if (!messageToWriteTo) {
			throw new Error("Message to write to not found");
		}

		const messageUpdatesAbortController = new AbortController();

		const messageUpdatesIterator = await fetchMessageUpdates(
			conversationId,
			{
				base: params.base,
				inputs: params.prompt,
				messageId: params.messageId,
				isRetry: params.isRetry,
				isContinue: params.isContinue,
				files: params.files,
				personaId: params.personaId,
				branchedFrom: this.ctx.branchState
					? {
							messageId: this.ctx.branchState.messageId,
							personaId: this.ctx.branchState.personaId,
						}
					: undefined,
			},
			messageUpdatesAbortController.signal
		).catch((err) => {
			this.ctx.setError(err.message);
		});

		if (messageUpdatesIterator === undefined) return;

		this.ctx.setFiles([]);
		let buffer = "";
		let lastUpdateTime = new Date();

		let reasoningBuffer = "";
		let reasoningLastUpdate = new Date();

		const personaBuffers = new Map<string, string>();
		const personaLastUpdateTimes = new Map<string, Date>();

		for await (const update of messageUpdatesIterator) {
			if (this.ctx.isAborted()) {
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
				const newResponses = update.personas.map((p) => ({
					personaId: p.personaId,
					personaName: p.personaName,
					personaOccupation: p.personaOccupation,
					personaStance: p.personaStance,
					content: "",
				}));

				if (!messageToWriteTo.personaResponses) {
					messageToWriteTo.personaResponses = newResponses;
				} else {
					// Merge with existing personas (preserving those not in the update)
					for (const newRes of newResponses) {
						const existingIdx = messageToWriteTo.personaResponses.findIndex(
							(p) => p.personaId === newRes.personaId
						);
						if (existingIdx !== -1) {
							// Update existing persona in place
							messageToWriteTo.personaResponses[existingIdx] = {
								...messageToWriteTo.personaResponses[existingIdx],
								...newRes,
								content: messageToWriteTo.personaResponses[existingIdx].content || newRes.content,
							};
						} else {
							messageToWriteTo.personaResponses.push(newRes);
						}
					}
				}
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

				if (update.updateType === "stream" && update.token && !this.ctx.settings.disableStream) {
					const personaBuffer = personaBuffers.get(update.personaId) || "";
					const newBuffer = personaBuffer + update.token;
					personaBuffers.set(update.personaId, newBuffer);

					const lastUpdate = personaLastUpdateTimes.get(update.personaId) || new Date(0);
					if (currentTime.getTime() - lastUpdate.getTime() > updateDebouncer.maxUpdateTime) {
						personaResponse.content += newBuffer;
						personaBuffers.set(update.personaId, "");
						personaLastUpdateTimes.set(update.personaId, currentTime);
					}
					this.ctx.setPending(false);
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
			} else if (update.type === MessageUpdateType.Stream && !this.ctx.settings.disableStream) {
				buffer += update.token;
				if (currentTime.getTime() - lastUpdateTime.getTime() > updateDebouncer.maxUpdateTime) {
					messageToWriteTo.content += buffer;
					buffer = "";
					lastUpdateTime = currentTime;
				}
				this.ctx.setPending(false);
			} else if (
				update.type === MessageUpdateType.Status &&
				update.status === MessageUpdateStatus.Error
			) {
				this.ctx.setError(update.message ?? "An error has occurred");
			} else if (
				update.type === MessageUpdateType.Status &&
				update.status === MessageUpdateStatus.Started &&
				update.messageId
			) {
				if (messageToWriteTo.id !== update.messageId) {
					// Use TreeManager to safely update the ID and parent links
					const oldId = messageToWriteTo.id;
					this.treeManager.syncMessageId(oldId, update.messageId);
				}
			} else if (update.type === MessageUpdateType.Title) {
				this.ctx.setTitleUpdate({
					title: update.title,
					convId: conversationId,
				});
				this.ctx.onTitleUpdate?.(update.title);
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
				this.ctx.setPending(false);
			}
		}
	}
}
