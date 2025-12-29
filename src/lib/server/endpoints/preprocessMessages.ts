import type { Message } from "$lib/types/Message";
import type { EndpointMessage } from "./endpoints";
import { downloadFile } from "../files/downloadFile";
import type { ObjectId } from "mongodb";

export async function preprocessMessages(
	messages: Message[],
	convId: ObjectId
): Promise<EndpointMessage[]> {
	return Promise.resolve(messages)
		.then((msgs) => downloadFiles(msgs, convId))
		.then((msgs) => injectClipboardFiles(msgs))
		.then((msgs) => expandPersonaResponses(msgs));
}

/**
 * Expand messages with personaResponses into the content field
 * For multi-persona messages, concatenate all persona responses
 * This ensures all personas see what others said in previous turns
 */
function expandPersonaResponses(messages: EndpointMessage[]): EndpointMessage[] {
	return messages.map((message) => {
		// If message has persona responses, format them into content
		if (message.personaResponses && message.personaResponses.length > 0) {
			const personaContents = message.personaResponses
				.map((pr) => {
					// Format: "[PersonaName]: content"
					const name = pr.personaName || pr.personaId;
					return `[${name}]: ${pr.content}`;
				})
				.join("\n\n");

			return {
				...message,
				content: `--- Transcript of responses from participating personas ---\n${personaContents}`,
			};
		}
		return message;
	});
}

async function downloadFiles(messages: Message[], convId: ObjectId): Promise<EndpointMessage[]> {
	return Promise.all(
		messages.map<Promise<EndpointMessage>>((message) =>
			Promise.all((message.files ?? []).map((file) => downloadFile(file.value, convId))).then(
				(files) => ({ ...message, files })
			)
		)
	);
}

async function injectClipboardFiles(messages: EndpointMessage[]) {
	return Promise.all(
		messages.map((message) => {
			const plaintextFiles = message.files
				?.filter((file) => file.mime === "application/vnd.chatui.clipboard")
				.map((file) => Buffer.from(file.value, "base64").toString("utf-8"));

			if (!plaintextFiles || plaintextFiles.length === 0) return message;

			return {
				...message,
				content: `${plaintextFiles.join("\n\n")}\n\n${message.content}`,
				files: message.files?.filter((file) => file.mime !== "application/vnd.chatui.clipboard"),
			};
		})
	);
}
