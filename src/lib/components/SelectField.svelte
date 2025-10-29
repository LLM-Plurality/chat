<script lang="ts">
	import CarbonChevronDown from "~icons/carbon/chevron-down";
	
	const CUSTOM_VALUE = "__custom__";
	
	interface Props {
		label: string;
		value: string;
		options: string[];
		disabled?: boolean;
		required?: boolean;
		onChange: (value: string) => void;
		allowCustom?: boolean;
	}
	
	let { label, value, options, disabled = false, required = false, onChange, allowCustom = false }: Props = $props();
	
	let showCustomInput = $state(false);
	let customValue = $state("");
	
	let isCustomValue = $derived(!options.includes(value) && value !== "");
	
	function handleSelectChange(e: Event) {
		const target = e.target as HTMLSelectElement;
		const newValue = target.value;
		
		if (newValue === CUSTOM_VALUE) {
			showCustomInput = true;
			customValue = value;
		} else {
			showCustomInput = false;
			onChange(newValue);
		}
	}
	
	function handleCustomSubmit() {
		if (customValue.trim()) {
			onChange(customValue.trim());
			showCustomInput = false;
		}
	}
	
	function handleCustomCancel() {
		showCustomInput = false;
		customValue = "";
	}
</script>

<div class="flex flex-col gap-2">
	<label for={label.toLowerCase().replace(/\s+/g, '-')} class="text-sm font-medium text-gray-700 dark:text-gray-300">
		{label}
		{#if required}<span class="text-red-500">*</span>{/if}
	</label>
	
	{#if showCustomInput}
		<div class="flex gap-2">
			<input
				type="text"
				bind:value={customValue}
				class="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800"
				placeholder="Enter custom value"
				onkeydown={(e) => e.key === 'Enter' && handleCustomSubmit()}
			/>
			<button
				type="button"
				class="rounded-md bg-black px-3 py-2 text-sm font-medium text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
				onclick={handleCustomSubmit}
			>
				Save
			</button>
			<button
				type="button"
				class="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
				onclick={handleCustomCancel}
			>
				Cancel
			</button>
		</div>
	{:else}
		<div class="relative">
			<select
				id={label.toLowerCase().replace(/\s+/g, '-')}
				{disabled}
				{required}
				value={isCustomValue && allowCustom ? CUSTOM_VALUE : value}
				onchange={handleSelectChange}
				class="w-full appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 pr-10 text-sm transition-colors hover:border-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800"
			>
				{#each options as option}
					<option value={option}>{option}</option>
				{/each}
				{#if allowCustom}
					<option value={CUSTOM_VALUE}>
						{isCustomValue ? `Custom: ${value}` : 'Custom...'}
					</option>
				{/if}
			</select>
			<CarbonChevronDown class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
		</div>
	{/if}
</div>

