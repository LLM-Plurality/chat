<script lang="ts">
	import Modal from "./Modal.svelte";
	import CarbonWarning from "~icons/carbon/warning";

	interface Props {
		title: string;
		message: string;
		confirmText?: string;
		cancelText?: string;
		variant?: "danger" | "warning" | "info";
		onConfirm: () => void;
		onCancel: () => void;
	}

	let {
		title,
		message,
		confirmText = "Confirm",
		cancelText = "Cancel",
		variant = "warning",
		onConfirm,
		onCancel,
	}: Props = $props();

	const variantStyles = {
		danger: "bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800",
		warning: "bg-yellow-600 hover:bg-yellow-700 dark:bg-yellow-700 dark:hover:bg-yellow-800",
		info: "bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800",
	};

	const iconColors = {
		danger: "text-red-600 dark:text-red-500",
		warning: "text-yellow-600 dark:text-yellow-500",
		info: "text-blue-600 dark:text-blue-500",
	};
</script>

<Modal width="max-w-md" closeOnBackdrop={false} onclose={onCancel}>
	<div class="p-6">
		<!-- Icon and Title -->
		<div class="mb-4 flex items-start gap-4">
			<div
				class={[
					"flex size-12 shrink-0 items-center justify-center rounded-full",
					variant === "danger"
						? "bg-red-100 dark:bg-red-900/30"
						: variant === "warning"
							? "bg-yellow-100 dark:bg-yellow-900/30"
							: "bg-blue-100 dark:bg-blue-900/30",
				]}
			>
				<CarbonWarning class={["size-6", iconColors[variant]]} />
			</div>
			<div class="flex-1">
				<h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
					{title}
				</h3>
			</div>
		</div>

		<!-- Message -->
		<p class="mb-6 text-sm text-gray-600 dark:text-gray-400">
			{message}
		</p>

		<!-- Actions -->
		<div class="flex gap-3 justify-end">
			<button
				onclick={onCancel}
				class="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
			>
				{cancelText}
			</button>
			<button
				onclick={onConfirm}
				class={[
					"rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors",
					variantStyles[variant],
				]}
			>
				{confirmText}
			</button>
		</div>
	</div>
</Modal>

