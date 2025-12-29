import { describe, test, expect } from "vitest";
import type { Message } from "$lib/types/Message";
import type { MetacognitiveConfig } from "$lib/types/Metacognitive";
import { determineMetacognitivePrompt } from "./metacognitiveLogic";

const enabledConfig: MetacognitiveConfig = {
	enabled: true,
	frequencies: [2],
	comprehensionPrompts: ["C1"],
	perspectivePrompts: ["P1 {{personaName}}"],
};

function msg(partial: Partial<Message> & Pick<Message, "id" | "from" | "content">): Message {
	// The caller type guarantees id/from/content are present.
	return { ...partial } as Message;
}

describe("determineMetacognitivePrompt", () => {
	test("returns null when config is disabled", () => {
		const out = determineMetacognitivePrompt(
			[msg({ id: "a1", from: "assistant", content: "x" })],
			undefined,
			{},
			{}
		);
		expect(out).toBeNull();
	});

	test("respects dismissedForMessageId", () => {
		const messages = [msg({ id: "a1", from: "assistant", content: "x" })];
		const out = determineMetacognitivePrompt(
			messages,
			enabledConfig,
			{ targetFrequency: 1, dismissedForMessageId: "a1" },
			{}
		);
		expect(out).toBeNull();
	});

	test("gates by targetFrequency using assistant messages since last shown event", () => {
		const messages = [
			msg({
				id: "a0",
				from: "assistant",
				content: "old",
				metacognitiveEvents: [
					{
						type: "comprehension",
						promptText: "C",
						triggerFrequency: 1,
						timestamp: new Date(),
						accepted: false,
					},
				],
			}),
			msg({ id: "u1", from: "user", content: "q" }),
			msg({ id: "a1", from: "assistant", content: "x" }),
		];

		expect(
			determineMetacognitivePrompt(messages, enabledConfig, { targetFrequency: 2 }, {})
		).toBeNull();
		expect(
			determineMetacognitivePrompt(messages, enabledConfig, { targetFrequency: 1 }, {})
		).not.toBeNull();
	});

	test("prefers perspective when it can suggest a different active persona", () => {
		const messages = [
			msg({
				id: "a1",
				from: "assistant",
				content: "x",
				personaResponses: [{ personaId: "p1", personaName: "P1", content: "x" }],
			}),
		];
		const out = determineMetacognitivePrompt(
			messages,
			enabledConfig,
			{ targetFrequency: 1 },
			{
				activePersonas: ["p1", "p2"],
				personas: [
					{ id: "p1", name: "Alpha" },
					{ id: "p2", name: "Beta" },
				],
			}
		);

		expect(out?.type).toBe("perspective");
		expect(out?.suggestedPersonaId).toBe("p2");
		expect(out?.promptText).toContain("Beta");
	});

	test("inserts personaName literally (no $ replacement expansions)", () => {
		const config: MetacognitiveConfig = {
			enabled: true,
			frequencies: [1],
			comprehensionPrompts: ["C1"],
			perspectivePrompts: ["Hello {{personaName}}"],
		};
		const messages = [
			msg({
				id: "a1",
				from: "assistant",
				content: "x",
				personaResponses: [{ personaId: "p1", personaName: "P1", content: "x" }],
			}),
		];

		// `$&` would normally expand to the matched substring in String.replace replacement strings.
		const out = determineMetacognitivePrompt(
			messages,
			config,
			{ targetFrequency: 1 },
			{
				activePersonas: ["p1", "p2"],
				personas: [
					{ id: "p1", name: "Alpha" },
					{ id: "p2", name: "$&" },
				],
			}
		);

		expect(out?.type).toBe("perspective");
		expect(out?.suggestedPersonaName).toBe("$&");
		expect(out?.promptText).toBe("Hello $&");
	});

	test("falls back to comprehension when there is no alternative persona", () => {
		const messages = [
			msg({
				id: "a1",
				from: "assistant",
				content: "x",
				personaResponses: [{ personaId: "p1", personaName: "P1", content: "x" }],
			}),
		];
		const out = determineMetacognitivePrompt(
			messages,
			enabledConfig,
			{ targetFrequency: 1 },
			{ activePersonas: ["p1"], personas: [{ id: "p1", name: "Alpha" }] }
		);

		expect(out?.type).toBe("comprehension");
	});
});
