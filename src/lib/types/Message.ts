import type { MessageUpdate } from "./MessageUpdate";
import type { Timestamps } from "./Timestamps";
import type { v4 } from "uuid";

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

export type Message = Partial<Timestamps> & {
	from: "user" | "assistant" | "system";
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

	// Multi-persona responses (when multiple personas are active)
	personaResponses?: PersonaResponse[];

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
