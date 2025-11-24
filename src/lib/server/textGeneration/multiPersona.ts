import {
	type MessageUpdate,
	MessageUpdateType,
	MessageUpdateStatus,
	PersonaUpdateType,
	type MessagePersonaUpdate,
} from "$lib/types/MessageUpdate";
import { generate } from "./generate";
import { mergeAsyncGenerators } from "$lib/utils/mergeAsyncGenerators";
import type { TextGenerationContext } from "./types";
import { type Persona, generatePersonaPrompt } from "$lib/types/Persona";
import { logger } from "$lib/server/logger";
import { preprocessMessages } from "../endpoints/preprocessMessages";

/**
 * Generate responses from multiple personas in parallel
 * Each persona gets its own text generation stream
 * Updates are tagged with personaId so the client can route them correctly
 */
export async function* multiPersonaTextGeneration(
	ctx: TextGenerationContext,
	personas: Persona[]
): AsyncGenerator<MessageUpdate, undefined, undefined> {
	if (personas.length === 0) {
		logger.error("multiPersonaTextGeneration called with no personas");
		yield {
			type: MessageUpdateType.Status,
			status: MessageUpdateStatus.Error,
			message: "No personas provided",
		};
		return;
	}

	const { conv, messages } = ctx;
	const convId = conv._id;

	// Notify start
	yield {
		type: MessageUpdateType.Status,
		status: MessageUpdateStatus.Started,
	};

	// Send persona initialization to establish order before streaming
	yield {
		type: MessageUpdateType.PersonaInit,
		personas: personas.map((p) => ({
			personaId: p.id,
			personaName: p.name,
			personaOccupation: p.jobSector,
			personaStance: p.stance,
		})),
	};

	// Preprocess messages ONCE for all personas (performance optimization)
	// This downloads files and prepares messages for the model
	const preprocessedMessages = await preprocessMessages(messages, convId);

	// Create a generator for each persona with preprocessed messages
	const personaGenerators = personas.map((persona) =>
		createPersonaGenerator(ctx, persona, preprocessedMessages)
	);

	// Merge all generators and stream their updates
	yield* mergeAsyncGenerators(personaGenerators);

	// All done
	yield {
		type: MessageUpdateType.Status,
		status: MessageUpdateStatus.Finished,
	};
}

/**
 * Create a text generation stream for a single persona
 * Wraps all updates with persona metadata
 * Each persona sees ALL previous messages (user + all persona responses from past turns)
 */
async function* createPersonaGenerator(
	ctx: TextGenerationContext,
	persona: Persona,
	preprocessedMessages: Awaited<ReturnType<typeof preprocessMessages>>
): AsyncGenerator<MessageUpdate, undefined, undefined> {
	try {
		// Messages are already preprocessed and filtered (system messages removed) from the caller
		// Each persona sees ALL previous messages (user + all persona responses)
		// This allows personas to build on each other's responses from previous turns

		// Generate the persona's prompt from their fields
		const preprompt = generatePersonaPrompt(persona);

		// Generate text for this persona using preprocessed messages
		// Type assertion is safe here because we know messages are preprocessed
		const generateCtx = { ...ctx, messages: preprocessedMessages };
		for await (const update of generate(generateCtx, preprompt)) {
			// Wrap each update with persona information
			yield wrapWithPersona(update, persona);
		}
	} catch (error) {
		logger.error({ error, personaId: persona.id }, "Error in persona text generation");
		yield {
			type: MessageUpdateType.Persona,
			personaId: persona.id,
			personaName: persona.name,
			personaOccupation: persona.jobSector,
			personaStance: persona.stance,
			updateType: PersonaUpdateType.Status,
			error: error instanceof Error ? error.message : "Unknown error",
		} as MessagePersonaUpdate;
	}
}

/**
 * Wraps a standard MessageUpdate with persona metadata
 */
function wrapWithPersona(update: MessageUpdate, persona: Persona): MessageUpdate {
	// Handle different update types and wrap them as persona updates
	if (update.type === MessageUpdateType.Stream) {
		return {
			type: MessageUpdateType.Persona,
			personaId: persona.id,
			personaName: persona.name,
			personaOccupation: persona.jobSector,
			personaStance: persona.stance,
			updateType: PersonaUpdateType.Stream,
			token: update.token,
		} as MessagePersonaUpdate;
	} else if (update.type === MessageUpdateType.FinalAnswer) {
		return {
			type: MessageUpdateType.Persona,
			personaId: persona.id,
			personaName: persona.name,
			personaOccupation: persona.jobSector,
			personaStance: persona.stance,
			updateType: PersonaUpdateType.FinalAnswer,
			text: update.text,
			interrupted: update.interrupted,
		} as MessagePersonaUpdate;
	} else if (update.type === MessageUpdateType.Reasoning) {
		return {
			type: MessageUpdateType.Persona,
			personaId: persona.id,
			personaName: persona.name,
			personaOccupation: persona.jobSector,
			personaStance: persona.stance,
			updateType: PersonaUpdateType.Reasoning,
			status: update.subtype === "status" ? update.status : undefined,
			token: update.subtype === "stream" ? update.token : undefined,
		} as MessagePersonaUpdate;
	} else if (update.type === MessageUpdateType.RouterMetadata) {
		return {
			type: MessageUpdateType.Persona,
			personaId: persona.id,
			personaName: persona.name,
			personaOccupation: persona.jobSector,
			personaStance: persona.stance,
			updateType: PersonaUpdateType.RouterMetadata,
			route: update.route,
			model: update.model,
		} as MessagePersonaUpdate;
	} else if (update.type === MessageUpdateType.Status) {
		// Only pass through error status for individual personas
		if (update.status === MessageUpdateStatus.Error) {
			return {
				type: MessageUpdateType.Persona,
				personaId: persona.id,
				personaName: persona.name,
				personaOccupation: persona.jobSector,
				personaStance: persona.stance,
				updateType: PersonaUpdateType.Status,
				error: update.message,
			} as MessagePersonaUpdate;
		}
		// Filter out other status updates (started, finished, keep-alive)
		// since we handle those at the multi-persona level
		return update;
	}

	// For other update types (Title, File), pass through as-is
	// These are conversation-level, not persona-specific
	return update;
}
