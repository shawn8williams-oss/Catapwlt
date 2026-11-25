import React, { useRef, useState } from 'react';
import { ArrowRight, FolderOpen, Terminal, Play, Award } from 'lucide-react';

interface BriefingScreenProps {
  playerName: string;
  onPlayerNameChange: (name: string) => void;
  hasStarted: boolean;
  solvedCount: number;
  totalCases: number;
  totalScore: number;
  onStartWorkspace: () => void;
  onStartDemo: () => void;
  onOpenScenarios: () => void;
  onOpenCaseFile: () => void;
  onOpenFinalScore: () => void;
}

const BRIEFING_IMAGE_SRC = '/src/assets/images/ops_room_briefing_1795593173019.jpg';

export function BriefingScreen({
  playerName,
  onPlayerNameChange,
  hasStarted,
  solvedCount,
  totalCases,
  totalScore,
  onStartWorkspace,
  onStartDemo,
  onOpenScenarios,
  onOpenCaseFile,
  onOpenFinalScore,
}: BriefingScreenProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const [nameError, setNameError] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  const allSolved = solvedCount === totalCases;

  const ensureNameThen = (action: () => void) => {
    if (!playerName.trim()) {
      setNameError('Please enter your name so your final diagnostic score report can be recorded.');
      nameInputRef.current?.focus();
      return;
    }
    setNameError('');
    action();
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    ensureNameThen(onStartWorkspace);
  };

  return (
    <main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:py-10">
      {/* Hero Split */}
      <section className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12">
        <div className="flex flex-col justify-between lg:col-span-6 lg:py-2">
          <div>
            <p className="font-mono text-xs tracking-wide text-amber-400">
              Monday 08:47 · Meridian Freight &amp; Logistics Ltd · Helpdesk Queue
            </p>
            <h1 className="mt-3 max-w-xl font-display text-3xl font-bold leading-tight tracking-tight text-[#F8FAFC] [text-wrap:balance] sm:text-5xl">
              Six routine Monday tickets. One hidden fault line.
            </h1>
            <p className="mt-5 max-w-[62ch] text-[15px] leading-relaxed text-[#A8B6CB]">
              You are the junior systems technician starting your shift at Meridian Freight &amp; Logistics.
              Within minutes of logging in, the helpdesk queue fills with seemingly ordinary faults:
              a workstation with no internet, a dispatch terminal cut off from company servers, broken DNS
              in Finance, a locked payroll folder, and abnormal server traffic.
            </p>
            <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-[#A8B6CB]">
              Use authentic Windows diagnostic commands inside each machine&apos;s simulated terminal to
              gather evidence, test your hypothesis, apply the right repair, and verify recovery. Every
              resolved case adds verified evidence to your persistent Case File and contributes to your final score.
            </p>
          </div>

          {/* Technician Sign-In Form */}
          <form onSubmit={handleFormSubmit} className="mt-7 space-y-4">
            <div className="max-w-md">
              <label
                htmlFor="technician-name-input"
                className="block text-xs font-semibold tracking-wide text-[#CBD5E1]"
              >
                Technician Name
              </label>
              <input
                ref={nameInputRef}
                id="technician-name-input"
                type="text"
                maxLength={60}
                value={playerName}
                onChange={(e) => {
                  onPlayerNameChange(e.target.value);
                  if (nameError) setNameError('');
                }}
                placeholder="Enter your name to begin shift..."
                className="mt-1.5 w-full rounded-md border border-[#2A364B] bg-[#0D131D] px-3.5 py-2.5 text-sm text-[#F8FAFC] placeholder-[#64748B] focus:border-amber-500 focus:outline-none"
              />
              {nameError && (
                <p className="mt-1.5 text-xs text-red-400" role="alert">
                  {nameError}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3.5">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-md bg-amber-500 px-5 py-2.5 text-sm font-semibold text-[#0B0F17] transition-colors hover:bg-amber-400 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Terminal className="h-4 w-4" aria-hidden="true" />
                <span>{hasStarted ? 'Resume Investigation' : 'Start Monday Shift'}</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => ensureNameThen(onStartDemo)}
                className="inline-flex items-center gap-2 rounded-md border border-amber-500/45 bg-amber-500/10 px-4 py-2.5 text-sm font-medium text-amber-300 transition-colors hover:bg-amber-500/20 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Play className="h-4 w-4" aria-hidden="true" />
                <span>Try Guided Demo</span>
              </button>

              <button
                type="button"
                onClick={() => ensureNameThen(onOpenScenarios)}
                className="inline-flex items-center gap-2 rounded-md border border-[#2A364B] bg-[#131A26] px-4 py-2.5 text-sm font-medium text-[#E2E8F0] transition-colors hover:border-[#3B4B66] hover:bg-[#192233] whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>View All Six Cases</span>
              </button>

              {allSolved && (
                <button
                  type="button"
                  onClick={onOpenFinalScore}
                  className="inline-flex items-center gap-2 rounded-md border border-emerald-500/45 bg-emerald-500/15 px-4 py-2.5 text-sm font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/25 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Award className="h-4 w-4" aria-hidden="true" />
                  <span>View Final Score</span>
                </button>
              )}

              {solvedCount > 0 && !allSolved && (
                <button
                  type="button"
                  onClick={onOpenCaseFile}
                  className="inline-flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-amber-400 transition-colors hover:text-amber-300 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <FolderOpen className="h-4 w-4" aria-hidden="true" />
                  <span>Open Case File</span>
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Right visual anchor */}
        <div className="relative min-h-[280px] overflow-hidden rounded-lg border border-[#232D3F] bg-[#111722] lg:col-span-6">
          {!imgFailed ? (
            <img
              src={BRIEFING_IMAGE_SRC}
              alt="Meridian Freight and Logistics server room and IT operations workstation at early morning"
              referrerPolicy="no-referrer"
              onError={() => setImgFailed(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full min-h-[300px] w-full flex-col items-center justify-center bg-gradient-to-br from-[#131B2A] via-[#0F1521] to-[#1A2333] p-8 text-center">
              <Terminal className="h-10 w-10 text-amber-500/70" aria-hidden="true" />
              <p className="mt-3 font-mono text-sm text-[#94A3B8]">
                Meridian IT Operations · Comms Room B
              </p>
            </div>
          )}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0B0F17]/90 via-[#0B0F17]/25 to-transparent"
          />
          <div className="absolute inset-x-0 bottom-0 p-5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-[#CBD5E1]">
              <span>Domain: meridian.local</span>
              <span aria-hidden="true">·</span>
              <span>Subnet: 192.168.10.0/24</span>
              <span aria-hidden="true">·</span>
              <span>Gateway: 192.168.10.1</span>
              <span aria-hidden="true">·</span>
              <span>DC/DNS: 192.168.10.5</span>
            </div>
          </div>
        </div>
      </section>

      {/* Progress & Methodology Strip */}
      <section className="mt-10 border-t border-[#1E2738] pt-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          <div className="border-t border-[#263144] pt-4">
            <p className="font-mono text-xs text-amber-400">01. Inspect &amp; Triage</p>
            <h2 className="mt-1.5 text-base font-semibold text-[#F1F5F9]">
              Read the Ticket &amp; Probe the Host
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-[#94A3B8]">
              Use real Windows commands—ipconfig, ping, tracert, nslookup, netstat, sc, icacls, and logs—to separate symptoms from causes.
            </p>
          </div>

          <div className="border-t border-[#263144] pt-4">
            <p className="font-mono text-xs text-amber-400">02. Reason From Evidence</p>
            <h2 className="mt-1.5 text-base font-semibold text-[#F1F5F9]">
              Test Hypotheses Before Fixing
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-[#94A3B8]">
              Every machine maintains consistent internal state. Multiple diagnostic sequences work; scoring rewards methodical investigation over guessing.
            </p>
          </div>

          <div className="border-t border-[#263144] pt-4">
            <p className="font-mono text-xs text-amber-400">03. Repair &amp; Verify</p>
            <h2 className="mt-1.5 text-base font-semibold text-[#F1F5F9]">
              Prove Recovery in the Terminal
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-[#94A3B8]">
              Apply repairs via terminal commands or the remediation workbench, then run post-fix checks to prove the fault is truly resolved for bonus marks.
            </p>
          </div>

          <div className="border-t border-[#263144] pt-4">
            <p className="font-mono text-xs text-amber-400">04. Connect the Pattern</p>
            <h2 className="mt-1.5 text-base font-semibold text-[#F1F5F9]">
              Build the Persistent Case File
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-[#94A3B8]">
              Track recurring IPs, MAC addresses, usernames, and timestamps across all six cases to expose and contain the complete incident.
            </p>
          </div>
        </div>
      </section>

      {/* Quiet Shift Summary Row */}
      <section className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-[#1E2738] pt-6 text-xs text-[#94A3B8]">
        <div className="flex flex-wrap items-center gap-3 font-mono tabular-nums">
          <span>Level 3 IT Fault Diagnosis</span>
          <span aria-hidden="true">·</span>
          <span>Estimated Time: 35–50 mins</span>
          <span aria-hidden="true">·</span>
          <span>Cases Solved: {solvedCount} / {totalCases}</span>
          <span aria-hidden="true">·</span>
          <span>Cumulative Score: {totalScore.toLocaleString()} / {(totalCases * 1000).toLocaleString()}</span>
        </div>
        <p className="text-xs text-[#64748B]">
          Simulated Windows environment — no real system commands are executed.
        </p>
      </section>
    </main>
  );
}
