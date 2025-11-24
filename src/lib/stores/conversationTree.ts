import { writable } from "svelte/store";
import type { Message } from "$lib/types/Message";

interface ConversationTreeState {
	conversationId: string | null;
	messages: Message[];
	activeMessageId: string | null; // Currently displayed message
	branchedFrom: { messageId: string; personaId: string } | null;
	activePath: string[]; // Linear path of message IDs visible in chat
}

const initialState: ConversationTreeState = {
	conversationId: null,
	messages: [],
	activeMessageId: null,
	branchedFrom: null,
	activePath: [],
};

export const conversationTree = writable<ConversationTreeState>(initialState);

export function setConversationTree(
	conversationId: string,
	messages: Message[],
	activeMessageId?: string,
	branchedFrom?: { messageId: string; personaId: string } | null,
	activePath: string[] = []
) {
	conversationTree.set({
		conversationId,
		messages,
		activeMessageId: activeMessageId ?? null,
		branchedFrom: branchedFrom ?? null,
		activePath,
	});
}

export function clearConversationTree() {
	conversationTree.set(initialState);
}
