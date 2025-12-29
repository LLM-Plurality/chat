import type { Message } from "./Message";
import type { v4 } from "uuid";
import type { goto, invalidate } from "$app/navigation";

export interface WriteMessageContext {
	page: { params: { id: string } };
	messages: Message[];
	messagesPath: Message[];
	data: { rootMessageId: string };
	files: File[];
	settings: {
		disableStream: boolean;
		personas?: Array<{ id: string; name: string }>;
	};
	isAborted: () => boolean;
	branchState: {
		messageId: string;
		personaId: string;
		personaName: string;
	} | null;

	setLoading: (val: boolean) => void;
	setPending: (val: boolean) => void;
	setFiles: (val: File[]) => void;
	setError: (val: string) => void;
	setIsAborted: (val: boolean) => void;
	setTitleUpdate: (val: { title: string; convId: string }) => void;
	onTitleUpdate?: (title: string) => void;
	onMessageCreated?: (id: string) => void;
	updateBranchState: (val: unknown) => void;
	invalidate: typeof invalidate;
	goto: typeof goto;
}

export interface WriteMessageParams {
	prompt?: string;
	messageId?: ReturnType<typeof v4>;
	isRetry?: boolean;
	isContinue?: boolean;
	personaId?: string;
}
