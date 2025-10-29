<script lang="ts">
	import CarbonChevronDown from "~icons/carbon/chevron-down";
	
	interface Props {
		label: string;
		value: string;
		suggestions: string[];
		disabled?: boolean;
		maxlength?: number;
		placeholder?: string;
		onChange: (value: string) => void;
	}
	
	let { label, value, suggestions, disabled = false, maxlength, placeholder = "Type or select...", onChange }: Props = $props();
	
	let showSuggestions = $state(false);
	let inputValue = $state(value);
	let focusedIndex = $state(-1);
	
	// Update inputValue when value prop changes (e.g., when switching personas)
	$effect(() => {
		inputValue = value;
	});
	
	let filteredSuggestions = $derived(
		suggestions.filter(s => 
			s.toLowerCase().includes(inputValue.toLowerCase())
		).slice(0, 10) // Limit to 10 suggestions
	);
	
	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		inputValue = target.value;
		showSuggestions = true;
		focusedIndex = -1;
	}
	
	function selectSuggestion(suggestion: string) {
		inputValue = suggestion;
		showSuggestions = false;
		onChange(suggestion);
	}
	
	function handleBlur() {
		// Delay to allow click on suggestion
		setTimeout(() => {
			showSuggestions = false;
			if (inputValue !== value) {
				onChange(inputValue);
			}
		}, 200);
	}
	
	function handleFocus() {
		if (filteredSuggestions.length > 0) {
			showSuggestions = true;
		}
	}
	
	function handleKeydown(e: KeyboardEvent) {
		if (!showSuggestions || filteredSuggestions.length === 0) return;
		
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			focusedIndex = Math.min(focusedIndex + 1, filteredSuggestions.length - 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			focusedIndex = Math.max(focusedIndex - 1, -1);
		} else if (e.key === 'Enter' && focusedIndex >= 0) {
			e.preventDefault();
			selectSuggestion(filteredSuggestions[focusedIndex]);
		} else if (e.key === 'Escape') {
			showSuggestions = false;
		}
	}
</script>

<div class="flex flex-col gap-2 relative">
	<label for={label.toLowerCase().replace(/\s+/g, '-')} class="text-sm font-medium text-gray-700 dark:text-gray-300">
		{label}
	</label>
	
	<div class="relative">
		<input
			id={label.toLowerCase().replace(/\s+/g, '-')}
			type="text"
			value={inputValue}
			{disabled}
			{maxlength}
			{placeholder}
			oninput={handleInput}
			onblur={handleBlur}
			onfocus={handleFocus}
			onkeydown={handleKeydown}
			class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 pr-10 text-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800"
		/>
		{#if !disabled}
			<CarbonChevronDown 
				class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-transform dark:text-gray-500 {showSuggestions ? 'rotate-180' : ''}"
			/>
		{/if}
	</div>
	
	{#if showSuggestions && filteredSuggestions.length > 0 && !disabled}
		<div class="absolute top-full left-0 right-0 z-40 mt-1 max-h-60 overflow-auto rounded-md border border-gray-300 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-800">
			{#each filteredSuggestions as suggestion, index}
				<button
					type="button"
					class="w-full px-3 py-2 text-left text-sm transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 {index === focusedIndex ? 'bg-gray-100 dark:bg-gray-700' : ''}"
					onclick={() => selectSuggestion(suggestion)}
				>
					{suggestion}
				</button>
			{/each}
		</div>
	{/if}
</div>

