import { useState } from 'react';
import {
  CheckCircle2,
  Circle,
  AlertTriangle,
  HelpCircle,
  ChevronRight,
  Lock,
  Wrench,
  ShieldCheck,
  MessageSquare,
} from 'lucide-react';
import { DeckTab, ScenarioConfig, ScenarioProgress } from '../types/game';
import { ColleagueMessage } from '../data/colleagueMessages';

interface InvestigationDeckProps {
  scenario: ScenarioConfig;
  progress: ScenarioProgress;
  messages: ColleagueMessage[];
  activeTab: DeckTab;
  onTabChange: (tab: DeckTab) => void;
  onSelectHypothesis: (hypothesisId: string) => void;
  onApplyRepair: (repairId: string) => void;
  onRevealHint: (level: 1 | 2 | 3) => void;
  onNotesChange: (notes: string) => void;
  onCompleteCase: () => void;
  onOpenDebrief: () => void;
}

export function InvestigationDeck({
  scenario,
  progress,
  messages,
  activeTab,
  onTabChange,
  onSelectHypothesis,
  onApplyRepair,
  onRevealHint,
  onNotesChange,
  onCompleteCase,
  onOpenDebrief,
}: InvestigationDeckProps) {
  const [lastHypothesisFeedback, setLastHypothesisFeedback] = useState<{
    isCorrect: boolean;
    message: string;
  } | null>(null);
  const [lastRepairFeedback, setLastRepairFeedback] = useState<{
    isCorrect: boolean;
    message: string;
  } | null>(null);

  const discoveredCount = progress.discoveredEvidenceIds.length;
  const totalEvidence = scenario.evidence.length;
  const allRepairsDone = scenario.requiredRepairIds.every((id) =>
    progress.completedRepairIds.includes(id)
  );
  const verifiedCount = progress.verifiedCheckIds.length;
  const totalVerifications = scenario.verifications.length;
  const allVerified = verifiedCount >= totalVerifications;

  const isMultiStage = scenario.requiredRepairIds.length > 1;
  const stageGroups = isMultiStage
    ? Array.from(new Set(scenario.repairs.map((r) => r.stageId || 'default'))).map((stageId) => ({
        stageId,
        label: scenario.repairs.find((r) => r.stageId === stageId)?.stageLabel || 'Remediation',
        items: scenario.repairs.filter((r) => r.stageId === stageId),
      }))
    : [{ stageId: 'single', label: 'Select Appropriate Technical Fix', items: scenario.repairs }];

  const handleHypothesisClick = (hypId: string) => {
    const hyp = scenario.hypotheses.find((h) => h.id === hypId);
    if (!hyp) return;
    setLastHypothesisFeedback({ isCorrect: hyp.isCorrect, message: hyp.feedback });
    onSelectHypothesis(hypId);
  };

  const handleRepairClick = (repId: string) => {
    const rep = scenario.repairs.find((r) => r.id === repId);
    if (!rep) return;
    setLastRepairFeedback({ isCorrect: rep.isCorrect, message: rep.feedback });
    onApplyRepair(repId);
  };

  const tabs: { id: DeckTab; label: string }[] = [
    { id: 'ticket', label: 'Ticket' },
    { id: 'evidence', label: `Evidence (${discoveredCount}/${totalEvidence})` },
    { id: 'diagnose', label: 'Diagnose & Fix' },
    { id: 'hints', label: `Hints (${progress.revealedHintLevels.length}/3)` },
  ];

  return (
    <aside className="flex h-full min-h-[480px] flex-col overflow-hidden rounded-lg border border-[#232D3F] bg-[#111722]">
      {/* Segmented Interactive Tab Bar */}
      <div className="border-b border-[#1E2738] bg-[#0E141F] p-2">
        <div className="grid grid-cols-4 gap-1 rounded-md bg-[#090D14] p-1" role="tablist">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onTabChange(tab.id)}
                className={`rounded px-2 py-1.5 text-xs font-medium transition-colors truncate whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-[#1D2739] text-amber-400'
                    : 'text-[#94A3B8] hover:text-[#E2E8F0]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Scrollable Deck Body */}
      <div className="flex-1 overflow-y-auto p-5">
        {/* ================= TICKET TAB ================= */}
        {activeTab === 'ticket' && (
          <div className="space-y-5">
            <div>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-xs text-[#94A3B8]">
                <span className="font-semibold text-amber-400">{scenario.ticket.id}</span>
                <span aria-hidden="true">·</span>
                <span>{scenario.ticket.reportedAt}</span>
                <span aria-hidden="true">·</span>
                <span
                  className={
                    scenario.ticket.priority === 'Critical'
                      ? 'text-red-400 font-semibold'
                      : scenario.ticket.priority === 'High'
                      ? 'text-amber-300 font-medium'
                      : 'text-[#CBD5E1]'
                  }
                >
                  Priority: {scenario.ticket.priority}
                </span>
              </div>
              <h2 className="mt-2 font-display text-lg font-bold text-[#F8FAFC]">
                {scenario.ticket.subject}
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-3 border-y border-[#1E2738] py-3.5 text-xs">
              <div>
                <p className="text-[#64748B]">Reported By</p>
                <p className="mt-0.5 font-medium text-[#E2E8F0]">{scenario.ticket.reporterName}</p>
                <p className="text-[#94A3B8]">{scenario.ticket.reporterRole}</p>
              </div>
              <div>
                <p className="text-[#64748B]">Target Machine</p>
                <p className="mt-0.5 font-mono font-medium text-[#E2E8F0]">{scenario.ticket.workstation}</p>
                <p className="font-mono text-[#94A3B8]">{scenario.ticket.reporterAccount}</p>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold tracking-wide text-[#94A3B8]">
                User Report
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#CBD5E1]">
                &ldquo;{scenario.ticket.description}&rdquo;
              </p>
            </div>

            <div>
              <h3 className="text-xs font-semibold tracking-wide text-[#94A3B8]">
                Observed Symptoms
              </h3>
              <ul className="mt-2.5 space-y-2 text-sm text-[#CBD5E1]">
                {scenario.ticket.observedSymptoms.map((symptom, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden="true" />
                    <span>{symptom}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Ops / Colleague Messages Thread */}
            {messages.length > 0 && (
              <div className="border-t border-[#1E2738] pt-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-[#94A3B8]">
                    <MessageSquare className="h-3.5 w-3.5 text-amber-400 shrink-0" aria-hidden="true" />
                    <span>Helpdesk &amp; Team Messages</span>
                  </h3>
                  <span className="font-mono text-[11px] tabular-nums text-[#64748B]">
                    {messages.length}
                  </span>
                </div>

                <div className="mt-2.5 space-y-2.5">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className="rounded-md border border-[#1E2738] bg-[#0D131D] p-3"
                    >
                      <div className="flex items-baseline justify-between gap-2 text-xs">
                        <span className="font-semibold text-[#F1F5F9]">
                          {msg.sender}{' '}
                          <span className="font-normal text-[#64748B]">· {msg.role}</span>
                        </span>
                        <span className="font-mono text-[11px] tabular-nums text-[#64748B] shrink-0">
                          {msg.time}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-[#CBD5E1]">{msg.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t border-[#1E2738] pt-4">
              <p className="text-xs leading-relaxed text-[#94A3B8]">
                Begin by running diagnostic commands in the terminal on the left. Key findings will automatically be logged into your <strong className="text-[#E2E8F0]">Evidence</strong> tab.
              </p>
              <button
                type="button"
                onClick={() => onTabChange('diagnose')}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 transition-colors hover:text-amber-300 cursor-pointer"
              >
                <span>Proceed to Diagnose &amp; Fix when ready</span>
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        {/* ================= EVIDENCE TAB ================= */}
        {activeTab === 'evidence' && (
          <div className="space-y-5">
            <div className="flex items-baseline justify-between gap-2">
              <div>
                <h2 className="font-display text-base font-bold text-[#F8FAFC]">
                  Gathered Evidence
                </h2>
                <p className="mt-0.5 text-xs text-[#94A3B8]">
                  Run diagnostic commands in the terminal to uncover technical facts.
                </p>
              </div>
              <span className="font-mono text-xs font-semibold tabular-nums text-amber-400">
                {discoveredCount} / {totalEvidence}
              </span>
            </div>

            <div className="space-y-3">
              {scenario.evidence.map((ev) => {
                const found = progress.discoveredEvidenceIds.includes(ev.id);
                return (
                  <div
                    key={ev.id}
                    className={`rounded-md border p-3.5 transition-colors ${
                      found
                        ? 'border-emerald-500/35 bg-emerald-500/[0.06]'
                        : 'border-[#1E2738] bg-[#0D131D]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5">
                        {found ? (
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
                        ) : (
                          <Circle className="mt-0.5 h-4 w-4 shrink-0 text-[#475569]" aria-hidden="true" />
                        )}
                        <div>
                          <p className={`text-sm font-semibold ${found ? 'text-[#F1F5F9]' : 'text-[#64748B]'}`}>
                            {found ? ev.title : `Undiscovered ${ev.category} Finding`}
                          </p>
                          <p className={`mt-1 text-xs leading-relaxed ${found ? 'text-[#CBD5E1]' : 'text-[#475569]'}`}>
                            {found
                              ? ev.summary
                              : 'Inspect this system area using terminal diagnostic commands to log evidence.'}
                          </p>
                        </div>
                      </div>
                      <span className="font-mono text-[11px] tabular-nums text-[#64748B] shrink-0">
                        {found ? 'Logged' : 'Pending'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Technician Notes */}
            <div className="border-t border-[#1E2738] pt-4">
              <label htmlFor="tech-notes" className="block text-xs font-semibold text-[#CBD5E1]">
                Technician Scratchpad (Saved Automatically)
              </label>
              <textarea
                id="tech-notes"
                rows={4}
                value={progress.notes}
                onChange={(e) => onNotesChange(e.target.value)}
                placeholder="Jot down IP addresses, MACs, PIDs, usernames, or hypotheses as you investigate..."
                className="mt-2 w-full rounded-md border border-[#232D3F] bg-[#080B11] p-3 font-mono text-xs leading-relaxed text-[#E2E8F0] placeholder-[#475569] focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* ================= DIAGNOSE & FIX TAB ================= */}
        {activeTab === 'diagnose' && (
          <div className="space-y-6">
            {/* Step 1: Form Hypothesis */}
            <section>
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-sm font-bold text-[#F8FAFC]">
                  Step 1. Form &amp; Test Your Hypothesis
                </h2>
                <span className={`font-mono text-xs ${progress.hypothesisSolved ? 'text-emerald-400' : 'text-[#94A3B8]'}`}>
                  {progress.hypothesisSolved ? 'Confirmed' : 'Pending'}
                </span>
              </div>
              <p className="mt-1 text-xs text-[#94A3B8]">
                Based on your terminal findings ({discoveredCount}/{totalEvidence} evidence logged), select the root cause supported by the data.
              </p>

              {discoveredCount < 2 && !progress.hypothesisSolved && (
                <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
                  <span>
                    Tip: Gather at least 2 pieces of terminal evidence before selecting a diagnosis. Blind guessing deducts accuracy marks.
                  </span>
                </div>
              )}

              <div className="mt-3 space-y-2.5">
                {scenario.hypotheses.map((hyp) => {
                  const wasWrong = progress.wrongHypothesisIds.includes(hyp.id);
                  const isSolvedCorrect = progress.hypothesisSolved && hyp.isCorrect;

                  return (
                    <button
                      key={hyp.id}
                      type="button"
                      disabled={progress.hypothesisSolved}
                      onClick={() => handleHypothesisClick(hyp.id)}
                      className={`w-full rounded-md border p-3 text-left transition-colors ${
                        isSolvedCorrect
                          ? 'border-emerald-500/50 bg-emerald-500/10'
                          : wasWrong
                          ? 'border-red-500/35 bg-red-500/[0.06] opacity-75'
                          : progress.hypothesisSolved
                          ? 'border-[#1C2434] bg-[#0D131D] opacity-50'
                          : 'border-[#253146] bg-[#141C2A] hover:border-amber-500/60 hover:bg-[#192334] cursor-pointer'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-semibold text-[#F1F5F9]">{hyp.title}</span>
                        {isSolvedCorrect && (
                          <span className="font-mono text-[11px] font-semibold text-emerald-400 shrink-0">
                            Confirmed
                          </span>
                        )}
                        {wasWrong && !isSolvedCorrect && (
                          <span className="font-mono text-[11px] text-red-400 shrink-0">
                            Ruled Out
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-[#94A3B8]">{hyp.explanation}</p>
                    </button>
                  );
                })}
              </div>

              {lastHypothesisFeedback && (
                <div
                  className={`mt-3 rounded-md border p-3 text-xs leading-relaxed ${
                    lastHypothesisFeedback.isCorrect
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                      : 'border-red-500/40 bg-red-500/10 text-red-200'
                  }`}
                >
                  {lastHypothesisFeedback.message}
                </div>
              )}
            </section>

            {/* Step 2: Apply Technical Remediation */}
            <section className="border-t border-[#1E2738] pt-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-sm font-bold text-[#F8FAFC]">
                  Step 2. Apply Technical Remediation
                </h2>
                <span className={`font-mono text-xs ${allRepairsDone ? 'text-emerald-400' : 'text-[#94A3B8]'}`}>
                  {allRepairsDone
                    ? 'Applied'
                    : isMultiStage
                    ? `${progress.completedRepairIds.length}/${scenario.requiredRepairIds.length} Stages`
                    : 'Waiting'}
                </span>
              </div>

              {!progress.hypothesisSolved && !allRepairsDone ? (
                <div className="mt-2.5 flex items-center gap-2 rounded-md border border-[#1E2738] bg-[#0D131D] p-3 text-xs text-[#64748B]">
                  <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    Confirm your root-cause hypothesis above (or execute the repair command directly in the terminal).
                  </span>
                </div>
              ) : (
                <div className="mt-3 space-y-4">
                  <p className="text-xs text-[#94A3B8]">
                    Select the proper fix below, or run its Windows command directly inside the terminal.
                  </p>

                  {stageGroups.map((group) => {
                    const stageCorrectId = group.items.find((i) => i.isCorrect)?.id;
                    const stageDone = stageCorrectId ? progress.completedRepairIds.includes(stageCorrectId) : false;

                    return (
                      <div key={group.stageId} className="space-y-2">
                        {isMultiStage && (
                          <div className="flex items-center justify-between text-xs font-semibold text-amber-400">
                            <span>{group.label}</span>
                            <span className="font-mono text-[11px] text-[#94A3B8]">
                              {stageDone ? 'Contained' : 'Action Required'}
                            </span>
                          </div>
                        )}
                        {group.items.map((rep) => {
                          const done = progress.completedRepairIds.includes(rep.id);
                          const failed = progress.wrongRepairIds.includes(rep.id);
                          return (
                            <button
                              key={rep.id}
                              type="button"
                              disabled={stageDone || done}
                              onClick={() => handleRepairClick(rep.id)}
                              className={`w-full rounded-md border p-3 text-left transition-colors ${
                                done
                                  ? 'border-emerald-500/50 bg-emerald-500/10'
                                  : failed
                                  ? 'border-red-500/35 bg-red-500/[0.06] opacity-75'
                                  : stageDone
                                  ? 'border-[#1C2434] bg-[#0D131D] opacity-45'
                                  : 'border-[#253146] bg-[#141C2A] hover:border-amber-500/60 hover:bg-[#192334] cursor-pointer'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className="flex items-center gap-2 text-xs font-semibold text-[#F1F5F9]">
                                  <Wrench className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden="true" />
                                  <span>{rep.title}</span>
                                </span>
                                {done && (
                                  <span className="font-mono text-[11px] font-semibold text-emerald-400 shrink-0">
                                    Applied
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 text-xs text-[#94A3B8]">{rep.description}</p>
                              <p className="mt-1.5 font-mono text-[11px] text-[#64748B] truncate">
                                CLI: {rep.commandEquivalent}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}

                  {lastRepairFeedback && (
                    <div
                      className={`rounded-md border p-3 text-xs leading-relaxed ${
                        lastRepairFeedback.isCorrect
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                          : 'border-red-500/40 bg-red-500/10 text-red-200'
                      }`}
                    >
                      {lastRepairFeedback.message}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Step 3: Post-Fix Verification (Bonus Points!) */}
            <section className="border-t border-[#1E2738] pt-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-sm font-bold text-[#F8FAFC]">
                  Step 3. Post-Fix Verification (+150 Bonus)
                </h2>
                <span className={`font-mono text-xs tabular-nums ${allVerified ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {verifiedCount}/{totalVerifications} Verified
                </span>
              </div>

              {!allRepairsDone ? (
                <p className="mt-2 text-xs text-[#64748B]">
                  Apply the fix first, then run diagnostic commands in the terminal to prove the system has recovered.
                </p>
              ) : (
                <div className="mt-3 space-y-2.5">
                  <p className="text-xs leading-relaxed text-[#CBD5E1]">
                    Never close a ticket on faith! Run verification commands in the terminal now to prove the repair succeeded:
                  </p>
                  {scenario.verifications.map((ver) => {
                    const checked = progress.verifiedCheckIds.includes(ver.id);
                    return (
                      <div
                        key={ver.id}
                        className={`flex items-start gap-2.5 rounded-md border p-3 ${
                          checked
                            ? 'border-emerald-500/40 bg-emerald-500/10'
                            : 'border-[#253146] bg-[#0D131D]'
                        }`}
                      >
                        {checked ? (
                          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
                        ) : (
                          <Circle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400/60" aria-hidden="true" />
                        )}
                        <div>
                          <p className={`text-xs font-semibold ${checked ? 'text-emerald-300' : 'text-[#F1F5F9]'}`}>
                            {ver.label}
                          </p>
                          <p className="mt-0.5 text-xs text-[#94A3B8]">{ver.description}</p>
                        </div>
                      </div>
                    );
                  })}

                  <div className="pt-2">
                    {progress.status === 'solved' ? (
                      <button
                        type="button"
                        onClick={onOpenDebrief}
                        className="w-full rounded-md bg-emerald-500 px-4 py-2.5 text-xs font-semibold text-[#06130D] transition-colors hover:bg-emerald-400 cursor-pointer"
                      >
                        View Diagnostic Debrief Report
                      </button>
                    ) : !progress.hypothesisSolved ? (
                      <div className="rounded-md border border-amber-500/35 bg-amber-500/10 p-3 text-xs text-amber-200">
                        Repair applied via terminal! Confirm your root-cause hypothesis in <strong>Step 1</strong> above before closing the ticket so you receive full diagnosis marks.
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={onCompleteCase}
                        className={`w-full rounded-md px-4 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
                          allVerified
                            ? 'bg-emerald-500 text-[#06130D] hover:bg-emerald-400'
                            : 'bg-amber-500 text-[#0B0F17] hover:bg-amber-400'
                        }`}
                      >
                        {allVerified
                          ? 'Close Ticket & Open Diagnostic Debrief (Full Verification Bonus)'
                          : 'Close Ticket Without Full Verification (Forfeits Remaining Bonus)'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        {/* ================= HINTS TAB ================= */}
        {activeTab === 'hints' && (
          <div className="space-y-4">
            <div>
              <h2 className="font-display text-base font-bold text-[#F8FAFC]">
                Three-Tier Diagnostic Hints
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-[#94A3B8]">
                Hints unlock progressively and deduct points from your final case score. Try forming your own test in the terminal first.
              </p>
            </div>

            <div className="space-y-3">
              {scenario.hints.map((hint) => {
                const isRevealed = progress.revealedHintLevels.includes(hint.level);
                const prevRevealed =
                  hint.level === 1 || progress.revealedHintLevels.includes(hint.level - 1);

                return (
                  <div
                    key={hint.level}
                    className={`rounded-md border p-4 ${
                      isRevealed
                        ? 'border-amber-500/35 bg-amber-500/[0.06]'
                        : 'border-[#1E2738] bg-[#0D131D]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-xs font-semibold text-[#F1F5F9]">
                        <HelpCircle className="h-3.5 w-3.5 text-amber-400 shrink-0" aria-hidden="true" />
                        <span>
                          Tier {hint.level}: {hint.title}
                        </span>
                      </span>
                      <span className="font-mono text-xs tabular-nums text-amber-400">
                        -{hint.cost} pts
                      </span>
                    </div>

                    {isRevealed ? (
                      <p className="mt-2.5 text-xs leading-relaxed text-[#E2E8F0]">{hint.text}</p>
                    ) : (
                      <div className="mt-3">
                        <button
                          type="button"
                          disabled={!prevRevealed}
                          onClick={() => onRevealHint(hint.level)}
                          className={`rounded px-3 py-1.5 text-xs font-semibold transition-colors ${
                            prevRevealed
                              ? 'bg-[#1D2739] text-amber-400 hover:bg-[#26344B] cursor-pointer'
                              : 'bg-[#131926] text-[#475569] cursor-not-allowed'
                          }`}
                        >
                          {prevRevealed
                            ? `Unlock Tier ${hint.level} Hint (-${hint.cost} pts)`
                            : `Unlock Tier ${hint.level - 1} First`}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
