import React, { useEffect, useRef, useState } from 'react';
import { Trash2, Terminal } from 'lucide-react';
import { MachineState, TerminalLine } from '../types/game';

interface WindowsTerminalProps {
  machine: MachineState;
  lines: TerminalLine[];
  commandHistory: string[];
  isStreaming?: boolean;
  onRunCommand: (command: string) => void;
  onCancelStream?: () => void;
  onClearTerminal: () => void;
}

const KNOWN_COMMANDS = [
  'ipconfig',
  'ipconfig /all',
  'ipconfig /displaydns',
  'ipconfig /flushdns',
  'ping',
  'tracert',
  'nslookup',
  'arp -a',
  'route print',
  'netstat -ano',
  'tasklist',
  'tasklist /svc',
  'taskkill',
  'sc query',
  'sc qc',
  'sc stop',
  'sc start',
  'sc config',
  'schtasks /query',
  'systeminfo',
  'whoami',
  'whoami /groups',
  'net user',
  'net localgroup Administrators',
  'icacls',
  'netsh interface ip show config',
  'dir',
  'cd',
  'type',
  'findstr',
  'help',
  'cls',
];

export function WindowsTerminal({
  machine,
  lines,
  commandHistory,
  isStreaming = false,
  onRunCommand,
  onCancelStream,
  onClearTerminal,
}: WindowsTerminalProps) {
  const [input, setInput] = useState('');
  const [historyIdx, setHistoryIdx] = useState<number>(-1);
  const [tabHint, setTabHint] = useState<string>('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  useEffect(() => {
    if (!isStreaming) {
      inputRef.current?.focus();
    }
  }, [isStreaming]);

  useEffect(() => {
    if (!isStreaming || !onCancelStream) return;
    const handleGlobalKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        onCancelStream();
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [isStreaming, onCancelStream]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isStreaming) return;
    const cmd = input;
    setInput('');
    setHistoryIdx(-1);
    setTabHint('');
    onRunCommand(cmd);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length === 0) return;
      const nextIdx = historyIdx === -1 ? commandHistory.length - 1 : Math.max(0, historyIdx - 1);
      setHistoryIdx(nextIdx);
      setInput(commandHistory[nextIdx] || '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx === -1) return;
      const nextIdx = historyIdx + 1;
      if (nextIdx >= commandHistory.length) {
        setHistoryIdx(-1);
        setInput('');
      } else {
        setHistoryIdx(nextIdx);
        setInput(commandHistory[nextIdx] || '');
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const val = input.trim().toLowerCase();
      if (!val) return;
      const matches = KNOWN_COMMANDS.filter((c) => c.toLowerCase().startsWith(val));
      if (matches.length === 1) {
        setInput(matches[0] + ' ');
        setTabHint('');
      } else if (matches.length > 1) {
        setTabHint(matches.slice(0, 5).join('   '));
      }
    } else {
      if (tabHint) setTabHint('');
    }
  };

  const promptPrefix = `${machine.currentDir}>`;

  return (
    <div
      className="flex h-full min-h-[480px] flex-col overflow-hidden rounded-lg border border-[#232D3F] bg-[#080B11]"
      onClick={() => inputRef.current?.focus()}
    >
      {/* Window Title Bar */}
      <div className="flex items-center justify-between border-b border-[#1E2738] bg-[#111722] px-4 py-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <Terminal className="h-4 w-4 text-amber-400 shrink-0" aria-hidden="true" />
          <span className="truncate font-mono text-xs font-medium text-[#CBD5E1]">
            Command Prompt — {machine.hostname} ({machine.currentUser})
          </span>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClearTerminal();
          }}
          className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs text-[#94A3B8] transition-colors hover:bg-[#1C2536] hover:text-[#E2E8F0] whitespace-nowrap shrink-0 cursor-pointer"
          title="Clear terminal output (cls)"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Clear</span>
        </button>
      </div>

      {/* Scrollable Output Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3.5 font-mono text-[13px] leading-[1.55]"
        role="log"
        aria-live="polite"
        aria-label="Simulated Windows terminal output"
      >
        {lines.map((line) => {
          let colorClass = 'text-[#D6E0EE]';
          if (line.type === 'prompt') colorClass = 'text-[#F8FAFC] font-medium mt-2';
          else if (line.type === 'error') colorClass = 'text-red-400';
          else if (line.type === 'success') colorClass = 'text-emerald-400';
          else if (line.type === 'system') colorClass = 'text-[#7D8DA6]';
          else if (line.type === 'clue') colorClass = 'text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded px-2.5 py-1.5 my-1.5';

          return (
            <div key={line.id} className={`whitespace-pre-wrap break-words ${colorClass}`}>
              {line.text || '\u00A0'}
            </div>
          );
        })}

        {/* Active Input Line or Streaming Status */}
        {isStreaming ? (
          <div className="mt-2 flex items-center justify-between gap-2 font-mono text-xs text-amber-400">
            <span>Probing network…</span>
            {onCancelStream && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCancelStream();
                }}
                className="rounded border border-[#2A364B] bg-[#111722] px-2 py-0.5 text-[11px] text-[#CBD5E1] hover:text-[#F8FAFC] cursor-pointer"
              >
                Ctrl+C Cancel
              </button>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-2 flex items-center gap-1.5">
            <label htmlFor="win-cmd-input" className="font-mono text-[13px] font-medium text-amber-400 shrink-0">
              {promptPrefix}
            </label>
            <input
              id="win-cmd-input"
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Type a Windows command (e.g. ipconfig /all, ping, help)..."
              className="w-full bg-transparent font-mono text-[13px] text-[#F8FAFC] placeholder-[#475569] focus:outline-none"
            />
          </form>
        )}

        {tabHint && (
          <div className="mt-1.5 font-mono text-xs text-[#7D8DA6]">
            Suggestions: {tabHint}
          </div>
        )}
      </div>

      {/* Subtle Keyboard Usage Line */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#1A2232] bg-[#0D121B] px-4 py-2 font-mono text-[11px] text-[#64748B]">
        <span>Enter: Execute · Up/Down: History · Tab: Autocomplete · type &quot;help&quot;</span>
        <span>{machine.osName}</span>
      </div>
    </div>
  );
}
