import type { MetacognitiveEventType } from "./Message";

export type MetacognitiveConfig = {
	frequencies: number[];
	comprehensionPrompts: string[];
	perspectivePrompts: string[];
	enabled: boolean;
};

export type MetacognitivePromptData = {
	type: MetacognitiveEventType;
	promptText: string;
	triggerFrequency: number;
	suggestedPersonaId?: string;
	suggestedPersonaName?: string;
	messageId?: string;
	linkedMessageId?: string;
};
