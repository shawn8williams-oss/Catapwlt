import { ScenarioConfig, ScenarioProgress, ScoreBreakdown } from '../types/game';

export function calculateScenarioScore(
  scenario: ScenarioConfig,
  progress: ScenarioProgress
): ScoreBreakdown {
  // 1. Evidence Gathering (max 250 pts)
  const maxEvidencePoints = 250;
  const totalEvidenceCount = Math.max(1, scenario.evidence.length);
  const evidenceRatio = progress.discoveredEvidenceIds.length / totalEvidenceCount;
  const evidencePoints = Math.round(evidenceRatio * maxEvidencePoints);

  // 2. Sensible Command Choice (max 150 pts)
  // Rewards using multiple distinct relevant diagnostic commands, penalizes excessive invalid spam
  const maxCommandChoicePoints = 150;
  const uniqueDiagCount = new Set(progress.validDiagnosticCommands).size;
  const baseCommandScore = Math.min(maxCommandChoicePoints, uniqueDiagCount * 35);
  const spamPenalty = Math.max(0, progress.invalidCommandCount - 3) * 10;
  const commandChoicePoints = Math.max(20, Math.min(maxCommandChoicePoints, baseCommandScore - spamPenalty));

  // 3. Hypothesis & Diagnosis (max 250 pts)
  const maxDiagnosisPoints = 250;
  let diagnosisPoints = 0;
  if (progress.hypothesisSolved) {
    // Small deduction for guessing without evidence or wrong guesses
    const wrongDeduction = progress.wrongHypothesisIds.length * 45;
    const blindGuessPenalty = progress.discoveredEvidenceIds.length < 2 ? 40 : 0;
    diagnosisPoints = Math.max(100, maxDiagnosisPoints - wrongDeduction - blindGuessPenalty);
  }

  // 4. Appropriate Repair (max 200 pts)
  const maxRepairPoints = 200;
  const allRepairsDone = scenario.requiredRepairIds.every((id) =>
    progress.completedRepairIds.includes(id)
  );
  let repairPoints = 0;
  if (allRepairsDone) {
    const wrongRepairPenalty = progress.wrongRepairIds.length * 35;
    repairPoints = Math.max(90, maxRepairPoints - wrongRepairPenalty);
  }

  // 5. Post-Fix Verification Bonus (max +150 pts)
  const maxVerificationBonus = 150;
  const totalVerifications = Math.max(1, scenario.verifications.length);
  const verifyRatio = progress.verifiedCheckIds.length / totalVerifications;
  const verificationBonus = Math.round(verifyRatio * maxVerificationBonus);

  // 6. Hint Penalty
  const hintPenalty = progress.revealedHintLevels.reduce((acc, lvl) => {
    const hint = scenario.hints.find((h) => h.level === lvl);
    return acc + (hint ? hint.cost : 0);
  }, 0);

  const rawTotal =
    evidencePoints +
    commandChoicePoints +
    diagnosisPoints +
    repairPoints +
    verificationBonus -
    hintPenalty;

  const totalScore = Math.max(0, Math.min(1000, rawTotal));
  const maxPossibleScore = 1000;

  let grade: ScoreBreakdown['grade'] = 'Needs Review';
  if (totalScore >= 850) grade = 'Distinction';
  else if (totalScore >= 700) grade = 'Merit';
  else if (totalScore >= 550) grade = 'Pass';

  return {
    evidencePoints,
    maxEvidencePoints,
    commandChoicePoints,
    maxCommandChoicePoints,
    diagnosisPoints,
    maxDiagnosisPoints,
    repairPoints,
    maxRepairPoints,
    verificationBonus,
    maxVerificationBonus,
    hintPenalty,
    totalScore,
    maxPossibleScore,
    grade,
  };
}
