import type { Message } from "$lib/types/Message";
import type { MetacognitiveConfig, MetacognitivePromptData } from "$lib/types/Metacognitive";

type DetermineState = {
	/**
	 * If the user dismissed a prompt for a particular message, never show again for that message.
	 */
	dismissedForMessageId?: string;
	/**
	 * Target frequency (in assistant messages) for when to show the next prompt.
	 */
	targetFrequency?: number;
	/**
	 * The ID of the message that most recently triggered a metacognitive prompt (globally).
	 * This helps handle cases where the prompt was on a sibling branch not visible in the current path.
	 */
	lastPromptedAtMessageId?: string;
};

type PersonaContext = {
	/**
	 * Active persona IDs from user settings (if any).
	 */
	activePersonas?: string[];
	/**
	 * Persona definitions from user settings (if any).
	 */
	personas?: Array<{ id: string; name?: string }>;
};

function pickRandom<T>(arr: readonly T[]): T | undefined {
	if (!arr.length) return undefined;
	return arr[Math.floor(Math.random() * arr.length)];
}

function getLastShownMetacognitiveIndex(
	messages: readonly Message[],
	lastPromptedAtMessageId?: string
): number {
	for (let i = messages.length - 1; i >= 0; i--) {
		const msg = messages[i];

		// Reset on messages with metacognitive events
		const events = msg.metacognitiveEvents;
		if (events && events.length > 0) return i;

		// Reset on multi-persona messages (more than 1 persona response)
		if (msg.personaResponses && msg.personaResponses.length > 1) {
			return i;
		}

		// Reset if this message matches the global last prompted ID
		if (lastPromptedAtMessageId && msg.id === lastPromptedAtMessageId) {
			return i;
		}

		// Check if a child of this message (a sibling of the next message in path) was the one prompted.
		// If 'lastPromptedAtMessageId' is in 'msg.children', then 'msg' is the parent of the prompted message.
		// The prompt occurred effectively "at" this junction.
		if (lastPromptedAtMessageId && msg.children?.includes(lastPromptedAtMessageId)) {
			return i;
		}
	}
	return -1;
}

/**
 * Checks if a sibling message (same parent) already has an ACCEPTED "perspective" metacognitive prompt.
 * This prevents suggesting "Want to know what X thinks?" if the user just clicked "Want to know what Y thinks?"
 * and we are now on the Y branch, but the X branch (sibling) had that prompt accepted.
 */
function hasSiblingWithMetacognitiveEvent(
	messages: readonly Message[],
	currentMessage: Message
): boolean {
	const parentId = currentMessage.ancestors?.at(-1);
	if (!parentId) return false;

	// Find parent message
	const parent = messages.find((m) => m.id === parentId);
	if (!parent || !parent.children) return false;

	// Check all siblings (children of same parent, excluding self)
	for (const childId of parent.children) {
		if (childId === currentMessage.id) continue;

		const sibling = messages.find((m) => m.id === childId);
		if (sibling?.metacognitiveEvents?.some((e) => e.type === "perspective" && e.accepted)) {
			return true;
		}
	}

	return false;
}

function countAssistantMessagesAfterIndex(
	messages: readonly Message[],
	idxExclusive: number
): number {
	let count = 0;
	for (let i = idxExclusive + 1; i < messages.length; i++) {
		if (messages[i]?.from === "assistant") count++;
	}
	return count;
}

function getCurrentAssistantPersonaId(message: Message): string | undefined {
	// If the assistant message has exactly one persona response, treat that as the "current" persona.
	if (message.personaResponses && message.personaResponses.length === 1) {
		return message.personaResponses[0]?.personaId;
	}
	return undefined;
}

function pickSuggestedPersona(
	currentPersonaId: string | undefined,
	context: PersonaContext
): { id: string; name: string } | undefined {
	const personas = context.personas ?? [];
	const activeIds = new Set(context.activePersonas ?? []);

	// Select from all personas MINUS the active set (and minus current speaker just in case)
	const candidates = personas.filter((p) => {
		if (!p.id) return false;
		if (activeIds.has(p.id)) return false;
		if (currentPersonaId && p.id === currentPersonaId) return false;
		return true;
	});

	const chosen = pickRandom(candidates);
	if (!chosen) return undefined;
	return { id: chosen.id, name: chosen.name ?? chosen.id };
}

function renderPerspectivePrompt(template: string, personaName: string): string {
	// Use a function replacer so personaName is inserted literally (no `$&`, `$1`, `$`` expansions).
	return template.replace(/\{\{personaName\}\}/g, () => personaName);
}

/**
 * Determine whether a metacognitive prompt should be shown for the current (last) assistant message,
 * and if so, which prompt to show.
 *
 * This function is intentionally pure: it derives the decision from the passed-in messages/config/state.
 */
export function determineMetacognitivePrompt(
	messages: readonly Message[],
	config: MetacognitiveConfig | undefined,
	state: DetermineState | undefined,
	context: PersonaContext | undefined
): MetacognitivePromptData | null {
	if (!config?.enabled) return null;

	const targetFrequency = state?.targetFrequency;
	if (!targetFrequency || !Number.isFinite(targetFrequency) || targetFrequency <= 0) return null;

	const lastMessage = messages[messages.length - 1];
	if (!lastMessage || lastMessage.from !== "assistant") return null;
	if (lastMessage.metacognitiveEvents?.length) return null;
	if (state?.dismissedForMessageId && state.dismissedForMessageId === lastMessage.id) return null;

	// Check if a sibling already triggered a perspective prompt (meaning this branch is the result of one)
	if (hasSiblingWithMetacognitiveEvent(messages, lastMessage)) {
		return null;
	}

	// Frequency gate: only show on the Nth assistant message since the last "shown" event OR multi-persona reset.
	// We pass lastPromptedAtMessageId to account for prompts shown on sibling branches (which we might not see in 'messages', but whose parent we see).
	const lastShownIdx = getLastShownMetacognitiveIndex(messages, state?.lastPromptedAtMessageId);
	const assistantSinceLastShown = countAssistantMessagesAfterIndex(messages, lastShownIdx);

	if (assistantSinceLastShown < targetFrequency) return null;

	// Determine available prompt types
	const currentPersonaId = getCurrentAssistantPersonaId(lastMessage);
	const suggestedPersona = pickSuggestedPersona(currentPersonaId, context ?? {});

	const options: Array<() => MetacognitivePromptData> = [];

	// Option 1: Perspective Prompts (requires a suggested persona)
	if (suggestedPersona && config.perspectivePrompts?.length) {
		const prompts = config.perspectivePrompts;
		options.push(() => {
			const template = pickRandom(prompts) ?? "Want to know what {{personaName}} thinks?";
			return {
				type: "perspective",
				promptText: renderPerspectivePrompt(template, suggestedPersona.name),
				triggerFrequency: targetFrequency,
				suggestedPersonaId: suggestedPersona.id,
				suggestedPersonaName: suggestedPersona.name,
				messageId: lastMessage.id,
			};
		});
	}

	// Option 2: Comprehension Prompts
	if (config.comprehensionPrompts?.length) {
		const prompts = config.comprehensionPrompts;
		options.push(() => {
			const promptText =
				pickRandom(prompts) ??
				"Is there anything in this response that you do not fully understand?";
			return {
				type: "comprehension",
				promptText,
				triggerFrequency: targetFrequency,
				messageId: lastMessage.id,
			};
		});
	}

	// Randomly pick one of the available options
	const chosenOption = pickRandom(options);
	if (!chosenOption) return null;

	return chosenOption();
}
