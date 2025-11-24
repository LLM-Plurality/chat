import { browser } from "$app/environment";

export interface BranchStateSnapshot {
	messageId: string;
	personaId: string;
	personaName: string;
}

export interface BranchTrackingSnapshot {
	messageId: string | null;
	personaId: string | null;
}

const BRANCH_STATE_PREFIX = "branchState_";
const BRANCH_TRACKING_PREFIX = "branchTracking_";

function getBranchStateKey(conversationId: string): string {
	return `${BRANCH_STATE_PREFIX}${conversationId}`;
}

function getBranchTrackingKey(conversationId: string): string {
	return `${BRANCH_TRACKING_PREFIX}${conversationId}`;
}

export function loadBranchState(conversationId: string): BranchStateSnapshot | null {
	if (!browser) return null;
	const stored = localStorage.getItem(getBranchStateKey(conversationId));
	if (!stored) return null;
	try {
		return JSON.parse(stored) as BranchStateSnapshot;
	} catch {
		localStorage.removeItem(getBranchStateKey(conversationId));
		return null;
	}
}

export function persistBranchState(
	conversationId: string,
	state: BranchStateSnapshot | null
): void {
	if (!browser) return;
	const key = getBranchStateKey(conversationId);
	if (state) {
		localStorage.setItem(key, JSON.stringify(state));
	} else {
		localStorage.removeItem(key);
	}
}

export function loadBranchTracking(conversationId: string): BranchTrackingSnapshot {
	if (!browser) return { messageId: null, personaId: null };
	const stored = localStorage.getItem(getBranchTrackingKey(conversationId));
	if (!stored) return { messageId: null, personaId: null };
	try {
		const parsed = JSON.parse(stored) as BranchTrackingSnapshot;
		return {
			messageId: parsed.messageId ?? null,
			personaId: parsed.personaId ?? null,
		};
	} catch {
		localStorage.removeItem(getBranchTrackingKey(conversationId));
		return { messageId: null, personaId: null };
	}
}

export function persistBranchTracking(
	conversationId: string,
	tracking: BranchTrackingSnapshot | null
): void {
	if (!browser) return;
	const key = getBranchTrackingKey(conversationId);
	if (tracking && (tracking.messageId || tracking.personaId)) {
		localStorage.setItem(key, JSON.stringify(tracking));
	} else {
		localStorage.removeItem(key);
	}
}
