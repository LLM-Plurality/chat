import { page } from "$app/state";
import { goto } from "$app/navigation";
import { base } from "$app/paths";
import { browser } from "$app/environment";
import superjson from "superjson";
import type { Message, MetacognitiveEvent } from "$lib/types/Message";
import type { MetacognitiveConfig, MetacognitivePromptData } from "$lib/types/Metacognitive";
import { determineMetacognitivePrompt } from "$lib/utils/metacognitiveLogic";

interface MetacognitiveSettings {
	activePersonas?: string[];
	personas?: Array<{ id: string; name?: string }>;
}

interface UseMetacognitiveEngineProps {
	messages: Message[];
	loading: boolean;
	pending: boolean;
	metacognitiveConfig?: MetacognitiveConfig;
	metacognitiveState?: {
		targetFrequency?: number;
		lastPromptedAtMessageId?: string | null;
	};
	userSettings: MetacognitiveSettings;
	onmetacognitivebranch?: (
		messageId: string,
		personaId: string,
		promptData: MetacognitivePromptData
	) => void;
}

export function useMetacognitiveEngine(props: () => UseMetacognitiveEngineProps) {
	let metacognitiveTargetFrequency = $state<number | null>(null);
	let metacognitiveLastPromptedAtMessageId = $state<string | null>(null);
	let metacognitivePromptDismissedForMessageId = $state<string | null>(null);

	let activeMetacognitivePrompt = $state<MetacognitivePromptData | null>(null);
	let lastProcessedMessageId = $state<string | null>(null);
	let promptGenerationTimeout: ReturnType<typeof setTimeout> | undefined = $state();

	// Cache generated prompts to prevent regeneration with different random values
	const promptCache = new Map<string, MetacognitivePromptData | null>();
	let lastMessageCount = 0;

	// Initialize from server state
	$effect(() => {
		const { metacognitiveConfig, metacognitiveState, messages } = props();
		if (!metacognitiveConfig?.enabled) {
			return;
		}
		if (metacognitiveState?.targetFrequency && metacognitiveTargetFrequency === null) {
			metacognitiveTargetFrequency = metacognitiveState.targetFrequency;
		}
		if (
			metacognitiveState?.lastPromptedAtMessageId !== undefined &&
			metacognitiveLastPromptedAtMessageId === null
		) {
			metacognitiveLastPromptedAtMessageId = metacognitiveState.lastPromptedAtMessageId ?? null;
		}

		// Clear cache if messages array was replaced (e.g., navigation to different conversation)
		if (messages.length < lastMessageCount) {
			promptCache.clear();
		}
		lastMessageCount = messages.length;

		// Populate cache from server-loaded events to prevent regeneration
		messages.forEach((msg) => {
			if (msg.from === "assistant" && msg.metacognitiveEvents?.length && !promptCache.has(msg.id)) {
				const event = msg.metacognitiveEvents[msg.metacognitiveEvents.length - 1];
				promptCache.set(msg.id, {
					type: event.type,
					promptText: event.promptText,
					triggerFrequency: event.triggerFrequency,
					suggestedPersonaId: event.suggestedPersonaId,
					suggestedPersonaName: event.suggestedPersonaName,
					messageId: msg.id,
				});
			}
		});
	});

	function persistPromptShownEvent(lastMessage: Message, prompt: MetacognitivePromptData) {
		if (!prompt) return;
		if (lastMessage.from !== "assistant") return;
		if (lastMessage.metacognitiveEvents?.length) return;

		const eventData: MetacognitiveEvent = {
			type: prompt.type,
			promptText: prompt.promptText,
			triggerFrequency: prompt.triggerFrequency,
			suggestedPersonaId: prompt.suggestedPersonaId,
			suggestedPersonaName: prompt.suggestedPersonaName,
			timestamp: new Date(),
			accepted: false,
		};

		// Defensive copy using structuredClone
		const cleanEventData = structuredClone(eventData);

		// Immediately persist locally to prevent race conditions
		lastMessage.metacognitiveEvents = [cleanEventData];
		metacognitiveLastPromptedAtMessageId = lastMessage.id;

		// Ensure cache reflects persisted state
		promptCache.set(lastMessage.id, prompt);

		// Force message update in parent if needed
		if (!browser || !page.params.id) return;

		(async () => {
			try {
				const response = await fetch(
					`${base}/api/v2/conversations/${page.params.id}/message/${lastMessage.id}/metacognitive-event`,
					{
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							type: prompt.type,
							promptText: prompt.promptText,
							triggerFrequency: prompt.triggerFrequency,
							suggestedPersonaId: prompt.suggestedPersonaId,
							suggestedPersonaName: prompt.suggestedPersonaName,
							accepted: false,
						}),
					}
				);

				if (!response.ok) {
					console.error("Failed to log metacognitive prompt shown event:", response.status);
					return;
				}

				const parsed = superjson.parse(await response.text()) as {
					nextTargetFrequency?: number;
				};

				if (parsed.nextTargetFrequency) {
					metacognitiveTargetFrequency = parsed.nextTargetFrequency;
				}
			} catch (e) {
				console.error("Failed to log metacognitive prompt shown event:", e);
			}
		})();
	}

	$effect(() => {
		const { messages, loading, pending, metacognitiveConfig, userSettings } = props();

		if (!metacognitiveConfig?.enabled) {
			activeMetacognitivePrompt = null;
			return;
		}

		const lastMessage = messages[messages.length - 1];

		if (!lastMessage || lastMessage.from !== "assistant") {
			activeMetacognitivePrompt = null;
			if (promptGenerationTimeout) {
				clearTimeout(promptGenerationTimeout);
				promptGenerationTimeout = undefined;
			}
			return;
		}

		if (activeMetacognitivePrompt && activeMetacognitivePrompt.messageId !== lastMessage.id) {
			activeMetacognitivePrompt = null;
		}

		if (loading || pending) {
			if (promptGenerationTimeout) {
				clearTimeout(promptGenerationTimeout);
				promptGenerationTimeout = undefined;
			}
			return;
		}

		if (lastMessage.metacognitiveEvents?.length) {
			lastProcessedMessageId = lastMessage.id;
			return;
		}

		if (lastProcessedMessageId === lastMessage.id) {
			return;
		}

		if (!promptGenerationTimeout) {
			promptGenerationTimeout = setTimeout(() => {
				promptGenerationTimeout = undefined;
				const currentMessages = props().messages;
				const currentLast = currentMessages[currentMessages.length - 1];

				if (!currentLast || currentLast.id !== lastMessage.id) return;
				if (props().loading || props().pending) return;

				lastProcessedMessageId = currentLast.id;
				if (currentLast.metacognitiveEvents?.length) return;

				// Check cache first to ensure immutability
				let prompt = promptCache.get(currentLast.id);
				if (prompt === undefined) {
					// Only generate if not cached
					prompt = determineMetacognitivePrompt(
						currentMessages,
						metacognitiveConfig,
						{
							dismissedForMessageId: metacognitivePromptDismissedForMessageId || undefined,
							targetFrequency: metacognitiveTargetFrequency || undefined,
						},
						{
							activePersonas: userSettings.activePersonas,
							personas: userSettings.personas,
						}
					);
					// Cache the result (even if null) to prevent regeneration
					promptCache.set(currentLast.id, prompt);
				}

				if (prompt && prompt.messageId === currentLast.id) {
					persistPromptShownEvent(currentLast, prompt);
					activeMetacognitivePrompt = prompt;
				} else {
					activeMetacognitivePrompt = null;
				}
			}, 1000);
		}
	});

	function handleMetacognitiveAction(messageId?: string, data?: MetacognitivePromptData) {
		const { messages, onmetacognitivebranch } = props();
		let promptData = data;
		let targetMessageIndex = messages.length - 1;

		if (messageId) {
			const idx = messages.findIndex((m) => m.id === messageId);
			if (idx !== -1) {
				targetMessageIndex = idx;
				const msg = messages[idx];

				if (msg.metacognitiveEvents?.length) {
					const event = msg.metacognitiveEvents.find((e) => e.type === "perspective");
					if (event) {
						event.accepted = true;
						// Trigger update in UI? The object is mutated.
						promptData = {
							type: event.type,
							promptText: event.promptText,
							triggerFrequency: event.triggerFrequency,
							suggestedPersonaId: event.suggestedPersonaId,
							suggestedPersonaName: event.suggestedPersonaName,
							messageId: msg.id,
							linkedMessageId: event.linkedMessageId,
						};
					}
				}
			}
		}

		if (!promptData) {
			if (activeMetacognitivePrompt) {
				if (!messageId || activeMetacognitivePrompt.messageId === messageId) {
					promptData = activeMetacognitivePrompt;
				}
			}
		}

		if (!promptData || promptData.type !== "perspective") {
			return;
		}

		if (promptData.linkedMessageId) {
			const url = new URL(window.location.href);
			url.searchParams.set("msgId", promptData.linkedMessageId);
			url.searchParams.set("scrollTo", "true");
			goto(url.toString(), { replaceState: false, noScroll: true });
			return;
		}

		const targetMessage = messages[targetMessageIndex];
		if (!targetMessage) return;

		let previousUserMessageId: string | null = null;
		for (let i = targetMessageIndex; i >= 0; i--) {
			if (messages[i].from === "user") {
				previousUserMessageId = messages[i].id;
				break;
			}
		}

		if (!previousUserMessageId || !promptData.suggestedPersonaId) {
			return;
		}

		if (targetMessageIndex === messages.length - 1) {
			metacognitivePromptDismissedForMessageId = targetMessage.id;
		}

		onmetacognitivebranch?.(previousUserMessageId, promptData.suggestedPersonaId, promptData);
	}

	return {
		get activeMetacognitivePrompt() {
			return activeMetacognitivePrompt;
		},
		handleMetacognitiveAction,
	};
}
