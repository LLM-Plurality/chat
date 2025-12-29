export type MessageUpdate =
	| MessageStatusUpdate
	| MessageTitleUpdate
	| MessageStreamUpdate
	| MessageFileUpdate
	| MessageFinalAnswerUpdate
	| MessageReasoningUpdate
	| MessageRouterMetadataUpdate
	| MessagePersonaUpdate
	| MessagePersonaInitUpdate;

export enum MessageUpdateType {
	Status = "status",
	Title = "title",
	Stream = "stream",
	File = "file",
	FinalAnswer = "finalAnswer",
	Reasoning = "reasoning",
	RouterMetadata = "routerMetadata",
	Persona = "persona",
	PersonaInit = "personaInit",
}

// Status
export enum MessageUpdateStatus {
	Started = "started",
	Error = "error",
	Finished = "finished",
	KeepAlive = "keepAlive",
}
export interface MessageStatusUpdate {
	type: MessageUpdateType.Status;
	status: MessageUpdateStatus;
	message?: string;
	messageId?: string;
}

// Everything else
export interface MessageTitleUpdate {
	type: MessageUpdateType.Title;
	title: string;
}
export interface MessageStreamUpdate {
	type: MessageUpdateType.Stream;
	token: string;
}

export enum MessageReasoningUpdateType {
	Stream = "stream",
	Status = "status",
}

export type MessageReasoningUpdate = MessageReasoningStreamUpdate | MessageReasoningStatusUpdate;

export interface MessageReasoningStreamUpdate {
	type: MessageUpdateType.Reasoning;
	subtype: MessageReasoningUpdateType.Stream;
	token: string;
}
export interface MessageReasoningStatusUpdate {
	type: MessageUpdateType.Reasoning;
	subtype: MessageReasoningUpdateType.Status;
	status: string;
}

export interface MessageFileUpdate {
	type: MessageUpdateType.File;
	name: string;
	sha: string;
	mime: string;
}
export interface MessageFinalAnswerUpdate {
	type: MessageUpdateType.FinalAnswer;
	text: string;
	interrupted: boolean;
}
export interface MessageRouterMetadataUpdate {
	type: MessageUpdateType.RouterMetadata;
	route: string;
	model: string;
}

// Multi-persona updates
export enum PersonaUpdateType {
	Stream = "stream",
	Reasoning = "reasoning",
	RouterMetadata = "routerMetadata",
	FinalAnswer = "finalAnswer",
	Status = "status",
}

export interface MessagePersonaUpdate {
	type: MessageUpdateType.Persona;
	personaId: string;
	personaName: string;
	personaOccupation?: string;
	personaStance?: string;
	updateType: PersonaUpdateType;
	token?: string;
	text?: string;
	interrupted?: boolean;
	status?: string;
	route?: string;
	model?: string;
	error?: string;
}

// Persona initialization - sent before streaming to establish order
export interface MessagePersonaInitUpdate {
	type: MessageUpdateType.PersonaInit;
	personas: Array<{
		personaId: string;
		personaName: string;
		personaOccupation?: string;
		personaStance?: string;
	}>;
}
