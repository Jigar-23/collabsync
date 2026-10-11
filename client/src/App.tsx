import React, { useState, useMemo } from 'react';
import { useCollabSync } from './hooks/useCollabSync';
import { Canvas } from './components/Canvas';
import { Toolbar, ToolType } from './components/Toolbar';
import { PresenceBar } from './components/PresenceBar';
import { HUD } from './components/HUD';
import { Notes } from './components/Notes';
import { Share2, Zap } from 'lucide-react';
import { CanvasElement } from './engine/types';

export const App: React.FC = () => {
  // Parse room and user from URL or localStorage
  const searchParams = new URLSearchParams(window.location.search);
  const initialRoom = searchParams.get('room') || 'engineering-sync';
  const [roomId, setRoomId] = useState<string>(initialRoom);

  const clientId = useMemo(() => {
    let id = sessionStorage.getItem('collab_client_id');
    if (!id) {
      id = `client-${Math.random().toString(36).substring(2, 9)}`;
      sessionStorage.setItem('collab_client_id', id);
    }
    return id;
  }, []);

  const userName = useMemo(() => {
    let name = sessionStorage.getItem('collab_user_name');
    if (!name) {
      const names = ['Alex', 'Jordan', 'Taylor', 'Sam', 'Morgan', 'Casey', 'Riley'];
      name = names[Math.floor(Math.random() * names.length)];
      sessionStorage.setItem('collab_user_name', name);
    }
    return name;
  }, []);

  // Determine WebSocket URL (default to localhost:4000 or same host)
  const wsUrl = useMemo(() => {
    const loc = window.location;
    const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
    // If running in development (e.g. Vite port 3000), point to backend port 4000
    if (loc.port === '3000') {
      return `${protocol}//${loc.hostname}:4000/ws`;
    }
    return `${protocol}//${loc.host}/ws`;
  }, []);

  // Active Tooling State
  const [currentTool, setTool] = useState<ToolType>('pen');
  const [currentColor, setColor] = useState<string>('#3B82F6');

  // CollabSync Real-Time Engine
  const {
    elements,
    users,
    isConnected,
    isAirplaneMode,
    pingMs,
    offlineCount,
    upsertElement,
    sendCursor,
    toggleAirplaneMode,
  } = useCollabSync({
    wsUrl,
    roomId,
    userName,
    clientId,
  });

  const handleUpdateNotes = (content: string) => {
    const noteElem: CanvasElement = {
      id: 'doc-shared-notes',
      type: 'text',
      data: { text: content },
      lamport: 0,
      updatedAt: Date.now(),
      clientId,
    };
    upsertElement(noteElem);
  };

  const handleCopyShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    alert('Shareable Room URL copied to clipboard! Open this URL in another tab/browser to collaborate.');
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-900 select-none">
      {/* Top Header Bar */}
      <header className="absolute top-4 left-6 z-20 flex items-center gap-3">
        <div className="flex items-center gap-2 bg-slate-800/90 backdrop-blur-md border border-slate-700/60 px-3.5 py-2 rounded-2xl shadow-xl">
          <Zap className="w-5 h-5 text-blue-400 fill-blue-400/20" />
          <span className="font-bold text-slate-100 tracking-tight text-sm">CollabSync</span>
          <span className="text-[10px] font-mono uppercase bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20">
            CRDT v1.0
          </span>
        </div>

        <button
          onClick={handleCopyShareLink}
          className="flex items-center gap-1.5 bg-slate-800/90 hover:bg-slate-700 backdrop-blur-md border border-slate-700/60 px-3 py-2 rounded-2xl text-xs font-medium text-slate-300 shadow-xl transition-all"
          title="Share room link"
        >
          <Share2 className="w-3.5 h-3.5 text-blue-400" />
          <span>Share Room</span>
        </button>
      </header>

      {/* Top Right Presence Bar */}
      <div className="absolute top-4 right-6 z-20">
        <PresenceBar users={users} currentUser={userName} />
      </div>

      {/* Center Floating Toolbar */}
      <Toolbar
        currentTool={currentTool}
        setTool={setTool}
        currentColor={currentColor}
        setColor={setColor}
        isAirplaneMode={isAirplaneMode}
        toggleAirplaneMode={toggleAirplaneMode}
        offlineCount={offlineCount}
      />

      {/* 60 FPS Collaborative Canvas */}
      <Canvas
        elements={elements}
        users={users}
        currentTool={currentTool}
        currentColor={currentColor}
        onElementCreate={upsertElement}
        onCursorMove={sendCursor}
      />

      {/* Shared Notes Drawer */}
      <Notes elements={elements} onUpdateNotes={handleUpdateNotes} />

      {/* Bottom Telemetry HUD */}
      <HUD
        isConnected={isConnected}
        isAirplaneMode={isAirplaneMode}
        pingMs={pingMs}
        elementCount={elements.length}
        roomId={roomId}
      />
    </div>
  );
};
export default App;
