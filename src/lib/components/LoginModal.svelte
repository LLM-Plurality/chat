<script lang="ts">
	import { base } from "$app/paths";
	import { page } from "$app/state";

	import LogoHuggingFaceBorderless from "$lib/components/icons/LogoHuggingFaceBorderless.svelte";
	import Modal from "$lib/components/Modal.svelte";
	import { cookiesAreEnabled } from "$lib/utils/cookiesAreEnabled";
	import Logo from "./icons/Logo.svelte";
	import CarbonCopy from "~icons/carbon/copy";
	import CarbonCheckmark from "~icons/carbon/checkmark";
	import CarbonView from "~icons/carbon/view";
	import CarbonViewOff from "~icons/carbon/view-off";
	import { usePublicConfig } from "$lib/utils/PublicConfig.svelte";

	const publicConfig = usePublicConfig();

	interface Props {
		onclose?: () => void;
	}

	let { onclose }: Props = $props();

	let showPasswordForm = $state(false);
	let isRegistering = $state(false);
	let isRecovering = $state(false);
	let passwordErrorMessage = $state("");
	let passwordSuccessMessage = $state("");
	let isSubmitting = $state(false);
	
	let recoveryKey = $state("");
	let recoveryKeyCopied = $state(false);
	let passwordVisible = $state(false);
	let passwordInput = $state("");

	let usernameInput = $state("");

	async function handlePasswordSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (isSubmitting) return;

		if (!cookiesAreEnabled()) {
			window.open(window.location.href, "_blank");
			return;
		}

		isSubmitting = true;
		passwordErrorMessage = "";
		passwordSuccessMessage = "";

		const formData = new FormData(event.target as HTMLFormElement);
		const body = Object.fromEntries(formData.entries());

		try {
			if (isRecovering) {
				const response = await fetch(`${base}/login/recover`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(body),
				});

				if (response.ok) {
					const data = await response.json();
					if (data.newRecoveryKey) {
						isRecovering = false;
						recoveryKey = data.newRecoveryKey;
						passwordSuccessMessage = "Password reset successfully. Please save your NEW recovery key.";
					} else {
						isRecovering = false;
						isRegistering = false;
						passwordSuccessMessage = "Password reset successfully. Please sign in.";
					}
				} else {
					const result = await response.json();
					passwordErrorMessage = result.message || "Recovery failed";
				}
			} else if (isRegistering) {
				const response = await fetch(`${base}/login/register`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(body),
				});

				if (response.ok) {
					const data = await response.json();
					recoveryKey = data.recoveryKey;
				} else {
					const result = await response.json();
					passwordErrorMessage = result.message || "Registration failed";
				}
			} else {
				const response = await fetch(`${base}/login/password`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(body),
				});

				if (response.ok) {
					window.location.href = `${base}/`;
				} else {
					const result = await response.json();
					passwordErrorMessage = result.message || "Invalid username or password";
				}
			}
		} catch (e) {
			console.error(e);
			passwordErrorMessage = "An error occurred. Please try again.";
		} finally {
			isSubmitting = false;
		}
	}

	function handleCopyRecoveryKey() {
		navigator.clipboard.writeText(recoveryKey);
		recoveryKeyCopied = true;
	}

	function handleCloseRecoveryModal() {
		if (passwordSuccessMessage && passwordSuccessMessage.includes("NEW recovery key")) {
			recoveryKey = "";
			recoveryKeyCopied = false;
			isRecovering = false;
			isRegistering = false;
			passwordSuccessMessage = "Password updated successfully. Please sign in with your new password.";
		} else {
			window.location.href = `${base}/`;
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

		{#if recoveryKey}
			<div class="flex w-full flex-col items-center gap-4">
				<h3 class="text-xl font-semibold text-gray-800">
					{#if passwordSuccessMessage && passwordSuccessMessage.includes("NEW recovery key")}
						Password Updated!
					{:else}
						Account Created!
					{/if}
				</h3>
				<p class="text-sm text-gray-600 text-balance">
					{#if passwordSuccessMessage && passwordSuccessMessage.includes("NEW recovery key")}
						Your password has been updated.
						<br/><br/>
						Your old recovery key has been invalidated. <strong>Save this NEW key safely.</strong> It is now the ONLY way to recover your account.
					{:else}
						Save this Recovery Key safely. <strong>It is the ONLY way to recover your account</strong> if you forget your password.
					{/if}
				</p>

				<div class="flex w-full items-center gap-2 rounded-md border border-gray-200 bg-gray-50 p-2">
					<code class="flex-1 break-all font-mono text-sm text-gray-800">
						{recoveryKey}
					</code>
					<button
						onclick={handleCopyRecoveryKey}
						class="flex h-8 w-8 flex-none items-center justify-center rounded-md text-gray-500 hover:bg-gray-200 hover:text-black transition-colors"
						title="Copy Recovery Key"
					>
						{#if recoveryKeyCopied}
							<CarbonCheckmark class="text-green-600" />
						{:else}
							<CarbonCopy />
						{/if}
					</button>
				</div>

				<button
					onclick={handleCloseRecoveryModal}
					disabled={!recoveryKeyCopied}
					class="mt-2 w-full rounded-full bg-black px-5 py-2 text-lg font-semibold text-gray-100 transition-colors hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
				>
					I have saved my key
				</button>
			</div>
		{:else}
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

					{#if !showPasswordForm}
						<button
							type="button"
							onclick={() => {
								showPasswordForm = true;
								isRegistering = false;
								isRecovering = false;
								passwordInput = "";
								passwordErrorMessage = "";
								passwordSuccessMessage = "";
							}}
							class="flex w-full items-center justify-center whitespace-nowrap rounded-full border-2 border-black bg-white px-5 py-2 text-lg font-semibold text-gray-800 transition-colors hover:bg-gray-100"
						>
							Sign in with username/password
						</button>
					{/if}

					{#if showPasswordForm}
						<form
							onsubmit={handlePasswordSubmit}
							class="flex w-full flex-col gap-2 rounded-xl border border-gray-200 bg-white/80 p-3 text-left shadow-sm"
						>
							<div class="mb-2 text-center">
								<h3 class="text-lg font-semibold">
									{#if isRecovering}
										Reset Password
									{:else if isRegistering}
										Create Account
									{:else}
										Sign In
									{/if}
								</h3>
							</div>

							<label class="text-sm font-medium text-gray-700">
								Username
								<input
									type="text"
									name="username"
									autocomplete="username"
									required
									bind:value={usernameInput}
									class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-base text-gray-900 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/50"
								/>
							</label>

							{#if isRecovering}
								<label class="text-sm font-medium text-gray-700">
									Recovery Key
									<input
										type="text"
										name="recoveryKey"
										autocomplete="off"
										required
										class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-base text-gray-900 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/50"
									/>
								</label>
								<label class="text-sm font-medium text-gray-700">
									New Password
									<div class="relative mt-1">
										<input
											type={passwordVisible ? "text" : "password"}
											name="newPassword"
											autocomplete="new-password"
											required
											minlength="8"
											bind:value={passwordInput}
											class="w-full rounded-md border border-gray-300 pl-3 pr-20 py-2 text-base text-gray-900 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/50"
										/>
										<div class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
											<button
												type="button"
												class="p-1 text-gray-500 hover:text-black"
												onclick={() => (passwordVisible = !passwordVisible)}
												title={passwordVisible ? "Hide password" : "Show password"}
											>
												{#if passwordVisible}
													<CarbonViewOff />
												{:else}
													<CarbonView />
												{/if}
											</button>
										</div>
									</div>
								</label>
							{:else}
								{#if isRegistering}
									<label class="text-sm font-medium text-gray-700">
										Email (Optional)
										<input
											type="email"
											name="email"
											autocomplete="email"
											class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-base text-gray-900 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/50"
										/>
									</label>
								{/if}

								<label class="text-sm font-medium text-gray-700">
									Password
									<div class="relative mt-1">
										<input
											type={passwordVisible ? "text" : "password"}
											name="password"
											autocomplete={isRegistering ? "new-password" : "current-password"}
											required
											minlength="8"
											bind:value={passwordInput}
											class="w-full rounded-md border border-gray-300 pl-3 pr-20 py-2 text-base text-gray-900 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/50"
										/>
										<div class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
											<button
												type="button"
												class="p-1 text-gray-500 hover:text-black"
												onclick={() => (passwordVisible = !passwordVisible)}
												title={passwordVisible ? "Hide password" : "Show password"}
											>
												{#if passwordVisible}
													<CarbonViewOff />
												{:else}
													<CarbonView />
												{/if}
											</button>
										</div>
									</div>
								</label>
							{/if}

							{#if passwordErrorMessage}
								<p class="text-sm text-red-600">{passwordErrorMessage}</p>
							{/if}
							{#if passwordSuccessMessage}
								<p class="text-sm text-green-600">{passwordSuccessMessage}</p>
							{/if}

							<button
								type="submit"
								disabled={isSubmitting}
								class="mt-1 flex w-full items-center justify-center whitespace-nowrap rounded-full bg-black px-4 py-2 text-lg font-semibold text-gray-100 transition-colors hover:bg-gray-900 disabled:cursor-not-allowed disabled:bg-gray-500"
							>
								{#if isSubmitting}
									Submitting...
								{:else}
									{#if isRecovering}
										Reset Password
									{:else if isRegistering}
										Create Account
									{:else}
										Sign In
									{/if}
								{/if}
							</button>

							{#if !isRecovering && !isRegistering}
								<div class="mt-1 text-center">
									<button type="button" onclick={() => { isRecovering = true; isRegistering = false; passwordInput = ""; passwordErrorMessage = ""; passwordSuccessMessage = ""; }} class="text-sm text-gray-500 hover:underline">Forgot Password?</button>
								</div>
							{/if}

							<div class="mt-2 text-center text-sm text-gray-600">
								{#if isRecovering}
									Remember it? <button type="button" onclick={() => { isRecovering = false; passwordInput = ""; passwordErrorMessage = ""; passwordSuccessMessage = ""; }} class="font-semibold underline">Sign in</button>
								{:else if isRegistering}
									Already have an account? <button type="button" onclick={() => { isRegistering = false; passwordInput = ""; passwordErrorMessage = ""; passwordSuccessMessage = ""; }} class="font-semibold underline">Sign in</button>
								{:else}
									Don't have an account? <button type="button" onclick={() => { isRegistering = true; passwordInput = ""; passwordErrorMessage = ""; passwordSuccessMessage = ""; }} class="font-semibold underline">Create one</button>
								{/if}
							</div>
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
		{/if}
	</div>
</Modal>
