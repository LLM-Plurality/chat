import ELK from "elkjs/lib/elk.bundled.js";
import type { Message } from "$lib/types/Message";
import { MessageRole } from "$lib/types/Message";

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

// Add explicit interface for ELK edge
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
	edges?: ElkEdge[];
	layoutOptions?: Record<string, string>;
}

// Helper to calculate node width based on content
function getNodeWidth(message: Message): number {
	const baseSize = 24;
	// For assistant messages with multiple persona responses, we need more width
	// only if we are displaying them side-by-side or in a specific way.
	// For now, the visual implementation in ConversationTreeGraph uses a fixed size
	// but renders multiple icons. We should reserve space for them to prevent overlap.
	if (
		message.from === MessageRole.Assistant &&
		message.personaResponses &&
		message.personaResponses.length > 1
	) {
		const iconSize = 18;
		const spacing = 8;
		const count = message.personaResponses.length;
		// Calculate total width needed for the horizontal layout of icons
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

	// Map messages by ID for easy access
	const messageMap = new Map(messages.map((m) => [m.id, m]));

	// Identify roots (messages with no parent or parent not in the list)
	const getParentId = (m: Message) => m.ancestors?.at(-1);

	const roots = messages.filter(
		(m) => !m.children?.length && (!getParentId(m) || !messageMap.has(getParentId(m) ?? ""))
	);

	// Fallback for roots if none found (circular or system msg issues)
	if (roots.length === 0 && messages.length > 0) {
		// Try finding messages with parentId that doesn't exist in the current set
		const potentialRoots = messages.filter(
			(m) => !getParentId(m) || !messageMap.has(getParentId(m) ?? "")
		);
		if (potentialRoots.length > 0) {
			roots.push(...potentialRoots);
		} else {
			// Ultimate fallback: just take the first one
			roots.push(messages[0]);
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

		elkNodes.push({
			id: message.id,
			width,
			height: 24,
			layoutOptions: {
				"elk.portConstraints": "FIXED_SIDE",
				"elk.portAlignment.default": "CENTER",
			},
		});

		if (message.children) {
			for (const childId of message.children) {
				const child = messageMap.get(childId);
				if (child) {
					elkEdges.push({
						id: `${message.id}-${childId}`,
						sources: [message.id],
						targets: [childId],
					});
					buildSubgraph(child);
				}
			}
		}
	}

	// Build graph from all roots
	roots.forEach((root) => buildSubgraph(root));

	// Also scan for any disconnected components that weren't reached from roots
	// (This handles cases where message history might be fragmented)
	messages.forEach((m) => {
		if (!visited.has(m.id)) {
			buildSubgraph(m);
		}
	});

	const graph: ExtendedElkNode = {
		id: "root",
		layoutOptions: {
			"elk.algorithm": "layered",
			"elk.direction": "DOWN",
			"elk.spacing.nodeNode": "20",
			"elk.layered.spacing.nodeNodeBetweenLayers": "15",
			"elk.edgeRouting": "SPLINES",
			"elk.spacing.componentComponent": "30",
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
