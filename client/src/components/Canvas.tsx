import React, { useRef, useEffect, useState, useCallback } from 'react';
import { CanvasElement, UserPresence } from '../engine/types';
import { ToolType } from './Toolbar';

interface CanvasProps {
  elements: CanvasElement[];
  users: UserPresence[];
  currentTool: ToolType;
  currentColor: string;
  onElementCreate: (element: CanvasElement) => void;
  onCursorMove: (x: number, y: number) => void;
}

export const Canvas: React.FC<CanvasProps> = ({
  elements,
  users,
  currentTool,
  currentColor,
  onElementCreate,
  onCursorMove,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const currentPoints = useRef<number[]>([]);
  const startPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Resize canvas to full window
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // Main Render Loop (60 FPS)
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Render Grid Background
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Render CRDT Elements
    for (const elem of elements) {
      ctx.save();
      const d = elem.data;

      switch (elem.type) {
        case 'stroke': {
          const pts = d.points as number[];
          if (pts && pts.length >= 4) {
            ctx.strokeStyle = d.color || '#3B82F6';
            ctx.lineWidth = d.width || 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(pts[0], pts[1]);
            for (let i = 2; i < pts.length; i += 2) {
              ctx.lineTo(pts[i], pts[i + 1]);
            }
            ctx.stroke();
          }
          break;
        }

        case 'rectangle': {
          ctx.strokeStyle = d.color || '#3B82F6';
          ctx.lineWidth = 3;
          ctx.strokeRect(d.x, d.y, d.width, d.height);
          break;
        }

        case 'circle': {
          ctx.strokeStyle = d.color || '#3B82F6';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(d.x, d.y, Math.abs(d.radius), 0, Math.PI * 2);
          ctx.stroke();
          break;
        }

        case 'sticky': {
          ctx.fillStyle = d.color || '#F59E0B';
          ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
          ctx.shadowBlur = 10;
          ctx.shadowOffsetY = 4;
          ctx.fillRect(d.x, d.y, 140, 100);

          ctx.shadowColor = 'transparent';
          ctx.fillStyle = '#0f172a';
          ctx.font = '14px sans-serif';
          ctx.fillText(d.text || 'Sticky Note', d.x + 12, d.y + 30);
          break;
        }
      }
      ctx.restore();
    }

    // Render Remote User Cursors with Presence Badges
    for (const user of users) {
      if (!user.cursor) continue;
      const { x, y } = user.cursor;

      ctx.save();
      // Cursor Arrow
      ctx.fillStyle = user.color || '#EC4899';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 16, y + 12);
      ctx.lineTo(x + 8, y + 14);
      ctx.lineTo(x + 4, y + 22);
      ctx.closePath();
      ctx.fill();

      // User Label Tag
      ctx.fillStyle = user.color || '#EC4899';
      ctx.beginPath();
      ctx.roundRect(x + 14, y + 14, user.userName.length * 8 + 14, 20, 6);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(user.userName, x + 20, y + 28);
      ctx.restore();
    }
  }, [elements, users]);

  useEffect(() => {
    let animId: number;
    const loop = () => {
      render();
      animId = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(animId);
  }, [render]);

  // Mouse / Touch Event Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDrawing(true);
    startPos.current = { x, y };

    if (currentTool === 'pen') {
      currentPoints.current = [x, y];
    } else if (currentTool === 'sticky') {
      // Create sticky immediately on click
      const newElem: CanvasElement = {
        id: `sticky-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        type: 'sticky',
        data: { x: x - 70, y: y - 50, color: currentColor, text: 'Brainstorm idea...' },
        lamport: 0,
        updatedAt: Date.now(),
        clientId: '',
      };
      onElementCreate(newElem);
      setIsDrawing(false);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Broadcast cursor position to collaborators
    onCursorMove(x, y);

    if (!isDrawing) return;

    if (currentTool === 'pen') {
      currentPoints.current.push(x, y);
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    setIsDrawing(false);

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const id = `${currentTool}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    if (currentTool === 'pen' && currentPoints.current.length >= 4) {
      const newElem: CanvasElement = {
        id,
        type: 'stroke',
        data: { points: [...currentPoints.current], color: currentColor, width: 3 },
        lamport: 0,
        updatedAt: Date.now(),
        clientId: '',
      };
      onElementCreate(newElem);
      currentPoints.current = [];
    } else if (currentTool === 'rectangle') {
      const width = x - startPos.current.x;
      const height = y - startPos.current.y;
      if (Math.abs(width) > 5 && Math.abs(height) > 5) {
        const newElem: CanvasElement = {
          id,
          type: 'rectangle',
          data: {
            x: Math.min(startPos.current.x, x),
            y: Math.min(startPos.current.y, y),
            width: Math.abs(width),
            height: Math.abs(height),
            color: currentColor,
          },
          lamport: 0,
          updatedAt: Date.now(),
          clientId: '',
        };
        onElementCreate(newElem);
      }
    } else if (currentTool === 'circle') {
      const dx = x - startPos.current.x;
      const dy = y - startPos.current.y;
      const radius = Math.sqrt(dx * dx + dy * dy);
      if (radius > 5) {
        const newElem: CanvasElement = {
          id,
          type: 'circle',
          data: {
            x: startPos.current.x,
            y: startPos.current.y,
            radius,
            color: currentColor,
          },
          lamport: 0,
          updatedAt: Date.now(),
          clientId: '',
        };
        onElementCreate(newElem);
      }
    }
  };

  return (
    <canvas
      ref={canvasRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      className="absolute inset-0 cursor-crosshair"
    />
  );
};
