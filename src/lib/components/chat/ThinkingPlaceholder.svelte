<script lang="ts">
	import { onDestroy } from "svelte";

	let step = $state(0);

	const interval = setInterval(() => {
		step = (step + 1) % 4;
	}, 450);

	onDestroy(() => {
		clearInterval(interval);
	});

	const label = "Thinking";

	let dots = $derived(".".repeat(step));
</script>

<div class="thinking-placeholder" role="status" aria-live="polite">
	<span class="label">{label}{dots}</span>
</div>

<style>
	.thinking-placeholder {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		border-radius: 0.75rem;
		border: 1px solid rgba(209, 213, 219, 0.7);
		background: linear-gradient(135deg, rgba(249, 250, 251, 0.75), rgba(243, 244, 246, 0.65));
		padding: 0.75rem 1rem;
		color: #6b7280;
		font-size: 0.9rem;
		font-weight: 500;
		letter-spacing: 0.01em;
		min-width: 9rem;
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
	}

	.label {
		font-family: var(--font-sans, inherit);
	}

	:global(.dark) .thinking-placeholder {
		border-color: rgba(75, 85, 99, 0.7);
		background: rgba(31, 41, 55, 0.55);
		color: #9ca3af;
		box-shadow: inset 0 1px 0 rgba(148, 163, 184, 0.1);
	}
</style>

