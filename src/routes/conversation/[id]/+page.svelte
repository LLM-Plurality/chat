<script lang="ts">
	import ChatWindow from "$lib/components/chat/ChatWindow.svelte";
	import { pendingMessage } from "$lib/stores/pendingMessage";
	import { isAborted } from "$lib/stores/isAborted";
	import { onMount, tick, untrack } from "svelte";
	import { page } from "$app/state";
	import { beforeNavigate, goto, invalidate } from "$app/navigation";
	import { base } from "$app/paths";
	import { ERROR_MESSAGES, error } from "$lib/stores/errors";
	import { findCurrentModel } from "$lib/utils/models";
	import { UrlDependency } from "$lib/types/UrlDependency";
	import { type Message, MessageRole } from "$lib/types/Message";
	import {
		MessageReasoningUpdateType,
		MessageUpdateStatus,
		MessageUpdateType,
	} from "$lib/types/MessageUpdate";
	import titleUpdate from "$lib/stores/titleUpdate";
	import file2base64 from "$lib/utils/file2base64";
	import { addChildren } from "$lib/utils/tree/addChildren";
	import { addSibling } from "$lib/utils/tree/addSibling";
	import { fetchMessageUpdates } from "$lib/utils/messageUpdates";
	import type { v4 } from "uuid";
	import { useSettingsStore } from "$lib/stores/settings.js";
	import { browser } from "$app/environment";
	import {
		addBackgroundGeneration,
		hasBackgroundGeneration,
		removeBackgroundGeneration,
	} from "$lib/stores/backgroundGenerations";
	import type { TreeNode, TreeId } from "$lib/utils/tree/tree";
	import "katex/dist/katex.min.css";
	import { updateDebouncer } from "$lib/utils/updates.js";
	import { setConversationTree, clearConversationTree } from "$lib/stores/conversationTree";
	import { resetActivePersonasToDefaults } from "$lib/utils/personaDefaults";
	import { 
		createMessagesPath, 
		createMessagesAlternatives, 
		detectCurrentBranch, 
		filterMessagesByBranch 
	} from "$lib/utils/tree/branching";
	import { mergeMessages } from "$lib/utils/mergeMessages";
	import { writeMessage as writeMessageLogic } from "$lib/utils/messageSender";

	let { data = $bindable() } = $props();

	let loading = $state(false);
	let pending = $state(false);
	let initialRun = true;

	let files: File[] = $state([]);

	let conversations = $state(data.conversations);
	$effect(() => {
		conversations = data.conversations;
	});

	function getMessagesPath(messages: any[], msgId?: string) {
		if (initialRun) {
			if (!msgId && page.url.searchParams.get("leafId")) {
				msgId = page.url.searchParams.get("leafId") as string;
				page.url.searchParams.delete("leafId");
			}
			if (!msgId && page.url.searchParams.get("msgId")) {
				msgId = page.url.searchParams.get("msgId") as string;
			}
			if (!msgId && browser && localStorage.getItem("leafId")) {
				msgId = localStorage.getItem("leafId") as string;
			}
			initialRun = false;
		}
		return createMessagesPath(messages, msgId);
	}

	async function convFromShared() {
		try {
			loading = true;

			await resetActivePersonasToDefaults(
				settings,
				$settings.personas,
				$settings.activePersonas
			);
			const res = await fetch(`${base}/conversation`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					fromShare: page.params.id,
					model: data.model,
				}),
			});

			if (!res.ok) {
				error.set(await res.text());
				console.error("Error while creating conversation: " + (await res.text()));
				return;
			}

			const { conversationId } = await res.json();

			return conversationId;
		} catch (err) {
			error.set(ERROR_MESSAGES.default);
			console.error(String(err));
			throw err;
		}
	}
	
	async function writeMessage({
		prompt,
		messageId = messagesPath.at(-1)?.id ?? undefined,
		isRetry = false,
		isContinue = false,
		personaId,
	}: {
		prompt?: string;
		messageId?: ReturnType<typeof v4>;
		isRetry?: boolean;
		isContinue?: boolean;
		personaId?: string;
	}): Promise<void> {
		await writeMessageLogic(
			{
				page: { params: { id: page.params.id! } },
				messages,
				messagesPath: messagesPath as Message[],
				data: { rootMessageId: data.rootMessageId ?? "" },
				files,
				settings: {
					disableStream: $settings.disableStream ?? false,
					personas: $settings.personas,
				},
				isAborted: () => $isAborted,
				branchState,
				
				// Setters
				setLoading: (val) => (loading = val),
				setPending: (val) => (pending = val),
				setFiles: (val) => (files = val),
				setError: (val) => ($error = val),
				setIsAborted: (val) => ($isAborted = val),
				setTitleUpdate: (val) => ($titleUpdate = val),
				onTitleUpdate: (title) => {
					const convInData = conversations.find(({ id }) => id === page.params.id);
					if (convInData) {
						convInData.title = title;
					}
				},
				onMessageCreated: (id) => {
					targetMessageId = id;
				},
				updateBranchState: (val: unknown) => updateBranchState(val as typeof branchState),
				invalidate,
				goto,
			},
			{
				prompt,
				messageId,
				isRetry,
				isContinue,
				personaId,
			}
		);
	}

	onMount(async () => {
		if (browser) {
			const trackingKey = `branchTracking_${page.params.id}`;
			const storedTracking = localStorage.getItem(trackingKey);
			if (storedTracking) {
				try {
					const parsed = JSON.parse(storedTracking);
					previousBranchMessageId = parsed.messageId ?? null;
					previousBranchPersonaId = parsed.personaId ?? null;
				} catch (e) {
					console.error("Failed to parse stored tracking:", e);
					localStorage.removeItem(trackingKey);
				}
			}
			
			const storageKey = `branchState_${page.params.id}`;
			const storedBranch = localStorage.getItem(storageKey);
			if (storedBranch) {
				try {
					const parsed = JSON.parse(storedBranch);
					updateBranchState(parsed);
				} catch (e) {
					console.error("Failed to parse stored branch state:", e);
					localStorage.removeItem(storageKey);
				}
			}
		}

		// only used in case of creating new conversations (from the parent POST endpoint)
		if ($pendingMessage) {
			files = $pendingMessage.files;
			await writeMessage({ prompt: $pendingMessage.content });
			$pendingMessage = undefined;
		}
	});

	async function onMessage(content: string) {
		if (!data.shared) {
			await writeMessage({ prompt: content });
		} else {
			await convFromShared()
				.then(async (convId) => {
					await goto(`${base}/conversation/${convId}`, { invalidateAll: true });
				})
				.then(async () => await writeMessage({ prompt: content }))
				.finally(() => (loading = false));
		}
	}

	async function onRetry(payload: { id: Message["id"]; content?: string; personaId?: string }) {
		const lastMsgId = payload.id;
		targetMessageId = lastMsgId;

		// Restore active personas from the original message's responses if this is an edit
		if (payload.content) {
			const msgToEdit = messages.find((m) => m.id === payload.id);
			if (msgToEdit?.children) {
				const childMessages = msgToEdit.children
					.map((childId) => messages.find((m) => m.id === childId))
					.filter((m) => m !== undefined) as Message[];

				const previousPersonas = new Set<string>();

				for (const child of childMessages) {
					// Check for unified persona responses
					if (child.personaResponses) {
						child.personaResponses.forEach((pr) => previousPersonas.add(pr.personaId));
					}
				}

				if (previousPersonas.size > 0) {
					settings.instantSet({
						activePersonas: Array.from(previousPersonas),
					});
				}
			}
		}

		if (!data.shared) {
			await writeMessage({
				prompt: payload.content,
				messageId: payload.id,
				isRetry: true,
				personaId: payload.personaId,
			});
		} else {
			await convFromShared()
				.then(async (convId) => {
					await goto(`${base}/conversation/${convId}`, { invalidateAll: true });
				})
				.then(
					async () =>
						await writeMessage({
							prompt: payload.content,
							messageId: payload.id,
							isRetry: true,
							personaId: payload.personaId,
						})
				)
				.finally(() => (loading = false));
		}
	}

	async function onShowAlternateMsg(payload: { id: Message["id"] }) {
		const msgId = payload.id;
		targetMessageId = msgId;
	}

	async function onContinue(payload: { id: Message["id"] }) {
		if (!data.shared) {
			await writeMessage({ messageId: payload.id, isContinue: true });
		} else {
			await convFromShared()
				.then(async (convId) => {
					await goto(`${base}/conversation/${convId}`, { invalidateAll: true });
				})
				.then(
					async () =>
						await writeMessage({
							messageId: payload.id,
							isContinue: true,
						})
				)
				.finally(() => (loading = false));
		}
	}

	const settings = useSettingsStore();

	// Branch state: tracks when we're creating a new branch
	let branchState = $state<{
		messageId: string;
		personaId: string;
		personaName: string;
	} | null>(null);

// Delay persona syncing to avoid clobbering user edits
let branchSyncTimeout: ReturnType<typeof setTimeout> | null = null;

	// Track which message to display (for navigation within tree)
	let targetMessageId = $state<string | undefined>(undefined);
	// Removed: let pendingNavigationId = $state<string | null>(null);
	
	// Persist branch state to localStorage whenever it changes
	function updateBranchState(newState: typeof branchState) {
		branchState = newState;
		
		if (browser) {
			const storageKey = `branchState_${page.params.id}`;
			if (newState) {
				localStorage.setItem(storageKey, JSON.stringify(newState));
			} else {
				localStorage.removeItem(storageKey);
			}
		}
	}

	function onBranch(messageId: string, personaId: string) {
		const persona = $settings.personas?.find((p) => p.id === personaId);
		
		// Validate branch point exists
		const branchPointMessage = messages.find(m => m.id === messageId);
		if (!branchPointMessage) {
			console.error('Branch point not found:', messageId.slice(0, 8));
			$error = "Cannot create branch: message not found.";
			return;
		}
		
		// Set branch state - writeMessage will use this when user sends a message
		updateBranchState({
			messageId,
			personaId,
			personaName: persona?.name || personaId,
		});
		
		// Navigate to branch point
		targetMessageId = messageId;
		
		// Focus input for user to type
		setTimeout(() => {
			const textarea = document.querySelector('textarea[placeholder]');
			if (textarea instanceof HTMLTextAreaElement) {
				textarea.focus();
			}
		}, 100);
	}

	let messages = $state(data.messages);
	let lastDataMessages = data.messages;

	$effect(() => {
		// If the server messages array hasn't changed identity, don't touch local state.
		if (data.messages === lastDataMessages) return;
		
		lastDataMessages = data.messages;

		// Only sync from server if we are NOT currently writing/streaming a message
		if (!loading && !pending) {
			messages = data.messages;
		}
		
		// Restore branchState from localStorage after data reload
		untrack(() => {
			const currentBranchState = branchState;
			if (browser && !currentBranchState) {
				const storageKey = `branchState_${page.params.id}`;
				const storedBranch = localStorage.getItem(storageKey);
				if (storedBranch) {
					try {
						const parsed = JSON.parse(storedBranch);
						updateBranchState(parsed);
					} catch (e) {
						console.error("Failed to restore branch state:", e);
					}
				}
			}
		});
	});
	
	// Track last processed msgId to prevent infinite loops
	let lastProcessedMsgId = $state<string | null>(null);
	
	// Handle tree node navigation via URL parameters
	$effect(() => {
		const url = page.url;
		const msgIdParam = url.searchParams.get("msgId");
		const keepBranch = url.searchParams.get("keepBranch") === "true";
		
		if (!msgIdParam) {
			lastProcessedMsgId = null;
			return;
		}
		
		if (messages.length === 0) return;
		if (msgIdParam === lastProcessedMsgId) return;
		
		const clickedMessage = messages.find(m => m.id === msgIdParam);
		if (!clickedMessage) return;
		
		lastProcessedMsgId = msgIdParam;
		
		// Clean up URL parameters
		const urlObj = new URL(page.url);
		const shouldScroll = urlObj.searchParams.get('scrollTo') === 'true';
		urlObj.searchParams.delete("msgId");
		urlObj.searchParams.delete('scrollTo');
		urlObj.searchParams.delete('keepBranch');
		goto(urlObj.pathname + urlObj.search, { replaceState: true, noScroll: true });
		
		if (keepBranch) {
			targetMessageId = msgIdParam;
		} else {
			if (clickedMessage.branchedFrom) {
				const persona = $settings.personas?.find((p) => p.id === clickedMessage.branchedFrom!.personaId);
				updateBranchState({
					messageId: clickedMessage.branchedFrom.messageId,
					personaId: clickedMessage.branchedFrom.personaId,
					personaName: persona?.name || clickedMessage.branchedFrom.personaId,
				});
			} else {
				updateBranchState(null);
			}
			
			targetMessageId = msgIdParam;
		}
		
		if (shouldScroll) {
			setTimeout(() => {
				const messageElement = document.querySelector(`[data-message-id="${msgIdParam}"]`);
				if (messageElement) {
					messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
				}
			}, 200);
		}
	});
	
	function isConversationStreaming(msgs: Message[]): boolean {
		const lastAssistant = [...msgs].reverse().find((msg) => msg.from === MessageRole.Assistant);
		if (!lastAssistant) return false;
		
		// Check for errors
		const hasError =
			lastAssistant.updates?.some(
				(update) =>
					update.type === MessageUpdateType.Status && update.status === MessageUpdateStatus.Error
			) ?? false;
		if (hasError) return false;
		
		// Check if multi-persona mode
		if (lastAssistant.personaResponses && lastAssistant.personaResponses.length > 0) {
			// Check if we have a Finished status (sent when all personas complete)
			const hasFinished =
				lastAssistant.updates?.some(
					(update) =>
						update.type === MessageUpdateType.Status &&
						update.status === MessageUpdateStatus.Finished
				) ?? false;
			if (hasFinished) return false;
			
			// In multi-persona mode, check if all personas have sent their final answers
			const allPersonasComplete = lastAssistant.personaResponses.every((pr) => {
				// A persona is complete if interrupted field is defined (set when final answer arrives)
				// The interrupted field is only set when updateType === "finalAnswer" is processed
				return pr.interrupted !== undefined;
			});
			return !allPersonasComplete;
		}
		
		// Single persona mode: check for FinalAnswer update
		const hasFinalAnswer =
			lastAssistant.updates?.some((update) => update.type === MessageUpdateType.FinalAnswer) ??
			false;
		return !hasFinalAnswer;
	}

	$effect(() => {
		const streaming = isConversationStreaming(messages);
		if (streaming) {
			loading = true;
		} else if (!pending) {
			loading = false;
		}

		if (!streaming && browser) {
			removeBackgroundGeneration(page.params.id!);
		}
	});

	// Filter messages by branch first, THEN create the path
	let filteredMessages = $derived(filterMessagesByBranch(messages, branchState || detectCurrentBranch(messages, null, $settings.personas)));
	
	let messagesPath = $derived(getMessagesPath(filteredMessages, targetMessageId));
	let messagesAlternatives = $derived(createMessagesAlternatives(messages));
	
	// Detect active branch for UI display
	let activeBranch = $derived(detectCurrentBranch(messagesPath, branchState, $settings.personas));

	// Keep track of pre-branch activePersonas for restoration
	let preBranchActivePersonas = $state<string[]>([]);
	
	// Track previous branch values to detect actual changes
	let previousBranchMessageId = $state<string | null>(null);
	let previousBranchPersonaId = $state<string | null>(null);
	
	
	// Persist tracking variables to localStorage
	$effect(() => {
		if (browser) {
			const trackingKey = `branchTracking_${page.params.id}`;
			if (previousBranchMessageId || previousBranchPersonaId) {
				localStorage.setItem(trackingKey, JSON.stringify({
					messageId: previousBranchMessageId,
					personaId: previousBranchPersonaId,
				}));
			} else {
				localStorage.removeItem(trackingKey);
			}
		}
	});
	
	// Sync activePersonas with current branch
	$effect(() => {
		if (!page.url.pathname.includes('/conversation/')) {
			return;
		}
		
		const currentMessageId = branchState?.messageId ?? null;
		const currentPersonaId = branchState?.personaId ?? null;
		
		const branchChanged = 
			previousBranchMessageId !== currentMessageId ||
			previousBranchPersonaId !== currentPersonaId;
		
		if (branchState && branchChanged) {
			// Save original activePersonas when first entering any branch
			if (previousBranchMessageId === null && preBranchActivePersonas.length === 0) {
				preBranchActivePersonas = [...$settings.activePersonas];
			}
			
			if (branchSyncTimeout) {
				clearTimeout(branchSyncTimeout);
				branchSyncTimeout = null;
			}
			
			// Delay persona sync slightly so manual changes can settle
			branchSyncTimeout = setTimeout(() => {
				settings.instantSet({
					activePersonas: [currentPersonaId!],
				});
				
				previousBranchMessageId = currentMessageId;
				previousBranchPersonaId = currentPersonaId;
				branchSyncTimeout = null;
			}, 250);
		} else if (!branchState && (previousBranchMessageId !== null || previousBranchPersonaId !== null)) {
			// Exiting branch - restore original activePersonas
			if (branchSyncTimeout) {
				clearTimeout(branchSyncTimeout);
				branchSyncTimeout = null;
			}
			
			if (preBranchActivePersonas.length > 0) {
				settings.instantSet({
					activePersonas: preBranchActivePersonas,
				});
				preBranchActivePersonas = [];
			}
			
			previousBranchMessageId = null;
			previousBranchPersonaId = null;
		}
	});

	$effect(() => {
		if (browser && messagesPath.at(-1)?.id) {
			localStorage.setItem("leafId", messagesPath.at(-1)?.id as string);
		}
	});

	beforeNavigate((navigation) => {
		if (!page.params.id) return;

		const navigatingAway =
			navigation.to?.route.id !== page.route.id || navigation.to?.params?.id !== page.params.id;

		if (loading && navigatingAway) {
			addBackgroundGeneration({ id: page.params.id!, startedAt: Date.now() });
		}

		$isAborted = true;
		loading = false;
	});

	onMount(() => {
		const hasBackgroundEntry = hasBackgroundGeneration(page.params.id!);
		const streaming = isConversationStreaming(messages);
		if (hasBackgroundEntry && streaming) {
			addBackgroundGeneration({ id: page.params.id!, startedAt: Date.now() });
			loading = true;
		}
	});

	let title = $derived.by(() => {
		const rawTitle = conversations.find((conv) => conv.id === page.params.id)?.title ?? data.title;
		return rawTitle ? rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1) : rawTitle;
	});

	// Update conversation tree store for sidebar
	$effect(() => {
		if (browser && page.params.id && messages.length > 0) {
			setConversationTree(
				page.params.id,
				messages,
				targetMessageId || messagesPath.at(-1)?.id,
				branchState,
				messagesPath.map(m => m.id)
			);
		}
	});
</script>

<svelte:head>
	<title>{title}</title>
</svelte:head>

<ChatWindow
	{loading}
	{pending}
	messages={messagesPath as Message[]}
	{messagesAlternatives}
	shared={data.shared}
	preprompt={data.preprompt}
	personaId={(data as any).personaId}
	branchState={activeBranch}
	bind:files
	onmessage={onMessage}
	onretry={onRetry}
	oncontinue={onContinue}
	onshowAlternateMsg={onShowAlternateMsg}
	onbranch={onBranch}
	onstop={async () => {
		await fetch(`${base}/conversation/${page.params.id}/stop-generating`, {
			method: "POST",
		}).then((r) => {
			if (r.ok) {
				setTimeout(() => {
					$isAborted = true;
					loading = false;
				}, 500);
			} else {
				$isAborted = true;
				loading = false;
			}
		});
	}}
	models={data.models}
	currentModel={findCurrentModel(data.models, data.oldModels, data.model)}
/>
