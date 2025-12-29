/**
 * Metacognitive Prompts Configuration
 *
 * Parses environment variables for metacognitive prompt feature:
 * - METACOGNITIVE_FREQUENCIES: Comma-separated list of integers (e.g., "3,5,10")
 * - METACOGNITIVE_PROMPTS_COMPREHENSION: JSON array of prompt templates
 * - METACOGNITIVE_PROMPTS_PERSPECTIVE: JSON array of prompt templates with {{personaName}} placeholder
 */

import { config } from "./config";
import { logger } from "./logger";

export interface MetacognitiveConfig {
	frequencies: number[];
	comprehensionPrompts: string[];
	perspectivePrompts: string[];
	enabled: boolean;
}

const DEFAULT_FREQUENCIES = [5];
const DEFAULT_COMPREHENSION_PROMPTS = [
	"Is there anything in this response that you do not fully understand? If yes, try asking a follow-up question.",
];
const DEFAULT_PERSPECTIVE_PROMPTS = [
	"Want to know what {{personaName}} thinks about this?",
	"You've been talking with the same persona for a while. Maybe see what {{personaName}} would say?",
];

function parseFrequencies(value: string | undefined): number[] {
	if (!value || value.trim() === "") {
		return DEFAULT_FREQUENCIES;
	}

	try {
		const parsed = value
			.split(",")
			.map((s) => parseInt(s.trim(), 10))
			.filter((n) => !isNaN(n) && n > 0);

		if (parsed.length === 0) {
			logger.warn("METACOGNITIVE_FREQUENCIES parsed to empty array, using defaults");
			return DEFAULT_FREQUENCIES;
		}

		return parsed;
	} catch (e) {
		logger.error(e, "Failed to parse METACOGNITIVE_FREQUENCIES");
		return DEFAULT_FREQUENCIES;
	}
}

function parsePrompts(value: string | undefined, defaults: string[]): string[] {
	if (!value || value.trim() === "") {
		return defaults;
	}

	try {
		const parsed = JSON.parse(value);
		if (Array.isArray(parsed) && parsed.length > 0 && parsed.every((p) => typeof p === "string")) {
			return parsed;
		}
		logger.warn("Parsed prompts not a valid string array, using defaults");
		return defaults;
	} catch (e) {
		logger.error(e, "Failed to parse metacognitive prompts JSON");
		return defaults;
	}
}

let cachedConfig: MetacognitiveConfig | null = null;

export function getMetacognitiveConfig(): MetacognitiveConfig {
	if (cachedConfig) {
		return cachedConfig;
	}

	const frequencies = parseFrequencies(config.METACOGNITIVE_FREQUENCIES);
	const comprehensionPrompts = parsePrompts(
		config.METACOGNITIVE_PROMPTS_COMPREHENSION,
		DEFAULT_COMPREHENSION_PROMPTS
	);
	const perspectivePrompts = parsePrompts(
		config.METACOGNITIVE_PROMPTS_PERSPECTIVE,
		DEFAULT_PERSPECTIVE_PROMPTS
	);

	// Feature is enabled if frequencies are configured (even defaults)
	const enabled = frequencies.length > 0;

	cachedConfig = {
		frequencies,
		comprehensionPrompts,
		perspectivePrompts,
		enabled,
	};

	logger.info(
		{
			frequencies,
			comprehensionPromptsCount: comprehensionPrompts.length,
			perspectivePromptsCount: perspectivePrompts.length,
			enabled,
		},
		"Metacognitive config loaded"
	);

	return cachedConfig;
}

/**
 * Select a random frequency from the configured list
 */
export function selectRandomFrequency(): number {
	const { frequencies } = getMetacognitiveConfig();
	return frequencies[Math.floor(Math.random() * frequencies.length)];
}

/**
 * Select a random comprehension prompt
 */
export function selectComprehensionPrompt(): string {
	const { comprehensionPrompts } = getMetacognitiveConfig();
	return comprehensionPrompts[Math.floor(Math.random() * comprehensionPrompts.length)];
}

/**
 * Select a random perspective prompt and substitute the persona name
 */
export function selectPerspectivePrompt(personaName: string): string {
	const { perspectivePrompts } = getMetacognitiveConfig();
	const template = perspectivePrompts[Math.floor(Math.random() * perspectivePrompts.length)];
	return template.replace(/\{\{personaName\}\}/g, personaName);
}
