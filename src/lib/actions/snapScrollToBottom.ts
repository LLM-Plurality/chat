import { navigating } from "$app/state";
import { tick } from "svelte";

export const snapScrollToBottom = (node: HTMLElement, dependency: unknown) => {
	let isDetached = false;
	const threshold = 50; // Distance from bottom to consider "attached"

	const isNearBottom = () => {
		const { scrollTop, scrollHeight, clientHeight } = node;
		// Use Math.abs for float precision safety, though distances are usually positive
		return Math.abs(scrollHeight - scrollTop - clientHeight) <= threshold;
	};

	const updateScrollPosition = () => {
		if (!isDetached) {
			node.scrollTo({ top: node.scrollHeight, behavior: "instant" });
		}
	};

	const onScroll = () => {
		// If the user is near the bottom, they are attached.
		// If they scroll up (away from bottom), they detach.
		if (isNearBottom()) {
			isDetached = false;
		} else {
			isDetached = true;
		}
	};

	const update = async (_options: { force?: boolean } = {}) => {
		const { force = false } = _options;

		if (!force && isDetached && !navigating.to) return;

		// Wait for DOM updates (e.g. new message rendered)
		await tick();

		node.scrollTo({ top: node.scrollHeight, behavior: "instant" });
	};

	// Observe content size changes (e.g. streaming responses, images loading)
	// This ensures we stay at the bottom even if the container size doesn't change
	// but the content grows.
	const observer = new ResizeObserver(() => {
		updateScrollPosition();
	});

	if (node.firstElementChild) {
		observer.observe(node.firstElementChild);
	} else {
		observer.observe(node);
	}

	node.addEventListener("scroll", onScroll);

	// Check initial state
	if (dependency) {
		update({ force: true });
	}

	return {
		update,
		destroy: () => {
			node.removeEventListener("scroll", onScroll);
			observer.disconnect();
		},
	};
};
