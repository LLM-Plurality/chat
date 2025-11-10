<script lang="ts">
	import type { PersonaResponse } from "$lib/types/Message";
import MarkdownRenderer from "./MarkdownRenderer.svelte";
import CopyToClipBoardBtn from "../CopyToClipBoardBtn.svelte";
import CarbonRotate360 from "~icons/carbon/rotate-360";
import CarbonChevronDown from "~icons/carbon/chevron-down";
import CarbonChevronUp from "~icons/carbon/chevron-up";
import ThinkingPlaceholder from "./ThinkingPlaceholder.svelte";
import { hasThinkSegments, splitThinkSegments } from "$lib/utils/stripThinkBlocks";
	import { goto } from "$app/navigation";
	import { base } from "$app/paths";

	interface Props {
		personaResponses: PersonaResponse[];
		loading?: boolean;
		onretry?: (personaId: string) => void;
	}

	let { personaResponses, loading = false, onretry }: Props = $props();

	// Track expanded state for each persona
	let expandedStates = $state<Record<string, boolean>>({});
	
	// Track content elements for overflow detection
	let contentElements = $state<Record<string, HTMLElement | null>>({});
	const MAX_COLLAPSED_HEIGHT = 400;

	function toggleExpanded(personaId: string) {
		expandedStates[personaId] = !expandedStates[personaId];
	}

	// Check if content has <think> blocks
	function hasClientThink(content: string | undefined): boolean {
	return content ? hasThinkSegments(content) : false;
	}

	// Check if content has overflow
	function hasOverflow(personaId: string): boolean {
		const element = contentElements[personaId];
		if (!element) return false;
		return element.scrollHeight > MAX_COLLAPSED_HEIGHT;
	}

	// Navigate to persona settings
	function openPersonaSettings(personaId: string) {
		goto(`${base}/settings/personas/${personaId}`);
	}
</script>

<!-- Horizontal scrollable cards -->
<div class="flex gap-3 overflow-x-auto pb-2">
	{#each personaResponses as response (response.personaId)}
		{@const isExpanded = expandedStates[response.personaId]}
		
		<div 
			class="persona-card flex-shrink-0 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-850"
			style="min-width: 300px; max-width: {isExpanded ? '600px' : '400px'};"
		>
			<!-- Persona Header -->
			<div class="mb-3 flex items-center justify-between border-b border-gray-200 pb-2 dark:border-gray-700">
				<button
					type="button"
					class="font-semibold text-gray-900 hover:text-gray-700 dark:text-gray-100 dark:hover:text-gray-300 transition-colors"
					onclick={() => openPersonaSettings(response.personaId)}
					aria-label="Open persona settings"
				>
					{response.personaName}
				</button>
				<div class="flex items-center gap-1">
					<CopyToClipBoardBtn
						classNames="!rounded-md !p-1.5 !text-gray-500 hover:!bg-gray-100 dark:!text-gray-400 dark:hover:!bg-gray-800"
						value={response.content}
					/>
					<!-- Regenerate button commented out - regeneration disabled -->
					<!-- {#if onretry}
						<button
							type="button"
							class="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
							onclick={() => onretry?.(response.personaId)}
							aria-label="Regenerate response"
						>
							<CarbonRotate360 class="text-base" />
						</button>
					{/if} -->
				</div>
			</div>

			<!-- Persona Content -->
			<div 
				bind:this={contentElements[response.personaId]}
				class="mt-2"
				style={isExpanded ? '' : `max-height: ${MAX_COLLAPSED_HEIGHT}px; overflow: hidden;`}
			>
		{#if hasClientThink(response.content)}
			{@const segments = splitThinkSegments(response.content ?? "")}
			{#each segments as part, _i}
				{#if part && part.startsWith("<think>")}
					{@const trimmed = part.trimEnd()}
					{@const isClosed = trimmed.endsWith("</think>")}

					{#if isClosed}
						<!-- Skip closed think tags - don't show reasoning content -->
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
					<MarkdownRenderer content={response.content} {loading} />
				</div>
			{/if}

				{#if response.routerMetadata}
					<div class="mt-2 text-xs text-gray-400 dark:text-gray-500">
						<span class="font-medium">{response.routerMetadata.route}</span>
						<span class="mx-1">•</span>
						<span>{response.routerMetadata.model}</span>
					</div>
				{/if}
			</div>

			<!-- Expand/Collapse button - only show if overflow exists -->
			{#if hasOverflow(response.personaId)}
				<button
					onclick={() => toggleExpanded(response.personaId)}
					class="mt-3 flex w-full items-center justify-center gap-1 rounded-md border border-gray-200 bg-gray-50 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
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
		</div>
	{/each}
</div>

<style>
	.persona-card {
		transition: all 0.3s ease;
	}

	/* Smooth scrollbar styling */
	.overflow-x-auto {
		scrollbar-width: thin;
		scrollbar-color: rgb(209 213 219) transparent;
	}

	.overflow-x-auto::-webkit-scrollbar {
		height: 8px;
	}

	.overflow-x-auto::-webkit-scrollbar-track {
		background: transparent;
	}

	.overflow-x-auto::-webkit-scrollbar-thumb {
		background-color: rgb(209 213 219);
		border-radius: 4px;
	}

	.overflow-x-auto::-webkit-scrollbar-thumb:hover {
		background-color: rgb(156 163 175);
	}

	:global(.dark) .overflow-x-auto {
		scrollbar-color: rgb(75 85 99) transparent;
	}

	:global(.dark) .overflow-x-auto::-webkit-scrollbar-thumb {
		background-color: rgb(75 85 99);
	}

	:global(.dark) .overflow-x-auto::-webkit-scrollbar-thumb:hover {
		background-color: rgb(107 114 128);
	}
</style>

