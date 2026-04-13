// app/dashboard/family/[userId]/tree/page.tsx
'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ReactFlow,
    ReactFlowProvider,
    Controls,
    MiniMap,
    Background,
    useNodesState,
    useEdgesState,
    Handle,
    Position,
    MarkerType,
    Connection,
    Edge,
    Node,
    ConnectionMode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { createClient } from '@/utils/supabase/client';
import {
    ArrowLeft, User, LayoutTemplate, Save, Trash2,
    X, MapPin, Quote, Settings2, Loader2
} from 'lucide-react';
import { isFamilyPlan, useAuth } from '@/components/providers/AuthProvider';
import DashboardShell from '@/components/dashboard/DashboardShell';

// ============================================================================
// 1. CUSTOM NODE COMPONENT (4 Handles, visible only on hover)
// ============================================================================
const MemorialNode = ({ data, id }: any) => {
    const handleClasses = "!w-3.5 !h-3.5 !bg-white !border-2 !border-olive !opacity-0 group-hover:!opacity-100 !transition-all !duration-200 hover:!scale-150 hover:!bg-olive/20 cursor-crosshair z-50";

    return (
        <div
            className="ft-node group relative"
            onClick={() => data.onNodeClick(id, data)}
        >
            <Handle type="source" position={Position.Top} id="top" className={handleClasses} />
            <Handle type="source" position={Position.Bottom} id="bottom" className={handleClasses} />
            <Handle type="source" position={Position.Left} id="left" className={handleClasses} />
            <Handle type="source" position={Position.Right} id="right" className={handleClasses} />

            <div className="ft-node-avatar bg-warm-border/10 border-r border-warm-border/30 flex items-center justify-center">
                {data.image ? (
                    <img src={data.image} alt={data.label} className="w-full h-full object-cover pointer-events-none" />
                ) : (
                    <User className="text-warm-dark/20 pointer-events-none" size={24} />
                )}
            </div>
            <div className="ft-node-body flex-1 overflow-hidden pointer-events-none">
                <p className="text-sm font-serif font-bold text-warm-dark truncate">{data.label || 'Unknown'}</p>
                <p className="text-[10px] text-warm-dark/50 tracking-wide mt-0.5">{data.dates || 'Dates unknown'}</p>
            </div>
        </div>
    );
};

const nodeTypes = { memorial: MemorialNode };

// ============================================================================
// AUTO-LAYOUT ALGORITHM
// ============================================================================
function computeFamilyLayout(nodes: Node[], edges: Edge[]) {
    const newNodes = [...nodes];
    const levels = new Map<string, number>();
    const spouses = new Map<string, string[]>();

    // Since we removed types visually, we treat all connections similarly for layout
    edges.forEach(edge => {
        // If you want to refine this later, you can parse the labels, but for now we
        // will just assign levels based on connections.
        if (!levels.has(edge.source)) levels.set(edge.source, 0);
        if (!levels.has(edge.target)) levels.set(edge.target, (levels.get(edge.source) || 0) + 1);
    });

    newNodes.forEach(node => {
        if (!levels.has(node.id)) {
            levels.set(node.id, 0);
        }
    });

    const levelCounts = new Map<number, number>();
    const HORIZONTAL_SPACING = 240;
    const VERTICAL_SPACING = 150;

    newNodes.forEach(node => {
        const level = levels.get(node.id) || 0;
        const currentXIndex = levelCounts.get(level) || 0;

        node.position = {
            x: currentXIndex * HORIZONTAL_SPACING,
            y: level * VERTICAL_SPACING
        };

        levelCounts.set(level, currentXIndex + 1);
    });

    return newNodes;
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================
function FamilyTreeGraph({ userId }: { userId: string }) {
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const [rawMemorials, setRawMemorials] = useState<any[]>([]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const supabase = createClient();

    const [pendingConnection, setPendingConnection] = useState<Connection | null>(null);
    const [selectedNodeData, setSelectedNodeData] = useState<any | null>(null);
    const [selectedEdgeData, setSelectedEdgeData] = useState<Edge | null>(null);

    // ─── INIT & DATA FETCHING ──────────────────────────────────────────────────
    const loadGraph = useCallback(async (forceAutoLayout = false) => {
        setLoading(true);
        try {
            const { data: memorials } = await supabase
                .from('memorials')
                .select('*')
                .eq('user_id', userId)
                .eq('mode', 'family')
                .eq('deleted', false);

            setRawMemorials(memorials || []);

            const { data: relations } = await supabase
                .from('memorial_relations')
                .select('*')
                .or(`from_memorial_id.in.(${memorials?.map(m => m.id).join(',')}),to_memorial_id.in.(${memorials?.map(m => m.id).join(',')})`);

            const savedPositions = JSON.parse(localStorage.getItem(`family-tree-positions-${userId}`) || '{}');

            let initialNodes: Node[] = (memorials || []).map(m => {
                const birthYear = m.birth_date ? new Date(m.birth_date).getFullYear() : '';
                const deathYear = m.death_date ? new Date(m.death_date).getFullYear() : '';

                return {
                    id: m.id,
                    type: 'memorial',
                    position: (!forceAutoLayout && savedPositions[m.id]) ? savedPositions[m.id] : { x: 0, y: 0 },
                    data: {
                        label: m.full_name || 'Unknown',
                        image: m.profile_photo_url,
                        dates: birthYear ? `${birthYear} ${deathYear ? `- ${deathYear}` : ''}` : '',
                        raw: m,
                        onNodeClick: handleNodeClick
                    }
                };
            });

            // FILTER DUPLICATE VISUAL LINES (Because DB creates A->B and B->A)
            const processedPairs = new Set<string>();
            const initialEdges: Edge[] = [];

            (relations || []).forEach(rel => {
                // Sort IDs so A-B and B-A generate the exact same string
                const pairKey = [rel.from_memorial_id, rel.to_memorial_id].sort().join('-');

                // Only draw one line per pair of memorials
                if (!processedPairs.has(pairKey)) {
                    processedPairs.add(pairKey);
                    initialEdges.push(createEdgeObject(
                        rel.id,
                        rel.from_memorial_id,
                        rel.to_memorial_id,
                        rel.description, // We just pass the description as the label
                        rel.source_handle,
                        rel.target_handle
                    ));
                }
            });

            if (forceAutoLayout || Object.keys(savedPositions).length === 0) {
                initialNodes = computeFamilyLayout(initialNodes, initialEdges);
            }

            setNodes(initialNodes);
            setEdges(initialEdges);
        } catch (err) {
            console.error("Failed to load family tree:", err);
        } finally {
            setLoading(false);
        }
    }, [userId, setNodes, setEdges]);

    useEffect(() => {
        loadGraph();
    }, [loadGraph]);

    const onNodeDragStop = () => {
        const positions: Record<string, { x: number, y: number }> = {};
        nodes.forEach(n => {
            positions[n.id] = n.position;
        });
        localStorage.setItem(`family-tree-positions-${userId}`, JSON.stringify(positions));
    };

    // ─── EDGE CREATION HELPER ──────────────────────────────────────────────────
    const createEdgeObject = (
        id: string,
        source: string,
        target: string,
        label?: string | null,
        sourceHandle?: string | null,
        targetHandle?: string | null
    ): Edge => {
        return {
            id: id,
            source,
            target,
            sourceHandle: sourceHandle || undefined,
            targetHandle: targetHandle || undefined,
            type: 'smoothstep',
            label: label || 'Connected',
            data: { description: label },
            animated: false,
            style: {
                strokeWidth: 2.5,
                stroke: '#5a6b78', // Always solid charcoal line
                strokeDasharray: 'none', // No dashes
            },
            markerEnd: undefined, // NO ARROWS
            labelStyle: { fill: '#5a6b78', fontWeight: 600, fontSize: 10, fontFamily: 'sans-serif' },
            labelBgStyle: { fill: '#fdf6f0', fillOpacity: 0.8, rx: 4 },
        };
    };

    const onConnect = useCallback((connection: Connection) => {
        setPendingConnection(connection);
    }, []);

    const handleNodeClick = (nodeId: string, nodeData: any) => {
        setSelectedNodeData(nodeData);
    };

    const onEdgeClick = (event: React.MouseEvent, edge: Edge) => {
        event.stopPropagation();
        setSelectedEdgeData(edge);
    };

    // ============================================================================
    // SAVING CONNECTION TO DB
    // ============================================================================
    const confirmConnection = async (description: string) => {
        if (!pendingConnection) return;
        setSaving(true);

        const sourceId = pendingConnection.source;
        const targetId = pendingConnection.target;
        const sourceHandle = pendingConnection.sourceHandle;
        const targetHandle = pendingConnection.targetHandle;

        try {
            const res = await fetch('/api/family/link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fromId: sourceId,
                    toId: targetId,
                    type: 'other', // Default type for the database since we removed the dropdown
                    description: description,
                    sourceHandle: sourceHandle,
                    targetHandle: targetHandle
                })
            });

            if (!res.ok) throw new Error('Failed to create link via API');

            await loadGraph();
            setPendingConnection(null);

        } catch (err) {
            console.error(err);
            alert("Failed to save connection. Please check your database permissions.");
        } finally {
            setSaving(false);
        }
    };

    const updateEdge = async (newLabel: string) => {
        if (!selectedEdgeData) return;
        setSaving(true);
        try {
            // Because we hid the duplicate reverse lines, we need to update BOTH lines in DB
            // matching these two memorials.
            const sourceId = selectedEdgeData.source;
            const targetId = selectedEdgeData.target;

            const { data: relatedEdges } = await supabase
                .from('memorial_relations')
                .select('id')
                .or(`and(from_memorial_id.eq.${sourceId},to_memorial_id.eq.${targetId}),and(from_memorial_id.eq.${targetId},to_memorial_id.eq.${sourceId})`);

            if (relatedEdges) {
                const edgeIds = relatedEdges.map(e => e.id);
                await supabase
                    .from('memorial_relations')
                    .update({ description: newLabel })
                    .in('id', edgeIds);
            }

            await loadGraph();
            setSelectedEdgeData(null);
        } catch (err) {
            alert("Failed to update connection.");
        } finally {
            setSaving(false);
        }
    };

    const deleteEdge = async () => {
        if (!selectedEdgeData) return;
        if (!confirm("Remove this connection?")) return;
        setSaving(true);
        try {
            // Delete BOTH the forward and reverse relations between these two memorials
            const sourceId = selectedEdgeData.source;
            const targetId = selectedEdgeData.target;

            await supabase
                .from('memorial_relations')
                .delete()
                .or(`and(from_memorial_id.eq.${sourceId},to_memorial_id.eq.${targetId}),and(from_memorial_id.eq.${targetId},to_memorial_id.eq.${sourceId})`);

            await loadGraph();
            setSelectedEdgeData(null);
        } catch (err) {
            alert("Failed to delete connection.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="relative min-h-[70vh] w-full flex-1 bg-surface-low">
            {loading && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-surface-low/50 backdrop-blur-sm">
                    <Loader2 className="animate-spin text-olive" size={32} />
                </div>
            )}

            {/* Floating Toolbar */}
            <div className="absolute top-4 right-4 z-40 flex gap-2">
                <button
                    onClick={() => loadGraph(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-warm-border/40 rounded-xl shadow-sm text-sm font-medium text-warm-dark hover:bg-warm-border/10 transition-all"
                >
                    <LayoutTemplate size={16} className="text-olive" />
                    Auto-Arrange
                </button>
            </div>

            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeDragStop={onNodeDragStop}
                onEdgeClick={onEdgeClick}
                nodeTypes={nodeTypes}
                connectionMode={ConnectionMode.Loose}
                fitView
                className="touch-auto"
            >
                <Background color="#e8d8cc" gap={24} size={1} />
                <Controls className="ft-controls" />
                <MiniMap className="ft-minimap hidden md:block" nodeColor="#89b896" maskColor="rgba(253,246,240,0.8)" />
            </ReactFlow>

            {/* NEW CONNECTION POPUP */}
            {pendingConnection && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-warm-dark/40 backdrop-blur-sm p-4">
                    <div className="ft-popup w-full max-w-sm p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-serif text-xl text-warm-dark">Define Relationship</h3>
                            <button onClick={() => setPendingConnection(null)} className="text-warm-dark/40 hover:text-warm-dark"><X size={20} /></button>
                        </div>

                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const formData = new FormData(e.currentTarget);
                            confirmConnection(formData.get('label') as string);
                        }}>
                            <div className="space-y-4 mb-6">
                                <div>
                                    <label className="block text-xs font-medium text-warm-dark/50 uppercase tracking-wider mb-2">
                                        Relationship Name
                                    </label>
                                    <input
                                        name="label"
                                        type="text"
                                        required
                                        placeholder="e.g. Mother, Best Friend, Husband"
                                        className="glass-input w-full px-3 py-2 border border-warm-border/40 rounded-lg focus:ring-2 focus:ring-olive/30 outline-none text-warm-dark"
                                        autoFocus
                                    />
                                </div>
                            </div>
                            <button type="submit" disabled={saving} className="glass-btn-dark w-full py-3 bg-warm-dark text-surface-low rounded-lg font-medium hover:bg-warm-dark/90 transition-all flex items-center justify-center gap-2">
                                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Create Link
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* NODE INFO POPUP */}
            {selectedNodeData && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-warm-dark/40 backdrop-blur-sm p-4">
                    <div className="ft-popup w-full max-w-md p-6 relative">
                        <button onClick={() => setSelectedNodeData(null)} className="absolute top-4 right-4 p-2 bg-warm-border/10 hover:bg-warm-border/30 rounded-full transition-all">
                            <X size={16} className="text-warm-dark" />
                        </button>

                        <div className="flex flex-col items-center text-center mt-2">
                            <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-surface-low shadow-lg bg-warm-border/10 flex items-center justify-center mb-4">
                                {selectedNodeData.image ? (
                                    <img src={selectedNodeData.image} alt={selectedNodeData.label} className="w-full h-full object-cover" />
                                ) : (
                                    <User className="text-warm-dark/20" size={48} />
                                )}
                            </div>
                            <h2 className="font-serif text-3xl text-warm-dark mb-1">{selectedNodeData.label}</h2>
                            <p className="text-sm font-medium text-warm-dark/50 uppercase tracking-wider mb-4">{selectedNodeData.dates}</p>

                            {selectedNodeData.raw.birth_place && (
                                <div className="flex items-center gap-2 text-sm text-warm-dark/70 mb-4 bg-warm-border/10 px-3 py-1.5 rounded-full">
                                    <MapPin size={14} className="text-warm-muted" /> {selectedNodeData.raw.birth_place}
                                </div>
                            )}

                            {selectedNodeData.raw.step1?.epitaph && (
                                <div className="relative py-4 px-6 mt-2 mb-6 border-y border-warm-border/30 w-full">
                                    <Quote size={24} className="text-olive/20 absolute top-2 left-2" />
                                    <p className="font-serif italic text-warm-dark/80">"{selectedNodeData.raw.step1.epitaph}"</p>
                                </div>
                            )}

                            <Link
                                href={`/person/${selectedNodeData.raw.id}`}
                                target="_blank"
                                className="w-full py-3 bg-olive text-surface-low rounded-lg font-medium hover:bg-olive/90 transition-all flex items-center justify-center gap-2"
                            >
                                Open Full Archive
                            </Link>
                        </div>
                    </div>
                </div>
            )}

            {/* EDGE EDIT POPUP */}
            {selectedEdgeData && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-warm-dark/40 backdrop-blur-sm p-4">
                    <div className="ft-popup w-full max-w-sm p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-serif text-xl text-warm-dark flex items-center gap-2"><Settings2 size={20} className="text-warm-muted" /> Edit Connection</h3>
                            <button onClick={() => setSelectedEdgeData(null)} className="text-warm-dark/40 hover:text-warm-dark"><X size={20} /></button>
                        </div>

                        <form onSubmit={(e) => {
                            e.preventDefault();
                            updateEdge(new FormData(e.currentTarget).get('label') as string);
                        }}>
                            <div className="mb-6">
                                <label className="block text-xs font-medium text-warm-dark/50 uppercase tracking-wider mb-2">Relationship Name</label>
                                <input
                                    name="label"
                                    type="text"
                                    required
                                    defaultValue={(selectedEdgeData.data?.description as string) || ''}
                                    placeholder="e.g. Mother, Best Friend"
                                    className="glass-input w-full px-3 py-2 border border-warm-border/40 rounded-lg focus:ring-2 focus:ring-olive/30 outline-none text-warm-dark"
                                />
                            </div>
                            <div className="flex gap-3">
                                <button type="submit" disabled={saving} className="glass-btn-dark flex-1 py-3 bg-warm-dark text-surface-low rounded-lg font-medium hover:bg-warm-dark/90 transition-all flex items-center justify-center gap-2">
                                    <Save size={16} /> Save
                                </button>
                                <button type="button" onClick={deleteEdge} disabled={saving} className="px-4 py-3 bg-red-50 text-red-600 rounded-lg font-medium hover:bg-red-100 transition-all flex items-center justify-center">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

// ============================================================================
// NEXT.JS PAGE WRAPPER
// ============================================================================
export default function FamilyTreePage({ params }: { params: Promise<{ userId: string }> }) {
    const unwrappedParams = use(params);
    const auth = useAuth();
    const router = useRouter();

    // Auth guard: only family plan users can access the constellation
    useEffect(() => {
        if (auth.loading) return;
        if (!auth.authenticated) {
            router.replace('/login?next=/dashboard');
            return;
        }
        if (auth.user && auth.user.id !== unwrappedParams.userId) {
            router.replace(`/dashboard/family/${auth.user.id}/tree`);
            return;
        }
        if (!isFamilyPlan(auth.plan)) {
            router.replace(`/dashboard`);
        }
    }, [auth.loading, auth.authenticated, auth.user, auth.plan, router, unwrappedParams.userId]);

    if (auth.loading || !isFamilyPlan(auth.plan) || auth.user?.id !== unwrappedParams.userId) {
        return (
            <div className="min-h-screen bg-surface-low flex items-center justify-center">
                <Loader2 size={28} className="text-warm-muted/40 animate-spin" />
            </div>
        );
    }

    return (
        <DashboardShell userId={unwrappedParams.userId}>
        <div className="min-h-screen lg:h-screen flex flex-col bg-surface-low">
            {/* Header */}
            <div className="bg-white border-b border-warm-border/30 shadow-sm flex-none z-50 relative">
                <div className="max-w-[1920px] mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link
                            href={`/dashboard/family/${unwrappedParams.userId}`}
                            className="p-2 hover:bg-warm-border/10 rounded-lg transition-colors border border-warm-border/20"
                            title="Back to Dashboard"
                        >
                            <ArrowLeft size={18} className="text-warm-dark/60" />
                        </Link>
                        <div>
                            <h1 className="font-serif text-2xl text-warm-dark leading-none">Family Tree</h1>
                            <p className="text-xs text-warm-dark/50 mt-1">Drag nodes to organize. Hover over a card to reveal connection points.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* React Flow Canvas */}
            <ReactFlowProvider>
                <FamilyTreeGraph userId={unwrappedParams.userId} />
            </ReactFlowProvider>
        </div>
        </DashboardShell>
    );
}
