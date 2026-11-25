import { useEffect, useRef, useState } from 'react';
import {
  RotateCcw,
  FileText,
  ChevronLeft,
  ChevronRight,
  Network,
  MessageSquare,
  X,
  HelpCircle,
  Lightbulb,
  Terminal as TerminalIcon,
} from 'lucide-react';
import { SCENARIOS } from './data/scenarios';
import { DEMO_SCENARIO } from './data/demoScenario';
import { ColleagueMessage, getUnlockedMessages } from './data/colleagueMessages';
import {
  ActiveView,
  DeckTab,
  ScenarioConfig,
  ScenarioProgress,
  TerminalLine,
} from './types/game';
import {
  applyMachineRepair,
  executeTerminalCommand,
  makeLine,
} from './engine/terminalEngine';
import { detectNearMissCommand } from './engine/commandAssist';
import { calculateScenarioScore } from './engine/scoring';
import { TopBar } from './components/TopBar';
import { BriefingScreen } from './components/BriefingScreen';
import { WindowsTerminal } from './components/WindowsTerminal';
import { InvestigationDeck } from './components/InvestigationDeck';
import { DemoCoachBanner } from './components/DemoCoachBanner';
import { NetworkTopologyPanel } from './components/NetworkTopologyPanel';
import { CaseFileView } from './components/CaseFileView';
import { DebriefModal } from './components/DebriefModal';
import { CommandRefModal } from './components/CommandRefModal';
import { ScenarioMapView } from './components/ScenarioMapView';
import { FinalScoreScreen } from './components/FinalScoreScreen';

const STORAGE_KEY = 'faultline_progress_v1';
const PLAYER_NAME_KEY = 'faultline_player_name_v1';
const STUCK_IDLE_MS = 60_000;

function buildInitialLines(scenario: ScenarioConfig): TerminalLine[] {
  const m = scenario.initialMachine;
  return [
    makeLine('system', `${m.osName} [Version ${m.osVersion}]`),
    makeLine('system', `(c) Meridian Freight & Logistics IT Remote Console — Host: ${m.hostname}`),
    makeLine('system', `Ticket ${scenario.code} · Logged session: ${m.currentUser}. Type "help" for commands.`),
  ];
}

function createInitialProgress(scenario: ScenarioConfig, unlocked: boolean): ScenarioProgress {
  return {
    scenarioId: scenario.id,
    status: unlocked ? 'active' : 'locked',
    machine: JSON.parse(JSON.stringify(scenario.initialMachine)),
    terminalLines: buildInitialLines(scenario),
    commandHistory: [],
    validDiagnosticCommands: [],
    invalidCommandCount: 0,
    discoveredEvidenceIds: [],
    revealedHintLevels: [],
    hypothesisSolved: false,
    wrongHypothesisIds: [],
    completedRepairIds: [],
    wrongRepairIds: [],
    verifiedCheckIds: [],
    notes: '',
    score: null,
  };
}

function createInitialProgressMap(): Record<string, ScenarioProgress> {
  const map: Record<string, ScenarioProgress> = {};
  SCENARIOS.forEach((sc, idx) => {
    map[sc.id] = createInitialProgress(sc, idx === 0);
  });
  return map;
}

function loadSavedProgress(): Record<string, ScenarioProgress> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialProgressMap();
    const parsed = JSON.parse(raw) as Record<string, ScenarioProgress>;
    const fresh = createInitialProgressMap();
    for (const sc of SCENARIOS) {
      if (parsed[sc.id] && parsed[sc.id].machine) {
        fresh[sc.id] = parsed[sc.id];
      }
    }
    return fresh;
  } catch {
    return createInitialProgressMap();
  }
}

export default function App() {
  const [playerName, setPlayerName] = useState<string>(() => {
    try {
      return localStorage.getItem(PLAYER_NAME_KEY) || '';
    } catch {
      return '';
    }
  });
  const [progressMap, setProgressMap] = useState<Record<string, ScenarioProgress>>(() =>
    loadSavedProgress()
  );
  const [demoProgress, setDemoProgress] = useState<ScenarioProgress>(() =>
    createInitialProgress(DEMO_SCENARIO, true)
  );
  const [isDemoActive, setIsDemoActive] = useState(false);

  const [activeView, setActiveView] = useState<ActiveView>('briefing');
  const [activeScenarioId, setActiveScenarioId] = useState<string>('case-1');
  const [activeDeckTab, setActiveDeckTab] = useState<DeckTab>('ticket');
  const [showCommandRef, setShowCommandRef] = useState(false);
  const [showNetworkMap, setShowNetworkMap] = useState(false);
  const [debriefScenarioId, setDebriefScenarioId] = useState<string | null>(null);
  const [instructorMode, setInstructorMode] = useState(false);

  // Streaming state for realistic ping / tracert pacing
  const [isStreaming, setIsStreaming] = useState(false);
  const streamTimersRef = useRef<number[]>([]);

  // Live colleague message banner state
  const seenMessageIdsRef = useRef<Set<string>>(new Set());
  const [incomingMessage, setIncomingMessage] = useState<ColleagueMessage | null>(null);

  // Two-strike command coach pop-up (strict syntax: never auto-executes)
  const nearMissCountsRef = useRef<Record<string, number>>({});
  const [commandCoach, setCommandCoach] = useState<{
    strike: 1 | 2;
    suggestedCommand: string;
  } | null>(null);

  // "Stuck?" inactivity clue pop-up
  const [showStuckPopup, setShowStuckPopup] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progressMap));
    } catch {
      // Ignore storage quota errors
    }
  }, [progressMap]);

  useEffect(() => {
    try {
      localStorage.setItem(PLAYER_NAME_KEY, playerName);
    } catch {
      // Ignore storage quota errors
    }
  }, [playerName]);

  const cancelActiveStream = (appendCancelLine = false) => {
    if (streamTimersRef.current.length > 0) {
      streamTimersRef.current.forEach((id) => window.clearTimeout(id));
      streamTimersRef.current = [];
    }
    if (isStreaming) {
      setIsStreaming(false);
      if (appendCancelLine) {
        updateActiveProgress((curr) => ({
          ...curr,
          terminalLines: [...curr.terminalLines, makeLine('system', '^C (Command terminated by user)')],
        }));
      }
    }
  };

  useEffect(() => {
    return () => {
      streamTimersRef.current.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  const activeScenario = isDemoActive
    ? DEMO_SCENARIO
    : SCENARIOS.find((s) => s.id === activeScenarioId) || SCENARIOS[0];
  const activeProgress = isDemoActive ? demoProgress : progressMap[activeScenario.id];

  const solvedScenarios = SCENARIOS.filter((s) => progressMap[s.id]?.status === 'solved');
  const unlockedCaseNumbers = solvedScenarios.map((s) => s.number);
  const unlockedClues = solvedScenarios.map((s) => s.caseFileClue);
  const cumulativeScore = solvedScenarios.reduce(
    (sum, s) => sum + (progressMap[s.id]?.score?.totalScore || 0),
    0
  );
  const hasStarted = SCENARIOS.some(
    (s) =>
      progressMap[s.id]?.commandHistory.length > 0 ||
      progressMap[s.id]?.status === 'solved'
  );

  const allRepairsDone = activeScenario.requiredRepairIds.every((id) =>
    activeProgress.completedRepairIds.includes(id)
  );
  const allVerified = activeProgress.verifiedCheckIds.length >= activeScenario.verifications.length;

  const activeMessages = getUnlockedMessages(
    activeScenario.id,
    activeProgress.discoveredEvidenceIds,
    allRepairsDone,
    allVerified
  );

  // Detect newly unlocked mid-case colleague messages and pop a non-blocking banner
  useEffect(() => {
    for (const msg of activeMessages) {
      if (!seenMessageIdsRef.current.has(msg.id)) {
        seenMessageIdsRef.current.add(msg.id);
        if (msg.trigger !== 'start' && activeView === 'workspace') {
          setIncomingMessage(msg);
        }
      }
    }
  }, [activeMessages, activeView]);

  const nextUnrevealedHint = activeScenario.hints.find(
    (h) => !activeProgress.revealedHintLevels.includes(h.level)
  );

  // Inactivity watcher for the "Stuck?" clue pop-up
  useEffect(() => {
    const canWatchIdle =
      activeView === 'workspace' &&
      !isDemoActive &&
      activeProgress.status !== 'solved' &&
      !isStreaming &&
      !showCommandRef &&
      !debriefScenarioId;

    if (!canWatchIdle) {
      setShowStuckPopup(false);
      return;
    }

    if (showStuckPopup) return;

    let timerId = window.setTimeout(() => {
      setShowStuckPopup(true);
    }, STUCK_IDLE_MS);

    const resetIdleTimer = () => {
      window.clearTimeout(timerId);
      timerId = window.setTimeout(() => {
        setShowStuckPopup(true);
      }, STUCK_IDLE_MS);
    };

    window.addEventListener('keydown', resetIdleTimer);
    window.addEventListener('pointerdown', resetIdleTimer);

    return () => {
      window.clearTimeout(timerId);
      window.removeEventListener('keydown', resetIdleTimer);
      window.removeEventListener('pointerdown', resetIdleTimer);
    };
  }, [
    activeView,
    isDemoActive,
    activeScenario.id,
    activeProgress.status,
    activeProgress.commandHistory.length,
    activeProgress.completedRepairIds.length,
    activeDeckTab,
    isStreaming,
    showCommandRef,
    debriefScenarioId,
    showStuckPopup,
  ]);

  const updateProgressById = (
    targetId: string,
    isDemoTarget: boolean,
    updater: (curr: ScenarioProgress) => ScenarioProgress
  ) => {
    if (isDemoTarget) {
      setDemoProgress((curr) => updater(curr));
    } else {
      setProgressMap((prev) => {
        const curr = prev[targetId];
        if (!curr) return prev;
        return {
          ...prev,
          [targetId]: updater(curr),
        };
      });
    }
  };

  const updateActiveProgress = (updater: (curr: ScenarioProgress) => ScenarioProgress) => {
    updateProgressById(activeScenario.id, isDemoActive, updater);
  };

  // ---------- Handlers ----------

  const handleStartDemo = () => {
    cancelActiveStream(false);
    nearMissCountsRef.current = {};
    setCommandCoach(null);
    setShowStuckPopup(false);
    setDemoProgress(createInitialProgress(DEMO_SCENARIO, true));
    setIsDemoActive(true);
    setIncomingMessage(null);
    setActiveDeckTab('ticket');
    setDebriefScenarioId(null);
    setActiveView('workspace');
  };

  const handleExitDemoToCase1 = () => {
    cancelActiveStream(false);
    nearMissCountsRef.current = {};
    setCommandCoach(null);
    setShowStuckPopup(false);
    setIsDemoActive(false);
    setIncomingMessage(null);
    setDebriefScenarioId(null);
    setActiveScenarioId('case-1');
    setActiveDeckTab('ticket');
    setActiveView('workspace');
  };

  const handleRunCommand = (rawCommand: string) => {
    if (isStreaming) return;
    const scenario = activeScenario;
    const targetId = scenario.id;
    const isDemoTarget = isDemoActive;
    const curr = activeProgress;

    const trimmed = rawCommand.trim();
    setShowStuckPopup(false);
    const promptLine = makeLine('prompt', `${curr.machine.currentDir}>${rawCommand}`);
    const res = executeTerminalCommand(
      rawCommand,
      curr.machine,
      scenario,
      curr.completedRepairIds
    );

    if (res.commandCategory === 'invalid') {
      const suggestion = detectNearMissCommand(trimmed);
      if (suggestion) {
        const nextCount = (nearMissCountsRef.current[suggestion.key] || 0) + 1;
        nearMissCountsRef.current[suggestion.key] = nextCount;
        setCommandCoach({
          strike: nextCount >= 2 ? 2 : 1,
          suggestedCommand: suggestion.suggestedCommand,
        });
      } else {
        setCommandCoach(null);
      }
    } else {
      nearMissCountsRef.current = {};
      setCommandCoach(null);
    }

    if (res.commandCategory === 'clear') {
      updateProgressById(targetId, isDemoTarget, (c) => ({
        ...c,
        terminalLines: buildInitialLines(scenario),
      }));
      return;
    }

    const newlyAddedEvidence = res.newEvidenceIds.filter(
      (id) => !curr.discoveredEvidenceIds.includes(id)
    );
    const newlyVerified = res.newVerificationIds.filter(
      (id) => !curr.verifiedCheckIds.includes(id)
    );
    const newlyRepaired = res.newCompletedRepairIds.filter(
      (id) => !curr.completedRepairIds.includes(id)
    );

    const extraNotices: TerminalLine[] = [];
    for (const evId of newlyAddedEvidence) {
      const evObj = scenario.evidence.find((e) => e.id === evId);
      if (evObj) {
        extraNotices.push(makeLine('clue', `[Evidence Logged] ${evObj.title}`));
      }
    }
    for (const repId of newlyRepaired) {
      const repObj = scenario.repairs.find((r) => r.id === repId);
      if (repObj) {
        extraNotices.push(
          makeLine(
            'success',
            `[Remediation Applied via CLI] ${repObj.title} — run post-fix verification commands to confirm recovery.`
          )
        );
      }
    }
    for (const verId of newlyVerified) {
      const verObj = scenario.verifications.find((v) => v.id === verId);
      if (verObj) {
        extraNotices.push(makeLine('success', `[Verification Confirmed] ${verObj.label}`));
      }
    }

    const firstWord = (trimmed.split(/\s+/)[0] || '').toLowerCase();
    const shouldStream =
      (firstWord === 'ping' || firstWord === 'tracert') && res.outputLines.length > 3;

    const applyFinalMetadata = (c: ScenarioProgress, trailingLines: TerminalLine[] = []): ScenarioProgress => {
      const nextHistory = trimmed ? [...c.commandHistory, trimmed] : c.commandHistory;
      const nextValidDiag =
        res.commandCategory === 'diagnostic' && res.normalizedCommand
          ? Array.from(new Set([...c.validDiagnosticCommands, res.normalizedCommand]))
          : c.validDiagnosticCommands;

      const updated: ScenarioProgress = {
        ...c,
        machine: res.nextMachine,
        terminalLines: [...c.terminalLines, ...trailingLines],
        commandHistory: nextHistory,
        validDiagnosticCommands: nextValidDiag,
        invalidCommandCount:
          res.commandCategory === 'invalid' ? c.invalidCommandCount + 1 : c.invalidCommandCount,
        discoveredEvidenceIds: Array.from(
          new Set([...c.discoveredEvidenceIds, ...res.newEvidenceIds])
        ),
        completedRepairIds: Array.from(
          new Set([...c.completedRepairIds, ...res.newCompletedRepairIds])
        ),
        verifiedCheckIds: Array.from(
          new Set([...c.verifiedCheckIds, ...res.newVerificationIds])
        ),
      };
      if (updated.status === 'solved') {
        updated.score = calculateScenarioScore(scenario, updated);
      }
      return updated;
    };

    if (!shouldStream) {
      updateProgressById(targetId, isDemoTarget, (c) =>
        applyFinalMetadata(c, [promptLine, ...res.outputLines, ...extraNotices])
      );
      return;
    }

    // Realistic line-by-line streaming for ping & tracert
    const headerCount = firstWord === 'tracert' ? 4 : 2;
    const headerLines = res.outputLines.slice(0, headerCount);
    const bodyLines = res.outputLines.slice(headerCount);

    setIsStreaming(true);
    updateProgressById(targetId, isDemoTarget, (c) => ({
      ...c,
      terminalLines: [...c.terminalLines, promptLine, ...headerLines],
    }));

    let elapsed = 0;
    const timers: number[] = [];

    bodyLines.forEach((line, idx) => {
      const isReplyOrHop =
        line.text.startsWith('Reply from') ||
        line.text.includes('Request timed out') ||
        line.text.includes('transmit failed') ||
        line.text.includes('General failure') ||
        /^\s+\d+\s+/.test(line.text);

      const stepDelay = isReplyOrHop
        ? line.text.includes('timed out') || line.text.includes('General failure')
          ? 340
          : 210
        : 60;

      elapsed += stepDelay;
      const isLast = idx === bodyLines.length - 1;

      const t = window.setTimeout(() => {
        if (isLast) {
          streamTimersRef.current = [];
          setIsStreaming(false);
          updateProgressById(targetId, isDemoTarget, (c) =>
            applyFinalMetadata(c, [line, ...extraNotices])
          );
        } else {
          updateProgressById(targetId, isDemoTarget, (c) => ({
            ...c,
            terminalLines: [...c.terminalLines, line],
          }));
        }
      }, elapsed);
      timers.push(t);
    });

    streamTimersRef.current = timers;
  };

  const handleClearTerminal = () => {
    cancelActiveStream(false);
    updateActiveProgress((curr) => ({
      ...curr,
      terminalLines: buildInitialLines(activeScenario),
    }));
  };

  const handleSelectHypothesis = (hypothesisId: string) => {
    const hyp = activeScenario.hypotheses.find((h) => h.id === hypothesisId);
    if (!hyp) return;

    updateActiveProgress((curr) => {
      if (curr.hypothesisSolved) return curr;
      if (hyp.isCorrect) {
        return { ...curr, hypothesisSolved: true };
      }
      return {
        ...curr,
        wrongHypothesisIds: Array.from(new Set([...curr.wrongHypothesisIds, hypothesisId])),
      };
    });
  };

  const handleApplyRepair = (repairId: string) => {
    const rep = activeScenario.repairs.find((r) => r.id === repairId);
    if (!rep) return;

    updateActiveProgress((curr) => {
      if (!rep.isCorrect) {
        return {
          ...curr,
          wrongRepairIds: Array.from(new Set([...curr.wrongRepairIds, repairId])),
        };
      }

      const updatedMachine = applyMachineRepair(curr.machine, rep.applyKey);
      const nextCompleted = Array.from(new Set([...curr.completedRepairIds, repairId]));
      const notice = makeLine(
        'success',
        `[Remediation Applied] ${rep.title}. Run diagnostic commands now to verify system recovery.`
      );

      return {
        ...curr,
        machine: updatedMachine,
        completedRepairIds: nextCompleted,
        terminalLines: [...curr.terminalLines, notice],
      };
    });
  };

  const handleRevealHint = (level: 1 | 2 | 3) => {
    updateActiveProgress((curr) => {
      if (curr.revealedHintLevels.includes(level)) return curr;
      return {
        ...curr,
        revealedHintLevels: [...curr.revealedHintLevels, level],
      };
    });
  };

  const handleNotesChange = (notes: string) => {
    updateActiveProgress((curr) => ({ ...curr, notes }));
  };

  const handleCompleteCase = () => {
    cancelActiveStream(false);
    const scenario = activeScenario;
    if (isDemoActive) {
      setDemoProgress((curr) => ({
        ...curr,
        status: 'solved',
        score: calculateScenarioScore(DEMO_SCENARIO, curr),
      }));
      setDebriefScenarioId(DEMO_SCENARIO.id);
      return;
    }

    setProgressMap((prev) => {
      const curr = prev[scenario.id];
      if (!curr) return prev;
      const finalScore = calculateScenarioScore(scenario, curr);
      const updatedCurr: ScenarioProgress = {
        ...curr,
        status: 'solved',
        score: finalScore,
      };

      const nextMap: Record<string, ScenarioProgress> = {
        ...prev,
        [scenario.id]: updatedCurr,
      };

      const nextScenario = SCENARIOS.find((s) => s.number === scenario.number + 1);
      if (nextScenario && nextMap[nextScenario.id]?.status === 'locked') {
        nextMap[nextScenario.id] = {
          ...nextMap[nextScenario.id],
          status: 'active',
        };
      }

      return nextMap;
    });
    setDebriefScenarioId(scenario.id);
  };

  const handleResetCurrentCase = () => {
    cancelActiveStream(false);
    nearMissCountsRef.current = {};
    setCommandCoach(null);
    setShowStuckPopup(false);
    setIncomingMessage(null);
    if (isDemoActive) {
      setDemoProgress(createInitialProgress(DEMO_SCENARIO, true));
    } else {
      setProgressMap((prev) => ({
        ...prev,
        [activeScenario.id]: createInitialProgress(activeScenario, true),
      }));
    }
    setActiveDeckTab('ticket');
  };

  const handleResetAll = () => {
    cancelActiveStream(false);
    seenMessageIdsRef.current.clear();
    nearMissCountsRef.current = {};
    setCommandCoach(null);
    setShowStuckPopup(false);
    setIncomingMessage(null);
    const fresh = createInitialProgressMap();
    setProgressMap(fresh);
    setDemoProgress(createInitialProgress(DEMO_SCENARIO, true));
    setIsDemoActive(false);
    setActiveScenarioId('case-1');
    setActiveDeckTab('ticket');
    setDebriefScenarioId(null);
    setPlayerName('');
    setActiveView('briefing');
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(PLAYER_NAME_KEY);
  };

  const handleSelectScenario = (scenarioId: string) => {
    cancelActiveStream(false);
    nearMissCountsRef.current = {};
    setCommandCoach(null);
    setShowStuckPopup(false);
    setIncomingMessage(null);
    setIsDemoActive(false);
    setActiveScenarioId(scenarioId);
    setActiveDeckTab('ticket');
    setActiveView('workspace');
  };

  const handleNavigate = (view: ActiveView) => {
    cancelActiveStream(false);
    setCommandCoach(null);
    setShowStuckPopup(false);
    setActiveView(view);
  };

  const workflowStages = [
    { id: 'triage', label: '1. Triage', done: activeProgress.commandHistory.length > 0 },
    { id: 'evidence', label: '2. Evidence', done: activeProgress.discoveredEvidenceIds.length >= 2 },
    { id: 'hypothesis', label: '3. Hypothesis', done: activeProgress.hypothesisSolved },
    { id: 'fix', label: '4. Fix', done: allRepairsDone },
    { id: 'verify', label: '5. Verify', done: allVerified },
  ];

  const prevScenario = !isDemoActive
    ? SCENARIOS.find((s) => s.number === activeScenario.number - 1)
    : undefined;
  const nextScenario = !isDemoActive
    ? SCENARIOS.find((s) => s.number === activeScenario.number + 1)
    : undefined;
  const canGoNext =
    !!nextScenario &&
    (instructorMode ||
      progressMap[nextScenario.id]?.status === 'active' ||
      progressMap[nextScenario.id]?.status === 'solved');

  const debriefScenario =
    debriefScenarioId === DEMO_SCENARIO.id
      ? DEMO_SCENARIO
      : debriefScenarioId
      ? SCENARIOS.find((s) => s.id === debriefScenarioId) || null
      : null;
  const debriefProgress =
    debriefScenarioId === DEMO_SCENARIO.id
      ? demoProgress
      : debriefScenario
      ? progressMap[debriefScenario.id]
      : null;

  return (
    <div className="flex min-h-screen flex-col bg-[#0B0F17] text-[#E8EEF6]">
      <TopBar
        activeView={activeView}
        onNavigate={handleNavigate}
        onOpenCommandRef={() => setShowCommandRef(true)}
        unlockedCluesCount={unlockedClues.length}
        solvedCount={solvedScenarios.length}
        totalCases={SCENARIOS.length}
      />

      {activeView === 'briefing' && (
        <BriefingScreen
          playerName={playerName}
          onPlayerNameChange={setPlayerName}
          hasStarted={hasStarted}
          solvedCount={solvedScenarios.length}
          totalCases={SCENARIOS.length}
          totalScore={cumulativeScore}
          onStartWorkspace={() => {
            setIsDemoActive(false);
            setActiveView('workspace');
          }}
          onStartDemo={handleStartDemo}
          onOpenScenarios={() => setActiveView('scenarios')}
          onOpenCaseFile={() => setActiveView('casefile')}
          onOpenFinalScore={() => setActiveView('results')}
        />
      )}

      {activeView === 'workspace' && (
        <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-4 py-4 sm:px-6">
          {/* Guided Walkthrough Coach Banner (Demo Mode only) */}
          {isDemoActive && (
            <DemoCoachBanner
              progress={demoProgress}
              activeTab={activeDeckTab}
              onRunSuggestedCommand={handleRunCommand}
              onSwitchTab={setActiveDeckTab}
              onExitDemo={handleExitDemoToCase1}
            />
          )}

          {/* Non-blocking Incoming Colleague Message Notification */}
          {incomingMessage && incomingMessage.scenarioId === activeScenario.id && (
            <div
              role="status"
              className="mb-4 flex items-start justify-between gap-4 rounded-lg border border-amber-500/40 bg-[#141C2A] px-4 py-3"
            >
              <div className="flex items-start gap-3 min-w-0">
                <MessageSquare className="mt-0.5 h-4 w-4 text-amber-400 shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-2 text-xs">
                    <span className="font-semibold text-[#F8FAFC]">{incomingMessage.sender}</span>
                    <span className="text-[#94A3B8]">{incomingMessage.role}</span>
                    <span aria-hidden="true" className="text-[#475569]">·</span>
                    <span className="font-mono text-[11px] text-amber-400">New message · {incomingMessage.time}</span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-[#E2E8F0]">
                    &ldquo;{incomingMessage.text}&rdquo;
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {activeDeckTab !== 'ticket' && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveDeckTab('ticket');
                      setIncomingMessage(null);
                    }}
                    className="rounded bg-[#1D2739] px-2.5 py-1 text-xs font-medium text-amber-400 transition-colors hover:bg-[#26344B] whitespace-nowrap cursor-pointer"
                  >
                    Open Thread
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIncomingMessage(null)}
                  aria-label="Dismiss message notification"
                  className="rounded p-1 text-[#94A3B8] transition-colors hover:bg-[#1E2738] hover:text-[#F8FAFC] cursor-pointer"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}

          {/* Compact Workspace Context Strip */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4 border-b border-[#1E2738] pb-3.5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-xs text-[#94A3B8]">
                <span className="font-semibold text-amber-400">
                  {isDemoActive
                    ? 'Training Sandbox'
                    : `Case ${activeScenario.number} of ${SCENARIOS.length}`}
                </span>
                <span aria-hidden="true">·</span>
                <span>{activeScenario.code}</span>
                <span aria-hidden="true">·</span>
                <span>{activeProgress.machine.hostname}</span>
                <span aria-hidden="true">·</span>
                <span>{activeScenario.difficulty}</span>
              </div>
              <h1 className="mt-1 font-display text-xl font-bold text-[#F8FAFC]">
                {activeScenario.title}
              </h1>
            </div>

            {/* Workflow Stage Tracker + Case Actions */}
            <div className="flex flex-wrap items-center gap-3">
              <ol
                aria-label="Investigation workflow progress"
                className="hidden 2xl:flex items-center gap-4 font-mono text-xs"
              >
                {workflowStages.map((st) => (
                  <li
                    key={st.id}
                    className={st.done ? 'text-emerald-400 font-medium' : 'text-[#64748B]'}
                  >
                    {st.done ? `✓ ${st.label}` : st.label}
                  </li>
                ))}
              </ol>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowNetworkMap((v) => !v)}
                  className={`inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    showNetworkMap
                      ? 'border-amber-500/60 bg-amber-500/15 text-amber-300'
                      : 'border-[#253146] bg-[#111722] text-[#E2E8F0] hover:border-amber-500/40 hover:bg-[#192233]'
                  }`}
                >
                  <Network className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{showNetworkMap ? 'Hide Network Map' : 'Network Map'}</span>
                </button>

                {prevScenario && (
                  <button
                    type="button"
                    onClick={() => handleSelectScenario(prevScenario.id)}
                    className="inline-flex items-center gap-1 rounded border border-[#253146] bg-[#111722] px-2.5 py-1.5 text-xs text-[#CBD5E1] transition-colors hover:bg-[#192233] whitespace-nowrap cursor-pointer"
                    title={`Switch to Case ${prevScenario.number}`}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Case {prevScenario.number}</span>
                  </button>
                )}

                {canGoNext && nextScenario && (
                  <button
                    type="button"
                    onClick={() => handleSelectScenario(nextScenario.id)}
                    className="inline-flex items-center gap-1 rounded border border-[#253146] bg-[#111722] px-2.5 py-1.5 text-xs text-amber-400 transition-colors hover:bg-[#192233] whitespace-nowrap cursor-pointer"
                    title={`Switch to Case ${nextScenario.number}`}
                  >
                    <span>Case {nextScenario.number}</span>
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}

                {activeProgress.status === 'solved' && (
                  <button
                    type="button"
                    onClick={() => setDebriefScenarioId(activeScenario.id)}
                    className="inline-flex items-center gap-1.5 rounded bg-emerald-500/15 border border-emerald-500/40 px-3 py-1.5 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-500/25 whitespace-nowrap cursor-pointer"
                  >
                    <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Debrief</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleResetCurrentCase}
                  className="inline-flex items-center gap-1.5 rounded border border-[#253146] bg-[#111722] px-2.5 py-1.5 text-xs text-[#94A3B8] transition-colors hover:text-[#E2E8F0] whitespace-nowrap cursor-pointer"
                  title="Reset this workstation to its initial faulty state"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Reset Host</span>
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Live Network Topology Map (Toggleable) */}
          {showNetworkMap && (
            <NetworkTopologyPanel
              key={activeScenario.id}
              scenario={activeScenario}
              progress={activeProgress}
              unlockedCaseNumbers={unlockedCaseNumbers}
              onClose={() => setShowNetworkMap(false)}
            />
          )}

          {/* Two-Zone Sandbox Split: Simulated Terminal (Left ~58%) + Investigation Deck (Right ~42%) */}
          <div className="grid flex-1 grid-cols-1 gap-5 lg:grid-cols-12 lg:min-h-[calc(100vh-165px)]">
            <div className="lg:col-span-7 flex flex-col">
              <WindowsTerminal
                key={activeScenario.id}
                machine={activeProgress.machine}
                lines={activeProgress.terminalLines}
                commandHistory={activeProgress.commandHistory}
                isStreaming={isStreaming}
                onRunCommand={handleRunCommand}
                onCancelStream={() => cancelActiveStream(true)}
                onClearTerminal={handleClearTerminal}
              />
            </div>

            <div className="lg:col-span-5 flex flex-col">
              <InvestigationDeck
                key={activeScenario.id}
                scenario={activeScenario}
                progress={activeProgress}
                messages={activeMessages}
                activeTab={activeDeckTab}
                onTabChange={setActiveDeckTab}
                onSelectHypothesis={handleSelectHypothesis}
                onApplyRepair={handleApplyRepair}
                onRevealHint={handleRevealHint}
                onNotesChange={handleNotesChange}
                onCompleteCase={handleCompleteCase}
                onOpenDebrief={() => setDebriefScenarioId(activeScenario.id)}
              />
            </div>
          </div>

          {/* Non-blocking Workspace Assistant Pop-Ups (Command Coach & Stuck? Clue) */}
          {(commandCoach || showStuckPopup) && (
            <div className="pointer-events-none fixed bottom-5 right-5 z-40 flex w-[calc(100vw-2.5rem)] max-w-sm flex-col gap-3">
              {commandCoach && (
                <div
                  role="status"
                  aria-live="polite"
                  className="pointer-events-auto rounded-lg border border-amber-500/45 bg-[#141C2A] p-4 shadow-xl shadow-black/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <TerminalIcon
                        className="mt-0.5 h-4 w-4 text-amber-400 shrink-0"
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        {commandCoach.strike === 1 ? (
                          <>
                            <p className="font-display text-sm font-semibold text-[#F8FAFC]">
                              Try again
                            </p>
                            <p className="mt-1 text-xs leading-relaxed text-[#CBD5E1]">
                              You&apos;re on the right track — check your spelling, spacing, or flags and try again.
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="font-display text-sm font-semibold text-[#F8FAFC]">
                              Psst.. I think you meant
                            </p>
                            <code className="mt-1.5 block rounded border border-[#2A3750] bg-[#0B0F17] px-2.5 py-1.5 font-mono text-xs text-amber-300 break-all">
                              {commandCoach.suggestedCommand}
                            </code>
                            <p className="mt-1.5 text-[11px] text-[#94A3B8]">
                              Type it into the command prompt to run it.
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCommandCoach(null)}
                      aria-label="Dismiss command tip"
                      className="rounded p-1 text-[#94A3B8] transition-colors hover:bg-[#1E2738] hover:text-[#F8FAFC] cursor-pointer shrink-0"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )}

              {showStuckPopup && (
                <div
                  role="dialog"
                  aria-label="Need a clue?"
                  className="pointer-events-auto rounded-lg border border-amber-500/50 bg-[#141C2A] p-4 shadow-xl shadow-black/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <HelpCircle
                        className="mt-0.5 h-4 w-4 text-amber-400 shrink-0"
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <p className="font-display text-sm font-semibold text-[#F8FAFC]">
                          Stuck?
                        </p>
                        {nextUnrevealedHint ? (
                          <>
                            <p className="mt-1 text-xs leading-relaxed text-[#CBD5E1]">
                              Things have gone quiet on this host. Want a Tier {nextUnrevealedHint.level} clue for your next step for{' '}
                              <span className="font-mono font-semibold text-amber-300">
                                -{nextUnrevealedHint.cost} pts
                              </span>
                              ?
                            </p>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  handleRevealHint(nextUnrevealedHint.level);
                                  setActiveDeckTab('hints');
                                  setShowStuckPopup(false);
                                }}
                                className="inline-flex items-center gap-1.5 rounded bg-amber-500 px-3 py-1.5 text-xs font-semibold text-[#0B0F17] transition-colors hover:bg-amber-400 cursor-pointer"
                              >
                                <Lightbulb className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>Give me a clue (-{nextUnrevealedHint.cost} pts)</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setShowStuckPopup(false)}
                                className="rounded border border-[#2A3750] bg-[#111722] px-2.5 py-1.5 text-xs text-[#CBD5E1] transition-colors hover:bg-[#1E2738] cursor-pointer"
                              >
                                Keep thinking
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <p className="mt-1 text-xs leading-relaxed text-[#CBD5E1]">
                              All 3 clues for this case are already unlocked. Review your Hints tab or open the Command Guide for syntax.
                            </p>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveDeckTab('hints');
                                  setShowStuckPopup(false);
                                }}
                                className="inline-flex items-center gap-1.5 rounded bg-amber-500 px-3 py-1.5 text-xs font-semibold text-[#0B0F17] transition-colors hover:bg-amber-400 cursor-pointer"
                              >
                                <Lightbulb className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>View Hints</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setShowStuckPopup(false)}
                                className="rounded border border-[#2A3750] bg-[#111722] px-2.5 py-1.5 text-xs text-[#CBD5E1] transition-colors hover:bg-[#1E2738] cursor-pointer"
                              >
                                Keep working
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowStuckPopup(false)}
                      aria-label="Dismiss stuck prompt"
                      className="rounded p-1 text-[#94A3B8] transition-colors hover:bg-[#1E2738] hover:text-[#F8FAFC] cursor-pointer shrink-0"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      )}

      {activeView === 'casefile' && (
        <CaseFileView
          clues={unlockedClues}
          totalCases={SCENARIOS.length}
          onReturnToWorkspace={() => {
            setIsDemoActive(false);
            setActiveView('workspace');
          }}
        />
      )}

      {activeView === 'scenarios' && (
        <ScenarioMapView
          scenarios={SCENARIOS}
          progressMap={progressMap}
          activeScenarioId={activeScenarioId}
          instructorMode={instructorMode}
          onSetInstructorMode={setInstructorMode}
          onSelectScenario={handleSelectScenario}
          onStartDemo={handleStartDemo}
          onResetAll={handleResetAll}
        />
      )}

      {activeView === 'results' && (
        <FinalScoreScreen
          playerName={playerName}
          scenarios={SCENARIOS}
          progressMap={progressMap}
          onOpenCaseFile={() => setActiveView('casefile')}
          onReturnToStart={() => setActiveView('briefing')}
          onResetAll={handleResetAll}
        />
      )}

      {/* Command Reference Modal */}
      {showCommandRef && (
        <CommandRefModal onClose={() => setShowCommandRef(false)} />
      )}

      {/* Post-Level Diagnostic Debrief Modal */}
      {debriefScenario && debriefProgress?.score && (
        <DebriefModal
          scenario={debriefScenario}
          score={debriefProgress.score}
          hasNextScenario={
            debriefScenario.id !== DEMO_SCENARIO.id &&
            debriefScenario.number < SCENARIOS.length
          }
          isFinalCase={debriefScenario.number === SCENARIOS.length}
          isDemo={debriefScenario.id === DEMO_SCENARIO.id}
          cumulativeScore={cumulativeScore}
          totalCases={SCENARIOS.length}
          onClose={() => setDebriefScenarioId(null)}
          onNextScenario={() => {
            if (debriefScenario.id === DEMO_SCENARIO.id) {
              handleExitDemoToCase1();
              return;
            }
            const next = SCENARIOS.find((s) => s.number === debriefScenario.number + 1);
            setDebriefScenarioId(null);
            if (next) {
              handleSelectScenario(next.id);
            }
          }}
          onOpenCaseFile={() => {
            setDebriefScenarioId(null);
            setActiveView('casefile');
          }}
          onViewFinalScore={() => {
            setDebriefScenarioId(null);
            setActiveView('results');
          }}
        />
      )}
    </div>
  );
}
