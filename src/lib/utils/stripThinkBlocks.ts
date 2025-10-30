import { THINK_BLOCK_REGEX } from "$lib/constants/thinkBlockRegex";

const THINK_OPEN_TAG = "<think>";
const THINK_CLOSE_TAG = "</think>";

export function stripThinkBlocks(text: string): string {
	if (!text) return "";
	THINK_BLOCK_REGEX.lastIndex = 0;
	const result = text.replace(THINK_BLOCK_REGEX, "");
	THINK_BLOCK_REGEX.lastIndex = 0;
	return result;
}

export function hasUnclosedThinkBlock(text: string): boolean {
	if (!text) return false;
	const lastOpen = text.lastIndexOf(THINK_OPEN_TAG);
	if (lastOpen === -1) return false;
	const nextClose = text.indexOf(THINK_CLOSE_TAG, lastOpen);
	return nextClose === -1;
}

export function splitThinkSegments(text: string): string[] {
	const source = text ?? "";
	THINK_BLOCK_REGEX.lastIndex = 0;
	const segments = source.split(THINK_BLOCK_REGEX);
	THINK_BLOCK_REGEX.lastIndex = 0;
	return segments;
}

export function hasThinkSegments(text: string): boolean {
	if (!text) return false;
	THINK_BLOCK_REGEX.lastIndex = 0;
	const match = THINK_BLOCK_REGEX.test(text);
	THINK_BLOCK_REGEX.lastIndex = 0;
	return match;
}
