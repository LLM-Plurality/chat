<script lang="ts">
	import { base } from "$app/paths";
	import { page } from "$app/state";
	import { goto } from "$app/navigation";

	import CarbonCheckmark from "~icons/carbon/checkmark";
	import CarbonTrashCan from "~icons/carbon/trash-can";
	import CarbonClose from "~icons/carbon/close";
	import CarbonEdit from "~icons/carbon/edit";
	import CarbonChevronDown from "~icons/carbon/chevron-down";
	import CarbonChevronRight from "~icons/carbon/chevron-right";
	import type { ConvSidebar } from "$lib/types/ConvSidebar";
	import { MessageRole } from "$lib/types/Message";

	import EditConversationModal from "$lib/components/EditConversationModal.svelte";
	import ConversationTreeGraph from "$lib/components/ConversationTreeGraph.svelte";
	import { conversationTree } from "$lib/stores/conversationTree";
	import { treeVisibility } from "$lib/stores/treeVisibility";
	import type { TreeLayoutNode } from "$lib/utils/tree/layout";
	import { buildTreeWithPositions } from "$lib/utils/tree/layout";
	import { onDestroy } from "svelte";

	interface Props {
		conv: ConvSidebar;
		readOnly?: true;
		ondeleteConversation?: (id: string) => void;
		oneditConversationTitle?: (payload: { id: string; title: string }) => void;
	}

	let { conv, readOnly, ondeleteConversation, oneditConversationTitle }: Props = $props();

	let confirmDelete = $state(false);
	let renameOpen = $state(false);

	// Check if this is the active conversation with tree data
	let isActiveWithTree = $derived(
		conv.id === page.params.id && $conversationTree.conversationId === conv.id
	);

	// Initialize visibility for active conversation if not set
	$effect(() => {
		if (isActiveWithTree && $treeVisibility[conv.id.toString()] === undefined) {
			// Default to visible for active conversation
			treeVisibility.setVisible(conv.id.toString(), true);
		}
	});

	let isVisible = $derived($treeVisibility[conv.id.toString()] ?? false);

	let treeData = $state<{ nodes: TreeLayoutNode[]; width: number; height: number }>({ 
		nodes: [], 
		width: 0, 
		height: 0 
	});

	let treeUpdateTimeout: ReturnType<typeof setTimeout>;

	// Update tree data when conversation or messages change
	// Only update after messages are complete (have content)
	// DEBOUNCED to prevent layout thrashing during streaming
	$effect(() => {
		if (isActiveWithTree && isVisible && $conversationTree.messages.length > 0) {
			clearTimeout(treeUpdateTimeout);
			treeUpdateTimeout = setTimeout(() => {
				// Filter to only messages with content (streaming complete)
				// For assistant messages with personas, check personaResponses
				const completeMessages = $conversationTree.messages.filter(m => {
					// Exclude system messages from tree visualization
					if (m.from === MessageRole.System) {
						return false;
					}

					if (m.from === MessageRole.Assistant && m.personaResponses && m.personaResponses.length > 0) {
						// Check if at least one persona has content
						return m.personaResponses.some(pr => pr.content && pr.content.trim().length > 0);
					}
					// For user messages, check main content field
					return m.content && m.content.trim().length > 0;
				});
				
				if (completeMessages.length > 0) {
					buildTreeWithPositions(
						completeMessages, 
						$conversationTree.activeMessageId || undefined,
						new Set($conversationTree.activePath)
					).then((data) => {
						treeData = data;
						// Set CSS variable for sidebar width (tree width + padding)
						// Allow expansion up to 800px for very wide trees
						const sidebarWidth = Math.max(290, Math.min(800, data.width + 60)); // +60 for padding
						document.documentElement.style.setProperty('--sidebar-width', `${sidebarWidth}px`);
					}).catch((err) => {
						console.error('Error building tree:', err);
					});
				}
			}, 300); // 300ms debounce
		} else {
			treeData = { nodes: [], width: 0, height: 0 };
			// Reset to default width if this was the active conversation
			if (isActiveWithTree) {
				document.documentElement.style.setProperty('--sidebar-width', '290px');
			}
		}
	});

	onDestroy(() => {
		if (treeUpdateTimeout) clearTimeout(treeUpdateTimeout);
	});

	function handleTreeNodeClick(messageId: string, personaId?: string) {
		const clickedMessage = $conversationTree.messages.find(m => m.id === messageId);
		const personaParam = personaId ? `&personaId=${personaId}` : '';
		
		if (!clickedMessage) {
			console.error('Clicked message not found:', messageId);
			goto(`${base}/conversation/${conv.id}?msgId=${messageId}&scrollTo=true${personaParam}`);
			return;
		}
		
		const currentBranchState = $conversationTree.branchedFrom;
		
		if (currentBranchState) {
			const currentActivePath = new Set($conversationTree.activePath);
			
			if (currentActivePath.has(messageId)) {
				// Message is in active branch; preserve state
				goto(`${base}/conversation/${conv.id}?msgId=${messageId}&scrollTo=true&keepBranch=true${personaParam}`);
				return;
			}
		}
		
		goto(`${base}/conversation/${conv.id}?msgId=${messageId}&scrollTo=true${personaParam}`);
	}
</script>

<div class="flex flex-col">
<a
	data-sveltekit-noscroll
	onmouseleave={() => {
		confirmDelete = false;
	}}
	onclick={(e) => {
		// If clicking the active conversation, ensure tree is visible
		if (isActiveWithTree && !isVisible) {
			treeVisibility.setVisible(conv.id.toString(), true);
		}
		// Navigation happens automatically via href
	}}
	href="{base}/conversation/{conv.id}"
	class="group flex h-[2.15rem] flex-none items-center gap-1.5 rounded-lg pl-2.5 pr-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 max-sm:h-10
		{conv.id === page.params.id ? 'bg-gray-100 dark:bg-gray-700' : ''}"
>
	<div class="my-2 min-w-0 flex-1 truncate first-letter:uppercase">
		<span>
			{#if confirmDelete}
				<span class="mr-1 font-semibold"> Delete? </span>
			{/if}
			{conv.title}
		</span>
	</div>

	{#if !readOnly}
		{#if confirmDelete}
			<button
				type="button"
				class="flex h-5 w-5 items-center justify-center rounded md:hidden md:group-hover:flex"
				title="Cancel delete action"
				onclick={(e) => {
					e.preventDefault();
					confirmDelete = false;
				}}
			>
				<CarbonClose class="text-xs text-gray-400 hover:text-gray-500 dark:hover:text-gray-300" />
			</button>
			<button
				type="button"
				class="flex h-5 w-5 items-center justify-center rounded md:hidden md:group-hover:flex"
				title="Confirm delete action"
				onclick={(e) => {
					e.preventDefault();
					confirmDelete = false;
					ondeleteConversation?.(conv.id.toString());
				}}
			>
				<CarbonCheckmark
					class="text-xs text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
				/>
			</button>
		{:else}
			<button
				type="button"
				class="flex h-5 w-5 items-center justify-center rounded md:hidden md:group-hover:flex"
				title={isVisible ? "Hide tree" : "Show tree"}
				onclick={(e) => {
					e.preventDefault();
					e.stopPropagation();
					if (isActiveWithTree) {
						// Only toggle locally if it's the active conversation
						treeVisibility.toggle(conv.id.toString());
					} else {
						// If inactive, navigate to it (Option A)
						// This will naturally trigger the visibility effect to set it to true
						goto(`${base}/conversation/${conv.id}`);
					}
				}}
			>
				{#if isActiveWithTree && isVisible}
					<CarbonChevronDown class="text-xs text-gray-400 hover:text-gray-500 dark:hover:text-gray-300" />
				{:else}
					<CarbonChevronRight class="text-xs text-gray-400 hover:text-gray-500 dark:hover:text-gray-300" />
				{/if}
			</button>

			<button
				type="button"
				class="flex h-5 w-5 items-center justify-center rounded md:hidden md:group-hover:flex"
				title="Edit conversation title"
				onclick={(e) => {
					e.preventDefault();
					renameOpen = true;
				}}
			>
				<CarbonEdit class="text-xs text-gray-400 hover:text-gray-500 dark:hover:text-gray-300" />
			</button>

			<button
				type="button"
				class="flex h-5 w-5 items-center justify-center rounded md:hidden md:group-hover:flex"
				title="Delete conversation"
				onclick={(event) => {
					event.preventDefault();
					if (event.shiftKey) {
						ondeleteConversation?.(conv.id.toString());
					} else {
						confirmDelete = true;
					}
				}}
			>
				<CarbonTrashCan
					class="text-xs text-gray-400  hover:text-gray-500 dark:hover:text-gray-300"
				/>
			</button>
		{/if}
	{/if}
</a>

	<!-- Tree view (only shown for active conversation) -->
	{#if isActiveWithTree && treeData.nodes.length > 0}
		<ConversationTreeGraph 
			{treeData} 
			onNodeClick={handleTreeNodeClick} 
		/>
	{/if}
</div>

<!-- Edit title modal -->
{#if renameOpen}
	<EditConversationModal
		open={renameOpen}
		title={conv.title}
		onclose={() => (renameOpen = false)}
		onsave={(payload) => {
			renameOpen = false;
			oneditConversationTitle?.({ id: conv.id.toString(), title: payload.title });
		}}
	/>
{/if}
