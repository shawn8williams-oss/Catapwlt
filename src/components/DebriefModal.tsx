import { X, ArrowRight, FolderPlus, CheckCircle2 } from 'lucide-react';
import { ScenarioConfig, ScoreBreakdown } from '../types/game';

interface DebriefModalProps {
  scenario: ScenarioConfig;
  score: ScoreBreakdown;
  hasNextScenario: boolean;
  isFinalCase: boolean;
  isDemo?: boolean;
  cumulativeScore: number;
  totalCases: number;
  onClose: () => void;
  onNextScenario: () => void;
  onOpenCaseFile: () => void;
  onViewFinalScore?: () => void;
}

export function DebriefModal({
  scenario,
  score,
  hasNextScenario,
  isFinalCase,
  isDemo = false,
  cumulativeScore,
  totalCases,
  onClose,
  onNextScenario,
  onOpenCaseFile,
  onViewFinalScore,
}: DebriefModalProps) {
  const { debrief, caseFileClue } = scenario;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#05080F]/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="debrief-modal-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-[#29354B] bg-[#111722]">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[#1E2738] bg-[#0D131D] px-6 py-5">
          <div>
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Ticket {scenario.code} Resolved</span>
              <span aria-hidden="true">·</span>
              <span>{isDemo ? 'Guided Sandbox Debrief' : `Case ${scenario.number} Diagnostic Report`}</span>
            </div>
            <h2 id="debrief-modal-title" className="mt-1.5 font-display text-xl font-bold text-[#F8FAFC]">
              {isFinalCase ? 'Incident Closed — Full Diagnostic Debrief' : scenario.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close debrief report"
            className="rounded p-1.5 text-[#94A3B8] transition-colors hover:bg-[#1C2536] hover:text-[#F8FAFC] cursor-pointer"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          {/* Score Summary Grid */}
          <section className="rounded-md border border-[#232D3F] bg-[#0C111A] p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-[#1E2738] pb-3">
              <div>
                <p className="text-xs text-[#94A3B8]">Diagnostic Assessment</p>
                <p className="mt-0.5 font-display text-2xl font-bold tabular-nums text-[#F8FAFC]">
                  {score.totalScore} <span className="text-sm font-normal text-[#64748B]">/ {score.maxPossibleScore} pts</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-[#94A3B8]">Grade Band</p>
                <p
                  className={`mt-0.5 font-display text-lg font-bold ${
                    score.grade === 'Distinction'
                      ? 'text-emerald-400'
                      : score.grade === 'Merit'
                      ? 'text-amber-400'
                      : 'text-[#CBD5E1]'
                  }`}
                >
                  {score.grade}
                </p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 font-mono text-xs tabular-nums sm:grid-cols-3">
              <div className="flex justify-between gap-2">
                <span className="text-[#94A3B8]">Evidence</span>
                <span className="text-[#E2E8F0]">{score.evidencePoints}/{score.maxEvidencePoints}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[#94A3B8]">Commands</span>
                <span className="text-[#E2E8F0]">{score.commandChoicePoints}/{score.maxCommandChoicePoints}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[#94A3B8]">Diagnosis</span>
                <span className="text-[#E2E8F0]">{score.diagnosisPoints}/{score.maxDiagnosisPoints}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[#94A3B8]">Repair</span>
                <span className="text-[#E2E8F0]">{score.repairPoints}/{score.maxRepairPoints}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[#94A3B8]">Verification</span>
                <span className={score.verificationBonus > 0 ? 'text-emerald-400' : 'text-[#64748B]'}>
                  +{score.verificationBonus}/{score.maxVerificationBonus}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[#94A3B8]">Hints Used</span>
                <span className={score.hintPenalty > 0 ? 'text-amber-400' : 'text-[#E2E8F0]'}>
                  -{score.hintPenalty}
                </span>
              </div>
            </div>
          </section>

          {/* 6-Part Required Diagnostic Report */}
          <section className="space-y-4 text-sm">
            <div>
              <h3 className="font-mono text-xs font-semibold text-amber-400">Fault</h3>
              <p className="mt-1 leading-relaxed text-[#E2E8F0]">{debrief.fault}</p>
            </div>

            <div>
              <h3 className="font-mono text-xs font-semibold text-amber-400">Symptoms</h3>
              <p className="mt-1 leading-relaxed text-[#CBD5E1]">{debrief.symptoms}</p>
            </div>

            <div>
              <h3 className="font-mono text-xs font-semibold text-amber-400">Evidence</h3>
              <ul className="mt-1.5 space-y-1.5 text-[#CBD5E1]">
                {debrief.evidence.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#64748B]" aria-hidden="true" />
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-mono text-xs font-semibold text-amber-400">Diagnosis</h3>
              <p className="mt-1 leading-relaxed text-[#CBD5E1]">{debrief.diagnosis}</p>
            </div>

            <div>
              <h3 className="font-mono text-xs font-semibold text-amber-400">Resolution</h3>
              <p className="mt-1 leading-relaxed text-[#CBD5E1]">{debrief.resolution}</p>
            </div>

            <div className="border-t border-[#1E2738] pt-4">
              <h3 className="font-mono text-xs font-semibold text-emerald-400">Real-World Lesson</h3>
              <p className="mt-1 leading-relaxed text-[#E2E8F0]">{debrief.realWorldLesson}</p>
              {debrief.simulationNote && (
                <p className="mt-2 text-xs leading-relaxed text-[#94A3B8]">
                  Simulation Note: {debrief.simulationNote}
                </p>
              )}
            </div>
          </section>

          {/* Case File Addition (Campaign cases only) */}
          {!isDemo && (
            <section className="rounded-md border border-amber-500/35 bg-amber-500/[0.06] p-4">
              <div className="flex items-center gap-2 font-mono text-xs font-semibold text-amber-400">
                <FolderPlus className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Added to Persistent Case File · Event {caseFileClue.eventTime}</span>
              </div>
              <h3 className="mt-1.5 text-sm font-bold text-[#F8FAFC]">{caseFileClue.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-[#CBD5E1]">{caseFileClue.summary}</p>
            </section>
          )}

          {isDemo && (
            <section className="rounded-md border border-amber-500/35 bg-amber-500/[0.06] p-4">
              <p className="font-mono text-xs font-semibold text-amber-400">
                Training Sandbox Complete
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[#CBD5E1]">
                This isolated demo does not affect your Case File or campaign score. You are ready to begin Monday&apos;s real helpdesk queue starting with Case 1 (INC-4012).
              </p>
            </section>
          )}

          {/* Final Campaign Summary Banner on Case 6 */}
          {isFinalCase && (
            <section className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-4">
              <p className="font-mono text-xs font-semibold text-emerald-400">
                All Six Connected Cases Complete · Meridian Freight &amp; Logistics Secured
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-[#E2E8F0]">
                You reconstructed the entire Sunday-to-Monday insider incident from six seemingly routine helpdesk tickets and stopped the 10:00 AM data exfiltration before a single record left the network.
              </p>
              <p className="mt-2 font-mono text-xs tabular-nums text-emerald-300">
                Final Campaign Score: {cumulativeScore.toLocaleString()} / {(totalCases * 1000).toLocaleString()}
              </p>
            </section>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#1E2738] bg-[#0D131D] px-6 py-4">
          {!isDemo ? (
            <button
              type="button"
              onClick={onOpenCaseFile}
              className="rounded-md border border-[#2A364B] bg-[#131A26] px-4 py-2 text-xs font-medium text-[#E2E8F0] transition-colors hover:bg-[#1C2536] cursor-pointer"
            >
              Inspect Case File
            </button>
          ) : (
            <span className="font-mono text-xs text-[#64748B]">Isolated Training Session</span>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-2 text-xs font-medium text-[#94A3B8] transition-colors hover:text-[#E2E8F0] cursor-pointer"
            >
              Stay on Machine
            </button>

            {(hasNextScenario || isDemo) && (
              <button
                type="button"
                onClick={onNextScenario}
                className="inline-flex items-center gap-2 rounded-md bg-amber-500 px-4 py-2 text-xs font-semibold text-[#0B0F17] transition-colors hover:bg-amber-400 cursor-pointer"
              >
                <span>{isDemo ? 'Start Case 1 (INC-4012)' : `Next Ticket (Case ${scenario.number + 1})`}</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}

            {isFinalCase && !isDemo && onViewFinalScore && (
              <button
                type="button"
                onClick={onViewFinalScore}
                className="inline-flex items-center gap-2 rounded-md bg-emerald-500 px-4 py-2 text-xs font-semibold text-[#06130D] transition-colors hover:bg-emerald-400 cursor-pointer"
              >
                <span>View Final Score Report</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
