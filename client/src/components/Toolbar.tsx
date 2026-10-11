import React from 'react';
import { Pencil, Square, Circle, StickyNote, Plane, Wifi, WifiOff } from 'lucide-react';

export type ToolType = 'pen' | 'rectangle' | 'circle' | 'sticky';

interface ToolbarProps {
  currentTool: ToolType;
  setTool: (tool: ToolType) => void;
  currentColor: string;
  setColor: (color: string) => void;
  isAirplaneMode: boolean;
  toggleAirplaneMode: () => void;
  offlineCount: number;
}

const COLORS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#FFFFFF'];

export const Toolbar: React.FC<ToolbarProps> = ({
  currentTool,
  setTool,
  currentColor,
  setColor,
  isAirplaneMode,
  toggleAirplaneMode,
  offlineCount,
}) => {
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-slate-800/90 backdrop-blur-md border border-slate-700/60 p-2 rounded-2xl shadow-2xl">
      {/* Drawing Tools */}
      <div className="flex items-center gap-1 border-r border-slate-700 pr-2">
        <button
          onClick={() => setTool('pen')}
          className={`p-2.5 rounded-xl transition-all ${
            currentTool === 'pen' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
          }`}
          title="Freehand Pen"
        >
          <Pencil className="w-5 h-5" />
        </button>

        <button
          onClick={() => setTool('rectangle')}
          className={`p-2.5 rounded-xl transition-all ${
            currentTool === 'rectangle' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
          }`}
          title="Rectangle Shape"
        >
          <Square className="w-5 h-5" />
        </button>

        <button
          onClick={() => setTool('circle')}
          className={`p-2.5 rounded-xl transition-all ${
            currentTool === 'circle' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
          }`}
          title="Circle Shape"
        >
          <Circle className="w-5 h-5" />
        </button>

        <button
          onClick={() => setTool('sticky')}
          className={`p-2.5 rounded-xl transition-all ${
            currentTool === 'sticky' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
          }`}
          title="Add Sticky Note"
        >
          <StickyNote className="w-5 h-5" />
        </button>
      </div>

      {/* Color Palette */}
      <div className="flex items-center gap-1.5 px-2 border-r border-slate-700">
        {COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className={`w-6 h-6 rounded-full transition-transform ${currentColor === c ? 'scale-125 ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-800' : 'opacity-80 hover:opacity-100 hover:scale-110'}`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>

      {/* Airplane Mode Simulator (Chaos Button) */}
      <div className="flex items-center pl-1">
        <button
          onClick={toggleAirplaneMode}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
            isAirplaneMode
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
              : 'bg-slate-700/60 hover:bg-slate-700 text-slate-300'
          }`}
          title="Toggle Airplane Mode (Simulates network disconnect for offline chaos test)"
        >
          {isAirplaneMode ? <Plane className="w-4 h-4 text-amber-400" /> : <Wifi className="w-4 h-4 text-emerald-400" />}
          <span>{isAirplaneMode ? `Airplane Mode (${offlineCount} offline edits)` : 'Online'}</span>
        </button>
      </div>
    </div>
  );
};
