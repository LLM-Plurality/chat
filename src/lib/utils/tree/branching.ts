import type { Message } from "$lib/types/Message";

export interface BranchState {
	messageId: string;
	personaId: string;
	personaName: string;
}

/**
 * Creates a linear path of messages from the tree, starting from the root
 * and following the path to the target message (msgId).
 */
export function createMessagesPath<
	T extends { id: string; ancestors?: string[]; children?: string[] },
>(messages: T[], msgId?: string): T[] {
	const msg = messages.find((msg) => msg.id === msgId) ?? messages.at(-1);
	if (!msg) return [];

	const path: T[] = [];

	// Ancestor path
	if (msg.ancestors?.length) {
		for (const ancestorId of msg.ancestors) {
			const ancestor = messages.find((m) => m.id === ancestorId);
			if (ancestor) {
				path.push(ancestor);
			}
		}
	}

	// The node itself
	path.push(msg);

	// Children path (follow last child)
	let childrenIds = msg.children;
	while (childrenIds?.length) {
		const lastChildId = childrenIds.at(-1);
		const lastChild = messages.find((m) => m.id === lastChildId);
		if (lastChild) {
			path.push(lastChild);
			childrenIds = lastChild.children;
		} else {
			break;
		}
	}

	return path;
}

/**
 * Identifies alternative branches for message alternatives toggle.
 * Filters out branches that are explicit multi-persona branches (handled via branch icons).
 */
export function createMessagesAlternatives(messages: Message[]): string[][] {
	const alternatives: string[][] = [];

	for (const message of messages) {
		if (message.children?.length) {
			const branchGroupCounts = new Map<string, number>();

			// Precompute how many children share the same branchedFrom metadata
			for (const childId of message.children) {
				const child = messages.find((m) => m.id === childId);
				if (child?.branchedFrom) {
					const key = `${child.branchedFrom.messageId}:${child.branchedFrom.personaId}`;
					branchGroupCounts.set(key, (branchGroupCounts.get(key) ?? 0) + 1);
				}
			}

			// Filter out children that are branches (have branchedFrom metadata)
			// Branches should only be navigated via branch icons, not alternatives toggle
			const nonBranchChildren = message.children.filter((childId) => {
				const child = messages.find((m) => m.id === childId);
				if (!child?.branchedFrom) {
					return true;
				}

				const branchKey = `${child.branchedFrom.messageId}:${child.branchedFrom.personaId}`;
				const sharedCount = branchGroupCounts.get(branchKey) ?? 0;

				// If multiple messages share the same branch origin (e.g. retries), show them as alternatives
				if (sharedCount > 1) {
					return true;
				}

				return false;
			});

			// Only add to alternatives if there are multiple non-branch children
			if (nonBranchChildren.length > 1) {
				alternatives.push(nonBranchChildren);
			}
		}
	}
	return alternatives;
}

/**
 * Detects the current active branch based on the message history path.
 */
export function detectCurrentBranch(
	msgs: Message[],
	branchState?: BranchState | null,
	personas?: { id: string; name: string }[]
): BranchState | null {
	if (branchState) {
		return branchState;
	}

	// Look at the last message to see if we're in a branch
	const lastMsg = msgs[msgs.length - 1];
	if (lastMsg?.branchedFrom) {
		// We're in a branch - find the persona name
		const persona = personas?.find((p) => p.id === lastMsg.branchedFrom?.personaId);
		return {
			messageId: lastMsg.branchedFrom.messageId,
			personaId: lastMsg.branchedFrom.personaId,
			personaName: persona?.name || lastMsg.branchedFrom.personaId,
		};
	}

	return null;
}

/**
 * Filters the full list of messages to only show those relevant to the current branch context.
 * If no branch is active, returns all messages.
 */
export function filterMessagesByBranch(
	msgs: Message[],
	currentBranch: BranchState | null
): Message[] {
	if (!currentBranch) {
		// No active branch - show all messages
		return msgs;
	}

	// Find all messages that are part of this branch (have matching branchedFrom)
	const branchMessages = msgs.filter(
		(m) =>
			m.branchedFrom?.messageId === currentBranch.messageId &&
			m.branchedFrom?.personaId === currentBranch.personaId
	);

	if (branchMessages.length === 0) {
		// New branch - no messages yet
		// Show all messages up to and including the branch point

		// Find the branch point message
		const branchPoint = msgs.find((m) => m.id === currentBranch.messageId);

		if (!branchPoint) {
			console.warn("⚠️ Branch point not found - showing all messages");
			return msgs;
		}

		// Get ancestors of branch point (messages before it)
		const ancestorIds = branchPoint.ancestors || [];
		const ancestors = msgs.filter((m) => ancestorIds.includes(m.id));

		// Show ancestors + branch point
		const filtered = [...ancestors, branchPoint];
		return filtered;
	}

	// Existing branch - get ancestor IDs from the first branch message
	// These include ALL messages in the history up to the branch point (including nested branches)
	const firstBranchMsg = branchMessages[0];
	const ancestorIds = firstBranchMsg.ancestors || [];

	// Filter to get actual ancestor messages
	const ancestors = msgs.filter((m) => ancestorIds.includes(m.id));

	// Combine ancestors + branch messages for the complete view
	return [...ancestors, ...branchMessages];
}
