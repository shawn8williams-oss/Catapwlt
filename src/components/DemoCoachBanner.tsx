import { Play, ArrowRight, CheckCircle2, X } from 'lucide-react';
import { DeckTab, ScenarioProgress } from '../types/game';

interface DemoCoachBannerProps {
  progress: ScenarioProgress;
  activeTab: DeckTab;
  onRunSuggestedCommand: (cmd: string) => void;
  onSwitchTab: (tab: DeckTab) => void;
  onExitDemo: () => void;
}

interface CoachStep {
  stepNumber: number;
  title: string;
  instruction: string;
  suggestedCommand?: string;
  targetTab?: DeckTab;
  targetTabLabel?: string;
}

export function DemoCoachBanner({
  progress,
  activeTab,
  onRunSuggestedCommand,
  onSwitchTab,
  onExitDemo,
}: DemoCoachBannerProps) {
  const hasSvcEvidence = progress.discoveredEvidenceIds.includes('demo-ev-svc');
  const hasNetEvidence = progress.discoveredEvidenceIds.includes('demo-ev-net');
  const hypDone = progress.hypothesisSolved;
  const fixDone = progress.completedRepairIds.includes('demo-fix-spooler');
  const verDone = progress.verifiedCheckIds.includes('demo-ver-svc');
  const solved = progress.status === 'solved';

  let step: CoachStep;
  if (!hasSvcEvidence) {
    step = {
      stepNumber: 1,
      title: 'Inspect the failing Windows service in the terminal',
      instruction:
        'Read the Ticket on the right, then type "sc query Spooler" in the terminal (or click Run Command) to check whether the Print Spooler service is running.',
      suggestedCommand: 'sc query Spooler',
    };
  } else if (!hasNetEvidence) {
    step = {
      stepNumber: 2,
      title: 'Rule out a network fault to gather second evidence',
      instruction:
        'Nice — Evidence #1 logged automatically! Good technicians test a second angle. Type "ping 192.168.10.80" (or "type C:\\Logs\\print_err.log") to prove the printer itself is reachable.',
      suggestedCommand: 'ping 192.168.10.80',
    };
  } else if (!hypDone) {
    step = {
      stepNumber: 3,
      title: 'Confirm your root-cause hypothesis',
      instruction:
        'You now have both pieces of evidence! Open the "Diagnose & Fix" tab on the right and select the hypothesis matching your terminal findings ("Local Windows Print Spooler service has stopped unexpectedly").',
      targetTab: activeTab !== 'diagnose' ? 'diagnose' : undefined,
      targetTabLabel: 'Open Diagnose & Fix Tab',
    };
  } else if (!fixDone) {
    step = {
      stepNumber: 4,
      title: 'Apply the repair (Workbench or Terminal CLI)',
      instruction:
        'In "Diagnose & Fix", click "Start the Windows Print Spooler service" — OR type "sc start Spooler" directly into the terminal. Both modify the live machine state!',
      suggestedCommand: 'sc start Spooler',
      targetTab: activeTab !== 'diagnose' ? 'diagnose' : undefined,
      targetTabLabel: 'Open Diagnose & Fix Tab',
    };
  } else if (!verDone) {
    step = {
      stepNumber: 5,
      title: 'Verify recovery for the +150 Verification Bonus',
      instruction:
        'Never close a ticket without proving it works! Run "sc query Spooler" again in the terminal to confirm STATE is now 4 RUNNING.',
      suggestedCommand: 'sc query Spooler',
    };
  } else if (!solved) {
    step = {
      stepNumber: 6,
      title: 'Close the ticket & review your Diagnostic Debrief',
      instruction:
        'Verification confirmed! Open the "Diagnose & Fix" tab and click "Close Ticket & Open Diagnostic Debrief" to see how scoring and post-case debriefs work.',
      targetTab: activeTab !== 'diagnose' ? 'diagnose' : undefined,
      targetTabLabel: 'Go to Close Ticket Button',
    };
  } else {
    step = {
      stepNumber: 6,
      title: 'Walkthrough complete — ready for Monday 08:47',
      instruction:
        'You have completed the full FAULT//LINE diagnostic workflow. Exit the training sandbox to start Case 1 (INC-4012) for real.',
    };
  }

  return (
    <section
      aria-label="Guided Demo Walkthrough"
      className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/[0.08] px-4 py-3.5"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-amber-300">
            {solved ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
            ) : (
              <span className="font-semibold">Guided Demo · Step {step.stepNumber} of 6</span>
            )}
            <span aria-hidden="true">·</span>
            <span className="text-[#CBD5E1]">Isolated Sandbox (does not affect campaign progress)</span>
          </div>
          <p className="mt-1 text-sm font-semibold text-[#F8FAFC]">{step.title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-[#CBD5E1]">{step.instruction}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {step.suggestedCommand && (
            <button
              type="button"
              onClick={() => onRunSuggestedCommand(step.suggestedCommand!)}
              className="inline-flex items-center gap-1.5 rounded bg-amber-500 px-3 py-1.5 font-mono text-xs font-semibold text-[#0B0F17] transition-colors hover:bg-amber-400 whitespace-nowrap cursor-pointer"
            >
              <Play className="h-3 w-3" aria-hidden="true" />
              <span>Run: {step.suggestedCommand}</span>
            </button>
          )}

          {step.targetTab && step.targetTabLabel && (
            <button
              type="button"
              onClick={() => onSwitchTab(step.targetTab!)}
              className="inline-flex items-center gap-1.5 rounded bg-amber-500 px-3 py-1.5 text-xs font-semibold text-[#0B0F17] transition-colors hover:bg-amber-400 whitespace-nowrap cursor-pointer"
            >
              <span>{step.targetTabLabel}</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}

          <button
            type="button"
            onClick={onExitDemo}
            className="inline-flex items-center gap-1.5 rounded border border-[#2A364B] bg-[#111722] px-3 py-1.5 text-xs font-medium text-[#CBD5E1] transition-colors hover:bg-[#1A2436] hover:text-[#F8FAFC] whitespace-nowrap cursor-pointer"
          >
            {solved ? (
              <>
                <span>Start Case 1</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </>
            ) : (
              <>
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Exit Demo</span>
              </>
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
