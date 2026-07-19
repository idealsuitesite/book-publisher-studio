'use client';

import { useMemo, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui';

/**
 * Ctrl+K (PRODUCT_EXPERIENCE §10.3). Entries come from the same registry the Explorer uses,
 * so the palette can never offer an action the studio cannot perform. Expert hands: type,
 * arrow, Enter.
 */
export interface PaletteCommand {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
}

interface CommandPaletteProps {
  commands: PaletteCommand[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ commands, open, onOpenChange }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? commands.filter((c) => c.label.toLowerCase().includes(q)) : commands;
    return list.slice(0, 9);
  }, [commands, query]);

  // Reset selection when the query or open-state changes - via key derivation, not a
  // synchronous effect setState (lint: cascading-render guard).
  const selectionKey = `${open}-${query}`;
  const [lastKey, setLastKey] = useState(selectionKey);
  if (lastKey !== selectionKey) {
    setLastKey(selectionKey);
    setSelected(0);
  }

  function runSelected() {
    const command = matches[selected];
    if (command) {
      onOpenChange(false);
      setQuery('');
      command.run();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Command palette" className="max-w-lg p-0" description="Type to search actions and views">
        <div className="flex flex-col">
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setSelected((s) => Math.min(s + 1, matches.length - 1));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setSelected((s) => Math.max(s - 1, 0));
              } else if (event.key === 'Enter') {
                event.preventDefault();
                runSelected();
              }
            }}
            placeholder="Where to? (views, actions…)"
            className="w-full border-b border-app-border bg-transparent px-1 py-2 text-sm text-app-text outline-none placeholder:text-app-text-muted"
          />
          <ul className="mt-2 flex flex-col">
            {matches.map((command, index) => (
              <li key={command.id}>
                <button
                  onClick={runSelected}
                  onMouseEnter={() => setSelected(index)}
                  className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm ${
                    index === selected ? 'bg-app-surface-0 text-app-text' : 'text-app-text-muted'
                  }`}
                >
                  <span>{command.label}</span>
                  {command.hint && <span className="text-xs text-app-text-muted">{command.hint}</span>}
                </button>
              </li>
            ))}
            {matches.length === 0 && (
              <li className="px-2 py-3 text-sm text-app-text-muted">Nothing matches — the studio only lists real actions.</li>
            )}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
