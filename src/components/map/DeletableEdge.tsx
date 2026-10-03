'use client';

import { useEffect, useRef, useState } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
  type EdgeProps,
} from '@xyflow/react';
import { Trash2 } from 'lucide-react';

export default function DeletableEdge({
  id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd,
}: EdgeProps) {
  const { setEdges } = useReactFlow();
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
  });

  const [showBin, setShowBin] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  const cancelHold = () => { if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; } };

  // Once the bin is up, a press anywhere but the bin itself dismisses it.
  useEffect(() => {
    if (!showBin) return;
    const onDown = (e: PointerEvent) => {
      if (btnRef.current?.contains(e.target as Node)) return; // let the delete click through
      setShowBin(false);
    };
    const t = setTimeout(() => document.addEventListener('pointerdown', onDown), 0);
    return () => { clearTimeout(t); document.removeEventListener('pointerdown', onDown); };
  }, [showBin]);

  // Press and hold the line for 1s → the bin appears. Release early cancels.
  const beginHold = () => {
    cancelHold();
    holdTimer.current = setTimeout(() => {
      setShowBin(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setShowBin(false), 4000);
    }, 1000);
  };

  const remove = () => setEdges((eds) => eds.filter((e) => e.id !== id));

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
      {/* Wide invisible hit-area so the thin line is easy to press-and-hold. */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        style={{ cursor: 'pointer' }}
        onPointerDown={beginHold}
        onPointerUp={cancelHold}
        onPointerLeave={cancelHold}
      />
      {showBin && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <button
              ref={btnRef}
              onClick={remove}
              title="Delete this link"
              className="p-1.5 rounded-lg border shadow-lg text-rose-400 hover:bg-rose-500/15 hover:border-rose-400 transition cursor-pointer"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-outline)' }}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
