import React from 'react';
import { Activity, ShieldCheck, Wifi, WifiOff } from 'lucide-react';

interface HUDProps {
  isConnected: boolean;
  isAirplaneMode: boolean;
  pingMs: number;
  elementCount: number;
  roomId: string;
}

export const HUD: React.FC<HUDProps> = ({ isConnected, isAirplaneMode, pingMs, elementCount, roomId }) => {
  return (
    <div className="absolute bottom-4 left-4 z-20 flex items-center gap-3 bg-slate-900/90 backdrop-blur-md border border-slate-800 px-4 py-2 rounded-2xl shadow-xl text-xs font-mono text-slate-300">
      {/* Connection Indicator */}
      <div className="flex items-center gap-1.5">
        <span
          className={`w-2 h-2 rounded-full ${
            isAirplaneMode
              ? 'bg-amber-400 animate-ping'
              : isConnected
              ? 'bg-emerald-400'
              : 'bg-rose-500 animate-pulse'
          }`}
        />
        <span className="font-semibold text-slate-200">
          {isAirplaneMode ? 'OFFLINE (AIRPLANE)' : isConnected ? 'CONNECTED' : 'RECONNECTING'}
        </span>
      </div>

      <span className="text-slate-600">|</span>

      {/* Latency */}
      <div className="flex items-center gap-1">
        <Activity className="w-3.5 h-3.5 text-blue-400" />
        <span>{isAirplaneMode ? '--' : `${pingMs}ms`}</span>
      </div>

      <span className="text-slate-600">|</span>

      {/* Element Count */}
      <div className="flex items-center gap-1">
        <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
        <span>{elementCount} CRDT objects</span>
      </div>

      <span className="text-slate-600">|</span>

      {/* Room Badge */}
      <span className="bg-slate-800 px-2 py-0.5 rounded-md text-slate-400">
        room: <strong className="text-slate-200">{roomId}</strong>
      </span>
    </div>
  );
};
