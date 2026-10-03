'use client';

import { createContext, useContext, useRef, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { ExternalLink, Pencil, Pin, PinOff, Trash2 } from 'lucide-react';

export type LearningStatus = 'learning' | 'done';

export interface TopicNodeData {
  topic: string;
  link: string;
  pinned: boolean;
  courseId?: string;
  status?: LearningStatus;
  [key: string]: unknown;
}

/** Purple for "learning", green for "done". */
export const STATUS_COLOR: Record<LearningStatus, string> = {
  learning: '#C56BF5',
  done: '#22c55e',
};

/** Line/border colour for a node's status, or null when not started. */
export function statusColor(status: LearningStatus | undefined): string | null {
  return status ? STATUS_COLOR[status] : null;
}

/** none → learning → done → none. */
export function nextStatus(status: LearningStatus | undefined): LearningStatus | undefined {
  if (!status) return 'learning';
  if (status === 'learning') return 'done';
  return undefined;
}

/** How long a card must be held before its status advances. */
const HOLD_MS = 3000;

interface NodeActions {
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
  onCycleStatus: (id: string) => void;
  /** Click one card's dot, then another's, to connect them (alt. to dragging). */
  onHandleClick: (nodeId: string, side: string) => void;
  /** The node whose dot is armed for a click-connection, for highlighting. */
  connectFromId: string | null;
  pinningId: string | null;
}

/** Editor supplies the card actions here so they never end up in saved node data. */
export const MapNodeActionsContext = createContext<NodeActions>({
  onEdit: () => {},
  onDelete: () => {},
  onTogglePin: () => {},
  onCycleStatus: () => {},
  onHandleClick: () => {},
  connectFromId: null,
  pinningId: null,
});

const SIDES: { pos: Position; key: string }[] = [
  { pos: Position.Top, key: 'top' },
  { pos: Position.Right, key: 'right' },
  { pos: Position.Bottom, key: 'bottom' },
  { pos: Position.Left, key: 'left' },
];

const HANDLE_STYLE = { width: 9, height: 9, background: '#8b5cf6', border: '1px solid #0b0d10' };

export default function TopicNode({ id, data, selected }: NodeProps) {
  const { onEdit, onDelete, onTogglePin, onCycleStatus, onHandleClick, connectFromId, pinningId } = useContext(MapNodeActionsContext);
  const d = data as TopicNodeData;
  const busy = pinningId === id;
  const sColor = statusColor(d.status);
  const armed = connectFromId === id;

  // 3-second press-and-hold advances the learning status. A drag (pointer
  // moves) or an early release cancels it, so holding is distinct from moving
  // the card around the canvas.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const [holding, setHolding] = useState(false);

  const cancelHold = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    start.current = null;
    setHolding(false);
  };

  const beginHold = (e: React.PointerEvent) => {
    if (e.button !== 0) return; // left-press only
    start.current = { x: e.clientX, y: e.clientY };
    setHolding(true);
    timer.current = setTimeout(() => {
      onCycleStatus(id);
      cancelHold();
    }, HOLD_MS);
  };

  const maybeCancelOnMove = (e: React.PointerEvent) => {
    if (!start.current) return;
    const moved = Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y);
    if (moved > 6) cancelHold(); // it's a drag, not a hold
  };

  const border = sColor ?? (selected ? '#a78bfa' : 'var(--color-outline)');

  return (
    <div
      onPointerDown={beginHold}
      onPointerMove={maybeCancelOnMove}
      onPointerUp={cancelHold}
      onPointerLeave={cancelHold}
      className={`relative rounded-2xl border px-4 py-3 w-fit min-w-[14rem] max-w-[24rem] shadow-lg transition ${
        holding ? 'animate-pulse' : ''
      } ${d.pinned && !sColor ? 'ring-1 ring-violet-400/50' : ''}`}
      style={{
        background: 'var(--color-surface)',
        borderColor: border,
        boxShadow: sColor ? `0 0 0 1px ${sColor}, 0 8px 24px -12px ${sColor}` : undefined,
      }}
    >
      {/* Four sides, each usable as connection start and end. Drag between dots
          to connect, or click one dot then another card's dot. */}
      {SIDES.map(({ pos, key }) => (
        <div key={key}>
          <Handle id={`t-${key}`} type="target" position={pos} style={HANDLE_STYLE} />
          <Handle
            id={`s-${key}`}
            type="source"
            position={pos}
            onClick={() => onHandleClick(id, key)}
            style={{ ...HANDLE_STYLE, ...(armed ? { background: '#22c55e', width: 12, height: 12 } : {}) }}
          />
        </div>
      ))}

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-bold text-sm break-words" style={{ color: 'var(--color-on-surface)' }}>{d.topic || 'Untitled topic'}</div>
          {d.link ? (
            <a href={d.link} target="_blank" rel="noopener noreferrer" onPointerDown={(e) => e.stopPropagation()}
              className="mt-1 flex items-center gap-1 text-[10px] text-violet-400 hover:text-violet-300 truncate max-w-full">
              <ExternalLink className="w-3 h-3 shrink-0" /> <span className="truncate">{d.link.replace(/^https?:\/\//, '')}</span>
            </a>
          ) : (
            <div className="mt-1 text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>No course link</div>
          )}
        </div>
        <button
          onClick={() => onTogglePin(id)}
          onPointerDown={(e) => e.stopPropagation()}
          disabled={busy}
          title={d.pinned ? 'Pinned to your courses — click to unpin' : 'Pin to your courses'}
          style={d.pinned ? undefined : { borderColor: 'var(--color-outline)', color: 'var(--color-on-surface-variant)' }}
          className={`shrink-0 p-1 rounded-lg border transition cursor-pointer disabled:opacity-40 ${
            d.pinned ? 'text-violet-300 border-violet-400/40 bg-violet-500/10' : 'hover:text-violet-400'
          }`}
        >
          {d.pinned ? <Pin className="w-3.5 h-3.5" /> : <PinOff className="w-3.5 h-3.5" />}
        </button>
      </div>

      <div className="mt-2 flex items-center gap-1.5">
        <button onClick={() => onEdit(id)} onPointerDown={(e) => e.stopPropagation()} title="Edit" className="p-1 rounded-lg border transition cursor-pointer hover:text-violet-400" style={{ borderColor: 'var(--color-outline)', color: 'var(--color-on-surface-variant)' }}>
          <Pencil className="w-3 h-3" />
        </button>
        <button onClick={() => onDelete(id)} onPointerDown={(e) => e.stopPropagation()} title="Delete card" className="p-1 rounded-lg border transition cursor-pointer hover:text-rose-400 hover:border-rose-400" style={{ borderColor: 'var(--color-outline)', color: 'var(--color-on-surface-variant)' }}>
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
