export type ScenarioStatus = 'locked' | 'active' | 'solved';

export interface ServiceRecord {
  name: string;
  displayName: string;
  state: 'RUNNING' | 'STOPPED';
  startType: 'AUTO_START' | 'DEMAND_START' | 'DISABLED';
  binaryPath: string;
  account: string;
  exitCode: number;
  exitReason?: string;
  pid?: number;
  suspicious?: boolean;
}

export interface ProcessRecord {
  name: string;
  pid: number;
  sessionName: string;
  memUsageKb: number;
  services?: string[];
  suspicious?: boolean;
}

export interface NetConnection {
  proto: 'TCP' | 'UDP';
  localAddress: string;
  foreignAddress: string;
  state: 'LISTENING' | 'ESTABLISHED' | 'TIME_WAIT' | 'SYN_SENT' | '';
  pid: number;
  suspicious?: boolean;
}

export interface ArpEntry {
  ip: string;
  mac: string;
  type: 'dynamic' | 'static';
}

export interface UserAccount {
  username: string;
  fullName: string;
  active: boolean;
  lastLogon: string;
  groups: string[];
  comment: string;
}

export interface AclEntry {
  principal: string;
  permissions: string;
  type: 'ALLOW' | 'DENY';
}

export interface ScheduledTaskRecord {
  name: string;
  nextRun: string;
  status: 'Ready' | 'Running' | 'Disabled';
  runAs: string;
  command: string;
  suspicious?: boolean;
}

export interface DnsRecord {
  hostname: string;
  ip: string;
  ttl: number;
}

export interface LanHost {
  ip: string;
  hostname: string;
  mac: string;
  respondsToPing: boolean;
  isGateway?: boolean;
  isDnsServer?: boolean;
}

export interface MachineState {
  hostname: string;
  osName: string;
  osVersion: string;
  domain: string;
  currentUser: string;
  currentDir: string;
  bootTime: string;
  adapterName: string;
  adapterDescription: string;
  macAddress: string;
  dhcpEnabled: boolean;
  ipAddress: string;
  subnetMask: string;
  defaultGateway: string;
  dnsServers: string[];
  dhcpServer: string;
  // Network simulation environment
  realGatewayIp: string;
  realDnsIp: string;
  dhcpAssignedIp: string;
  lanHosts: LanHost[];
  internalDnsRecords: DnsRecord[]; // Authoritative records on 192.168.10.5
  rogueDnsActive: boolean; // Whether 192.168.10.214 responds or times out
  rogueDnsRecords: DnsRecord[]; // Poisoned records if rogue DNS responds
  externalDnsRecords: DnsRecord[]; // Public internet records
  hostsFile: Record<string, string>; // hostname -> ip overrides
  dnsCache: DnsRecord[];
  arpCache: ArpEntry[];
  // OS / Services / Processes / Security
  services: ServiceRecord[];
  processes: ProcessRecord[];
  netConnections: NetConnection[];
  users: UserAccount[];
  localAdmins: string[];
  acls: Record<string, AclEntry[]>; // path -> ACL entries
  scheduledTasks: ScheduledTaskRecord[];
  firewallBlockedIps: string[];
  // Simulated file system: absolute Windows path (uppercase-normalized on lookup) -> file content
  files: Record<string, string>;
}

export interface TerminalLine {
  id: string;
  type: 'prompt' | 'output' | 'error' | 'success' | 'system' | 'clue';
  text: string;
}

export interface EvidenceDefinition {
  id: string;
  title: string;
  summary: string;
  category: 'Network' | 'DNS' | 'Permissions' | 'Service' | 'Forensics' | 'Account';
  points: number;
}

export interface HypothesisOption {
  id: string;
  title: string;
  explanation: string;
  isCorrect: boolean;
  feedback: string;
}

export interface RepairAction {
  id: string;
  stageId?: string; // Used for multi-stage Case 6
  stageLabel?: string;
  title: string;
  description: string;
  commandEquivalent: string;
  isCorrect: boolean;
  feedback: string;
  applyKey: string;
}

export interface VerificationRequirement {
  id: string;
  label: string;
  description: string;
}

export interface HintTier {
  level: 1 | 2 | 3;
  title: string;
  cost: number;
  text: string;
}

export interface DebriefReport {
  fault: string;
  symptoms: string;
  evidence: string[];
  diagnosis: string;
  resolution: string;
  realWorldLesson: string;
  simulationNote?: string;
}

export interface CaseFileClue {
  id: string;
  caseNumber: number;
  caseCode: string;
  eventTime: string;
  title: string;
  summary: string;
  hostInvolved: string;
  indicators: string[];
}

export interface HelpdeskTicket {
  id: string;
  reportedAt: string;
  reporterName: string;
  reporterRole: string;
  reporterAccount: string;
  workstation: string;
  priority: 'Standard' | 'High' | 'Critical';
  subject: string;
  description: string;
  observedSymptoms: string[];
}

export interface ScenarioConfig {
  id: string;
  number: number;
  code: string;
  title: string;
  difficulty: string;
  focusArea: string;
  ticket: HelpdeskTicket;
  initialMachine: MachineState;
  evidence: EvidenceDefinition[];
  hypotheses: HypothesisOption[];
  repairs: RepairAction[];
  requiredRepairIds: string[]; // Single ID for Cases 1-5, three IDs for Case 6
  verifications: VerificationRequirement[];
  hints: HintTier[];
  debrief: DebriefReport;
  caseFileClue: CaseFileClue;
}

export interface ScoreBreakdown {
  evidencePoints: number;
  maxEvidencePoints: number;
  commandChoicePoints: number;
  maxCommandChoicePoints: number;
  diagnosisPoints: number;
  maxDiagnosisPoints: number;
  repairPoints: number;
  maxRepairPoints: number;
  verificationBonus: number;
  maxVerificationBonus: number;
  hintPenalty: number;
  totalScore: number;
  maxPossibleScore: number;
  grade: 'Distinction' | 'Merit' | 'Pass' | 'Needs Review';
}

export interface ScenarioProgress {
  scenarioId: string;
  status: ScenarioStatus;
  machine: MachineState;
  terminalLines: TerminalLine[];
  commandHistory: string[];
  validDiagnosticCommands: string[];
  invalidCommandCount: number;
  discoveredEvidenceIds: string[];
  revealedHintLevels: number[];
  hypothesisSolved: boolean;
  wrongHypothesisIds: string[];
  completedRepairIds: string[];
  wrongRepairIds: string[];
  verifiedCheckIds: string[];
  notes: string;
  score: ScoreBreakdown | null;
}

export type ActiveView = 'briefing' | 'workspace' | 'casefile' | 'scenarios' | 'results';
export type DeckTab = 'ticket' | 'evidence' | 'diagnose' | 'hints';
