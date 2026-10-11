import React, { useState } from 'react';
import { FileText, ChevronRight, ChevronLeft } from 'lucide-react';
import { CanvasElement } from '../engine/types';

interface NotesProps {
  elements: CanvasElement[];
  onUpdateNotes: (content: string) => void;
}

export const Notes: React.FC<NotesProps> = ({ elements, onUpdateNotes }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  // Find shared text element or default
  const noteElement = elements.find((e) => e.id === 'doc-shared-notes');
  const textContent = (noteElement?.data?.text as string) || '';

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdateNotes(e.target.value);
  };

  return (
    <div
      className={`absolute top-20 right-0 z-20 flex transition-transform duration-300 ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {/* Toggle Tab */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="self-start -ml-10 bg-slate-800/90 border-l border-y border-slate-700 p-2.5 rounded-l-xl text-slate-300 hover:text-white shadow-xl flex items-center justify-center"
        title="Toggle Shared Notes Drawer"
      >
        {isOpen ? <ChevronRight className="w-5 h-5" /> : <FileText className="w-5 h-5 text-blue-400" />}
      </button>

      {/* Drawer Content */}
      <div className="w-80 h-[calc(100vh-140px)] bg-slate-800/95 backdrop-blur-md border-l border-b border-slate-700/80 p-4 rounded-bl-2xl shadow-2xl flex flex-col">
        <div className="flex items-center justify-between pb-3 border-b border-slate-700/60 mb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-slate-200">Shared Scratchpad</h3>
          </div>
          <span className="text-[10px] font-mono bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20">
            CRDT Sync
          </span>
        </div>

        <textarea
          value={textContent}
          onChange={handleChange}
          placeholder="Type notes collaboratively here in real time..."
          className="flex-1 w-full bg-slate-900/60 border border-slate-700/60 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono resize-none placeholder:text-slate-500"
        />

        <div className="text-[11px] text-slate-400 pt-2 flex items-center justify-between">
          <span>Auto-persisted to snapshot</span>
          <span>{textContent.length} chars</span>
        </div>
      </div>
    </div>
  );
};
