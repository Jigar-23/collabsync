import React from 'react';
import { UserPresence } from '../engine/types';
import { Users } from 'lucide-react';

interface PresenceBarProps {
  users: UserPresence[];
  currentUser: string;
}

export const PresenceBar: React.FC<PresenceBarProps> = ({ users, currentUser }) => {
  return (
    <div className="flex items-center gap-2 bg-slate-800/80 backdrop-blur-md border border-slate-700/60 px-3 py-1.5 rounded-full shadow-lg">
      <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium mr-1">
        <Users className="w-4 h-4 text-slate-400" />
        <span>Collaborating ({users.length + 1})</span>
      </div>

      {/* Current User */}
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm ring-2 ring-emerald-500"
        style={{ backgroundColor: '#10B981' }}
        title={`${currentUser} (You)`}
      >
        {currentUser.charAt(0).toUpperCase()}
      </div>

      {/* Remote Users */}
      {users.map((u) => (
        <div
          key={u.clientId}
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm transition-transform hover:scale-110"
          style={{ backgroundColor: u.color }}
          title={u.userName}
        >
          {u.userName.charAt(0).toUpperCase()}
        </div>
      ))}
    </div>
  );
};
