<script lang="ts">
	import CarbonUser from "~icons/carbon/user";
	import CarbonChat from "~icons/carbon/chat";
	import { MessageRole } from "$lib/types/Message";
	import { getPersonaColor } from "$lib/utils/personaColors";
	import type { TreeLayoutNode } from "$lib/utils/tree/layout";
	import { TREE_CONFIG } from "$lib/constants/treeConfig";

	interface Props {
		treeData: { nodes: TreeLayoutNode[]; width: number; height: number };
		onNodeClick: (messageId: string, personaId?: string) => void;
	}

	let { treeData, onNodeClick }: Props = $props();
	
	let containerElement: HTMLDivElement | undefined = $state();
	let previousNodeCount = $state(0);
	let previousActiveNodeId = $state<string | undefined>(undefined);
	let userHasScrolled = $state(false);
	let scrollResetTimeout: ReturnType<typeof setTimeout> | undefined;
	
	// Auto-scroll to keep active or latest nodes in view
	$effect(() => {
		if (!containerElement || treeData.nodes.length === 0) return;
		
		const activeNode = treeData.nodes.find(n => n.isActive);
		const activeNodeId = activeNode?.id;
		
		// Determine if we should auto-scroll
		const shouldAutoScroll = 
			// New nodes were added
			(treeData.nodes.length > previousNodeCount) ||
			// Active node changed and user hasn't manually scrolled recently
			(activeNodeId !== previousActiveNodeId && !userHasScrolled);
		
		if (shouldAutoScroll) {
			// Find the target node (active node or the last node)
			const targetNode = activeNode || treeData.nodes[treeData.nodes.length - 1];
			
			if (targetNode) {
				// Small delay to ensure DOM is updated
				requestAnimationFrame(() => {
					if (!containerElement) return;
					
					// Calculate the center Y position of the target node
					const nodeY = targetNode.y + (targetNode.height / 2);
					const containerHeight = containerElement.clientHeight;
					
					// Scroll to center the node vertically in the view
					const scrollTop = nodeY - (containerHeight / 2);
					
					// Use smooth scrolling
					containerElement.scrollTo({
						top: Math.max(0, scrollTop),
						behavior: 'smooth'
					});
				});
			}
			
			// Reset user scroll flag after auto-scroll
			userHasScrolled = false;
		}
		
		previousNodeCount = treeData.nodes.length;
		previousActiveNodeId = activeNodeId;
	});
	
	// Track manual scrolling by user
	function handleScroll() {
		userHasScrolled = true;
		
		// Reset the flag after a delay so auto-scroll can resume
		clearTimeout(scrollResetTimeout);
		scrollResetTimeout = setTimeout(() => {
			userHasScrolled = false;
		}, 2000); // 2 second delay
	}
</script>

{#if treeData.nodes.length > 0}
	{@const nodeSize = TREE_CONFIG.nodeSize}
	{@const iconSize = TREE_CONFIG.iconSize}
	{@const svgWidth = Math.max(treeData.width, TREE_CONFIG.minWidth)}
	{@const svgHeight = Math.max(treeData.height, TREE_CONFIG.minHeight)}
	
	<div 
		bind:this={containerElement}
		onscroll={handleScroll}
		class="mt-2 mb-3 flex justify-center conversation-tree max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent hover:scrollbar-thumb-gray-400 dark:hover:scrollbar-thumb-gray-500"
	>
		<svg 
			width={svgWidth} 
			height={svgHeight}
			class="overflow-visible"
		>
			<!-- Draw connecting lines -->
			{#each treeData.nodes as node}
				{#if node.parentX !== undefined && node.parentY !== undefined}
					{@const parentNode = treeData.nodes.find(n => n.x === node.parentX && n.y === node.parentY)}
					{@const isMultiPersonaResponse = node.message.from === MessageRole.Assistant && node.message.personaResponses && node.message.personaResponses.length > 1}
					{@const parentIsUser = parentNode?.message.from === MessageRole.User}
					
					{#if parentIsUser && isMultiPersonaResponse && node.message.personaResponses}
						{@const personaCount = node.message.personaResponses.length}
						{@const spacing = TREE_CONFIG.spacing}
						{@const totalWidth = personaCount * iconSize + (personaCount - 1) * spacing}
						
						<!-- Use ELK coordinates directly -->
						{@const startOffset = (node.width - totalWidth) / 2}
						{@const leftmostX = node.x + startOffset + iconSize / 2}
						{@const rightmostX = leftmostX + (personaCount - 1) * (iconSize + spacing)}
						{@const childCenterX = node.x + node.width / 2}

						{@const parentBottom = node.parentY + nodeSize}
						{@const gap = node.y - parentBottom}
						{@const junctionY = parentBottom + gap * 0.5}
						
						{@const parentWidth = parentNode?.width || nodeSize}
						{@const parentCenterX = node.parentX + parentWidth / 2}
						
						<!-- Curve from Parent to Child Center -->
						<path
							d="M {parentCenterX},{parentBottom} 
							   C {parentCenterX},{parentBottom + gap * 0.25} 
							     {childCenterX},{junctionY - gap * 0.25}
							     {childCenterX},{junctionY}"
							stroke="currentColor"
							stroke-width="1.5"
							fill="none"
							class={node.isOnActivePath ? "text-gray-400 dark:text-gray-500" : "text-gray-300 dark:text-gray-600"}
						/>
						
						<!-- Horizontal bar connecting all personas -->
						<line
							x1={leftmostX}
							y1={junctionY}
							x2={rightmostX}
							y2={junctionY}
							stroke="currentColor"
							stroke-width="1.5"
							class={node.isOnActivePath ? "text-gray-400 dark:text-gray-500" : "text-gray-300 dark:text-gray-600"}
						/>
						
						<!-- Vertical drops to each persona -->
						{#each node.message.personaResponses as persona, personaIndex}
							{@const dropX = leftmostX + personaIndex * (iconSize + spacing)}
							<path
								d="M {dropX},{junctionY} 
								   L {dropX},{node.y}"
								stroke="currentColor"
								stroke-width="1.5"
								fill="none"
								class={node.isOnActivePath ? "text-gray-400 dark:text-gray-500" : "text-gray-300 dark:text-gray-600"}
							/>
						{/each}
					{:else}
						{@const parentWidth = parentNode?.width || nodeSize}
						{@const parentCenterX = node.parentX + parentWidth / 2}
						
						{@const spacing = TREE_CONFIG.spacing}
						{@const parentIsMultiPersona = parentNode?.message.from === MessageRole.Assistant && parentNode?.message.personaResponses && parentNode.message.personaResponses.length > 1}
						{@const branchedFromPersonaId = node.message.branchedFrom?.personaId}
						{@const targetPersonaIndex = (parentIsMultiPersona && branchedFromPersonaId && parentNode?.message.personaResponses) 
							? parentNode.message.personaResponses.findIndex(p => p.personaId === branchedFromPersonaId)
							: -1}

						{@const parentPersonaCount = parentNode?.message.personaResponses?.length || 0}
						{@const parentTotalWidth = (parentPersonaCount > 0) ? parentPersonaCount * iconSize + (parentPersonaCount - 1) * spacing : 0}
						{@const parentStartOffset = (parentWidth - parentTotalWidth) / 2}

						{@const x1 = (targetPersonaIndex !== -1)
							? (node.parentX + parentStartOffset + iconSize / 2) + targetPersonaIndex * (iconSize + spacing)
							: parentCenterX}
						{@const y1 = node.parentY + nodeSize}
						{@const x2 = node.x + nodeSize / 2}
						{@const y2 = node.y}
						{@const controlOffset = Math.abs(y2 - y1) * 0.3}
						
						<path
							d="M {x1},{y1} 
							   C {x1},{y1 + controlOffset} 
							   {x2},{y2 - controlOffset} 
							   {x2},{y2}"
							stroke="currentColor"
							stroke-width="1.5"
							fill="none"
							class={node.isOnActivePath ? "text-gray-400 dark:text-gray-500" : "text-gray-300 dark:text-gray-600"}
						/>
					{/if}
				{/if}
			{/each}


			<!-- Draw nodes -->
			{#each treeData.nodes as node}
				{@const cx = node.x + node.width / 2}
				{@const cy = node.y + nodeSize / 2}
				
				{#if node.message.from === MessageRole.User}
					<foreignObject
						x={cx - iconSize / 2}
						y={cy - iconSize / 2}
						width={iconSize}
						height={iconSize}
						role="button"
						tabindex="0"
						class="cursor-pointer hover:opacity-80 transition-opacity"
						onclick={() => onNodeClick(node.message.id)}
						onkeydown={(e) => e.key === 'Enter' && onNodeClick(node.message.id)}
					>
						<div 
							class={`flex items-center justify-center w-full h-full rounded-full ${node.isActive ? 'opacity-100 scale-110' : ''} ${node.isOnActivePath ? 'text-gray-400 dark:text-gray-500' : 'text-gray-300 dark:text-gray-600'}`}
						>
							<CarbonUser class="w-full h-full" />
						</div>
					</foreignObject>
				{:else if node.message.personaResponses && node.message.personaResponses.length > 0}
					{@const personaCount = node.message.personaResponses.length}
					{@const spacing = TREE_CONFIG.spacing}
					
					{#if personaCount === 1}
						<!-- Single persona: center it like user icons -->
						<foreignObject
							x={cx - iconSize / 2}
							y={cy - iconSize / 2}
							width={iconSize}
							height={iconSize}
							style="overflow: visible"
							role="button"
							tabindex="0"
							class="cursor-pointer hover:opacity-80 transition-opacity"
							onclick={() => onNodeClick(node.message.id, node.message.personaResponses![0].personaId)}
							onkeydown={(e) => e.key === 'Enter' && onNodeClick(node.message.id, node.message.personaResponses![0].personaId)}
						>
							<div 
								class="flex items-center justify-center rounded-full {node.isActive ? 'opacity-100 scale-110' : ''}"
								style="width: {iconSize}px; height: {iconSize}px; color: {getPersonaColor(node.message.personaResponses[0].personaId)};"
								title={node.message.personaResponses[0].personaName || node.message.personaResponses[0].personaId}
							>
								<CarbonChat class="w-full h-full" />
							</div>
						</foreignObject>
					{:else}
						<!-- Multiple personas: distribute horizontally -->
						{@const totalWidth = personaCount * iconSize + (personaCount - 1) * spacing}
						{@const startOffset = (node.width - totalWidth) / 2}
						{@const startX = node.x + startOffset + iconSize / 2}
						
						{#each node.message.personaResponses as response, i}
							{@const iconX = startX + i * (iconSize + spacing)}
							<foreignObject
								x={iconX - iconSize / 2}
								y={cy - iconSize / 2}
								width={iconSize}
								height={iconSize}
								style="overflow: visible"
								role="button"
								tabindex="0"
								class="cursor-pointer hover:opacity-80 transition-opacity"
								onclick={() => onNodeClick(node.message.id, response.personaId)}
							onkeydown={(e) => e.key === 'Enter' && onNodeClick(node.message.id, response.personaId)}
						>
							<div 
								class="flex items-center justify-center rounded-full {node.isActive ? 'opacity-100 scale-110' : ''}"
								style="width: {iconSize}px; height: {iconSize}px; color: {getPersonaColor(response.personaId)};"
								title={response.personaName || response.personaId}
							>
								<CarbonChat class="w-full h-full" />
							</div>
						</foreignObject>
						{/each}
					{/if}
				{:else}
					<foreignObject
						x={cx - iconSize / 2}
						y={cy - iconSize / 2}
						width={iconSize}
						height={iconSize}
						role="button"
						tabindex="0"
						class="cursor-pointer hover:opacity-80 transition-opacity"
						onclick={() => onNodeClick(node.message.id)}
						onkeydown={(e) => e.key === 'Enter' && onNodeClick(node.message.id)}
					>
						<div 
							class="flex items-center justify-center w-full h-full rounded-full {node.isActive ? 'opacity-100 scale-110' : ''}"
							style="color: #10b981;"
						>
							<CarbonChat class="w-full h-full" />
						</div>
					</foreignObject>
				{/if}
			{/each}
		</svg>
	</div>
{/if}
