import { Lightbulb } from 'lucide-react';
import { useState } from 'react';

interface AiPromptHintsProps {
  accentColor: string;
  prompts: string[];
}

export function AiPromptHints({ accentColor, prompts }: AiPromptHintsProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => setOpen(prev => !prev)}
        className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-md transition-colors cursor-pointer"
        style={{
          color: accentColor,
          backgroundColor: `${accentColor}10`,
        }}
      >
        <Lightbulb className="h-3 w-3" />
        AI Tips
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 z-50 w-[340px] rounded-lg border border-gray-200 bg-white shadow-lg"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          <div className="px-3 py-2 border-b border-gray-100">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              Try these with your AI collaborator
            </span>
          </div>
          <ul className="px-3 py-2 space-y-2">
            {prompts.map((prompt, i) => (
              <li key={i} className="flex items-start gap-2">
                <span
                  className="mt-1 h-1.5 w-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: accentColor }}
                />
                <span className="text-xs text-gray-600 leading-relaxed">{prompt}</span>
              </li>
            ))}
          </ul>
          <div className="px-3 py-1.5 border-t border-gray-100">
            <span className="text-[10px] text-gray-300">Export CSV → paste into your AI agent</span>
          </div>
        </div>
      )}
    </div>
  );
}
