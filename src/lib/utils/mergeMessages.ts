import type { Message } from "$lib/types/Message";

/**
 * Merges server messages with local optimistic messages to preserve streaming content
 * while updating structure/IDs from the server.
 */
export function mergeMessages(serverMessages: Message[], localMessages: Message[]): Message[] {
	if (serverMessages.length === 0) return localMessages;
	if (localMessages.length === 0) return serverMessages;

	const lastServerMsg = serverMessages[serverMessages.length - 1];
	const lastLocalMsg = localMessages[localMessages.length - 1];

	// Check if they look like the same message (same role)
	if (lastServerMsg.from === lastLocalMsg.from) {
		// If server content is empty/short but local is long, keep local content
		if ((lastServerMsg.content?.length || 0) < (lastLocalMsg.content?.length || 0)) {
			const newLastServerMsg = { ...lastServerMsg };

			// Adopt server ID but keep local content
			newLastServerMsg.content = lastLocalMsg.content;
			newLastServerMsg.reasoning = lastLocalMsg.reasoning;

			// Merge persona responses
			if (lastLocalMsg.personaResponses?.length && !lastServerMsg.personaResponses?.length) {
				newLastServerMsg.personaResponses = lastLocalMsg.personaResponses;
			} else if (lastLocalMsg.personaResponses && lastServerMsg.personaResponses) {
				newLastServerMsg.personaResponses = lastServerMsg.personaResponses.map((sPR) => {
					const lPR = lastLocalMsg.personaResponses?.find((l) => l.personaId === sPR.personaId);
					if (lPR && lPR.content.length > sPR.content.length) {
						return { ...sPR, content: lPR.content };
					}
					return sPR;
				});
			}

			// Return new array with replaced last message
			return [...serverMessages.slice(0, -1), newLastServerMsg];
		}
	}

	return serverMessages;
}
