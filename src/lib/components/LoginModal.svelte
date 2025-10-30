<script lang="ts">
	import { base } from "$app/paths";
	import { page } from "$app/state";

	import LogoHuggingFaceBorderless from "$lib/components/icons/LogoHuggingFaceBorderless.svelte";
	import Modal from "$lib/components/Modal.svelte";
	import { cookiesAreEnabled } from "$lib/utils/cookiesAreEnabled";
import Logo from "./icons/Logo.svelte";
import { usePublicConfig } from "$lib/utils/PublicConfig.svelte";

const publicConfig = usePublicConfig();

interface Props {
	onclose?: () => void;
}

let { onclose }: Props = $props();

let showPasswordForm = $state(false);
let passwordErrorMessage = $state(false);
let isSubmitting = $state(false);

async function handlePasswordSubmit(event: SubmitEvent) {
	event.preventDefault();
	if (isSubmitting) return;

	if (!cookiesAreEnabled()) {
		window.open(window.location.href, "_blank");
		return;
	}

	isSubmitting = true;
	passwordErrorMessage = false;

	const formData = new FormData(event.target as HTMLFormElement);
	const body = Object.fromEntries(formData.entries());

	try {
		const response = await fetch(`${base}/login/password`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});

		if (response.ok) {
			window.location.href = `${base}/`;
		} else {
			const result = await response.json();
			console.error(result.message);
			passwordErrorMessage = true;
		}
	} catch (e) {
		console.error(e);
		passwordErrorMessage = true;
	} finally {
		isSubmitting = false;
	}
}
</script>

<Modal onclose={() => onclose?.()} width="!max-w-[400px] !m-4">
	<div
		class="from-primary-500/40 via-primary-500/10 to-primary-500/0 flex w-full flex-col items-center gap-6 bg-gradient-to-b px-5 pb-8 pt-9 text-center"
	>
		<h2 class="flex items-center text-2xl font-semibold text-gray-800">
			<Logo classNames="mr-1" />
			{publicConfig.PUBLIC_APP_NAME}
		</h2>
		<!-- <p class="text-balance text-lg font-semibold leading-snug text-gray-800">
			{publicConfig.PUBLIC_APP_DESCRIPTION}
		</p>
		<p class="text-balance rounded-xl border bg-white/80 p-2 text-base text-gray-800">
			{publicConfig.PUBLIC_APP_GUEST_MESSAGE}
		</p> -->

		<div class="flex w-full flex-col items-center gap-3">
			{#if page.data.loginRequired}
				<a
					href="{base}/login"
					class="flex w-full flex-wrap items-center justify-center whitespace-nowrap rounded-full bg-black px-5 py-2 text-center text-lg font-semibold text-gray-100 transition-colors hover:bg-gray-900"
				>
					Sign in with
					<span class="flex items-center">
						&nbsp;<LogoHuggingFaceBorderless classNames="text-xl mr-1" /> Hugging Face
					</span>
				</a>

			<button
				type="button"
				onclick={() => {
					showPasswordForm = !showPasswordForm;
					if (!showPasswordForm) {
						passwordErrorMessage = false;
					}
				}}
					class="flex w-full items-center justify-center whitespace-nowrap rounded-full border-2 border-black bg-white px-5 py-2 text-lg font-semibold text-gray-800 transition-colors hover:bg-gray-100"
				>
					Sign in with username/password
				</button>

			{#if showPasswordForm}
				<form
					onsubmit={handlePasswordSubmit}
					class="flex w-full flex-col gap-2 rounded-xl border border-gray-200 bg-white/80 p-3 text-left shadow-sm"
				>
					<label class="text-sm font-medium text-gray-700">
						Username or email
						<input
							type="text"
							name="username"
							autocomplete="username"
							required
							class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-base text-gray-900 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/50"
						/>
					</label>
					<label class="text-sm font-medium text-gray-700">
						Password
						<input
							type="password"
							name="password"
							autocomplete="current-password"
							required
							class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-base text-gray-900 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/50"
						/>
					</label>
					{#if passwordErrorMessage}
						<p class="text-sm text-red-600">Invalid username or password. Please try again.</p>
					{/if}
					<button
						type="submit"
						disabled={isSubmitting}
						class="mt-1 flex w-full items-center justify-center whitespace-nowrap rounded-full bg-black px-4 py-2 text-lg font-semibold text-gray-100 transition-colors hover:bg-gray-900 disabled:cursor-not-allowed disabled:bg-gray-500"
					>
						{#if isSubmitting}Submitting...{:else}Continue{/if}
					</button>
				</form>
			{/if}
			{:else}
				<button
					class="flex w-full items-center justify-center whitespace-nowrap rounded-full border-2 border-black bg-black px-5 py-2 text-lg font-semibold text-gray-100 transition-colors hover:bg-gray-900"
					onclick={(e) => {
						if (!cookiesAreEnabled()) {
							e.preventDefault();
							window.open(window.location.href, "_blank");
						}
						onclose?.();
					}}
				>
					Start chatting
				</button>
			{/if}
		</div>
	</div>
</Modal>
