import { Printer, FolderOpen, RotateCcw, Award, ArrowLeft } from 'lucide-react';
import { ScenarioConfig, ScenarioProgress } from '../types/game';

interface FinalScoreScreenProps {
  playerName: string;
  scenarios: ScenarioConfig[];
  progressMap: Record<string, ScenarioProgress>;
  onOpenCaseFile: () => void;
  onReturnToStart: () => void;
  onResetAll: () => void;
}

export function FinalScoreScreen({
  playerName,
  scenarios,
  progressMap,
  onOpenCaseFile,
  onReturnToStart,
  onResetAll,
}: FinalScoreScreenProps) {
  const maxTotal = scenarios.length * 1000;
  const totalScore = scenarios.reduce(
    (sum, sc) => sum + (progressMap[sc.id]?.score?.totalScore || 0),
    0
  );
  const percentage = Math.round((totalScore / maxTotal) * 1000) / 10;

  let overallGrade: 'Distinction' | 'Merit' | 'Pass' | 'Needs Review' = 'Needs Review';
  let rankTitle = 'Junior Systems Technician';
  if (percentage >= 85) {
    overallGrade = 'Distinction';
    rankTitle = 'Lead Incident Response Technician';
  } else if (percentage >= 70) {
    overallGrade = 'Merit';
    rankTitle = 'Senior Systems Analyst';
  } else if (percentage >= 55) {
    overallGrade = 'Pass';
    rankTitle = 'Systems Support Technician';
  }

  const totalEvidenceFound = scenarios.reduce(
    (sum, sc) => sum + (progressMap[sc.id]?.discoveredEvidenceIds.length || 0),
    0
  );
  const totalEvidencePossible = scenarios.reduce((sum, sc) => sum + sc.evidence.length, 0);

  const totalHintsUsed = scenarios.reduce(
    (sum, sc) => sum + (progressMap[sc.id]?.revealedHintLevels.length || 0),
    0
  );

  const fullVerificationsCount = scenarios.filter((sc) => {
    const p = progressMap[sc.id];
    return p && p.verifiedCheckIds.length >= sc.verifications.length;
  }).length;

  const solvedCount = scenarios.filter((sc) => progressMap[sc.id]?.status === 'solved').length;

  const completedDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <main className="mx-auto max-w-[1160px] px-4 py-8 sm:px-6">
      {/* Top Action Row (hidden when printing) */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <button
          type="button"
          onClick={onReturnToStart}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#94A3B8] transition-colors hover:text-[#E8EEF6] cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Back to Start Screen</span>
        </button>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenCaseFile}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#2A364B] bg-[#131A26] px-3.5 py-2 text-xs font-medium text-[#E2E8F0] transition-colors hover:bg-[#1C2536] cursor-pointer"
          >
            <FolderOpen className="h-3.5 w-3.5" aria-hidden="true" />
            <span>View Case File</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-4 py-2 text-xs font-semibold text-[#0B0F17] transition-colors hover:bg-amber-400 cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Print / Save Score Report</span>
          </button>
        </div>
      </div>

      {/* Main Score Certificate / Report Sheet */}
      <section className="overflow-hidden rounded-lg border border-[#263144] bg-[#111722]">
        {/* Header */}
        <div className="border-b border-[#1E2738] bg-[#0D131D] px-6 py-6 sm:px-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="font-mono text-xs text-amber-400">
                FAULT//LINE · Level 3 IT Fault Diagnosis Assessment Report
              </p>
              <h1 className="mt-2 font-display text-2xl font-bold text-[#F8FAFC] sm:text-3xl">
                Final Shift Performance Report
              </h1>
              <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-[#CBD5E1]">
                <span>
                  Technician: <strong className="text-[#F8FAFC]">{playerName || 'Unnamed Technician'}</strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>Date: {completedDate}</span>
                <span aria-hidden="true">·</span>
                <span>Cases Resolved: {solvedCount} / {scenarios.length}</span>
              </div>
            </div>

            <div className="text-left sm:text-right">
              <p className="font-mono text-xs text-[#94A3B8]">Final Score</p>
              <p className="mt-1 font-display text-4xl font-bold tabular-nums text-[#F8FAFC]">
                {totalScore.toLocaleString()}
                <span className="text-lg font-normal text-[#64748B]"> / {maxTotal.toLocaleString()}</span>
              </p>
              <div className="mt-1 flex items-center gap-2 font-mono text-xs sm:justify-end">
                <Award className="h-4 w-4 text-amber-400 shrink-0" aria-hidden="true" />
                <span
                  className={
                    overallGrade === 'Distinction'
                      ? 'font-semibold text-emerald-400'
                      : overallGrade === 'Merit'
                      ? 'font-semibold text-amber-400'
                      : 'font-semibold text-[#CBD5E1]'
                  }
                >
                  {overallGrade} ({percentage}%)
                </span>
                <span aria-hidden="true">·</span>
                <span className="text-[#94A3B8]">{rankTitle}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Key Diagnostic Habits Metrics */}
        <div className="grid grid-cols-1 gap-4 border-b border-[#1E2738] bg-[#0F1520] px-6 py-5 sm:grid-cols-3 sm:px-8">
          <div>
            <p className="text-xs text-[#94A3B8]">Evidence Gathered</p>
            <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-[#F8FAFC]">
              {totalEvidenceFound} / {totalEvidencePossible}
            </p>
            <p className="mt-0.5 text-xs text-[#64748B]">Key technical &amp; forensic artifacts logged</p>
          </div>

          <div>
            <p className="text-xs text-[#94A3B8]">Full Post-Fix Verifications</p>
            <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-emerald-400">
              {fullVerificationsCount} / {scenarios.length}
            </p>
            <p className="mt-0.5 text-xs text-[#64748B]">Cases proven working in terminal after repair</p>
          </div>

          <div>
            <p className="text-xs text-[#94A3B8]">Hints Used</p>
            <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-amber-400">
              {totalHintsUsed} / {scenarios.length * 3}
            </p>
            <p className="mt-0.5 text-xs text-[#64748B]">Tiered guidance requests across all six cases</p>
          </div>
        </div>

        {/* Per-Case Breakdown Table */}
        <div className="px-6 py-6 sm:px-8">
          <h2 className="font-display text-base font-bold text-[#F8FAFC]">
            Case-by-Case Diagnostic Breakdown
          </h2>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#232D3F] font-mono text-[#94A3B8]">
                  <th className="py-2.5 pr-4 font-medium">Case &amp; Host</th>
                  <th className="px-3 py-2.5 text-right font-medium">Evidence</th>
                  <th className="px-3 py-2.5 text-right font-medium">Commands</th>
                  <th className="px-3 py-2.5 text-right font-medium">Diagnosis</th>
                  <th className="px-3 py-2.5 text-right font-medium">Repair</th>
                  <th className="px-3 py-2.5 text-right font-medium">Verify</th>
                  <th className="px-3 py-2.5 text-right font-medium">Hints</th>
                  <th className="py-2.5 pl-4 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A2232] font-mono tabular-nums">
                {scenarios.map((sc) => {
                  const s = progressMap[sc.id]?.score;
                  return (
                    <tr key={sc.id} className="hover:bg-[#151D2B]/60">
                      <td className="py-3 pr-4 font-sans">
                        <div className="font-semibold text-[#F1F5F9]">
                          Case {sc.number}: {sc.title}
                        </div>
                        <div className="font-mono text-[11px] text-[#64748B]">
                          {sc.code} · {sc.ticket.workstation}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right text-[#CBD5E1]">
                        {s ? `${s.evidencePoints}/${s.maxEvidencePoints}` : '—'}
                      </td>
                      <td className="px-3 py-3 text-right text-[#CBD5E1]">
                        {s ? `${s.commandChoicePoints}/${s.maxCommandChoicePoints}` : '—'}
                      </td>
                      <td className="px-3 py-3 text-right text-[#CBD5E1]">
                        {s ? `${s.diagnosisPoints}/${s.maxDiagnosisPoints}` : '—'}
                      </td>
                      <td className="px-3 py-3 text-right text-[#CBD5E1]">
                        {s ? `${s.repairPoints}/${s.maxRepairPoints}` : '—'}
                      </td>
                      <td className="px-3 py-3 text-right text-emerald-400">
                        {s ? `+${s.verificationBonus}` : '—'}
                      </td>
                      <td className="px-3 py-3 text-right text-amber-400">
                        {s ? `-${s.hintPenalty}` : '—'}
                      </td>
                      <td className="py-3 pl-4 text-right font-semibold text-[#F8FAFC]">
                        {s ? `${s.totalScore} (${s.grade})` : 'Incomplete'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Incident Closure Summary */}
        <div className="border-t border-[#1E2738] bg-[#0D131D] px-6 py-5 sm:px-8">
          <h2 className="font-mono text-xs font-semibold text-emerald-400">
            Meridian Incident Closure Summary
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-[#CBD5E1]">
            Across six Monday morning tickets, {playerName || 'the technician'} traced seemingly ordinary faults—an invalid gateway on Reception, a /26 subnet break in Dispatch, hijacked DNS and hosts on Finance, an NTFS explicit DENY and sabotaged audit service in HR, and rogue exfiltration process <code className="text-amber-300">winupd_sync.exe</code> on SRV-FILE01—back to former contractor <code className="text-amber-300">MERIDIAN\m.halvorsen</code> and rogue staging host <code className="text-amber-300">MAINT-NODE-04 (192.168.10.214)</code> on Switch Port 24. All three persistence layers on <code className="text-amber-300">DC-CORE-01</code> were eradicated before the 10:00 AM external upload to <code className="text-amber-300">203.0.113.47:443</code>.
          </p>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#1E2738] pt-4 print:hidden">
            <p className="text-xs text-[#64748B]">
              Tip: Use Print / Save Score Report to save a PDF or submit your final score to your tutor.
            </p>
            <button
              type="button"
              onClick={onResetAll}
              className="inline-flex items-center gap-1.5 rounded border border-[#2A364B] bg-[#131A26] px-3 py-1.5 text-xs font-medium text-[#94A3B8] transition-colors hover:border-red-500/40 hover:text-red-300 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Start New Session</span>
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
