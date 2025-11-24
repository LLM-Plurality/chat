<script lang="ts">
	import CarbonUser from "~icons/carbon/user";
	import CarbonChat from "~icons/carbon/chat";
	import { MessageRole } from "$lib/types/Message";
	import { getPersonaColor } from "$lib/utils/personaColors";
	import type { TreeLayoutNode } from "$lib/utils/tree/layout";

	interface Props {
		treeData: { nodes: TreeLayoutNode[]; width: number; height: number };
		onNodeClick: (messageId: string) => void;
	}

	let { treeData, onNodeClick }: Props = $props();
</script>

{#if treeData.nodes.length > 0}
	{@const nodeSize = 24}
	{@const iconSize = 18}
	{@const svgWidth = Math.max(treeData.width, 100)}
	{@const svgHeight = Math.max(treeData.height, 50)}
	
	<div class="mt-2 mb-3 flex justify-center conversation-tree">
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
						{@const spacing = 8}
						{@const totalWidth = personaCount * iconSize + (personaCount - 1) * spacing}
						
						<!-- Use ELK coordinates directly -->
						{@const leftmostX = node.x + iconSize / 2}
						{@const rightmostX = leftmostX + (personaCount - 1) * (iconSize + spacing)}
						{@const childCenterX = node.x + totalWidth / 2}

						{@const junctionY = node.y - (node.y - node.parentY - nodeSize) * 0.25}
						{@const parentWidth = parentNode?.width || nodeSize}
						{@const parentCenterX = node.parentX + parentWidth / 2}
						
						<!-- Curve from Parent to Child Center -->
						<path
							d="M {parentCenterX},{node.parentY + nodeSize} 
							   C {parentCenterX},{node.parentY + nodeSize + 15} 
							     {childCenterX},{junctionY - 15}
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
								   Q {dropX},{junctionY + 5} 
								   {dropX},{node.y}"
								stroke="currentColor"
								stroke-width="1.5"
								fill="none"
								class={node.isOnActivePath ? "text-gray-400 dark:text-gray-500" : "text-gray-300 dark:text-gray-600"}
							/>
						{/each}
					{:else}
						{@const parentWidth = parentNode?.width || nodeSize}
						{@const parentCenterX = node.parentX + parentWidth / 2}
						
						{@const x1 = parentCenterX}
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
				{@const cx = node.x + nodeSize / 2}
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
					{@const spacing = 8}
					
					{#if personaCount === 1}
						<!-- Single persona: center it like user icons -->
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
								style="color: {getPersonaColor(node.message.personaResponses[0].personaId)};"
								title={node.message.personaResponses[0].personaName || node.message.personaResponses[0].personaId}
							>
								<CarbonChat class="w-full h-full" />
							</div>
						</foreignObject>
					{:else}
						<!-- Multiple personas: distribute horizontally -->
						{@const totalWidth = personaCount * iconSize + (personaCount - 1) * spacing}
						{@const startX = node.x + iconSize / 2}
						
						{#each node.message.personaResponses as response, i}
							{@const iconX = startX + i * (iconSize + spacing)}
							<foreignObject
								x={iconX - iconSize / 2}
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
									style="color: {getPersonaColor(response.personaId)};"
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

<style>
	.conversation-tree {
		animation: fadeIn 0.3s ease-in;
	}

	.conversation-tree path,
	.conversation-tree line,
	.conversation-tree foreignObject {
		animation: fadeIn 0.4s ease-in;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
</style>
