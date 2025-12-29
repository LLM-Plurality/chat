<script lang="ts">
	import type { MetacognitiveEventType } from "$lib/types/Message";
	import CarbonChat from "~icons/carbon/chat";
	import CarbonUser from "~icons/carbon/user";

	interface Props {
		promptType: MetacognitiveEventType;
		promptText: string;
		suggestedPersonaName?: string;
		isClicked?: boolean;
		onAction?: () => void;
	}

	let { promptType, promptText, suggestedPersonaName, isClicked = false, onAction }: Props = $props();

	let isHovered = $state(false);

	function handleClick() {
		if (promptType === "perspective" && onAction) {
			onAction();
		}
	}

	// Compute dynamic classes to avoid Svelte class: directive issues with Tailwind dark: prefix
	let containerClasses = $derived.by(() => {
		let classes = "metacognitive-prompt mt-2 mb-1 flex w-full items-start gap-2.5 rounded-lg border border-gray-200/60 bg-gray-50/50 px-3 py-2.5 text-sm shadow-sm transition-all duration-200 dark:border-gray-700/40 dark:bg-gray-800/30";
		
		if (promptType === "perspective") {
			classes += " cursor-pointer hover:border-gray-300 hover:bg-gray-100/50 hover:shadow-md dark:hover:border-gray-600 dark:hover:bg-gray-800/50";
		}
		
		return classes;
	});

	let badgeClasses = $derived.by(() => {
		let classes = "inline-flex w-fit items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium text-gray-600 transition-colors dark:text-gray-400";
		
		if (isHovered) {
			classes += " bg-gray-200/70 dark:bg-gray-700/60";
		} else {
			classes += " bg-gray-100 dark:bg-gray-800/60";
		}
		
		return classes;
	});
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
	class={containerClasses}
	role={promptType === "perspective" ? "button" : "note"}
	tabindex={promptType === "perspective" ? 0 : -1}
	onmouseenter={() => (isHovered = true)}
	onmouseleave={() => (isHovered = false)}
	onclick={handleClick}
	onkeydown={(e) => e.key === "Enter" && handleClick()}
>
	<div class="mt-0.5 shrink-0">
		{#if promptType === "comprehension"}
			<CarbonChat
				class="h-4 w-4 text-gray-500 dark:text-gray-400"
			/>
		{:else}
			<CarbonUser
				class="h-4 w-4 text-gray-500 transition-transform duration-200 dark:text-gray-400 {isHovered ? 'scale-110' : ''}"
			/>
		{/if}
	</div>

	<div class="flex flex-col gap-1">
		<p class="leading-relaxed text-gray-700 dark:text-gray-300">
			{promptText}
		</p>

		{#if promptType === "perspective" && suggestedPersonaName}
			<span class={badgeClasses}>
				{isClicked ? `View what ${suggestedPersonaName} said` : `Click to hear from ${suggestedPersonaName}`}
			</span>
		{/if}
	</div>
</div>

<style>
	.metacognitive-prompt {
		animation: fadeSlideIn 0.3s ease-out;
	}

	@keyframes fadeSlideIn {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
