import { FolderOpen, ArrowRight, ShieldAlert, Server } from 'lucide-react';
import { CaseFileClue } from '../types/game';

interface CaseFileViewProps {
  clues: CaseFileClue[];
  totalCases: number;
  onReturnToWorkspace: () => void;
}

export function CaseFileView({
  clues,
  totalCases,
  onReturnToWorkspace,
}: CaseFileViewProps) {
  // Collect recurring indicators discovered so far
  const allIndicators = Array.from(new Set(clues.flatMap((c) => c.indicators)));

  return (
    <main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#1E2738] pb-6">
        <div>
          <p className="font-mono text-xs text-amber-400">
            Persistent Investigation Dossier · Meridian Incident Correlation
          </p>
          <h1 className="mt-1.5 font-display text-2xl font-bold text-[#F8FAFC] sm:text-3xl">
            Master Case File
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-[#94A3B8]">
            Verified clues gathered across completed tickets are recorded here automatically. Cross-reference recurring IP addresses, MACs, accounts, and timestamps to trace how each Monday ticket connects.
          </p>
        </div>

        <button
          type="button"
          onClick={onReturnToWorkspace}
          className="inline-flex items-center gap-2 rounded-md bg-amber-500 px-4 py-2 text-xs font-semibold text-[#0B0F17] transition-colors hover:bg-amber-400 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <span>Return to Terminal Workspace</span>
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      {/* Known Company Network Reference Strip */}
      <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-[#F1F5F9]">
              Chronological Evidence Log
            </h2>
            <span className="font-mono text-xs tabular-nums text-[#94A3B8]">
              {clues.length} of {totalCases} Case Entries Logged
            </span>
          </div>

          {clues.length === 0 ? (
            <div className="mt-4 rounded-lg border border-[#1E2738] bg-[#111722] p-10 text-center">
              <FolderOpen className="mx-auto h-9 w-9 text-[#475569]" aria-hidden="true" />
              <h3 className="mt-3 text-base font-semibold text-[#E2E8F0]">
                No Case File Entries Yet
              </h3>
              <p className="mx-auto mt-1.5 max-w-md text-sm text-[#94A3B8]">
                Resolve your first helpdesk ticket (INC-4012 on WS-REC-01) to record verified forensic clues into this dossier.
              </p>
              <button
                type="button"
                onClick={onReturnToWorkspace}
                className="mt-5 rounded-md bg-amber-500 px-4 py-2 text-xs font-semibold text-[#0B0F17] transition-colors hover:bg-amber-400 cursor-pointer"
              >
                Open Case 1 Workspace
              </button>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {clues.map((clue) => (
                <article
                  key={clue.id}
                  className="rounded-lg border border-[#232D3F] bg-[#111722] p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-xs text-[#94A3B8]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-amber-400">Case {clue.caseNumber}</span>
                      <span aria-hidden="true">·</span>
                      <span>{clue.caseCode}</span>
                      <span aria-hidden="true">·</span>
                      <span>{clue.hostInvolved}</span>
                    </div>
                    <span className="text-[#CBD5E1]">Event Time: {clue.eventTime}</span>
                  </div>

                  <h3 className="mt-2 font-display text-base font-bold text-[#F8FAFC]">
                    {clue.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#CBD5E1]">
                    {clue.summary}
                  </p>

                  <div className="mt-3.5 border-t border-[#1E2738] pt-3 font-mono text-xs text-[#94A3B8]">
                    <span className="text-[#64748B]">Key Indicators: </span>
                    {clue.indicators.join('  ·  ')}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        {/* Right Sidebar: Network Baseline & Tracked Indicators */}
        <aside className="space-y-6 lg:col-span-4">
          <div className="rounded-lg border border-[#232D3F] bg-[#111722] p-5">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-amber-400 shrink-0" aria-hidden="true" />
              <h2 className="font-display text-sm font-bold text-[#F8FAFC]">
                Meridian Network Baseline
              </h2>
            </div>
            <p className="mt-1 text-xs text-[#94A3B8]">
              Authorised core infrastructure for meridian.local (192.168.10.0/24).
            </p>
            <dl className="mt-4 space-y-2.5 border-t border-[#1E2738] pt-3.5 font-mono text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-[#94A3B8]">Default Gateway</dt>
                <dd className="text-[#E2E8F0]">192.168.10.1</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[#94A3B8]">DC / DNS / DHCP</dt>
                <dd className="text-[#E2E8F0]">192.168.10.5</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[#94A3B8]">File &amp; ERP Server</dt>
                <dd className="text-[#E2E8F0]">192.168.10.10</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[#94A3B8]">Dispatch Printer</dt>
                <dd className="text-[#E2E8F0]">192.168.10.80</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[#94A3B8]">Standard Mask</dt>
                <dd className="text-[#E2E8F0]">255.255.255.0 (/24)</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-lg border border-[#232D3F] bg-[#111722] p-5">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0" aria-hidden="true" />
              <h2 className="font-display text-sm font-bold text-[#F8FAFC]">
                Tracked Anomaly Indicators
              </h2>
            </div>
            {allIndicators.length === 0 ? (
              <p className="mt-3 text-xs text-[#64748B]">
                No suspicious indicators logged yet. Complete cases to map overlapping clues.
              </p>
            ) : (
              <ul className="mt-3 space-y-2 border-t border-[#1E2738] pt-3 font-mono text-xs text-[#CBD5E1]">
                {allIndicators.map((ind) => (
                  <li key={ind} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden="true" />
                    <span>{ind}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </section>
    </main>
  );
}
