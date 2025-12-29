import type { MessageUpdate } from "./MessageUpdate";
import type { Timestamps } from "./Timestamps";
import type { v4 } from "uuid";

export type MetacognitiveEventType = "comprehension" | "perspective";

export type MetacognitiveEvent = {
	type: MetacognitiveEventType;
	promptText: string;
	triggerFrequency: number;
	timestamp: Date;
	suggestedPersonaId?: string;
	suggestedPersonaName?: string;
	accepted: boolean;
	linkedMessageId?: string;
};

export type PersonaResponse = {
	personaId: string;
	personaName: string;
	personaOccupation?: string;
	personaStance?: string;
	content: string;
	reasoning?: string;
	updates?: MessageUpdate[];
	interrupted?: boolean;
	routerMetadata?: {
		route: string;
		model: string;
	};
	// Track alternative versions of this persona's response
	children?: PersonaResponse[];
	currentChildIndex?: number;
};

export const MessageRole = {
	User: "user",
	Assistant: "assistant",
	System: "system",
} as const;

export type MessageRole = (typeof MessageRole)[keyof typeof MessageRole];

export type Message = Partial<Timestamps> & {
	from: MessageRole;
	id: ReturnType<typeof v4>;
	content: string;
	updates?: MessageUpdate[];

	reasoning?: string;
	score?: -1 | 0 | 1;
	/**
	 * Either contains the base64 encoded image data
	 * or the hash of the file stored on the server
	 **/
	files?: MessageFile[];
	interrupted?: boolean;

	// Router metadata when using llm-router
	routerMetadata?: {
		route: string;
		model: string;
	};

	// Multi-persona responses
	personaResponses?: PersonaResponse[];

	// Branch metadata
	branchedFrom?: {
		messageId: Message["id"];
		personaId: string;
	};

	// Metacognitive prompt events
	metacognitiveEvents?: MetacognitiveEvent[];

	// needed for conversation trees
	ancestors?: Message["id"][];

	// goes one level deep
	children?: Message["id"][];
};

export type MessageFile = {
	type: "hash" | "base64";
	name: string;
	value: string;
	mime: string;
};
