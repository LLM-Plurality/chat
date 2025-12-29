import type { Message, MessageFile } from "$lib/types/Message";
import { MessageRole } from "$lib/types/Message";
import { addChildren } from "$lib/utils/tree/addChildren";
import { addSibling } from "$lib/utils/tree/addSibling";
import type { WriteMessageContext, WriteMessageParams } from "$lib/types/MessageContext";

export class ConversationTreeManager {
	constructor(private ctx: WriteMessageContext) {}

	public prepareMessageForWrite(
		params: WriteMessageParams,
		base64Files: MessageFile[] = []
	): {
		messageToWriteToId: string;
		navigateToMessageId: string | null;
	} {
		const {
			prompt,
			messageId = this.ctx.messagesPath.at(-1)?.id ?? undefined,
			isRetry = false,
			isContinue = false,
			personaId,
		} = params;

		let messageToWriteToId: string | undefined;
		let navigateToMessageId: string | null = null;

		if (isContinue && messageId) {
			const msg = this.ctx.messages.find((m) => m.id === messageId);
			if ((msg?.children?.length ?? 0) > 0) {
				throw new Error("Can only continue the last message");
			}
			messageToWriteToId = messageId;
		} else if (isRetry && messageId) {
			const messageToRetry = this.ctx.messages.find((m) => m.id === messageId);
			if (!messageToRetry) {
				throw new Error("Message not found");
			}

			if (messageToRetry.from === MessageRole.User && prompt !== undefined) {
				const newUserMessageId = addSibling(
					{
						messages: this.ctx.messages,
						rootMessageId: this.ctx.data.rootMessageId,
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

				const targetPersonaId =
					this.ctx.branchState?.personaId || messageToRetry.branchedFrom?.personaId;
				const initialResponses: Message["personaResponses"] = [];
				if (targetPersonaId) {
					const persona = this.ctx.settings.personas?.find((p) => p.id === targetPersonaId);
					initialResponses.push({
						personaId: targetPersonaId,
						personaName: this.ctx.branchState?.personaName || persona?.name || targetPersonaId,
						content: "",
					});
				}

				messageToWriteToId = addChildren(
					{
						messages: this.ctx.messages,
						rootMessageId: this.ctx.data.rootMessageId,
					},
					{
						from: MessageRole.Assistant,
						content: "",
						personaResponses: initialResponses,
						...((this.ctx.branchState || messageToRetry.branchedFrom) && {
							branchedFrom: this.ctx.branchState
								? {
										messageId: this.ctx.branchState.messageId,
										personaId: this.ctx.branchState.personaId,
									}
								: messageToRetry.branchedFrom,
						}),
					},
					newUserMessageId
				);

				if (messageToRetry.branchedFrom && !this.ctx.branchState) {
					const persona = this.ctx.settings.personas?.find(
						(p) => p.id === messageToRetry.branchedFrom?.personaId
					);
					this.ctx.updateBranchState({
						messageId: messageToRetry.branchedFrom.messageId,
						personaId: messageToRetry.branchedFrom.personaId,
						personaName: persona?.name || messageToRetry.branchedFrom.personaId,
					});
					navigateToMessageId = newUserMessageId;
				}
				this.ctx.onMessageCreated?.(messageToWriteToId);
			} else if (messageToRetry.from === MessageRole.User && prompt === undefined) {
				messageToWriteToId = addChildren(
					{
						messages: this.ctx.messages,
						rootMessageId: this.ctx.data.rootMessageId,
					},
					{
						from: MessageRole.Assistant,
						content: "",
						personaResponses: [],
						...(this.ctx.branchState && {
							branchedFrom: {
								messageId: this.ctx.branchState.messageId,
								personaId: this.ctx.branchState.personaId,
							},
						}),
					},
					messageId
				);
				navigateToMessageId = messageToWriteToId;
				this.ctx.onMessageCreated?.(messageToWriteToId);
			} else if (messageToRetry.from === MessageRole.Assistant) {
				let initialPersonaResponses: Message["personaResponses"] = [];
				if (personaId && messageToRetry.personaResponses) {
					initialPersonaResponses = messageToRetry.personaResponses.map((p) => {
						if (p.personaId === personaId) {
							return {
								...p,
								content: "",
								interrupted: undefined,
								reasoning: undefined,
								updates: undefined,
								routerMetadata: undefined,
							};
						}
						// Defensive copy using structuredClone
						return structuredClone(p);
					});
				}

				messageToWriteToId = addSibling(
					{
						messages: this.ctx.messages,
						rootMessageId: this.ctx.data.rootMessageId,
					},
					{
						from: MessageRole.Assistant,
						content: "",
						personaResponses: initialPersonaResponses,
						...((this.ctx.branchState || messageToRetry.branchedFrom) && {
							branchedFrom: this.ctx.branchState
								? {
										messageId: this.ctx.branchState.messageId,
										personaId: this.ctx.branchState.personaId,
									}
								: messageToRetry.branchedFrom,
						}),
					},
					messageId
				);

				if (messageToRetry.branchedFrom && !this.ctx.branchState) {
					const persona = this.ctx.settings.personas?.find(
						(p) => p.id === messageToRetry.branchedFrom?.personaId
					);
					this.ctx.updateBranchState({
						messageId: messageToRetry.branchedFrom.messageId,
						personaId: messageToRetry.branchedFrom.personaId,
						personaName: persona?.name || messageToRetry.branchedFrom.personaId,
					});
					navigateToMessageId = messageToWriteToId;
				}
				this.ctx.onMessageCreated?.(messageToWriteToId);
			}
		} else {
			// New message
			const newUserMessageId = addChildren(
				{
					messages: this.ctx.messages,
					rootMessageId: this.ctx.data.rootMessageId,
				},
				{
					from: MessageRole.User,
					content: prompt ?? "",
					files: base64Files,
					...(this.ctx.branchState && {
						branchedFrom: {
							messageId: this.ctx.branchState.messageId,
							personaId: this.ctx.branchState.personaId,
						},
					}),
				},
				messageId
			);

			if (!this.ctx.data.rootMessageId) {
				this.ctx.data.rootMessageId = newUserMessageId;
			}

			messageToWriteToId = addChildren(
				{
					messages: this.ctx.messages,
					rootMessageId: this.ctx.data.rootMessageId,
				},
				{
					from: MessageRole.Assistant,
					content: "",
					personaResponses: [],
					...(this.ctx.branchState && {
						branchedFrom: {
							messageId: this.ctx.branchState.messageId,
							personaId: this.ctx.branchState.personaId,
						},
					}),
				},
				newUserMessageId
			);

			this.ctx.onMessageCreated?.(messageToWriteToId);
		}

		if (!messageToWriteToId) {
			throw new Error("Failed to determine message ID to write to");
		}

		return { messageToWriteToId, navigateToMessageId };
	}

	/**
	 * Safely updates a message ID in the tree, ensuring parent linkage is maintained.
	 */
	public syncMessageId(oldId: string, newId: string): void {
		const message = this.ctx.messages.find((m) => m.id === oldId || m.id === newId);
		if (!message) return;

		// If ID is already updated, just return
		if (message.id === newId) return;

		message.id = newId;

		if (message.ancestors && message.ancestors.length > 0) {
			const parentId = message.ancestors[message.ancestors.length - 1];
			const parent = this.ctx.messages.find((m) => m.id === parentId);

			if (parent) {
				if (!parent.children) parent.children = [];

				const childIndex = parent.children.indexOf(oldId);
				if (childIndex !== -1) {
					parent.children[childIndex] = newId;
				} else {
					// Fallback: append if not found
					console.warn(
						`[TreeManager] Parent ${parentId} missing child ${oldId}, appending ${newId}`
					);
					parent.children.push(newId);
				}
			} else {
				console.error(
					`[TreeManager] Parent ${parentId} not found for message ${oldId} -> ${newId}`
				);
			}
		}

		console.debug(`[TreeManager] Synced message ID: ${oldId} -> ${newId}`);
	}
}
