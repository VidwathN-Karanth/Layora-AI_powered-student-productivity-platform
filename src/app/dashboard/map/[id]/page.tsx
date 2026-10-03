'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ArrowLeft, Check, Info, Link2, Loader2, MousePointerClick, Pin, Plus, Trash2, X } from 'lucide-react';

import { apiFetch, errorMessage, readJson } from '@/lib/apiClient';
import { useStore } from '@/store/useStore';
import TopicNode, { MapNodeActionsContext, nextStatus, statusColor, type TopicNodeData } from '@/components/map/TopicNode';
import DeletableEdge from '@/components/map/DeletableEdge';
import type { MapGraph, MapNode } from '@/lib/mapsData';

const TUTORIAL_KEY = 'layora.map.tutorialSeen';

type FlowNode = Node<TopicNodeData>;

const uid = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

/** Strip React Flow internals down to what we persist. */
function serialize(nodes: FlowNode[], edges: Edge[]): MapGraph {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      position: n.position,
      data: {
        topic: n.data.topic || '',
        link: n.data.link || '',
        pinned: Boolean(n.data.pinned),
        ...(n.data.courseId ? { courseId: n.data.courseId } : {}),
        ...(n.data.status ? { status: n.data.status } : {}),
      },
    })) as MapNode[],
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
    })),
  };
}

function MapEditor() {
  const router = useRouter();
  const mapId = String(useParams().id);
  const { screenToFlowPosition } = useReactFlow();
  const themeMode = useStore((s) => s.themeMode);
  const isLight = themeMode === 'light';

  const [title, setTitle] = useState('');
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [pinningId, setPinningId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; topic: string; link: string } | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [connectFrom, setConnectFrom] = useState<{ nodeId: string; side: string } | null>(null);

  // Suppress the autosave that would otherwise fire right after the initial load.
  const hydratedRef = useRef(false);

  const nodeTypes = useMemo(() => ({ topic: TopicNode }), []);
  const edgeTypes = useMemo(() => ({ deletable: DeletableEdge }), []);

  // First-ever visit: open the tutorial once (skippable). Per-browser only.
  useEffect(() => {
    queueMicrotask(() => {
      try {
        if (!localStorage.getItem(TUTORIAL_KEY)) setInfoOpen(true);
      } catch { /* private mode — just skip the auto-open */ }
    });
  }, []);

  const dismissTutorial = () => {
    setInfoOpen(false);
    try { localStorage.setItem(TUTORIAL_KEY, '1'); } catch { /* ignore */ }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await readJson<{ map: { title: string; data: MapGraph } }>(
          await apiFetch(`/api/maps/${mapId}`)
        );
        if (cancelled) return;
        setTitle(data.map.title);
        setNodes((data.map.data?.nodes || []).map((n) => ({ ...n, type: 'topic' })) as FlowNode[]);
        setEdges((data.map.data?.edges || []).map((e) => ({ ...e, type: 'deletable' })) as Edge[]);
      } catch (err) {
        if (!cancelled) setError(errorMessage(err, 'Could not load the map.'));
      } finally {
        if (!cancelled) { setLoading(false); requestAnimationFrame(() => { hydratedRef.current = true; }); }
      }
    })();
    return () => { cancelled = true; };
  }, [mapId, setNodes, setEdges]);

  // One place that writes to the server; returns the promise so pinning can flush first.
  const save = useCallback(async () => {
    setSaveState('saving');
    try {
      await apiFetch(`/api/maps/${mapId}`, {
        method: 'PATCH',
        body: JSON.stringify({ title, data: serialize(nodes, edges) }),
      });
      setSaveState('saved');
    } catch (err) {
      setError(errorMessage(err, 'Could not save.'));
      setSaveState('idle');
    }
  }, [mapId, title, nodes, edges]);

  // Debounced autosave on any change to title / graph.
  useEffect(() => {
    if (!hydratedRef.current) return;
    setSaveState('saving');
    const t = setTimeout(() => { void save(); }, 800);
    return () => clearTimeout(t);
  }, [title, nodes, edges, save]);

  const onConnect = useCallback(
    (c: Connection) => setEdges((eds) => addEdge({ ...c, id: uid('e'), type: 'deletable' }, eds)),
    [setEdges]
  );

  // Click-to-connect: click one card's dot, then another's. First click arms
  // the source; the second on a different card creates the link.
  const onHandleClick = useCallback((nodeId: string, side: string) => {
    setConnectFrom((from) => {
      if (!from) return { nodeId, side };
      if (from.nodeId === nodeId) return null; // same card → cancel
      setEdges((eds) => addEdge({
        id: uid('e'),
        source: from.nodeId,
        sourceHandle: `s-${from.side}`,
        target: nodeId,
        targetHandle: `t-${side}`,
        type: 'deletable',
      }, eds));
      return null;
    });
  }, [setEdges]);

  // Esc or a click on empty canvas cancels a pending click-connection.
  useEffect(() => {
    if (!connectFrom) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setConnectFrom(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [connectFrom]);

  const addCard = useCallback(() => {
    const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    const id = uid('n');
    setNodes((nds) => [
      ...nds,
      { id, type: 'topic', position: { x: center.x - 112, y: center.y - 40 }, data: { topic: '', link: '', pinned: false } },
    ]);
    setEditing({ id, topic: '', link: '' });
  }, [screenToFlowPosition, setNodes]);

  const onEdit = useCallback((id: string) => {
    const n = nodes.find((x) => x.id === id);
    if (n) setEditing({ id, topic: n.data.topic || '', link: n.data.link || '' });
  }, [nodes]);

  const saveEdit = useCallback(() => {
    if (!editing) return;
    setNodes((nds) => nds.map((n) => n.id === editing.id
      ? { ...n, data: { ...n.data, topic: editing.topic.trim(), link: editing.link.trim() } }
      : n));
    setEditing(null);
  }, [editing, setNodes]);

  const onDelete = useCallback((id: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  }, [setNodes, setEdges]);

  const onTogglePin = useCallback(async (id: string) => {
    const node = nodes.find((n) => n.id === id);
    if (!node) return;
    const nextPinned = !node.data.pinned;
    setPinningId(id);
    setError('');
    try {
      await save(); // ensure the server has this node before it looks it up
      const res = await apiFetch(`/api/maps/${mapId}/pin`, {
        method: 'POST',
        body: JSON.stringify({ nodeId: id, pinned: nextPinned }),
      });
      const payload = await readJson<{ node: { data: TopicNodeData }; error?: string }>(res);
      setNodes((nds) => nds.map((n) => n.id === id
        ? { ...n, data: { ...n.data, pinned: payload.node.data.pinned, courseId: payload.node.data.courseId } }
        : n));
    } catch (err) {
      setError(errorMessage(err, 'Could not update the pin.'));
    } finally {
      setPinningId(null);
    }
  }, [nodes, mapId, save, setNodes]);

  const onCycleStatus = useCallback((id: string) => {
    setNodes((nds) => nds.map((n) => {
      if (n.id !== id) return n;
      const next = nextStatus(n.data.status);
      const data = { ...n.data };
      if (next) data.status = next; else delete data.status;
      return { ...n, data };
    }));
  }, [setNodes]);

  const actions = useMemo(
    () => ({ onEdit, onDelete, onTogglePin, onCycleStatus, onHandleClick, connectFromId: connectFrom?.nodeId ?? null, pinningId }),
    [onEdit, onDelete, onTogglePin, onCycleStatus, onHandleClick, connectFrom, pinningId]
  );

  // Edges take the colour of the card they connect — target first, else source —
  // so a path lights up (purple = learning, green = done) as you progress.
  const styledEdges = useMemo(() => {
    const statusById = new Map(nodes.map((n) => [n.id, n.data.status]));
    return edges.map((e) => {
      const color = statusColor(statusById.get(e.target)) ?? statusColor(statusById.get(e.source));
      return color
        ? { ...e, style: { stroke: color, strokeWidth: 2.5 } }
        : e;
    });
  }, [edges, nodes]);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center gap-3 mb-3">
        <button onClick={() => router.push('/dashboard/map')} className="p-2 rounded-lg border transition cursor-pointer" style={{ borderColor: 'var(--color-outline)', color: 'var(--color-on-surface-variant)' }} title="Back to maps">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled map"
          style={{ color: 'var(--color-on-surface)' }}
          className="flex-1 min-w-0 bg-transparent text-lg font-bold focus:outline-none border-b border-transparent focus:border-white/20"
        />
        <span className="text-[11px] font-mono flex items-center gap-1.5 w-20 justify-end" style={{ color: 'var(--color-on-surface-variant)' }}>
          {saveState === 'saving' ? (<><Loader2 className="w-3 h-3 animate-spin" /> Saving</>)
            : saveState === 'saved' ? (<><Check className="w-3 h-3 text-emerald-400" /> Saved</>) : null}
        </span>
        <button
          onClick={() => setInfoOpen(true)}
          title="How maps work"
          aria-label="How maps work"
          className="p-2 rounded-lg border transition cursor-pointer hover:text-violet-400"
          style={{ borderColor: 'var(--color-outline)', color: 'var(--color-on-surface-variant)' }}
        >
          <Info className="w-4 h-4" />
        </button>
        <button onClick={addCard} className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-xs font-bold uppercase tracking-wider transition cursor-pointer hover:brightness-110" style={{ background: '#8b5cf6' }}>
          <Plus className="w-4 h-4" /> Add card
        </button>
      </div>

      {connectFrom && (
        <p className="text-[11px] font-mono mb-2 flex items-center gap-1.5" style={{ color: '#8b5cf6' }}>
          <MousePointerClick className="w-3.5 h-3.5" /> Click another card&rsquo;s dot to connect · <kbd>Esc</kbd> to cancel
        </p>
      )}
      {error && <p className="text-[11px] text-rose-300 font-mono mb-2">{error}</p>}

      <div
        className="flex-1 rounded-2xl border overflow-hidden"
        style={{ background: 'var(--color-cyber-dark)', borderColor: 'var(--color-outline)' }}
      >
        {loading ? (
          <div className="h-full flex items-center justify-center text-xs font-mono" style={{ color: 'var(--color-on-surface-variant)' }}>Loading…</div>
        ) : (
          <MapNodeActionsContext.Provider value={actions}>
            <ReactFlow
              nodes={nodes}
              edges={styledEdges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onPaneClick={() => setConnectFrom(null)}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              defaultEdgeOptions={{ type: 'deletable' }}
              colorMode={themeMode}
              fitView
              proOptions={{ hideAttribution: true }}
            >
              <Background
                variant={BackgroundVariant.Dots}
                gap={22}
                size={1.6}
                color={isLight ? '#98a0b0' : '#5a6273'}
              />
              <Controls
                style={{
                  // Solid, theme-aware buttons — the default was invisible on the dark canvas.
                  ['--xy-controls-button-background-color' as string]: isLight ? '#ffffff' : '#272B31',
                  ['--xy-controls-button-background-color-hover' as string]: isLight ? '#eef0f4' : '#32373E',
                  ['--xy-controls-button-color' as string]: isLight ? '#16181C' : '#F2F2F7',
                  ['--xy-controls-button-color-hover' as string]: '#8b5cf6',
                  ['--xy-controls-button-border-color' as string]: 'var(--color-outline)',
                }}
              />
              <MiniMap
                pannable
                zoomable
                bgColor={isLight ? '#eef0f4' : '#16181C'}
                nodeColor={(n) => statusColor((n.data as TopicNodeData)?.status) ?? '#8b5cf6'}
                nodeStrokeColor={(n) => statusColor((n.data as TopicNodeData)?.status) ?? '#8b5cf6'}
                nodeStrokeWidth={3}
                nodeBorderRadius={6}
                maskColor={isLight ? 'rgba(120,130,150,0.18)' : 'rgba(0,0,0,0.55)'}
                maskStrokeColor="#8b5cf6"
                maskStrokeWidth={2}
                style={{ border: '1px solid var(--color-outline)', borderRadius: 8 }}
              />
            </ReactFlow>
          </MapNodeActionsContext.Provider>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div onClick={() => setEditing(null)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div role="dialog" aria-modal="true" className="glass-panel border p-6 rounded-2xl max-w-md w-full relative z-10 space-y-3" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-outline)' }}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold" style={{ color: 'var(--color-on-surface)' }}>Card</h3>
              <button onClick={() => setEditing(null)} className="cursor-pointer" style={{ color: 'var(--color-on-surface-variant)' }}><X className="w-4 h-4" /></button>
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase" style={{ color: 'var(--color-on-surface-variant)' }}>Topic name</label>
              <input value={editing.topic} onChange={(e) => setEditing({ ...editing, topic: e.target.value })} autoFocus placeholder="e.g. Hooks & state"
                style={{ background: 'var(--color-surface-container-lowest)', borderColor: 'var(--color-outline)', color: 'var(--color-on-surface)' }}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase" style={{ color: 'var(--color-on-surface-variant)' }}>Course link (URL)</label>
              <input value={editing.link} onChange={(e) => setEditing({ ...editing, link: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); }} placeholder="https://…"
                style={{ background: 'var(--color-surface-container-lowest)', borderColor: 'var(--color-outline)', color: 'var(--color-on-surface)' }}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none" />
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <button onClick={() => setEditing(null)} className="px-4 py-2 border rounded-xl text-xs font-bold cursor-pointer" style={{ borderColor: 'var(--color-outline)', color: 'var(--color-on-surface-variant)' }}>CANCEL</button>
              <button onClick={saveEdit} className="px-4 py-2 rounded-xl text-xs font-bold cursor-pointer text-white" style={{ background: '#8b5cf6' }}>SAVE</button>
            </div>
          </div>
        </div>
      )}

      {infoOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div onClick={dismissTutorial} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div role="dialog" aria-modal="true" className="glass-panel border p-6 rounded-2xl max-w-md w-full relative z-10 space-y-4" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-outline)', color: 'var(--color-on-surface)' }}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold flex items-center gap-2"><Info className="w-4 h-4 text-violet-400" /> How maps work</h3>
              <button onClick={dismissTutorial} className="cursor-pointer" style={{ color: 'var(--color-on-surface-variant)' }}><X className="w-4 h-4" /></button>
            </div>

            <ul className="space-y-3 text-xs">
              <li className="flex gap-3">
                <Plus className="w-4 h-4 shrink-0 mt-0.5 text-violet-400" />
                <span><strong>Add card</strong> — top-right. Each card is a topic with an optional course link.</span>
              </li>
              <li className="flex gap-3">
                <Link2 className="w-4 h-4 shrink-0 mt-0.5 text-violet-400" />
                <span><strong>Link cards</strong> — drag from one card&rsquo;s dot to another&rsquo;s. Or <strong>click one dot, then another card&rsquo;s dot</strong>.</span>
              </li>
              <li className="flex gap-3">
                <Trash2 className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <span><strong>Delete a link</strong> — press and <strong>hold the line for 1 second</strong>; a bin appears — tap it.</span>
              </li>
              <li className="flex gap-3">
                <MousePointerClick className="w-4 h-4 shrink-0 mt-0.5 text-violet-400" />
                <span><strong>Track learning</strong> — press and <strong>hold a card for 3 seconds</strong>: once → <span style={{ color: '#C56BF5' }}>Learning</span>, again → <span style={{ color: '#22c55e' }}>Done</span>, a third time clears it. Lines take the colour of the card they point to.</span>
              </li>
              <li className="flex gap-3">
                <Pin className="w-4 h-4 shrink-0 mt-0.5 text-violet-400" />
                <span><strong>Pin</strong> (top-right of a card) — adds that topic to your Courses and the browser extension.</span>
              </li>
            </ul>

            <div className="flex justify-end gap-3 pt-1">
              <button onClick={dismissTutorial} className="px-4 py-2 border rounded-xl text-xs font-bold cursor-pointer" style={{ borderColor: 'var(--color-outline)', color: 'var(--color-on-surface-variant)' }}>SKIP</button>
              <button onClick={dismissTutorial} className="px-4 py-2 rounded-xl text-xs font-bold cursor-pointer text-white" style={{ background: '#8b5cf6' }}>GOT IT</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MapEditorPage() {
  return (
    <ReactFlowProvider>
      <MapEditor />
    </ReactFlowProvider>
  );
}
