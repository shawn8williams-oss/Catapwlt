import { useState } from 'react';
import { X, Search } from 'lucide-react';
import { COMMAND_REFERENCE, CommandDoc } from '../data/commandReference';

interface CommandRefModalProps {
  onClose: () => void;
}

const CATEGORIES: ('All' | CommandDoc['category'])[] = [
  'All',
  'Networking',
  'DNS & Routing',
  'Processes & Services',
  'Accounts & Security',
  'Files & Logs',
];

export function CommandRefModal({ onClose }: CommandRefModalProps) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'All' | CommandDoc['category']>('All');

  const filtered = COMMAND_REFERENCE.filter((doc) => {
    const matchCat = category === 'All' || doc.category === category;
    const q = search.trim().toLowerCase();
    const matchText =
      !q ||
      doc.command.toLowerCase().includes(q) ||
      doc.syntax.toLowerCase().includes(q) ||
      doc.summary.toLowerCase().includes(q);
    return matchCat && matchText;
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#05080F]/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cmd-ref-title"
    >
      <div className="flex max-h-[86vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-[#29354B] bg-[#111722]">
        <div className="flex items-start justify-between gap-4 border-b border-[#1E2738] bg-[#0D131D] px-6 py-4">
          <div>
            <h2 id="cmd-ref-title" className="font-display text-lg font-bold text-[#F8FAFC]">
              Windows Diagnostic Command Reference
            </h2>
            <p className="mt-0.5 text-xs text-[#94A3B8]">
              Syntax and purpose of real Windows CLI troubleshooting tools supported in FAULT//LINE.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close command reference"
            className="rounded p-1.5 text-[#94A3B8] transition-colors hover:bg-[#1C2536] hover:text-[#F8FAFC] cursor-pointer"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Search & Filter */}
        <div className="space-y-3 border-b border-[#1E2738] bg-[#0F1520] px-6 py-3.5">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]"
              aria-hidden="true"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter commands (e.g. nslookup, netstat, icacls, sc)..."
              className="w-full rounded-md border border-[#253146] bg-[#080B11] py-2 pl-9 pr-3 text-xs text-[#E2E8F0] placeholder-[#64748B] focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by command category">
            {CATEGORIES.map((cat) => {
              const active = category === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-amber-500 text-[#0B0F17]'
                      : 'bg-[#172030] text-[#94A3B8] hover:text-[#E2E8F0]'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Command List */}
        <div className="flex-1 space-y-3 overflow-y-auto px-6 py-4">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#64748B]">
              No matching commands found for &ldquo;{search}&rdquo;.
            </p>
          ) : (
            filtered.map((doc) => (
              <div
                key={doc.command}
                className="rounded-md border border-[#1E2738] bg-[#0C111A] p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <code className="font-mono text-sm font-semibold text-amber-400">
                    {doc.command}
                  </code>
                  <span className="font-mono text-[11px] text-[#64748B]">{doc.category}</span>
                </div>
                <p className="mt-1 font-mono text-xs text-[#CBD5E1]">{doc.syntax}</p>
                <p className="mt-2 text-xs leading-relaxed text-[#94A3B8]">{doc.summary}</p>
                <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 border-t border-[#1A2232] pt-2 font-mono text-[11px] text-[#7D8DA6]">
                  {doc.examples.map((ex) => (
                    <span key={ex}>{ex}</span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
