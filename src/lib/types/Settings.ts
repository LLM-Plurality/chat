import { defaultModel } from "$lib/server/models";
import type { Timestamps } from "./Timestamps";
import type { User } from "./User";
import type { Persona } from "./Persona";
import { DEFAULT_PERSONAS } from "$lib/server/defaultPersonas";

export interface Settings extends Timestamps {
	userId?: User["_id"];
	sessionId?: string;

	shareConversationsWithModelAuthors: boolean;
	/** One-time welcome modal acknowledgement */
	welcomeModalSeenAt?: Date | null;
	activeModel: string;

	// Active personas and user's custom personas
	activePersonas: string[];
	personas: Persona[];

	/**
	 * Per‑model overrides to enable multimodal (image) support
	 * even when not advertised by the provider/model list.
	 * Only the `true` value is meaningful (enables images).
	 */
	multimodalOverrides?: Record<string, boolean>;

	/**
	 * Per-model toggle to hide Omni prompt suggestions shown near the composer.
	 * When set to `true`, prompt examples for that model are suppressed.
	 */
	hidePromptExamples?: Record<string, boolean>;

	disableStream: boolean;
	directPaste: boolean;
}

export type SettingsEditable = Omit<Settings, "welcomeModalSeenAt" | "createdAt" | "updatedAt">;
// TODO: move this to a constant file along with other constants
export const DEFAULT_SETTINGS = {
	shareConversationsWithModelAuthors: true,
	activeModel: defaultModel.id,
	activePersonas: ["dr-robert-zane", "mayor-david-chen", "dr-evelyn-reed", "mr-ben-carter"], // All default personas active on startup
	personas: DEFAULT_PERSONAS.map((p) => ({
		...p,
		archived: p.archived ?? false,
		createdAt: new Date(),
		updatedAt: new Date(),
	})),
	multimodalOverrides: {},
	hidePromptExamples: {},
	disableStream: false,
	directPaste: false,
} satisfies SettingsEditable;
