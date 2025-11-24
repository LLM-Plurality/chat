<script lang="ts">
	import type { Message } from "$lib/types/Message";
	import { tick } from "svelte";

	import { usePublicConfig } from "$lib/utils/PublicConfig.svelte";
	const publicConfig = usePublicConfig();
	import CopyToClipBoardBtn from "../CopyToClipBoardBtn.svelte";
	import IconLoading from "../icons/IconLoading.svelte";
	import CarbonRotate360 from "~icons/carbon/rotate-360";
	import CarbonBranch from "~icons/carbon/branch";
	import CarbonChevronLeft from "~icons/carbon/chevron-left";
	import CarbonChevronRight from "~icons/carbon/chevron-right";
	import CarbonMaximize from "~icons/carbon/maximize";
	import CarbonMinimize from "~icons/carbon/minimize";
	import CarbonPen from "~icons/carbon/pen";
	import UploadedFile from "./UploadedFile.svelte";

	import {
		MessageUpdateType,
		type MessageReasoningUpdate,
		MessageReasoningUpdateType,
	} from "$lib/types/MessageUpdate";
	import MarkdownRenderer from "./MarkdownRenderer.svelte";
	import Alternatives from "./Alternatives.svelte";
	import MessageAvatar from "./MessageAvatar.svelte";
	import ThinkingPlaceholder from "./ThinkingPlaceholder.svelte";
	import { hasThinkSegments, splitThinkSegments } from "$lib/utils/stripThinkBlocks";
	import { goto } from "$app/navigation";
	import { base } from "$app/paths";
	import type { PersonaResponse } from "$lib/types/Message";
	import { onDestroy } from "svelte";

	interface Props {
		message: Message;
		loading?: boolean;
		isAuthor?: boolean;
		readOnly?: boolean;
		isTapped?: boolean;
		alternatives?: Message["id"][];
		editMsdgId?: Message["id"] | null;
		isLast?: boolean;
		personaName?: string;
		personaOccupation?: string;
		personaStance?: string;
		branchState?: {
			messageId: string;
			personaId: string;
			personaName: string;
		} | null;
		branchPersonas?: string[];
		onretry?: (payload: { id: Message["id"]; content?: string; personaId?: string }) => void;
		onshowAlternateMsg?: (payload: { id: Message["id"] }) => void;
		onbranch?: (messageId: string, personaId: string) => void;
		messageBranches?: any[]; // Branches originating from this message
		onopenbranchmodal?: (messageId: string, personaId: string, branches: any[]) => void;
	}

	let {
		message,
		loading = false,
		isAuthor: _isAuthor = true,
		readOnly: _readOnly = false,
		isTapped = $bindable(false),
		branchPersonas = [],
		alternatives = [],
		editMsdgId = $bindable(null),
		isLast = false,
		personaName,
		personaOccupation,
		personaStance,
		branchState,
		onretry,
		onshowAlternateMsg,
		onbranch,
		messageBranches = [],
		onopenbranchmodal,
	}: Props = $props();

	let contentEl: HTMLElement | undefined = $state();
	let messageWidth: number = $state(0);
	let messageInfoWidth: number = $state(0);
	let isBranching = $state(false);
	
	let expandedStates = $state<Record<string, boolean>>({});
	let focusedPersonaId = $state<string | null>(null);
	
	let contentElements = $state<Record<string, HTMLElement | null>>({});
	const MAX_COLLAPSED_HEIGHT = 400;
	
	// Track which branch button was just clicked for animation
	let branchClickedPersonaId = $state<string | null>(null);
	let branchClickTimeout: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		// referenced to appease linter for currently-unused props
		void _isAuthor;
		void _readOnly;
	});

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
			editFormEl?.requestSubmit();
		}
		if (e.key === "Escape") {
			editMsdgId = null;
		}
	}

	let editContentEl: HTMLTextAreaElement | undefined = $state();
	let editFormEl: HTMLFormElement | undefined = $state();

	let reasoningUpdates = $derived(
		(message.updates?.filter(({ type }) => type === MessageUpdateType.Reasoning) ??
			[]) as MessageReasoningUpdate[]
	);

let thinkSegments = $derived.by(() => splitThinkSegments(message.content));
	let hasServerReasoning = $derived(
		reasoningUpdates &&
			reasoningUpdates.length > 0 &&
			!!message.reasoning &&
			message.reasoning.trim().length > 0
	);
let hasClientThink = $derived(!hasServerReasoning && hasThinkSegments(message.content));

	// Check if using persona-based response structure
	let isPersonaMode = $derived(message.personaResponses !== undefined);
	
	// Unified responses array: use personaResponses if available, otherwise wrap message as single response
	let responses = $derived.by((): PersonaResponse[] => {
		if (isPersonaMode) {
			return message.personaResponses!;
		}
		// Legacy mode: convert message to PersonaResponse format for unified rendering
		return [{
			personaId: 'single',
			personaName: personaName || '',
			personaOccupation,
			personaStance,
			content: message.content,
			reasoning: message.reasoning,
			updates: message.updates,
			routerMetadata: message.routerMetadata,
		}];
	});

	// Multiple cards need horizontal scroll layout
	let hasMultipleCards = $derived(responses.length > 1);

	let editMode = $derived(editMsdgId === message.id);
	$effect(() => {
		if (editMode) {
			tick();
			if (editContentEl) {
				editContentEl.value = message.content;
				editContentEl?.focus();
			}
		}
	});

	// Get persona ID for single persona mode
	function getPersonaId(): string | undefined {
		// Try to get from message personaResponses first
		if (message.personaResponses && message.personaResponses.length > 0) {
			return message.personaResponses[0].personaId;
		}
		// Fallback: this won't work perfectly but it's a reasonable attempt
		return undefined;
	}

	// Get branches for this message's persona
	let personaBranches = $derived.by(() => {
		const personaId = getPersonaId();
		if (!personaId) return messageBranches;
		return messageBranches.filter(b => b.branchedFromPersonaId === personaId);
	});

	// Handle branch creation with animation
	async function handleBranchClick() {
		const personaId = getPersonaId();
		if (!personaId || !onbranch) return;
		
		isBranching = true;
		await onbranch(message.id, personaId);
		
		setTimeout(() => {
			isBranching = false;
		}, 600);
	}

	// Handle branch button click
	function handleBranchButtonClick() {
		const personaId = getPersonaId();
		if (!personaId) return;
		
		const hasExistingBranches = personaBranches.length > 0;
		if (hasExistingBranches) {
			onopenbranchmodal?.(message.id, personaId, personaBranches);
		} else {
			handleBranchClick();
		}
	}

	// Unified helper functions for card rendering
	function toggleExpanded(personaId: string) {
		const isCurrentlyExpanded = expandedStates[personaId];
		
		// In multi-card view, "Show less" should collapse all cards
		if (hasMultipleCards && isCurrentlyExpanded) {
			responses.forEach(r => {
				expandedStates[r.personaId] = false;
			});
			focusedPersonaId = null;
		} else {
			// Otherwise, just toggle the individual card's state
			expandedStates[personaId] = !isCurrentlyExpanded;
			
			// If expanding, scroll to show the bottom of the content
			if (!isCurrentlyExpanded) {
				setTimeout(() => {
					const element = contentElements[personaId];
					if (element) {
						element.scrollIntoView({ behavior: 'smooth', block: 'end' });
					}
				}, 50);
			}
		}
	}
	
	function setFocus(personaId: string) {
		if (hasMultipleCards) {
			// Enter focused mode and ensure the card is expanded
			focusedPersonaId = personaId;
			expandedStates[personaId] = true;
		}
	}
	
	function navigateFocused(direction: 'prev' | 'next') {
		if (!focusedPersonaId || !hasMultipleCards) return;
		
		const currentIndex = responses.findIndex(r => r.personaId === focusedPersonaId);
		if (currentIndex === -1) return;
		
		const nextIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
		if (nextIndex >= 0 && nextIndex < responses.length) {
			focusedPersonaId = responses[nextIndex].personaId;
			expandedStates[focusedPersonaId] = true;
		}
	}

	// Reactive overflow detection - updates during streaming
	let overflowStates = $state<Record<string, boolean>>({});
	
	// Effect to detect overflow states during rendering and expansion
	$effect(() => {
		// Recompute overflow states whenever responses change or elements are bound
		const newStates: Record<string, boolean> = {};
		responses.forEach(r => {
			// Access content to make this reactive to content changes during streaming
			const contentLength = r.content?.length || 0;
			const element = contentElements[r.personaId];
			const isExpanded = expandedStates[r.personaId];
			// Only check overflow if we have content and an element
			// If expanded, always recheck after DOM updates
			if (element && contentLength > 0) {
				newStates[r.personaId] = element.scrollHeight > MAX_COLLAPSED_HEIGHT;
			} else {
				newStates[r.personaId] = false;
			}
		});
		overflowStates = newStates;
	});
	
	// Additional effect to force recheck after expansion state changes
	$effect(() => {
		// Track expanded states
		const expandedKeys = Object.keys(expandedStates);
		if (expandedKeys.length > 0) {
			// Delay recheck to allow DOM to update
			const timeout = setTimeout(() => {
				const newStates: Record<string, boolean> = {};
				responses.forEach(r => {
					const element = contentElements[r.personaId];
					if (element && r.content) {
						newStates[r.personaId] = element.scrollHeight > MAX_COLLAPSED_HEIGHT;
					}
				});
				overflowStates = { ...overflowStates, ...newStates };
			}, 100);
			return () => clearTimeout(timeout);
		}
	});

	function hasOverflow(personaId: string): boolean {
		return overflowStates[personaId] || false;
	}

	function openPersonaSettings(personaId: string) {
		goto(`${base}/settings/personas/${personaId}`);
	}

	onDestroy(() => {
		if (branchClickTimeout) {
			clearTimeout(branchClickTimeout);
		}
	});
</script>

{#if message.from === "assistant"}
	<div
		bind:offsetWidth={messageWidth}
		class="group relative -mb-4 flex max-w-full items-start justify-start gap-4 pb-4 leading-relaxed max-sm:mb-1 {message.routerMetadata &&
		messageInfoWidth >= messageWidth
			? 'mb-1'
			: ''}"
		class:w-full={isPersonaMode}
		class:w-fit={!isPersonaMode}
		data-message-id={message.id}
		data-message-role="assistant"
		role="presentation"
		onclick={() => (isTapped = !isTapped)}
		onkeydown={() => (isTapped = !isTapped)}
	>
	<MessageAvatar
		classNames="mt-5 size-3.5 flex-none select-none rounded-full shadow-lg max-sm:hidden"
		animating={isLast && loading}
	/>
	
	<div class="flex-1 min-w-0 relative">
		<!-- Focused mode carousel navigation arrows -->
		{#if focusedPersonaId && hasMultipleCards}
			{@const currentIndex = responses.findIndex(r => r.personaId === focusedPersonaId)}
			{@const hasPrev = currentIndex > 0}
			{@const hasNext = currentIndex < responses.length - 1}
			
			{#if hasPrev}
				<button
					onclick={() => navigateFocused('prev')}
					class="absolute -left-12 top-1/2 z-10 -translate-y-1/2 rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-all"
					aria-label="Previous persona"
				>
					<CarbonChevronLeft class="text-3xl" />
				</button>
			{/if}
			
			{#if hasNext}
				<button
					onclick={() => navigateFocused('next')}
					class="absolute -right-12 top-1/2 z-10 -translate-y-1/2 rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-all"
					aria-label="Next persona"
				>
					<CarbonChevronRight class="text-3xl" />
				</button>
			{/if}
		{/if}
		
		<!-- Container: horizontal scroll for multiple cards (unless focused), single card otherwise -->
		<div class="{hasMultipleCards && !focusedPersonaId ? 'persona-scroll-container flex gap-3 overflow-x-auto pb-2 px-12' : ''}">
			{#if isPersonaMode && responses.length === 0 && isLast && loading}
				<!-- Loading state: waiting for personas to start responding -->
					<IconLoading classNames="loading inline ml-2" />
			{/if}
			{#each responses as response (response.personaId)}
				{@const isExpanded = expandedStates[response.personaId]}
				{@const displayName = response.personaName || personaName || 'Assistant'}
				{@const isFocused = focusedPersonaId === response.personaId}
				{@const shouldHide = focusedPersonaId && !isFocused}
				{@const isGenerating = isLast && loading && (!response.content || response.content.length === 0)}
				
				{#if !shouldHide}
					<!-- Card: ALL use gradient bubble styling for consistency -->
					<div 
						class="rounded-2xl border border-gray-100 bg-gradient-to-br from-gray-50 px-5 py-4 text-gray-600 dark:border-gray-800 dark:from-gray-800/80 dark:text-gray-300 {hasMultipleCards && !focusedPersonaId ? 'persona-card flex-shrink-0' : ''}"
						style={hasMultipleCards && !focusedPersonaId ? `min-width: 320px; max-width: ${isExpanded ? '600px' : '420px'};` : ''}
					>
					<!-- Persona Header: persona name + action buttons -->
					<div class="mb-3 flex items-center justify-between border-b border-gray-200 pb-2 dark:border-gray-700">
						{#if isPersonaMode}
							<button
								type="button"
								class="truncate text-left text-lg font-semibold text-gray-700 hover:text-gray-900 dark:text-gray-200 dark:hover:text-gray-50 transition-colors"
								onclick={() => openPersonaSettings(response.personaId)}
								aria-label="Open settings for {displayName}"
								title="View {displayName} settings"
							>
								{displayName}
							</button>
						{:else}
							<h3 class="truncate text-lg font-semibold text-gray-700 dark:text-gray-200">
								{displayName}
							</h3>
						{/if}
						
						<div class="flex items-center gap-1">
							{#if hasMultipleCards}
								<button
									type="button"
									class="!rounded-md !p-1.5 !text-gray-500 hover:!bg-gray-100 dark:!text-gray-400 dark:hover:!bg-gray-800 transition-colors"
									onclick={(e) => {
										e.stopPropagation();
										focusedPersonaId === response.personaId ? toggleExpanded(response.personaId) : setFocus(response.personaId);
									}}
									aria-label={focusedPersonaId === response.personaId ? "Exit focus mode" : "Focus this persona"}
									title={focusedPersonaId === response.personaId ? "Show all cards" : "Focus on this card"}
								>
									{#if focusedPersonaId === response.personaId}
										<CarbonMinimize class="text-base" />
									{:else}
										<CarbonMaximize class="text-base" />
									{/if}
								</button>
							{/if}

							{#if !loading && onretry}
								<button
									type="button"
									class="!rounded-md !p-1.5 !text-gray-500 hover:!bg-gray-100 dark:!text-gray-400 dark:hover:!bg-gray-800 transition-colors"
									onclick={(e) => {
										e.stopPropagation();
										onretry?.({ id: message.id, personaId: response.personaId });
									}}
									aria-label="Regenerate {displayName}'s response"
									title="Regenerate this response"
								>
									<CarbonRotate360 class="text-base" />
								</button>
							{/if}
						{#if !loading && onbranch}
							{@const isBranchClicked = branchClickedPersonaId === response.personaId}
							<button
								type="button"
								class="!rounded-md !p-1.5 !text-gray-500 hover:!bg-gray-100 dark:!text-gray-400 dark:hover:!bg-gray-800 transition-colors"
								onclick={(e) => {
									e.stopPropagation();
									
									// Trigger animation
									branchClickedPersonaId = response.personaId;
									if (branchClickTimeout) {
										clearTimeout(branchClickTimeout);
									}
									branchClickTimeout = setTimeout(() => {
										branchClickedPersonaId = null;
									}, 500);
									
									onbranch?.(message.id, response.personaId);
								}}
								aria-label="Branch conversation with {displayName}"
								title="Start private conversation with {displayName}"
							>
								<div class="relative transition-transform duration-200 {isBranchClicked ? 'scale-125' : 'scale-100'}">
									<CarbonBranch class="text-base" />
								</div>
							</button>
						{/if}
						{#if !loading}
						<CopyToClipBoardBtn
							classNames="!rounded-md !p-1.5 !text-gray-500 hover:!bg-gray-100 dark:!text-gray-400 dark:hover:!bg-gray-800"
							value={response.content}
						/>
						{/if}
						</div>
					</div>

					<!-- File attachments: only for legacy mode (message-level, not persona-level) -->
					{#if !isPersonaMode && message.files?.length}
						<div class="flex h-fit flex-wrap gap-x-5 gap-y-2 mb-2">
							{#each message.files as file (file.value)}
								<UploadedFile {file} canClose={false} />
							{/each}
						</div>
					{/if}

					<!-- Thinking indicator for server reasoning (legacy mode only) -->
					{#if !isPersonaMode && hasServerReasoning && loading && message.content.length === 0}
						<ThinkingPlaceholder />
					{/if}

					<!-- Content -->
					<div 
						bind:this={contentElements[response.personaId]}
						class="mt-2"
						style={isExpanded ? '' : `max-height: ${MAX_COLLAPSED_HEIGHT}px; overflow: hidden;`}
					>
						{#if isGenerating}
							<!-- Loading state: show dots while generating -->
							<IconLoading classNames="loading inline ml-2 first:ml-0" />
						{:else}
							<!-- Content with think tag parsing -->
							{@const segments = splitThinkSegments(response.content ?? "")}
							{#each segments as part, _i}
								{#if part && part.startsWith("<think>")}
									{@const trimmed = part.trimEnd()}
									{@const isClosed = trimmed.endsWith("</think>")}
									{#if !isClosed}
										<ThinkingPlaceholder />
									{/if}
								{:else if part && part.trim().length > 0}
									<div
										class="prose max-w-none dark:prose-invert max-sm:prose-sm prose-headings:font-semibold prose-h1:text-lg prose-h2:text-base prose-h3:text-base prose-pre:bg-gray-800 dark:prose-pre:bg-gray-900"
									>
										<MarkdownRenderer content={part} loading={isLast && loading} />
									</div>
								{/if}
							{/each}
						{/if}

						{#if response.routerMetadata}
							<div class="mt-2 text-xs text-gray-400 dark:text-gray-500">
								<span class="font-medium">{response.routerMetadata.route}</span>
								<span class="mx-1">•</span>
								<span>{response.routerMetadata.model}</span>
							</div>
						{/if}
					</div>
				</div>
				{/if}
			{/each}
		</div>

		<!-- Branch button for legacy mode (outside card border) -->
		{#if !isPersonaMode && (!isLast || !loading) && onbranch && personaName}
			{@const branchCount = personaBranches.length}
			{@const hasExistingBranches = branchCount > 0}
			
			<div class="mt-1.5 flex items-center justify-end gap-1 px-2">
				<button
					type="button"
					class="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700/50 {isBranching ? 'animate-pulse' : ''}"
					onclick={handleBranchButtonClick}
					aria-label={hasExistingBranches ? "Branch options" : "Branch from this response"}
					title={hasExistingBranches ? "View or create branch" : "Branch from this response"}
				>
					<CarbonBranch class="text-xs" />
					{#if hasExistingBranches}
						<span>({branchCount})</span>
					{/if}
				</button>
			</div>
		{/if}
	</div>

		{#if message.routerMetadata && (!isLast || !loading)}
			<div
				class="absolute -bottom-3.5 {message.routerMetadata && messageInfoWidth > messageWidth
					? 'left-1 pl-1 lg:pl-7'
					: 'right-1'} flex max-w-[calc(100dvw-40px)] items-center gap-0.5 overflow-hidden"
				bind:offsetWidth={messageInfoWidth}
			>
				<div
					class="mr-2 flex items-center gap-1.5 truncate whitespace-nowrap text-[.65rem] text-gray-400 dark:text-gray-400 sm:text-xs"
				>
					<span class="truncate rounded bg-gray-100 px-1 font-mono dark:bg-gray-800 sm:py-px">
						{message.routerMetadata.route}
					</span>
					<span class="text-gray-500">with</span>
					{#if publicConfig.isHuggingChat}
						<a
							href="/chat/settings/models/{message.routerMetadata.model}"
							class="truncate rounded bg-gray-100 px-1 font-mono hover:text-gray-500 dark:bg-gray-800 dark:hover:text-gray-300 sm:py-px"
						>
							{message.routerMetadata.model.split("/").pop()}
						</a>
					{:else}
						<span class="truncate rounded bg-gray-100 px-1.5 font-mono dark:bg-gray-800 sm:py-px">
							{message.routerMetadata.model.split("/").pop()}
						</span>
					{/if}
				</div>
				{#if alternatives.length > 1 && editMsdgId === null}
					<Alternatives
						{message}
						{alternatives}
						{loading}
						onshowAlternateMsg={(payload) => onshowAlternateMsg?.(payload)}
					/>
				{/if}
			</div>
		{/if}
	</div>
{/if}
{#if message.from === "user"}
	<div
		class="group relative {alternatives.length > 1 && editMsdgId === null
			? 'mb-7'
			: ''} w-full items-start justify-start gap-4 max-sm:text-sm"
		data-message-id={message.id}
		data-message-type="user"
		role="presentation"
		onclick={() => (isTapped = !isTapped)}
		onkeydown={() => (isTapped = !isTapped)}
	>
		<div class="flex w-full flex-col gap-2">
			{#if message.files?.length}
				<div class="flex w-fit gap-4 px-5">
					{#each message.files as file}
						<UploadedFile {file} canClose={false} />
					{/each}
				</div>
			{/if}

			<div class="flex w-full flex-row flex-nowrap">
				{#if !editMode}
					<p
						class="disabled w-full appearance-none whitespace-break-spaces text-wrap break-words bg-inherit px-5 py-3.5 text-gray-500 dark:text-gray-400"
					>
						{message.content.trim()}
					</p>
				{:else}
					<form
						class="mt-3 flex w-full flex-col"
						bind:this={editFormEl}
						onsubmit={(e) => {
							e.preventDefault();
							onretry?.({ content: editContentEl?.value, id: message.id });
							editMsdgId = null;
						}}
					>
						<textarea
							class="w-full whitespace-break-spaces break-words rounded-xl bg-gray-100 px-5 py-3.5 text-gray-500 *:h-max focus:outline-none dark:bg-gray-800 dark:text-gray-400"
							rows="5"
							bind:this={editContentEl}
							value={message.content.trim()}
							onkeydown={handleKeyDown}
							required
						></textarea>
						<div class="flex w-full flex-row flex-nowrap items-center justify-center gap-2 pt-2">
							<button
								type="submit"
								class="btn rounded-lg px-3 py-1.5 text-sm
                                {loading
									? 'bg-gray-300 text-gray-400 dark:bg-gray-700 dark:text-gray-600'
									: 'bg-gray-200 text-gray-600 hover:text-gray-800   focus:ring-0 dark:bg-gray-800 dark:text-gray-300 dark:hover:text-gray-200'}
								"
								disabled={loading}
							>
								Send
							</button>
							<button
								type="button"
								class="btn rounded-sm p-2 text-sm text-gray-400 hover:text-gray-500 focus:ring-0 dark:text-gray-400 dark:hover:text-gray-300"
								onclick={() => {
									editMsdgId = null;
								}}
							>
								Cancel
							</button>
						</div>
					</form>
				{/if}
			</div>
			<div class="absolute -bottom-4 ml-3.5 flex w-full gap-1.5">
				{#if alternatives.length > 1 && editMsdgId === null}
					<Alternatives
						{message}
						{alternatives}
						{loading}
						onshowAlternateMsg={(payload) => onshowAlternateMsg?.(payload)}
					/>
				{/if}
				{#if (alternatives.length > 1 && editMsdgId === null) || (!loading && !editMode)}
					{@const isRootMessage = message.from === "user" && (!message.ancestors || message.ancestors.length === 0)}
					{#if !isRootMessage}
					<button
						class="hidden cursor-pointer items-center gap-1 rounded-md border border-gray-200 px-1.5 py-0.5 text-xs text-gray-400 group-hover:flex hover:flex hover:text-gray-500 dark:border-gray-700 dark:text-gray-400 dark:hover:text-gray-300 lg:-right-2"
						title="Edit"
						type="button"
						onclick={() => (editMsdgId = message.id)}
					>
						<CarbonPen />
						Edit
					</button>
					{/if}
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	@keyframes loading {
		to {
			stroke-dashoffset: 122.9;
		}
	}

	.persona-card {
		transition: all 0.3s ease;
	}

	/* Fade effect for horizontal scroll container */
	.persona-scroll-container {
		position: relative;
		/* Add gradient mask to fade out cards at edges */
		mask-image: linear-gradient(
			to right,
			transparent 0%,
			black 40px,
			black calc(100% - 40px),
			transparent 100%
		);
		-webkit-mask-image: linear-gradient(
			to right,
			transparent 0%,
			black 40px,
			black calc(100% - 40px),
			transparent 100%
		);
	}

	.persona-scroll-container {
		scrollbar-width: none;
	}

	.persona-scroll-container:hover {
		scrollbar-width: thin;
		scrollbar-color: rgba(156, 163, 175, 0.5) transparent;
	}

	.persona-scroll-container::-webkit-scrollbar {
		height: 6px;
	}

	.persona-scroll-container::-webkit-scrollbar-track {
		background: transparent;
		margin: 0 48px; /* Match the px-12 padding (3rem = 48px) */
	}

	.persona-scroll-container::-webkit-scrollbar-thumb {
		background-color: transparent;
		border-radius: 10px;
		transition: background-color 0.3s ease;
	}

	/* Show scrollbar thumb on hover */
	.persona-scroll-container:hover::-webkit-scrollbar-thumb {
		background-color: rgba(156, 163, 175, 0.5);
	}

	.persona-scroll-container::-webkit-scrollbar-thumb:hover {
		background-color: rgba(107, 114, 128, 0.7);
	}

	/* Dark mode */
	:global(.dark) .persona-scroll-container:hover {
		scrollbar-color: rgba(107, 114, 128, 0.5) transparent;
	}

	:global(.dark) .persona-scroll-container:hover::-webkit-scrollbar-thumb {
		background-color: rgba(107, 114, 128, 0.5);
	}

	:global(.dark) .persona-scroll-container::-webkit-scrollbar-thumb:hover {
		background-color: rgba(156, 163, 175, 0.7);
	}
</style>
