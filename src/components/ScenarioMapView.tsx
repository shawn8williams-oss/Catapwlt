import React, { useState } from 'react';
import { Lock, CheckCircle2, ArrowRight, RotateCcw, Unlock, Play, X } from 'lucide-react';
import { ScenarioConfig, ScenarioProgress } from '../types/game';

const INSTRUCTOR_PIN = '7572';

interface ScenarioMapViewProps {
  scenarios: ScenarioConfig[];
  progressMap: Record<string, ScenarioProgress>;
  activeScenarioId: string;
  instructorMode: boolean;
  onSetInstructorMode: (enabled: boolean) => void;
  onSelectScenario: (scenarioId: string) => void;
  onStartDemo: () => void;
  onResetAll: () => void;
}

export function ScenarioMapView({
  scenarios,
  progressMap,
  activeScenarioId,
  instructorMode,
  onSetInstructorMode,
  onSelectScenario,
  onStartDemo,
  onResetAll,
}: ScenarioMapViewProps) {
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  const solvedCount = scenarios.filter((s) => progressMap[s.id]?.status === 'solved').length;
  const totalScore = scenarios.reduce((sum, s) => sum + (progressMap[s.id]?.score?.totalScore || 0), 0);

  const handleInstructorClick = () => {
    if (instructorMode) {
      onSetInstructorMode(false);
    } else {
      setPinInput('');
      setPinError('');
      setShowPinModal(true);
    }
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput.trim() === INSTRUCTOR_PIN) {
      onSetInstructorMode(true);
      setShowPinModal(false);
      setPinInput('');
      setPinError('');
    } else {
      setPinError('Incorrect PIN. Contact your instructor for access.');
    }
  };

  return (
    <main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#1E2738] pb-6">
        <div>
          <p className="font-mono text-xs text-amber-400">
            Monday Helpdesk Queue · Six Connected Cases
          </p>
          <h1 className="mt-1.5 font-display text-2xl font-bold text-[#F8FAFC] sm:text-3xl">
            Investigation Queue
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-[#94A3B8]">
            Work through each ticket in order. Solving a fault unlocks the next workstation in the chain and appends verified clues to your Master Case File.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onStartDemo}
            className="inline-flex items-center gap-2 rounded-md border border-amber-500/45 bg-amber-500/10 px-3.5 py-2 text-xs font-semibold text-amber-300 transition-colors hover:bg-amber-500/20 whitespace-nowrap cursor-pointer"
          >
            <Play className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Launch Guided Demo</span>
          </button>

          <button
            type="button"
            onClick={handleInstructorClick}
            className={`inline-flex items-center gap-2 rounded-md border px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              instructorMode
                ? 'border-amber-500/50 bg-amber-500/15 text-amber-300'
                : 'border-[#2A364B] bg-[#131A26] text-[#CBD5E1] hover:bg-[#1C2536]'
            }`}
          >
            {instructorMode ? (
              <Unlock className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>{instructorMode ? 'Instructor Unlock: On' : 'Instructor Unlock'}</span>
          </button>

          <button
            type="button"
            onClick={onResetAll}
            className="inline-flex items-center gap-2 rounded-md border border-[#2A364B] bg-[#131A26] px-3.5 py-2 text-xs font-medium text-[#94A3B8] transition-colors hover:border-red-500/40 hover:text-red-300 whitespace-nowrap cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Reset All Progress</span>
          </button>
        </div>
      </div>

      {/* Summary Row */}
      <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-xs tabular-nums text-[#94A3B8]">
        <span>Completed: {solvedCount} / {scenarios.length}</span>
        <span aria-hidden="true">·</span>
        <span>Total Score: {totalScore.toLocaleString()} / {(scenarios.length * 1000).toLocaleString()}</span>
        {instructorMode && (
          <>
            <span aria-hidden="true">·</span>
            <span className="text-amber-400">All scenarios unlocked (Instructor Mode)</span>
          </>
        )}
      </div>

      {/* Six Scenario Cards */}
      <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {scenarios.map((scenario) => {
          const prog = progressMap[scenario.id];
          const isUnlocked = instructorMode || prog?.status === 'active' || prog?.status === 'solved';
          const isSolved = prog?.status === 'solved';
          const isCurrent = activeScenarioId === scenario.id;

          return (
            <article
              key={scenario.id}
              className={`flex flex-col justify-between rounded-lg border p-5 transition-colors ${
                isCurrent
                  ? 'border-amber-500/60 bg-[#141C2A]'
                  : isSolved
                  ? 'border-emerald-500/30 bg-[#111824]'
                  : isUnlocked
                  ? 'border-[#232D3F] bg-[#111722]'
                  : 'border-[#1A2232] bg-[#0D121B] opacity-70'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 font-mono text-xs">
                  <span className="text-amber-400 font-semibold">
                    Case {scenario.number} · {scenario.code}
                  </span>
                  <span
                    className={
                      isSolved
                        ? 'text-emerald-400 font-medium'
                        : isUnlocked
                        ? 'text-[#CBD5E1]'
                        : 'text-[#64748B]'
                    }
                  >
                    {isSolved ? 'Resolved' : isUnlocked ? 'Open' : 'Locked'}
                  </span>
                </div>

                <h2 className="mt-2 font-display text-lg font-bold text-[#F8FAFC]">
                  {scenario.title}
                </h2>
                <p className="mt-1 font-mono text-xs text-[#94A3B8]">
                  {scenario.ticket.workstation} · {scenario.difficulty}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-[#A8B6CB]">
                  {scenario.ticket.subject}
                </p>
                <p className="mt-2 text-xs text-[#64748B]">
                  Focus: {scenario.focusArea}
                </p>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-[#1E2738] pt-4">
                <div className="font-mono text-xs tabular-nums text-[#94A3B8]">
                  {isSolved && prog.score ? (
                    <span className="inline-flex items-center gap-1.5 text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>
                        {prog.score.totalScore} pts ({prog.score.grade})
                      </span>
                    </span>
                  ) : isUnlocked ? (
                    <span>
                      Evidence: {prog?.discoveredEvidenceIds.length || 0}/{scenario.evidence.length}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-[#64748B]">
                      <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>Solve Case {scenario.number - 1}</span>
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  disabled={!isUnlocked}
                  onClick={() => onSelectScenario(scenario.id)}
                  className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                    isUnlocked
                      ? 'bg-[#1D2739] text-amber-400 hover:bg-amber-500 hover:text-[#0B0F17] cursor-pointer'
                      : 'bg-[#141A26] text-[#475569] cursor-not-allowed'
                  }`}
                >
                  <span>{isSolved ? 'Revisit' : isCurrent ? 'Continue' : 'Investigate'}</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {/* Instructor PIN Modal */}
      {showPinModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#05080F]/85 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="instructor-pin-title"
        >
          <div className="w-full max-w-sm rounded-lg border border-[#29354B] bg-[#111722] p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="instructor-pin-title" className="font-display text-base font-bold text-[#F8FAFC]">
                  Instructor Unlock PIN
                </h2>
                <p className="mt-1 text-xs text-[#94A3B8]">
                  Enter the 4-digit teacher PIN to unlock all six scenarios for classroom demonstration.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPinModal(false)}
                aria-label="Close PIN prompt"
                className="rounded p-1 text-[#94A3B8] transition-colors hover:bg-[#1C2536] hover:text-[#F8FAFC] cursor-pointer"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handlePinSubmit} className="mt-4 space-y-3">
              <div>
                <label htmlFor="instructor-pin-input" className="sr-only">
                  Instructor PIN
                </label>
                <input
                  id="instructor-pin-input"
                  type="password"
                  inputMode="numeric"
                  maxLength={8}
                  autoFocus
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    if (pinError) setPinError('');
                  }}
                  placeholder="Enter PIN..."
                  className="w-full rounded-md border border-[#253146] bg-[#080B11] px-3 py-2 font-mono text-sm tracking-widest text-[#F8FAFC] placeholder-[#475569] focus:border-amber-500 focus:outline-none"
                />
                {pinError && (
                  <p className="mt-1.5 text-xs text-red-400" role="alert">
                    {pinError}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowPinModal(false)}
                  className="rounded-md px-3 py-1.5 text-xs font-medium text-[#94A3B8] transition-colors hover:text-[#E2E8F0] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-amber-500 px-4 py-1.5 text-xs font-semibold text-[#0B0F17] transition-colors hover:bg-amber-400 cursor-pointer"
                >
                  Unlock Scenarios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
