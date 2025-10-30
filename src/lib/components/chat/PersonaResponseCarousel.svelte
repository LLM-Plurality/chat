<script lang="ts">
	import type { PersonaResponse } from "$lib/types/Message";
	import CarbonChevronLeft from "~icons/carbon/chevron-left";
	import CarbonChevronRight from "~icons/carbon/chevron-right";
	import CarbonChevronDown from "~icons/carbon/chevron-down";
	import CarbonChevronUp from "~icons/carbon/chevron-up";
import MarkdownRenderer from "./MarkdownRenderer.svelte";
import OpenReasoningResults from "./OpenReasoningResults.svelte";
import CopyToClipBoardBtn from "../CopyToClipBoardBtn.svelte";
import CarbonRotate360 from "~icons/carbon/rotate-360";
import ThinkingPlaceholder from "./ThinkingPlaceholder.svelte";
import { hasThinkSegments, splitThinkSegments } from "$lib/utils/stripThinkBlocks";

	interface Props {
		personaResponses: PersonaResponse[];
		loading?: boolean;
		onretry?: (personaId: string) => void;
	}

	let { personaResponses, loading = false, onretry }: Props = $props();

	let currentIndex = $state(0);
	let expandedStates = $state<Record<string, boolean>>({});
	let isDragging = $state(false);
	let startX = $state(0);
	let currentX = $state(0);
	let dragOffset = $state(0);
	
	// Detect if device has touch/coarse pointer (mobile/tablet)
	let isTouchDevice = $state(false);
	
	$effect(() => {
		if (typeof window !== 'undefined') {
			// Check if device has coarse pointer (touchscreen) or no pointer (touch-only)
			isTouchDevice = window.matchMedia('(pointer: coarse)').matches || 
			                window.matchMedia('(pointer: none)').matches ||
			                'ontouchstart' in window;
		}
	});
	
	// Track content heights for overflow detection
	let contentElements = $state<Record<string, HTMLElement | null>>({});
	const MAX_COLLAPSED_HEIGHT = 400;

	// Track which version of each persona's response is being shown
	let personaVersionIndices = $state<Record<string, number>>({});

	// Get the currently displayed version of a persona response
	function getDisplayedResponse(response: PersonaResponse): PersonaResponse {
		const versionIndex = personaVersionIndices[response.personaId] ?? response.currentChildIndex ?? 0;
		
		if (versionIndex === 0 || !response.children || response.children.length === 0) {
			return response; // Show current response
		}
		
		// Show a previous version from children
		const childIndex = versionIndex - 1;
		return response.children[childIndex] ?? response;
	}

	// Get all versions of a persona response (current + children)
	function getAllVersions(response: PersonaResponse): PersonaResponse[] {
		const versions = [response];
		if (response.children && response.children.length > 0) {
			versions.push(...response.children);
		}
		return versions;
	}

	// Navigate to a different version of a persona's response
	function navigateToVersion(personaId: string, versionIndex: number) {
		personaVersionIndices[personaId] = versionIndex;
	}

	function next() {
		if (currentIndex < personaResponses.length - 1) {
			// Collapse current card if expanded before navigating
			const currentPersonaId = personaResponses[currentIndex]?.personaId;
			if (currentPersonaId && expandedStates[currentPersonaId]) {
				expandedStates[currentPersonaId] = false;
			}
			currentIndex = currentIndex + 1;
		}
	}

	function previous() {
		if (currentIndex > 0) {
			// Collapse current card if expanded before navigating
			const currentPersonaId = personaResponses[currentIndex]?.personaId;
			if (currentPersonaId && expandedStates[currentPersonaId]) {
				expandedStates[currentPersonaId] = false;
			}
			currentIndex = currentIndex - 1;
		}
	}

	function goToIndex(index: number) {
		// Collapse current card if expanded before navigating
		const currentPersonaId = personaResponses[currentIndex]?.personaId;
		if (currentPersonaId && expandedStates[currentPersonaId]) {
			expandedStates[currentPersonaId] = false;
		}
		currentIndex = index;
	}

	function handleDragStart(event: MouseEvent | TouchEvent) {
		// Only allow mouse dragging on touch devices
		if (!isTouchDevice && !('touches' in event)) {
			return;
		}
		
		isDragging = true;
		startX = 'touches' in event ? event.touches[0].clientX : event.clientX;
		currentX = startX;
	}

	function handleDragMove(event: MouseEvent | TouchEvent) {
		if (!isDragging) return;
		
		// Only allow mouse dragging on touch devices
		if (!isTouchDevice && !('touches' in event)) {
			return;
		}
		
		event.preventDefault();
		currentX = 'touches' in event ? event.touches[0].clientX : event.clientX;
		dragOffset = currentX - startX;
	}

	function handleDragEnd() {
		if (!isDragging) return;
		
		isDragging = false;
		const threshold = 50;
		
		if (dragOffset < -threshold && currentIndex < personaResponses.length - 1) {
			next();
		} else if (dragOffset > threshold && currentIndex > 0) {
			previous();
		}
		
		dragOffset = 0;
	}

	function toggleExpanded(personaId: string) {
		expandedStates[personaId] = !expandedStates[personaId];
	}

	// Check if content has overflow
	function hasOverflow(personaId: string): boolean {
		const element = contentElements[personaId];
		if (!element) return false;
		return element.scrollHeight > MAX_COLLAPSED_HEIGHT;
	}

	let currentResponse = $derived(personaResponses[currentIndex]);

	// Check if content has <think> blocks
	function hasClientThink(content: string | undefined): boolean {
	return content ? hasThinkSegments(content) : false;
	}

	let showLeftArrow = $derived(currentIndex > 0);
	let showRightArrow = $derived(currentIndex < personaResponses.length - 1);
	let showPositionIndicator = $derived(personaResponses.length > 3);
</script>

<!-- Outer wrapper for arrows -->
<div class="relative w-full">
	<!-- Left Navigation Arrow - positioned outside cards -->
	{#if personaResponses.length > 1 && showLeftArrow}
		<button
			onclick={previous}
			class="absolute -left-16 top-1/2 z-20 -translate-y-1/2 p-2 text-gray-600 transition-all hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
			aria-label="Previous persona"
		>
			<CarbonChevronLeft class="text-3xl" />
		</button>
	{/if}

	<!-- Right Navigation Arrow - positioned outside cards -->
	{#if personaResponses.length > 1 && showRightArrow}
		<button
			onclick={next}
			class="absolute -right-16 top-1/2 z-20 -translate-y-1/2 p-2 text-gray-600 transition-all hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
			aria-label="Next persona"
		>
			<CarbonChevronRight class="text-3xl" />
		</button>
	{/if}

	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div 
		class="carousel-container relative w-full overflow-hidden transition-all duration-300"
		onmousedown={handleDragStart}
		onmousemove={handleDragMove}
		onmouseup={handleDragEnd}
		onmouseleave={handleDragEnd}
		ontouchstart={handleDragStart}
		ontouchmove={handleDragMove}
		ontouchend={handleDragEnd}
	>
		<div 
			class="carousel-track flex transition-all duration-300 ease-out"
			class:dragging={isDragging}
			style="transform: translateX(calc(-{currentIndex * 100}% + {dragOffset}px));"
		>
		{#each personaResponses as response, index (response.personaId)}
			{@const isActive = index === currentIndex}
			{@const isPrevious = index === currentIndex - 1}
			{@const isNext = index === currentIndex + 1}
			{@const isExpanded = expandedStates[response.personaId]}
			{@const displayedResponse = getDisplayedResponse(response)}
			{@const allVersions = getAllVersions(response)}
			{@const currentVersionIndex = personaVersionIndices[response.personaId] ?? response.currentChildIndex ?? 0}

			<div 
				class="carousel-card flex-shrink-0 transition-all duration-300"
				class:active={isActive}
				class:peek={!isActive}
				style="width: 100%;"
			>
				<div 
					class="relative w-full rounded-2xl border border-gray-100 bg-gradient-to-br from-gray-50 px-5 py-3.5 text-gray-600 dark:border-gray-800 dark:from-gray-800/80 dark:text-gray-300"
					class:pointer-events-none={!isActive}
				>
					<!-- Persona Name at Top Left -->
					<div class="mb-4 flex items-center justify-between border-b border-gray-200 pb-2 dark:border-gray-700">
						<div>
							<h3 class="text-lg font-semibold text-gray-700 dark:text-gray-200">
								{response.personaName}
							</h3>
							{#if response.personaOccupation || response.personaStance}
								<div class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
									{#if response.personaOccupation}<span>{response.personaOccupation}</span>{/if}{#if response.personaOccupation && response.personaStance}<span class="mx-1">•</span>{/if}{#if response.personaStance}<span>{response.personaStance}</span>{/if}
								</div>
							{/if}
						</div>
						
						<!-- Position Indicator Dots (inside card) -->
						{#if personaResponses.length > 1}
							<div class="flex items-center gap-2">
								{#if showPositionIndicator}
									<!-- Text indicator for N > 3 -->
									<div class="text-sm text-gray-600 dark:text-gray-400">
										{currentIndex + 1} of {personaResponses.length}
									</div>
								{/if}
								
								<!-- Dot indicator -->
								<div class="flex gap-1.5">
									{#each personaResponses as _, idx}
										<button
											onclick={() => goToIndex(idx)}
											class="size-2 rounded-full transition-all {idx === currentIndex
												? 'bg-gray-700 dark:bg-gray-300'
												: 'bg-gray-400 dark:bg-gray-600 hover:bg-gray-500 dark:hover:bg-gray-500'}"
											aria-label={`Go to ${personaResponses[idx].personaName}`}
										></button>
									{/each}
								</div>
							</div>
						{/if}
					</div>

					<!-- Persona Content -->
					<div 
						bind:this={contentElements[response.personaId]}
						class="content-wrapper relative"
						style={isExpanded ? '' : `max-height: ${MAX_COLLAPSED_HEIGHT}px; overflow: hidden;`}
					>
					{#if hasClientThink(displayedResponse.content)}
						{@const segments = splitThinkSegments(displayedResponse.content ?? "")}
						{#each segments as part, _i}
							{#if part && part.startsWith("<think>")}
								{@const trimmed = part.trimEnd()}
								{@const isClosed = trimmed.endsWith("</think>")}

								{#if isClosed}
									{@const thinkContent = trimmed.slice(7, -8)}
									{@const summary = thinkContent.trim().split(/\n+/)[0] || "Reasoning"}
									<OpenReasoningResults {summary} content={thinkContent} loading={false} />
								{:else}
									<ThinkingPlaceholder />
								{/if}
							{:else if part && part.trim().length > 0}
								<div
									class="prose max-w-none dark:prose-invert max-sm:prose-sm prose-headings:font-semibold prose-h1:text-lg prose-h2:text-base prose-h3:text-base prose-pre:bg-gray-800 dark:prose-pre:bg-gray-900"
								>
									<MarkdownRenderer content={part} {loading} />
								</div>
							{/if}
						{/each}
						{:else}
							<div
								class="prose max-w-none dark:prose-invert max-sm:prose-sm prose-headings:font-semibold prose-h1:text-lg prose-h2:text-base prose-h3:text-base prose-pre:bg-gray-800 dark:prose-pre:bg-gray-900"
							>
								<MarkdownRenderer content={displayedResponse.content} {loading} />
							</div>
						{/if}

						{#if displayedResponse.routerMetadata}
							<div class="mt-2 text-xs text-gray-400 dark:text-gray-500">
								<span class="font-medium">{displayedResponse.routerMetadata.route}</span>
								<span class="mx-1">•</span>
								<span>{displayedResponse.routerMetadata.model}</span>
							</div>
						{/if}
					</div>

					<!-- Bottom Actions Row -->
					<div class="mt-4 flex items-center justify-between">
						<!-- Left Side: Show More Button or Version Navigation -->
						<div class="flex items-center gap-2">
							{#if hasOverflow(response.personaId)}
								<button
									onclick={() => toggleExpanded(response.personaId)}
									class="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700/50"
								>
									{#if isExpanded}
										<CarbonChevronUp class="text-base" />
										<span>Show less</span>
									{:else}
										<CarbonChevronDown class="text-base" />
										<span>Show more</span>
									{/if}
								</button>
							{/if}
							
							<!-- Version Navigation (if multiple versions exist) -->
							{#if allVersions.length > 1}
								<div class="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
									<button
										class="rounded-md p-1 hover:bg-gray-100 dark:hover:bg-gray-700/50 disabled:opacity-30 disabled:cursor-not-allowed"
										onclick={() => navigateToVersion(response.personaId, Math.max(0, currentVersionIndex - 1))}
										disabled={currentVersionIndex === 0 || loading}
										aria-label="Previous version"
									>
										<CarbonChevronLeft class="text-base" />
									</button>
									<span class="text-xs">
										{currentVersionIndex + 1} / {allVersions.length}
									</span>
									<button
										class="rounded-md p-1 hover:bg-gray-100 dark:hover:bg-gray-700/50 disabled:opacity-30 disabled:cursor-not-allowed"
										onclick={() => navigateToVersion(response.personaId, Math.min(allVersions.length - 1, currentVersionIndex + 1))}
										disabled={currentVersionIndex === allVersions.length - 1 || loading}
										aria-label="Next version"
									>
										<CarbonChevronRight class="text-base" />
									</button>
								</div>
							{/if}
						</div>

						<!-- Copy and Regenerate Icons (Bottom Right) -->
						<div class="flex items-center gap-1">
							<CopyToClipBoardBtn
								classNames="!rounded-md !p-2 !text-gray-500 hover:!bg-gray-100 dark:!text-gray-400 dark:hover:!bg-gray-700/50"
								value={displayedResponse.content}
							/>
							<!-- Regenerate button commented out - regeneration disabled -->
							<!-- {#if onretry}
								<button
									type="button"
									class="rounded-md p-2 text-gray-600 hover:bg-gray-200/50 dark:text-gray-400 dark:hover:bg-gray-700/50"
									onclick={() => onretry?.(response.personaId)}
									aria-label="Regenerate response"
								>
									<CarbonRotate360 class="text-base" />
								</button>
							{/if} -->
						</div>
					</div>
				</div>
			</div>
		{/each}
		</div>
	</div>
</div>

<style>
	.carousel-container {
		touch-action: pan-y pinch-zoom;
		-ms-overflow-style: none;
		scrollbar-width: none;
		user-select: none;
		-webkit-user-select: none;
	}
	
	/* Only show grab cursor on touch devices */
	@media (pointer: coarse) {
		.carousel-container {
			cursor: grab;
		}
		
		.carousel-container:active {
			cursor: grabbing;
		}
	}

	.carousel-container::-webkit-scrollbar {
		display: none;
	}

	.carousel-track {
		display: flex;
		gap: 0;
		transition: transform 0.3s ease-out, height 0.3s ease-out;
	}

	.carousel-track.dragging {
		transition: height 0.3s ease-out;
	}

	.carousel-card {
		transition: opacity 0.3s ease, transform 0.3s ease, filter 0.3s ease;
	}

	.carousel-card.active {
		opacity: 1;
		transform: scale(1);
		z-index: 10;
	}

	.carousel-card.peek {
		opacity: 1;
		transform: scale(0.92);
		pointer-events: none;
	}

	/* Additional styling for better peeking effect - subtle dimming */
	.carousel-card.peek > div {
		filter: brightness(0.92) saturate(0.9);
	}

	:global(.dark) .carousel-card.peek > div {
		filter: brightness(0.75) saturate(0.9);
	}

	/* Content wrapper auto-sizing */
	.content-wrapper {
		transition: max-height 0.3s ease;
	}
</style>

