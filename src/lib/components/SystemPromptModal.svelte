<script lang="ts">
	import Modal from "./Modal.svelte";
	import CarbonClose from "~icons/carbon/close";
	import CarbonBlockchain from "~icons/carbon/blockchain";

	interface Props {
		preprompt: string;
	}

	let { preprompt }: Props = $props();

	let isOpen = $state(false);
</script>


{#if isOpen}
	<Modal onclose={() => (isOpen = false)} width="w-full !max-w-xl">
		<div class="flex w-full flex-col gap-5 p-6">
			<div
				class="flex items-start justify-between text-xl font-semibold text-gray-800 dark:text-gray-200"
			>
				<h2>System Prompt</h2>
				<button type="button" class="group" onclick={() => (isOpen = false)}>
					<CarbonClose
						class="mt-auto text-gray-900 group-hover:text-gray-500 dark:text-gray-200 dark:group-hover:text-gray-400"
					/>
				</button>
			</div>
			<textarea
				disabled
				value={preprompt}
				class="min-h-[420px] w-full resize-none rounded-lg border bg-gray-50 p-2.5 text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 max-sm:text-sm"
			></textarea>
		</div>
	</Modal>
{/if}
