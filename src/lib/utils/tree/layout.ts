import ELK from "elkjs/lib/elk.bundled.js";
import type { Message } from "$lib/types/Message";
import { MessageRole } from "$lib/types/Message";
import { TREE_CONFIG } from "$lib/constants/treeConfig";

// Initialize ELK with default options
const elk = new ELK();

export interface TreeLayoutNode {
	id: string;
	x: number;
	y: number;
	width: number;
	height: number;
	type: "user" | "assistant" | "system";
	message: Message;
	children: TreeLayoutNode[];
	parentX?: number;
	parentY?: number;
	isOnActivePath?: boolean;
	isActive?: boolean;
	parentId?: string;
}

export interface TreeLayoutResult {
	nodes: TreeLayoutNode[];
	width: number;
	height: number;
	connections: Array<{
		id: string;
		source: TreeLayoutNode;
		target: TreeLayoutNode;
		path: string;
	}>;
}

interface ElkPort {
	id: string;
	layoutOptions?: Record<string, string>;
	width?: number;
	height?: number;
}

interface ElkEdge {
	id: string;
	sources: string[];
	targets: string[];
}

interface ExtendedElkNode {
	id: string;
	x?: number;
	y?: number;
	width?: number;
	height?: number;
	children?: ExtendedElkNode[];
	ports?: ElkPort[];
	edges?: ElkEdge[];
	layoutOptions?: Record<string, string>;
}

function getNodeWidth(message: Message): number {
	const baseSize = TREE_CONFIG.nodeSize;
	if (
		message.from === MessageRole.Assistant &&
		message.personaResponses &&
		message.personaResponses.length > 1
	) {
		const iconSize = TREE_CONFIG.iconSize;
		const spacing = TREE_CONFIG.spacing;
		const count = message.personaResponses.length;
		return Math.max(baseSize, count * iconSize + (count - 1) * spacing);
	}
	return baseSize;
}

/**
 * Builds a tree layout using ELK.js
 * @param messages All messages in the conversation
 * @param activeMessageId The currently selected/active message ID (optional)
 * @param activePathIds Optional set of message IDs that are currently visible in the chat window
 */
export async function buildTreeWithPositions(
	messages: Message[],
	activeMessageId?: string,
	activePathIds: Set<string> = new Set()
): Promise<TreeLayoutResult> {
	if (!messages || messages.length === 0) {
		return { nodes: [], width: 0, height: 0, connections: [] };
	}

	// Filter out assistant messages that are just starting (empty content, no personas yet fully loaded)
	// to prevent "flickering" or double updates.

	const messagesToHide = new Set<string>();

	const lastMessage = messages[messages.length - 1];
	if (lastMessage) {
		const isStreamingAssistant =
			lastMessage.from === MessageRole.Assistant &&
			(!lastMessage.content || lastMessage.content.length === 0) &&
			(!lastMessage.personaResponses ||
				!lastMessage.personaResponses.some((p) => p.content.length > 0));

		if (isStreamingAssistant) {
			messagesToHide.add(lastMessage.id);

			// Also hide the message that triggered this response (the parent of the streaming assistant message)
			// This handles the "User -> Assistant" flow where we want both to appear together.
			// We look up the parent ID from the ancestors list or parent property.
			const parentId = lastMessage.ancestors?.at(-1);
			if (parentId) {
				messagesToHide.add(parentId);
			}
		}
	}

	const visibleMessages = messages.filter((m) => !messagesToHide.has(m.id));

	// Map messages by ID for easy access
	const messageMap = new Map(visibleMessages.map((m) => [m.id, m]));

	// Identify roots (messages with no parent or parent not in the list)
	const getParentId = (m: Message) => m.ancestors?.at(-1);

	const roots = visibleMessages.filter(
		(m) => !m.children?.length && (!getParentId(m) || !messageMap.has(getParentId(m) ?? ""))
	);

	// Fallback for roots if none found (circular or system msg issues)
	if (roots.length === 0 && visibleMessages.length > 0) {
		// Try finding messages with parentId that doesn't exist in the current set
		const potentialRoots = visibleMessages.filter(
			(m) => !getParentId(m) || !messageMap.has(getParentId(m) ?? "")
		);
		if (potentialRoots.length > 0) {
			roots.push(...potentialRoots);
		} else {
			// Ultimate fallback: just take the first one
			roots.push(visibleMessages[0]);
		}
	}

	// Prepare ELK graph structure
	const elkNodes: ExtendedElkNode[] = [];
	const elkEdges: ElkEdge[] = [];

	// Helper to recursively build graph
	const visited = new Set<string>();

	function buildSubgraph(message: Message) {
		if (visited.has(message.id)) return;
		visited.add(message.id);

		const width = getNodeWidth(message);

		// Configure ports for multi-persona nodes
		const ports: ElkPort[] = [];
		const isMultiPersona =
			message.from === MessageRole.Assistant &&
			message.personaResponses &&
			message.personaResponses.length > 1;

		if (isMultiPersona && message.personaResponses) {
			message.personaResponses.forEach((_, index) => {
				ports.push({
					id: `${message.id}-p${index}`,
					width: 0,
					height: 0,
					layoutOptions: {
						"elk.port.side": "SOUTH",
						"elk.port.index": `${index}`,
					},
				});
			});
		}

		elkNodes.push({
			id: message.id,
			width,
			height: TREE_CONFIG.nodeSize,
			ports,
			layoutOptions: {
				"elk.portConstraints": "FIXED_ORDER",
				"elk.portAlignment.default": "CENTER",
			},
		});

		if (message.children) {
			// Sort children based on the persona they branched from to ensure correct left-to-right ordering
			const sortedChildren = [...message.children].sort((aId, bId) => {
				const a = messageMap.get(aId);
				const b = messageMap.get(bId);

				// Only relevant if parent has multiple personas
				if (!isMultiPersona) return 0;

				const getPersonaIndex = (m?: Message) => {
					if (!m?.branchedFrom?.personaId || !message.personaResponses) return -1;
					// If branched from this parent's persona, find index
					if (m.branchedFrom.messageId === message.id) {
						return message.personaResponses.findIndex(
							(p) => p.personaId === m.branchedFrom?.personaId
						);
					}
					return -1;
				};

				const idxA = getPersonaIndex(a);
				const idxB = getPersonaIndex(b);

				if (idxA === idxB) return 0;
				return idxA - idxB;
			});

			for (const childId of sortedChildren) {
				const child = messageMap.get(childId);
				if (child) {
					// Determine source port
					let sourceId = message.id;
					if (isMultiPersona && message.personaResponses) {
						let portIndex = 0; // Default to first persona/port

						if (child.branchedFrom?.messageId === message.id) {
							const idx = message.personaResponses.findIndex(
								(p) => p.personaId === child.branchedFrom?.personaId
							);
							if (idx !== -1) {
								portIndex = idx;
							}
						}
						sourceId = `${message.id}-p${portIndex}`;
					}

					elkEdges.push({
						id: `${message.id}-${childId}`,
						sources: [sourceId],
						targets: [childId],
					});
					buildSubgraph(child);
				}
			}
		}
	}

	// Build graph from all roots
	roots.forEach((root) => buildSubgraph(root));

	// Scan for any disconnected components
	visibleMessages.forEach((m) => {
		if (!visited.has(m.id)) {
			buildSubgraph(m);
		}
	});

	const graph: ExtendedElkNode = {
		id: "root",
		layoutOptions: {
			"elk.algorithm": "layered",
			"elk.direction": "DOWN",
			"elk.edgeRouting": "SPLINES",
			"elk.spacing.nodeNode": "20",
			"elk.spacing.componentComponent": "30",
			"elk.layered.spacing.nodeNodeBetweenLayers": "15",
			"elk.layered.crossingMinimization.strategy": "LAYER_SWEEP", // INTERACTIVE LAYER_SWEEP NONE
			"elk.layered.crossingMinimization.forceNodeModelOrder": "true", // true false
			"elk.layered.nodePlacement.strategy": "SIMPLE", // BRANDES_KOEPF LINEAR_SEGMENTS NETWORK_SIMPLEX SIMPLE NONE
			"elk.layered.considerModelOrder": "NONE", // NODES_AND_EDGES PERFER_NODES PREFER_EDGES NONE
		},

		children: elkNodes,
		edges: elkEdges,
	};

	// Run layout
	const layout = await elk.layout(graph);

	// Transform back to our node structure
	const resultNodes: TreeLayoutNode[] = [];
	let minX = Infinity;
	let maxX = -Infinity;
	let minY = Infinity;
	let maxY = -Infinity;

	// Helper to flatten ELK result
	function processLayoutNode(node: ExtendedElkNode) {
		if (node.children) {
			node.children.forEach(processLayoutNode);
			return;
		}

		// Leaf nodes (messages)
		if (node.id && messageMap.has(node.id)) {
			const msg = messageMap.get(node.id);
			if (!msg) return;

			const x = node.x || 0;
			const y = node.y || 0;

			minX = Math.min(minX, x);
			maxX = Math.max(maxX, x + (node.width || 24));
			minY = Math.min(minY, y);
			maxY = Math.max(maxY, y + (node.height || 24));

			const isOnActivePath = activePathIds.has(node.id);
			const isActive = activeMessageId === node.id;

			resultNodes.push({
				id: node.id,
				x,
				y,
				width: node.width || 24,
				height: node.height || 24,
				type:
					msg.from === MessageRole.User
						? "user"
						: msg.from === MessageRole.System
							? "system"
							: "assistant",
				message: msg,
				children: [], // Will populate active children logic if needed, but visual structure is flat
				isOnActivePath,
				isActive,
				parentId: getParentId(msg),
			});
		}
	}

	if (layout.children) {
		layout.children.forEach(processLayoutNode);
	}

	// Post-process to link parents for drawing lines
	const nodeMap = new Map(resultNodes.map((n) => [n.id, n]));
	const connections: TreeLayoutResult["connections"] = [];

	resultNodes.forEach((node) => {
		// Only check parent if we know it exists in our filtered map
		if (node.parentId && nodeMap.has(node.parentId)) {
			const parent = nodeMap.get(node.parentId);
			if (!parent) return;

			node.parentX = parent.x;
			node.parentY = parent.y;

			// Determine if this connection is on the active path
			// Connection is active if BOTH source and target are on the active path
			// const isConnectionActive = parent.isOnActivePath && node.isOnActivePath;

			connections.push({
				id: `${parent.id}-${node.id}`,
				source: parent,
				target: node,
				path: "", // Will be calculated in component or here if we want
			});
		}
	});

	// Normalize coordinates (start at 0,0 with padding)
	const padding = 20;
	const width = maxX - minX + padding * 2;
	const height = maxY - minY + padding * 2;

	resultNodes.forEach((node) => {
		node.x = node.x - minX + padding;
		node.y = node.y - minY + padding;
		if (node.parentX !== undefined) {
			node.parentX = node.parentX - minX + padding;
		}
		if (node.parentY !== undefined) {
			node.parentY = node.parentY - minY + padding;
		}
	});

	return {
		nodes: resultNodes,
		width: Math.max(width, 0), // Ensure non-negative
		height: Math.max(height, 0),
		connections,
	};
}
