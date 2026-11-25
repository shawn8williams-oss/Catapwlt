import { MachineState, ScenarioConfig, TerminalLine } from '../types/game';

export interface CommandExecutionResult {
  outputLines: TerminalLine[];
  nextMachine: MachineState;
  newEvidenceIds: string[];
  newVerificationIds: string[];
  newCompletedRepairIds: string[];
  commandCategory: 'diagnostic' | 'repair' | 'navigation' | 'clear' | 'invalid';
  normalizedCommand: string;
}

let lineSeq = 0;
export function makeLine(type: TerminalLine['type'], text: string): TerminalLine {
  lineSeq += 1;
  return { id: `ln-${Date.now()}-${lineSeq}`, type, text };
}

// ---------- IPv4 Bitwise Helpers ----------

function isValidIpv4(ip: string): boolean {
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return false;
  return parts.every((p) => /^\d+$/.test(p) && Number(p) >= 0 && Number(p) <= 255);
}

function ipToInt(ip: string): number {
  const parts = ip.split('.').map(Number);
  return (((parts[0] << 24) >>> 0) + ((parts[1] << 16) >>> 0) + ((parts[2] << 8) >>> 0) + parts[3]) >>> 0;
}

function intToIp(num: number): string {
  return [(num >>> 24) & 255, (num >>> 16) & 255, (num >>> 8) & 255, num & 255].join('.');
}

export function isSameSubnet(ipA: string, ipB: string, mask: string): boolean {
  if (!isValidIpv4(ipA) || !isValidIpv4(ipB) || !isValidIpv4(mask)) return false;
  const m = ipToInt(mask);
  return (ipToInt(ipA) & m) === (ipToInt(ipB) & m);
}

function getNetworkAddress(ip: string, mask: string): string {
  return intToIp((ipToInt(ip) & ipToInt(mask)) >>> 0);
}

function getBroadcastAddress(ip: string, mask: string): string {
  const net = (ipToInt(ip) & ipToInt(mask)) >>> 0;
  const hostBits = (~ipToInt(mask)) >>> 0;
  return intToIp((net | hostBits) >>> 0);
}

function canReachIp(machine: MachineState, targetIp: string): { reachable: boolean; reason: string; latencyMs: number } {
  if (targetIp === '127.0.0.1' || targetIp === machine.ipAddress) {
    return { reachable: true, reason: 'local', latencyMs: 1 };
  }
  if (machine.firewallBlockedIps.includes(targetIp)) {
    return { reachable: false, reason: 'General failure.', latencyMs: 0 };
  }

  // Check if target is on-link according to this machine's configured subnet mask
  const targetOnConfiguredSubnet = isSameSubnet(machine.ipAddress, targetIp, machine.subnetMask);

  if (targetOnConfiguredSubnet) {
    // Must actually exist on the physical 192.168.10.0/24 LAN
    const host = machine.lanHosts.find((h) => h.ip === targetIp && h.respondsToPing);
    if (host) {
      return { reachable: true, reason: 'on-link', latencyMs: 1 };
    }
    return { reachable: false, reason: 'Request timed out.', latencyMs: 0 };
  }

  // Off-subnet target: requires Default Gateway to be:
  // 1) Configured
  // 2) On-link according to this machine's subnet mask!
  // 3) Actually the real router IP (192.168.10.1)
  if (!machine.defaultGateway || !isValidIpv4(machine.defaultGateway)) {
    return { reachable: false, reason: 'PING: transmit failed. General failure.', latencyMs: 0 };
  }

  const gwOnConfiguredSubnet = isSameSubnet(machine.ipAddress, machine.defaultGateway, machine.subnetMask);
  if (!gwOnConfiguredSubnet) {
    // Classic subnet mask isolation (Case 2)
    return { reachable: false, reason: 'PING: transmit failed. General failure.', latencyMs: 0 };
  }

  if (machine.defaultGateway !== machine.realGatewayIp) {
    // Non-existent gateway (Case 1: 192.168.10.254)
    return { reachable: false, reason: 'Request timed out.', latencyMs: 0 };
  }

  // Gateway is valid and reachable!
  // Check if target is another LAN host outside a narrow mask (actually wouldn't route back properly unless /24,
  // but if gateway is reachable, gateway is on-link so machine is on .0/24 or .0/26 containing .1)
  if (targetIp.startsWith('192.168.10.')) {
    const host = machine.lanHosts.find((h) => h.ip === targetIp && h.respondsToPing);
    if (host) {
      return { reachable: true, reason: 'lan-routed', latencyMs: 1 };
    }
    return { reachable: false, reason: 'Request timed out.', latencyMs: 0 };
  }

  // External internet IP (e.g. 8.8.8.8, 1.1.1.1, 198.51.100.24, 203.0.113.47)
  if (
    targetIp === '8.8.8.8' ||
    targetIp === '1.1.1.1' ||
    targetIp.startsWith('198.51.100.') ||
    targetIp === '203.0.113.47'
  ) {
    return { reachable: true, reason: 'external', latencyMs: 14 };
  }

  return { reachable: false, reason: 'Request timed out.', latencyMs: 0 };
}

function resolveHostname(
  machine: MachineState,
  rawHost: string,
  explicitDnsServer?: string
): { ip: string | null; serverUsed: string; source: 'hosts' | 'dns' | 'timeout' | 'nxdomain' } {
  const host = rawHost.toLowerCase().trim();
  if (host === 'localhost') {
    return { ip: '127.0.0.1', serverUsed: 'hosts', source: 'hosts' };
  }

  // Normal Windows resolution (ping/tracert) checks hosts file first unless explicit DNS server is passed (nslookup)
  if (!explicitDnsServer && machine.hostsFile[host]) {
    return { ip: machine.hostsFile[host], serverUsed: 'hosts', source: 'hosts' };
  }

  const dnsIp = explicitDnsServer || machine.dnsServers[0] || '';
  if (!dnsIp) {
    return { ip: null, serverUsed: 'None', source: 'timeout' };
  }

  // Verify DNS server itself is reachable
  const dnsReach = canReachIp(machine, dnsIp);
  if (!dnsReach.reachable) {
    return { ip: null, serverUsed: dnsIp, source: 'timeout' };
  }

  // Is it the authoritative internal DNS server (192.168.10.5 or 127.0.0.1 on DC-CORE-01)?
  if (dnsIp === machine.realDnsIp || (dnsIp === '127.0.0.1' && machine.hostname === 'DC-CORE-01')) {
    const internal = machine.internalDnsRecords.find((r) => r.hostname.toLowerCase() === host);
    if (internal) return { ip: internal.ip, serverUsed: dnsIp, source: 'dns' };

    const shortMatch = machine.internalDnsRecords.find(
      (r) => r.hostname.toLowerCase() === `${host}.meridian.local`
    );
    if (shortMatch) return { ip: shortMatch.ip, serverUsed: dnsIp, source: 'dns' };

    // Forward external queries via gateway if gateway works
    const ext = machine.externalDnsRecords.find((r) => r.hostname.toLowerCase() === host);
    if (ext) {
      // DC forwards external queries through gateway
      const gwOk = machine.hostname === 'DC-CORE-01' || true;
      if (gwOk) return { ip: ext.ip, serverUsed: dnsIp, source: 'dns' };
    }
    return { ip: null, serverUsed: dnsIp, source: 'nxdomain' };
  }

  // Public DNS (8.8.8.8 / 1.1.1.1) knows external domains only, NOT meridian.local
  if (dnsIp === '8.8.8.8' || dnsIp === '1.1.1.1') {
    const ext = machine.externalDnsRecords.find((r) => r.hostname.toLowerCase() === host);
    if (ext) return { ip: ext.ip, serverUsed: dnsIp, source: 'dns' };
    return { ip: null, serverUsed: dnsIp, source: 'nxdomain' };
  }

  // Rogue DNS server (192.168.10.214)
  if (dnsIp === '192.168.10.214') {
    if (machine.rogueDnsActive) {
      const rogue = machine.rogueDnsRecords.find((r) => r.hostname.toLowerCase() === host);
      if (rogue) return { ip: rogue.ip, serverUsed: dnsIp, source: 'dns' };
    }
    return { ip: null, serverUsed: dnsIp, source: 'timeout' };
  }

  return { ip: null, serverUsed: dnsIp, source: 'timeout' };
}

// ---------- Filesystem Helpers ----------

function normalizeWinPath(currentDir: string, inputPath: string): string {
  const cleaned = inputPath.trim().replace(/^"(.*)"$/, '$1').replace(/\//g, '\\');
  if (!cleaned || cleaned === '.') return currentDir.toUpperCase();

  let full: string;
  if (/^[a-zA-Z]:/.test(cleaned)) {
    full = cleaned;
  } else if (cleaned.startsWith('\\')) {
    full = `C:${cleaned}`;
  } else {
    full = `${currentDir.replace(/\\$/, '')}\\${cleaned}`;
  }

  const parts = full.split('\\').filter(Boolean);
  const stack: string[] = [];
  for (const part of parts) {
    if (part === '.') continue;
    if (part === '..') {
      if (stack.length > 1) stack.pop();
    } else {
      stack.push(part);
    }
  }
  const joined = stack.join('\\');
  return (stack.length === 1 ? `${joined}\\` : joined).toUpperCase();
}

function getAllDirectories(files: Record<string, string>): Set<string> {
  const dirs = new Set<string>(['C:\\', 'C:\\USERS', 'C:\\WINDOWS', 'C:\\WINDOWS\\SYSTEM32', 'C:\\WINDOWS\\SYSTEM32\\DRIVERS', 'C:\\WINDOWS\\SYSTEM32\\DRIVERS\\ETC']);
  for (const filePath of Object.keys(files)) {
    const parts = filePath.toUpperCase().split('\\');
    let acc = parts[0] + '\\';
    dirs.add(acc);
    for (let i = 1; i < parts.length - 1; i++) {
      acc = i === 1 ? `${parts[0]}\\${parts[1]}` : `${acc}\\${parts[i]}`;
      dirs.add(acc);
    }
  }
  return dirs;
}

function cloneMachine(m: MachineState): MachineState {
  return JSON.parse(JSON.stringify(m));
}

// ---------- Repair State Mutator (shared by CLI & Workbench) ----------

export function applyMachineRepair(machine: MachineState, applyKey: string): MachineState {
  const next = cloneMachine(machine);

  switch (applyKey) {
    case 'demo_start_spooler': {
      const spool = next.services.find((s) => s.name === 'Spooler');
      if (spool) {
        spool.state = 'RUNNING';
        spool.exitCode = 0;
        spool.exitReason = undefined;
        spool.pid = 2404;
      }
      if (!next.processes.some((p) => p.name === 'spoolsv.exe')) {
        next.processes.push({
          name: 'spoolsv.exe',
          pid: 2404,
          sessionName: 'Services',
          memUsageKb: 21480,
          services: ['Spooler'],
        });
      }
      break;
    }

    case 'c1_fix_gateway':
      next.dhcpEnabled = true;
      next.ipAddress = next.dhcpAssignedIp;
      next.subnetMask = '255.255.255.0';
      next.defaultGateway = '192.168.10.1';
      next.dnsServers = ['192.168.10.5'];
      break;

    case 'c2_fix_subnet':
      next.dhcpEnabled = true;
      next.ipAddress = next.dhcpAssignedIp;
      next.subnetMask = '255.255.255.0';
      next.defaultGateway = '192.168.10.1';
      next.dnsServers = ['192.168.10.5'];
      if (!next.arpCache.some((a) => a.ip === '192.168.10.1')) {
        next.arpCache.unshift(
          { ip: '192.168.10.1', mac: '00-1a-2b-3c-4d-01', type: 'dynamic' },
          { ip: '192.168.10.5', mac: '00-1a-2b-3c-4d-05', type: 'dynamic' },
          { ip: '192.168.10.10', mac: '00-1a-2b-3c-4d-10', type: 'dynamic' }
        );
      }
      break;

    case 'c3_fix_dns_and_hosts':
      next.dnsServers = ['192.168.10.5'];
      delete next.hostsFile['files.meridian.local'];
      next.files['C:\\WINDOWS\\SYSTEM32\\DRIVERS\\ETC\\HOSTS'] =
        '# Copyright (c) 1993-2009 Microsoft Corp.\r\n# Local name resolution overrides\r\n127.0.0.1       localhost';
      next.dnsCache = [
        { hostname: 'erp.meridian.local', ip: '192.168.10.10', ttl: 1800 },
        { hostname: 'files.meridian.local', ip: '192.168.10.10', ttl: 1800 },
      ];
      break;

    case 'c4_fix_acl_and_svc': {
      if (next.acls['C:\\PAYROLL_EXPORTS']) {
        next.acls['C:\\PAYROLL_EXPORTS'] = next.acls['C:\\PAYROLL_EXPORTS'].filter(
          (entry) =>
            !(entry.principal.toLowerCase() === 'meridian\\p.nair' && entry.type === 'DENY') &&
            entry.principal.toLowerCase() !== 'meridian\\m.halvorsen'
        );
      }
      const auditSvc = next.services.find((s) => s.name === 'MeridianAuditSvc');
      if (auditSvc) {
        auditSvc.account = 'MERIDIAN\\svc_audit';
        auditSvc.state = 'RUNNING';
        auditSvc.exitCode = 0;
        auditSvc.exitReason = undefined;
        auditSvc.pid = 3810;
      }
      if (!next.processes.some((p) => p.name === 'auditsvc.exe')) {
        next.processes.push({
          name: 'auditsvc.exe',
          pid: 3810,
          sessionName: 'Services',
          memUsageKb: 18940,
          services: ['MeridianAuditSvc'],
        });
      }
      break;
    }

    case 'c5_stop_exfil': {
      const syncSvc = next.services.find((s) => s.name === 'MeridianSyncHelper');
      if (syncSvc) {
        syncSvc.state = 'STOPPED';
        syncSvc.startType = 'DISABLED';
        syncSvc.pid = undefined;
      }
      next.processes = next.processes.filter((p) => p.pid !== 4812 && p.name !== 'winupd_sync.exe');
      next.netConnections = next.netConnections.filter(
        (c) => c.pid !== 4812 && !c.foreignAddress.startsWith('192.168.10.214')
      );
      if (!next.firewallBlockedIps.includes('192.168.10.214')) {
        next.firewallBlockedIps.push('192.168.10.214');
      }
      break;
    }

    case 'c6_disable_account': {
      const mh = next.users.find((u) => u.username.toLowerCase() === 'm.halvorsen');
      if (mh) {
        mh.active = false;
        mh.groups = mh.groups.filter((g) => g !== 'Administrators');
      }
      next.localAdmins = next.localAdmins.filter((a) => !a.toLowerCase().includes('m.halvorsen'));
      break;
    }

    case 'c6_remove_persistence': {
      const relaySvc = next.services.find((s) => s.name === 'MaintRelaySvc');
      if (relaySvc) {
        relaySvc.state = 'STOPPED';
        relaySvc.startType = 'DISABLED';
        relaySvc.pid = undefined;
      }
      next.processes = next.processes.filter((p) => p.pid !== 6104 && p.name !== 'relay_agent.exe');
      next.netConnections = next.netConnections.filter((c) => c.pid !== 6104);
      next.scheduledTasks = next.scheduledTasks.filter((t) => t.name !== 'MeridianNightlyPush');
      break;
    }

    case 'c6_block_network': {
      if (!next.firewallBlockedIps.includes('192.168.10.214')) {
        next.firewallBlockedIps.push('192.168.10.214');
      }
      if (!next.firewallBlockedIps.includes('203.0.113.47')) {
        next.firewallBlockedIps.push('203.0.113.47');
      }
      next.internalDnsRecords = next.internalDnsRecords.filter(
        (r) => r.hostname.toLowerCase() !== 'relay.meridian.local'
      );
      delete next.hostsFile['relay.meridian-update.test'];
      next.files['C:\\WINDOWS\\SYSTEM32\\DRIVERS\\ETC\\HOSTS'] =
        '# Standard Windows hosts file\r\n127.0.0.1       localhost';
      next.dnsCache = [];
      next.netConnections = next.netConnections.filter(
        (c) => !c.foreignAddress.startsWith('203.0.113.47') && !c.foreignAddress.startsWith('192.168.10.214')
      );
      break;
    }

    default:
      break;
  }

  return next;
}

// ---------- Main Command Evaluator ----------

export function executeTerminalCommand(
  rawInput: string,
  machine: MachineState,
  scenario: ScenarioConfig,
  alreadyRepairedIds: string[]
): CommandExecutionResult {
  const trimmed = rawInput.trim();
  const nextMachine = cloneMachine(machine);
  const outputLines: TerminalLine[] = [];
  const newEvidenceIds: string[] = [];
  const newVerificationIds: string[] = [];
  const newCompletedRepairIds: string[] = [];

  if (!trimmed) {
    return {
      outputLines: [],
      nextMachine,
      newEvidenceIds,
      newVerificationIds,
      newCompletedRepairIds,
      commandCategory: 'navigation',
      normalizedCommand: '',
    };
  }

  const tokens = trimmed.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  const cmd = (tokens[0] || '').toLowerCase();
  const args = tokens.slice(1);
  const argsLower = args.map((a) => a.toLowerCase());
  const fullLower = trimmed.toLowerCase();

  let commandCategory: CommandExecutionResult['commandCategory'] = 'diagnostic';

  const isAllRequiredRepairsDone = (extraIds: string[] = []) => {
    const combined = new Set([...alreadyRepairedIds, ...extraIds]);
    return scenario.requiredRepairIds.every((id) => combined.has(id));
  };

  // Helper to push text block cleanly
  const pushLines = (lines: string[], type: TerminalLine['type'] = 'output') => {
    for (const l of lines) {
      outputLines.push(makeLine(type, l));
    }
  };

  // ==================== COMMAND SWITCH ====================

  if (cmd === 'cls' || cmd === 'clear') {
    return {
      outputLines: [],
      nextMachine,
      newEvidenceIds,
      newVerificationIds,
      newCompletedRepairIds,
      commandCategory: 'clear',
      normalizedCommand: 'cls',
    };
  }

  if (cmd === 'help' || cmd === '?') {
    commandCategory = 'navigation';
    pushLines([
      'Available Windows Diagnostic & Administrative Commands:',
      '  IPCONFIG [/all | /displaydns | /flushdns | /release | /renew]',
      '  PING <ip or hostname> [-n count]    TRACERT <ip or hostname>',
      '  NSLOOKUP <host> [dns-server]        ARP -a',
      '  ROUTE PRINT                         NETSTAT [-a | -an | -ano]',
      '  TASKLIST [/svc]                     TASKKILL /PID <id> /F',
      '  SC [query | qc | start | stop | config] [service]',
      '  SCHTASKS [/query | /delete /tn <name>]',
      '  WHOAMI [/groups | /all]             SYSTEMINFO',
      '  NET [user [name] [/active:no] | localgroup [Administrators] | start]',
      '  ICACLS <path> [/remove:d <user>]    NETSH interface ip [show config | set ...]',
      '  DIR [path] | CD <path> | TYPE <file> | FINDSTR <text> <file> | HOSTNAME | CLS',
      '',
      'Tip: Open "Command Reference" in the top bar for syntax notes.',
    ]);
  } else if (cmd === 'hostname') {
    pushLines([nextMachine.hostname]);
  } else if (cmd === 'ver') {
    pushLines([`${nextMachine.osName} [Version ${nextMachine.osVersion}]`]);
  } else if (cmd === 'echo') {
    commandCategory = 'navigation';
    pushLines([args.join(' ')]);
  } else if (cmd === 'ipconfig') {
    const flag = argsLower[0] || '';
    if (!flag) {
      pushLines([
        '',
        'Windows IP Configuration',
        '',
        `Ethernet adapter ${nextMachine.adapterName}:`,
        '',
        `   Connection-specific DNS Suffix  . : ${nextMachine.domain}`,
        `   IPv4 Address. . . . . . . . . . . : ${nextMachine.ipAddress}`,
        `   Subnet Mask . . . . . . . . . . . : ${nextMachine.subnetMask}`,
        `   Default Gateway . . . . . . . . . : ${nextMachine.defaultGateway}`,
        '',
      ]);
      if (scenario.id === 'case-1' && nextMachine.defaultGateway === '192.168.10.254') {
        newEvidenceIds.push('c1-ev-gw');
      }
      if (scenario.id === 'case-2' && nextMachine.subnetMask === '255.255.255.192') {
        newEvidenceIds.push('c2-ev-mask');
      }
      if (scenario.id === 'case-1' && isAllRequiredRepairsDone() && nextMachine.defaultGateway === '192.168.10.1') {
        newVerificationIds.push('c1-ver-cfg');
      }
      if (scenario.id === 'case-2' && isAllRequiredRepairsDone() && nextMachine.subnetMask === '255.255.255.0') {
        newVerificationIds.push('c2-ver-cfg');
      }
    } else if (flag === '/all') {
      pushLines([
        '',
        'Windows IP Configuration',
        '',
        `   Host Name . . . . . . . . . . . . : ${nextMachine.hostname}`,
        `   Primary Dns Suffix  . . . . . . . : ${nextMachine.domain}`,
        `   Node Type . . . . . . . . . . . . : Hybrid`,
        `   IP Routing Enabled. . . . . . . . : No`,
        `   WINS Proxy Enabled. . . . . . . . : No`,
        '',
        `Ethernet adapter ${nextMachine.adapterName}:`,
        '',
        `   Connection-specific DNS Suffix  . : ${nextMachine.domain}`,
        `   Description . . . . . . . . . . . : ${nextMachine.adapterDescription}`,
        `   Physical Address. . . . . . . . . : ${nextMachine.macAddress}`,
        `   DHCP Enabled. . . . . . . . . . . : ${nextMachine.dhcpEnabled ? 'Yes' : 'No'}`,
        `   Autoconfiguration Enabled . . . . : Yes`,
        `   IPv4 Address. . . . . . . . . . . : ${nextMachine.ipAddress}(Preferred)`,
        `   Subnet Mask . . . . . . . . . . . : ${nextMachine.subnetMask}`,
        `   Default Gateway . . . . . . . . . : ${nextMachine.defaultGateway}`,
        ...(nextMachine.dhcpEnabled
          ? [`   DHCP Server . . . . . . . . . . . : ${nextMachine.dhcpServer}`]
          : []),
        `   DNS Servers . . . . . . . . . . . : ${nextMachine.dnsServers[0] || 'None'}`,
        ...nextMachine.dnsServers.slice(1).map((d) => `                                       ${d}`),
        '',
      ]);
      if (scenario.id === 'case-1' && nextMachine.defaultGateway === '192.168.10.254') {
        newEvidenceIds.push('c1-ev-gw');
      }
      if (scenario.id === 'case-2' && nextMachine.subnetMask === '255.255.255.192') {
        newEvidenceIds.push('c2-ev-mask');
      }
      if (scenario.id === 'case-3' && nextMachine.dnsServers.includes('192.168.10.214')) {
        newEvidenceIds.push('c3-ev-dns');
      }
      if (scenario.id === 'case-1' && isAllRequiredRepairsDone() && nextMachine.defaultGateway === '192.168.10.1') {
        newVerificationIds.push('c1-ver-cfg');
      }
      if (scenario.id === 'case-2' && isAllRequiredRepairsDone() && nextMachine.subnetMask === '255.255.255.0') {
        newVerificationIds.push('c2-ver-cfg');
      }
    } else if (flag === '/displaydns') {
      pushLines(['', 'Windows IP Configuration', '']);
      const combinedEntries: { hostname: string; ip: string; ttl: number }[] = [
        ...Object.entries(nextMachine.hostsFile).map(([h, ip]) => ({ hostname: h, ip, ttl: 86400 })),
        ...nextMachine.dnsCache,
      ];
      const seen = new Set<string>();
      const unique = combinedEntries.filter((e) => {
        const k = `${e.hostname}-${e.ip}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      if (unique.length === 0) {
        pushLines(['   Could not display the DNS Resolver Cache (cache is empty).']);
      } else {
        for (const entry of unique) {
          pushLines([
            `    ${entry.hostname}`,
            '    ----------------------------------------',
            `    Record Name . . . . . : ${entry.hostname}`,
            '    Record Type . . . . . : 1',
            `    Time To Live  . . . . : ${entry.ttl}`,
            '    Data Length . . . . . : 4',
            '    Section . . . . . . . : Answer',
            `    A (Host) Record . . . : ${entry.ip}`,
            '',
          ]);
        }
      }
      if (scenario.id === 'case-3' && nextMachine.hostsFile['files.meridian.local']) {
        newEvidenceIds.push('c3-ev-hosts');
      }
      if (scenario.id === 'case-3' && isAllRequiredRepairsDone() && !nextMachine.hostsFile['files.meridian.local']) {
        newVerificationIds.push('c3-ver-files');
      }
    } else if (flag === '/flushdns') {
      commandCategory = 'repair';
      nextMachine.dnsCache = [];
      pushLines([
        '',
        'Windows IP Configuration',
        '',
        'Successfully flushed the DNS Resolver Cache.',
        ...(Object.keys(nextMachine.hostsFile).length > 0
          ? ['Note: Static entries inside C:\\Windows\\System32\\drivers\\etc\\hosts remain active until edited.']
          : []),
      ]);
    } else if (flag === '/release' || flag === '/renew') {
      commandCategory = 'repair';
      if (!nextMachine.dhcpEnabled) {
        pushLines(
          [
            '',
            'Windows IP Configuration',
            '',
            `The operation failed as no adapter is in the state permissible for this operation.`,
            `(${nextMachine.adapterName} is currently configured with a static IP, not DHCP. Use netsh to switch to DHCP or update static settings.)`,
          ],
          'error'
        );
      } else {
        nextMachine.ipAddress = nextMachine.dhcpAssignedIp;
        nextMachine.subnetMask = '255.255.255.0';
        nextMachine.defaultGateway = nextMachine.realGatewayIp;
        pushLines([
          '',
          'Windows IP Configuration',
          '',
          `Ethernet adapter ${nextMachine.adapterName}:`,
          `   IPv4 Address. . . . . . . . . . . : ${nextMachine.ipAddress}`,
          `   Subnet Mask . . . . . . . . . . . : ${nextMachine.subnetMask}`,
          `   Default Gateway . . . . . . . . . : ${nextMachine.defaultGateway}`,
        ]);
      }
    } else {
      commandCategory = 'invalid';
      pushLines([`Error: unrecognized or incomplete command line "${trimmed}". Try: ipconfig /all`], 'error');
    }
  } else if (cmd === 'ping') {
    // Extract target (skipping -n <num> flags)
    let target = '';
    let count = 4;
    for (let i = 0; i < args.length; i++) {
      if (argsLower[i] === '-n' && args[i + 1]) {
        count = Math.max(1, Math.min(4, Number(args[i + 1]) || 4));
        i++;
      } else if (!args[i].startsWith('-')) {
        target = args[i];
      }
    }
    if (!target) {
      commandCategory = 'invalid';
      pushLines(['Usage: ping <target_ip_or_hostname> [-n count]'], 'error');
    } else {
      let resolvedIp = target;
      let label = target;
      if (!isValidIpv4(target)) {
        const res = resolveHostname(nextMachine, target);
        if (!res.ip) {
          pushLines([`Ping request could not find host ${target}. Please check the name and try again.`], 'error');
          if (scenario.id === 'case-3' && target.toLowerCase().includes('meridian.local')) {
            newEvidenceIds.push('c3-ev-dns');
          }
          return {
            outputLines,
            nextMachine,
            newEvidenceIds,
            newVerificationIds,
            newCompletedRepairIds,
            commandCategory,
            normalizedCommand: `ping ${target.toLowerCase()}`,
          };
        }
        resolvedIp = res.ip;
        label = `${target} [${resolvedIp}]`;
      }

      const reach = canReachIp(nextMachine, resolvedIp);
      pushLines(['', `Pinging ${label} with 32 bytes of data:`]);
      for (let i = 0; i < count; i++) {
        if (reach.reachable) {
          const ttl = reach.reason === 'external' ? 117 : 128;
          const timeStr = reach.latencyMs <= 1 ? 'time<1ms' : `time=${reach.latencyMs + (i % 2)}ms`;
          pushLines([`Reply from ${resolvedIp}: bytes=32 ${timeStr} TTL=${ttl}`]);
        } else {
          pushLines([reach.reason], 'error');
        }
      }
      pushLines([
        '',
        `Ping statistics for ${resolvedIp}:`,
        `    Packets: Sent = ${count}, Received = ${reach.reachable ? count : 0}, Lost = ${reach.reachable ? 0 : count} (${reach.reachable ? '0%' : '100%'} loss),`,
      ]);
      if (reach.reachable) {
        pushLines([
          'Approximate round trip times in milli-seconds:',
          `    Minimum = ${reach.latencyMs}ms, Maximum = ${reach.latencyMs + 1}ms, Average = ${reach.latencyMs}ms`,
        ]);
      }

      if (scenario.id === 'demo-sandbox' && resolvedIp === '192.168.10.80' && reach.reachable) {
        newEvidenceIds.push('demo-ev-net');
      }

      // Evidence & Verification hooks for ping
      if (scenario.id === 'case-1') {
        if (!reach.reachable && (resolvedIp === '8.8.8.8' || resolvedIp === '1.1.1.1' || resolvedIp === '192.168.10.254' || resolvedIp === '198.51.100.24')) {
          newEvidenceIds.push('c1-ev-scope');
        }
        if (reach.reachable && (resolvedIp === '192.168.10.1' || resolvedIp === '192.168.10.5' || resolvedIp === '192.168.10.10')) {
          newEvidenceIds.push('c1-ev-scope');
        }
        if (isAllRequiredRepairsDone() && reach.reachable && (resolvedIp === '8.8.8.8' || resolvedIp === '1.1.1.1' || resolvedIp === '198.51.100.24')) {
          newVerificationIds.push('c1-ver-ext');
        }
      }

      if (scenario.id === 'case-2') {
        if (resolvedIp === '192.168.10.80' && reach.reachable) {
          newEvidenceIds.push('c2-ev-reach');
        }
        if (!reach.reachable && (resolvedIp === '192.168.10.1' || resolvedIp === '192.168.10.10' || resolvedIp === '192.168.10.5')) {
          newEvidenceIds.push('c2-ev-reach');
        }
        if (isAllRequiredRepairsDone() && reach.reachable && (resolvedIp === '192.168.10.1' || resolvedIp === '192.168.10.10' || resolvedIp === '192.168.10.5')) {
          newVerificationIds.push('c2-ver-srv');
        }
      }

      if (scenario.id === 'case-3') {
        if (reach.reachable && (resolvedIp === '192.168.10.10' || resolvedIp === '8.8.8.8' || resolvedIp === '192.168.10.5') && isValidIpv4(target)) {
          newEvidenceIds.push('c3-ev-ip-ok');
        }
        if (target.toLowerCase() === 'files.meridian.local' && resolvedIp === '192.168.10.214') {
          newEvidenceIds.push('c3-ev-hosts');
        }
        if (isAllRequiredRepairsDone() && target.toLowerCase() === 'erp.meridian.local' && resolvedIp === '192.168.10.10' && reach.reachable) {
          newVerificationIds.push('c3-ver-erp');
        }
        if (isAllRequiredRepairsDone() && target.toLowerCase() === 'files.meridian.local' && resolvedIp === '192.168.10.10' && reach.reachable) {
          newVerificationIds.push('c3-ver-files');
        }
      }
    }
  } else if (cmd === 'tracert') {
    const target = args[0];
    if (!target) {
      commandCategory = 'invalid';
      pushLines(['Usage: tracert <target_ip_or_hostname>'], 'error');
    } else {
      let resolvedIp = target;
      if (!isValidIpv4(target)) {
        const res = resolveHostname(nextMachine, target);
        if (!res.ip) {
          pushLines([`Unable to resolve target system name ${target}.`], 'error');
          return {
            outputLines,
            nextMachine,
            newEvidenceIds,
            newVerificationIds,
            newCompletedRepairIds,
            commandCategory,
            normalizedCommand: `tracert ${target.toLowerCase()}`,
          };
        }
        resolvedIp = res.ip;
      }

      pushLines(['', `Tracing route to ${target} [${resolvedIp}]`, 'over a maximum of 30 hops:', '']);
      const reach = canReachIp(nextMachine, resolvedIp);
      if (reach.reachable && reach.reason === 'on-link') {
        pushLines([`  1    <1 ms    <1 ms    <1 ms  ${resolvedIp}`, '', 'Trace complete.']);
      } else if (reach.reachable && reach.reason === 'external') {
        pushLines([
          `  1    <1 ms    <1 ms    <1 ms  gw-core-01.meridian.local [192.168.10.1]`,
          `  2     6 ms     7 ms     6 ms  100.64.0.1`,
          `  3    11 ms    12 ms    11 ms  core-lon-02.isp.net [198.51.100.1]`,
          `  4    14 ms    14 ms    15 ms  ${resolvedIp}`,
          '',
          'Trace complete.',
        ]);
        if (scenario.id === 'case-1' && isAllRequiredRepairsDone()) {
          newVerificationIds.push('c1-ver-ext');
        }
      } else {
        pushLines([
          `  1     *        *        *     Request timed out. (Configured gateway: ${nextMachine.defaultGateway})`,
          '  2     *        *        *     Request timed out.',
          '  3     *        *        *     Request timed out.',
          '',
          'Trace failed — gateway unreachable.',
        ], 'error');
        if (scenario.id === 'case-1') {
          newEvidenceIds.push('c1-ev-scope', 'c1-ev-gw');
        }
        if (scenario.id === 'case-2') {
          newEvidenceIds.push('c2-ev-reach');
        }
      }
    }
  } else if (cmd === 'nslookup') {
    const queryHost = args[0];
    const explicitServer = args[1];
    if (!queryHost) {
      commandCategory = 'invalid';
      pushLines(['Usage: nslookup <hostname> [dns_server_ip]'], 'error');
    } else {
      const serverToQuery = explicitServer || nextMachine.dnsServers[0] || 'None';
      const serverName =
        serverToQuery === '192.168.10.5' || serverToQuery === '127.0.0.1'
          ? 'dc-core-01.meridian.local'
          : serverToQuery === '8.8.8.8'
          ? 'dns.google'
          : 'UnKnown';
      const res = resolveHostname(nextMachine, queryHost, serverToQuery);
      if (res.source === 'timeout') {
        pushLines(
          [
            `DNS request timed out.`,
            `    timeout was 2 seconds.`,
            `Server:  ${serverName}`,
            `Address:  ${serverToQuery}`,
            '',
            `*** Request to ${serverName} (${serverToQuery}) timed-out`,
          ],
          'error'
        );
        if (scenario.id === 'case-3' && serverToQuery === '192.168.10.214') {
          newEvidenceIds.push('c3-ev-dns');
        }
      } else if (res.source === 'nxdomain' || !res.ip) {
        pushLines(
          [
            `Server:  ${serverName}`,
            `Address:  ${serverToQuery}`,
            '',
            `*** ${serverName} can't find ${queryHost}: Non-existent domain`,
          ],
          'error'
        );
      } else {
        pushLines([
          `Server:  ${serverName}`,
          `Address:  ${serverToQuery}`,
          '',
          `Name:    ${queryHost}`,
          `Address:  ${res.ip}`,
        ]);
        if (scenario.id === 'case-3' && serverToQuery === '192.168.10.5') {
          newEvidenceIds.push('c3-ev-nslookup');
        }
        if (scenario.id === 'case-3' && isAllRequiredRepairsDone() && !explicitServer && res.ip === '192.168.10.10') {
          if (queryHost.toLowerCase().includes('erp.meridian.local')) {
            newVerificationIds.push('c3-ver-erp');
          }
          if (queryHost.toLowerCase().includes('files.meridian.local')) {
            newVerificationIds.push('c3-ver-files');
          }
        }
        if (scenario.id === 'case-6' && queryHost.toLowerCase().includes('relay')) {
          newEvidenceIds.push('c6-ev-relay');
        }
      }
    }
  } else if (cmd === 'arp') {
    if (argsLower[0] !== '-a') {
      commandCategory = 'invalid';
      pushLines(['Usage: arp -a  (Displays current ARP entries)'], 'error');
    } else {
      pushLines([
        '',
        `Interface: ${nextMachine.ipAddress} --- 0x4`,
        '  Internet Address      Physical Address      Type',
        ...nextMachine.arpCache.map(
          (a) => `  ${a.ip.padEnd(22)}${a.mac.padEnd(22)}${a.type}`
        ),
        '',
      ]);
      if (scenario.id === 'case-1') {
        newEvidenceIds.push('c1-ev-arp');
      }
    }
  } else if (cmd === 'route') {
    if (argsLower[0] !== 'print') {
      commandCategory = 'invalid';
      pushLines(['Usage: route print'], 'error');
    } else {
      const netAddr = getNetworkAddress(nextMachine.ipAddress, nextMachine.subnetMask);
      const bcast = getBroadcastAddress(nextMachine.ipAddress, nextMachine.subnetMask);
      pushLines([
        '===========================================================================',
        'IPv4 Route Table',
        '===========================================================================',
        'Active Routes:',
        'Network Destination        Netmask          Gateway       Interface  Metric',
        `          0.0.0.0          0.0.0.0   ${nextMachine.defaultGateway.padEnd(14)} ${nextMachine.ipAddress.padEnd(14)}   25`,
        `        127.0.0.0        255.0.0.0         On-link        127.0.0.1    331`,
        `  ${netAddr.padStart(15)}  ${nextMachine.subnetMask.padStart(15)}         On-link   ${nextMachine.ipAddress.padEnd(14)}  281`,
        `  ${nextMachine.ipAddress.padStart(15)}  255.255.255.255         On-link   ${nextMachine.ipAddress.padEnd(14)}  281`,
        `  ${bcast.padStart(15)}  255.255.255.255         On-link   ${nextMachine.ipAddress.padEnd(14)}  281`,
        '===========================================================================',
      ]);
      if (scenario.id === 'case-1' && nextMachine.defaultGateway === '192.168.10.254') {
        newEvidenceIds.push('c1-ev-gw');
      }
      if (scenario.id === 'case-2' && nextMachine.subnetMask === '255.255.255.192') {
        newEvidenceIds.push('c2-ev-route', 'c2-ev-mask');
      }
      if (scenario.id === 'case-2' && isAllRequiredRepairsDone() && nextMachine.subnetMask === '255.255.255.0') {
        newVerificationIds.push('c2-ver-cfg');
      }
    }
  } else if (cmd === 'netstat') {
    const showPid = argsLower.some((a) => a.includes('o'));
    const header = showPid
      ? '  Proto  Local Address          Foreign Address        State           PID'
      : '  Proto  Local Address          Foreign Address        State';
    pushLines([
      '',
      'Active Connections',
      '',
      header,
      ...nextMachine.netConnections.map((c) => {
        const base = `  ${c.proto.padEnd(7)}${c.localAddress.padEnd(23)}${c.foreignAddress.padEnd(23)}${c.state.padEnd(16)}`;
        return showPid ? `${base}${c.pid}` : base;
      }),
      '',
    ]);

    if (scenario.id === 'case-5') {
      if (nextMachine.netConnections.some((c) => c.foreignAddress.includes('192.168.10.214:8443'))) {
        newEvidenceIds.push('c5-ev-netstat');
      }
      if (isAllRequiredRepairsDone() && !nextMachine.netConnections.some((c) => c.foreignAddress.includes('192.168.10.214'))) {
        newVerificationIds.push('c5-ver-netstat');
      }
    }
    if (scenario.id === 'case-6') {
      if (nextMachine.netConnections.some((c) => c.foreignAddress.includes('203.0.113.47'))) {
        newEvidenceIds.push('c6-ev-relay');
      }
      if (
        isAllRequiredRepairsDone() &&
        !nextMachine.netConnections.some(
          (c) => c.foreignAddress.includes('203.0.113.47') || c.foreignAddress.includes('192.168.10.214')
        )
      ) {
        newVerificationIds.push('c6-ver-net');
      }
    }
  } else if (cmd === 'tasklist') {
    const showSvc = argsLower.includes('/svc');
    if (showSvc) {
      pushLines([
        '',
        'Image Name                     PID Services',
        '========================= ======== ============================================',
        ...nextMachine.processes.map(
          (p) =>
            `${p.name.padEnd(25)} ${String(p.pid).padStart(8)} ${(p.services && p.services.length > 0 ? p.services.join(', ') : 'N/A')}`
        ),
        '',
      ]);
    } else {
      pushLines([
        '',
        'Image Name                     PID Session Name        Mem Usage',
        '========================= ======== ================ ============',
        ...nextMachine.processes.map(
          (p) =>
            `${p.name.padEnd(25)} ${String(p.pid).padStart(8)} ${p.sessionName.padEnd(16)} ${(p.memUsageKb.toLocaleString() + ' K').padStart(12)}`
        ),
        '',
      ]);
    }

    if (scenario.id === 'case-5') {
      if (nextMachine.processes.some((p) => p.pid === 4812)) {
        newEvidenceIds.push('c5-ev-pid');
      }
      if (isAllRequiredRepairsDone() && !nextMachine.processes.some((p) => p.pid === 4812)) {
        newVerificationIds.push('c5-ver-svc');
      }
    }
    if (scenario.id === 'case-6') {
      if (nextMachine.processes.some((p) => p.pid === 6104)) {
        newEvidenceIds.push('c6-ev-persist');
      }
    }
  } else if (cmd === 'taskkill') {
    commandCategory = 'repair';
    const pidIdx = argsLower.indexOf('/pid');
    const imIdx = argsLower.indexOf('/im');
    const targetPid = pidIdx >= 0 ? Number(args[pidIdx + 1]) : null;
    const targetIm = imIdx >= 0 ? (args[imIdx + 1] || '').toLowerCase() : null;

    const proc = nextMachine.processes.find(
      (p) => (targetPid && p.pid === targetPid) || (targetIm && p.name.toLowerCase() === targetIm)
    );
    if (!proc) {
      pushLines(['ERROR: The process specified was not found.'], 'error');
    } else if (!proc.suspicious) {
      pushLines([`ERROR: Termination blocked — "${proc.name}" (PID ${proc.pid}) is a critical Windows or business process.`], 'error');
    } else {
      nextMachine.processes = nextMachine.processes.filter((p) => p.pid !== proc.pid);
      nextMachine.netConnections = nextMachine.netConnections.filter((c) => c.pid !== proc.pid);
      const svc = nextMachine.services.find((s) => s.pid === proc.pid);
      if (svc) {
        svc.state = 'STOPPED';
        svc.pid = undefined;
      }
      pushLines([`SUCCESS: The process "${proc.name}" with PID ${proc.pid} has been terminated.`], 'success');
      if (svc && svc.startType === 'AUTO_START') {
        pushLines([`Warning: Associated service "${svc.name}" still has START_TYPE = AUTO_START. Disable it with "sc config ${svc.name} start= disabled".`]);
      }
    }
  } else if (cmd === 'sc') {
    const sub = argsLower[0] || '';
    const svcName = args[1] || '';

    if (sub === 'query') {
      if (!svcName) {
        pushLines([
          '',
          ...nextMachine.services.flatMap((s) => [
            `SERVICE_NAME: ${s.name}`,
            `DISPLAY_NAME: ${s.displayName}`,
            `        STATE              : ${s.state === 'RUNNING' ? '4  RUNNING' : '1  STOPPED'}`,
            `        WIN32_EXIT_CODE    : ${s.exitCode} ${s.exitReason ? `(${s.exitReason})` : ''}`,
            '',
          ]),
        ]);
      } else {
        const svc = nextMachine.services.find((s) => s.name.toLowerCase() === svcName.toLowerCase());
        if (!svc) {
          pushLines([`[SC] EnumQueryServicesStatus:OpenService FAILED 1060: The specified service does not exist.`], 'error');
        } else {
          pushLines([
            '',
            `SERVICE_NAME: ${svc.name}`,
            `        TYPE               : 10  WIN32_OWN_PROCESS`,
            `        STATE              : ${svc.state === 'RUNNING' ? '4  RUNNING' : '1  STOPPED'}`,
            `        WIN32_EXIT_CODE    : ${svc.exitCode}  (0x${svc.exitCode.toString(16)})${svc.exitReason ? ` - ${svc.exitReason}` : ''}`,
            `        START_TYPE         : ${svc.startType}`,
            '',
          ]);
        }
      }
      // Evidence / Verification checks
      if (scenario.id === 'demo-sandbox') {
        const spool = nextMachine.services.find((s) => s.name === 'Spooler');
        if (spool && spool.state === 'STOPPED') newEvidenceIds.push('demo-ev-svc');
        if (isAllRequiredRepairsDone() && spool && spool.state === 'RUNNING') newVerificationIds.push('demo-ver-svc');
      }
      if (scenario.id === 'case-4') {
        const audit = nextMachine.services.find((s) => s.name === 'MeridianAuditSvc');
        if (audit && audit.state === 'STOPPED') newEvidenceIds.push('c4-ev-svc');
        if (isAllRequiredRepairsDone() && audit && audit.state === 'RUNNING') newVerificationIds.push('c4-ver-svc');
      }
      if (scenario.id === 'case-5') {
        const sync = nextMachine.services.find((s) => s.name === 'MeridianSyncHelper');
        if (sync && sync.state === 'RUNNING') newEvidenceIds.push('c5-ev-svc');
        if (isAllRequiredRepairsDone() && sync && sync.state === 'STOPPED') newVerificationIds.push('c5-ver-svc');
      }
      if (scenario.id === 'case-6') {
        const relay = nextMachine.services.find((s) => s.name === 'MaintRelaySvc');
        if (relay && relay.state === 'RUNNING') newEvidenceIds.push('c6-ev-persist');
        if (isAllRequiredRepairsDone() && relay && relay.state === 'STOPPED') newVerificationIds.push('c6-ver-persist');
      }
    } else if (sub === 'qc') {
      const svc = nextMachine.services.find((s) => s.name.toLowerCase() === svcName.toLowerCase());
      if (!svc) {
        pushLines([`[SC] OpenService FAILED 1060: Specify a valid service name (e.g. "sc query" first).`], 'error');
      } else {
        pushLines([
          `[SC] QueryServiceConfig SUCCESS`,
          '',
          `SERVICE_NAME: ${svc.name}`,
          `        TYPE               : 10  WIN32_OWN_PROCESS`,
          `        START_TYPE         : ${svc.startType}`,
          `        BINARY_PATH_NAME   : ${svc.binaryPath}`,
          `        DISPLAY_NAME       : ${svc.displayName}`,
          `        SERVICE_START_NAME : ${svc.account}`,
          '',
        ]);
        if (scenario.id === 'case-4' && svc.name === 'MeridianAuditSvc') newEvidenceIds.push('c4-ev-svc');
        if (scenario.id === 'case-5' && svc.name === 'MeridianSyncHelper') {
          newEvidenceIds.push('c5-ev-svc');
          if (isAllRequiredRepairsDone() && svc.startType === 'DISABLED') newVerificationIds.push('c5-ver-svc');
        }
        if (scenario.id === 'case-6' && svc.name === 'MaintRelaySvc') newEvidenceIds.push('c6-ev-persist');
      }
    } else if (sub === 'stop') {
      commandCategory = 'repair';
      const svc = nextMachine.services.find((s) => s.name.toLowerCase() === svcName.toLowerCase());
      if (!svc) {
        pushLines(['[SC] OpenService FAILED 1060: The specified service does not exist.'], 'error');
      } else if (!svc.suspicious) {
        pushLines([`[SC] Refused: "${svc.name}" is a legitimate core service required for operations.`], 'error');
      } else {
        svc.state = 'STOPPED';
        if (svc.pid) {
          nextMachine.processes = nextMachine.processes.filter((p) => p.pid !== svc.pid);
          nextMachine.netConnections = nextMachine.netConnections.filter((c) => c.pid !== svc.pid);
          svc.pid = undefined;
        }
        pushLines([`SERVICE_NAME: ${svc.name}`, '        STATE              : 1  STOPPED'], 'success');
      }
    } else if (sub === 'start') {
      commandCategory = 'repair';
      const svc = nextMachine.services.find((s) => s.name.toLowerCase() === svcName.toLowerCase());
      if (!svc) {
        pushLines(['[SC] OpenService FAILED 1060: The specified service does not exist.'], 'error');
      } else if (svc.name === 'MeridianAuditSvc' && svc.account.toLowerCase().includes('disabled')) {
        pushLines(
          [
            '[SC] StartService FAILED 1069:',
            '',
            'The service did not start due to a logon failure.',
            `(Current SERVICE_START_NAME is "${svc.account}". Fix logon account with sc config first.)`,
          ],
          'error'
        );
      } else {
        svc.state = 'RUNNING';
        svc.exitCode = 0;
        svc.exitReason = undefined;
        pushLines([`SERVICE_NAME: ${svc.name}`, '        STATE              : 4  RUNNING'], 'success');
        if (scenario.id === 'demo-sandbox' && svc.name === 'Spooler') {
          if (!nextMachine.processes.some((p) => p.name === 'spoolsv.exe')) {
            nextMachine.processes.push({
              name: 'spoolsv.exe',
              pid: 2404,
              sessionName: 'Services',
              memUsageKb: 21480,
              services: ['Spooler'],
            });
          }
          newCompletedRepairIds.push('demo-fix-spooler');
        }
      }
    } else if (sub === 'config') {
      commandCategory = 'repair';
      const svc = nextMachine.services.find((s) => s.name.toLowerCase() === svcName.toLowerCase());
      if (!svc) {
        pushLines(['[SC] OpenService FAILED 1060: The specified service does not exist.'], 'error');
      } else if (fullLower.includes('start=') && fullLower.includes('disabled') && svc.suspicious) {
        svc.startType = 'DISABLED';
        svc.state = 'STOPPED';
        if (svc.pid) {
          nextMachine.processes = nextMachine.processes.filter((p) => p.pid !== svc.pid);
          nextMachine.netConnections = nextMachine.netConnections.filter((c) => c.pid !== svc.pid);
          svc.pid = undefined;
        }
        pushLines(['[SC] ChangeServiceConfig SUCCESS'], 'success');
        if (scenario.id === 'case-5' && svc.name === 'MeridianSyncHelper') {
          if (!nextMachine.firewallBlockedIps.includes('192.168.10.214')) {
            nextMachine.firewallBlockedIps.push('192.168.10.214');
          }
          newCompletedRepairIds.push('c5-fix-stop-disable');
        }
      } else if (svc.name === 'MeridianAuditSvc' && fullLower.includes('svc_audit') && !fullLower.includes('disabled')) {
        svc.account = 'MERIDIAN\\svc_audit';
        pushLines(['[SC] ChangeServiceConfig SUCCESS (Logon set to MERIDIAN\\svc_audit). Now run "sc start MeridianAuditSvc".'], 'success');
      } else {
        pushLines(['Usage: sc config <service> start= disabled  OR  sc config MeridianAuditSvc obj= MERIDIAN\\svc_audit'], 'error');
      }
    } else {
      commandCategory = 'invalid';
      pushLines(['Usage: sc [query | qc | start | stop | config] [service_name]'], 'error');
    }
  } else if (cmd === 'systeminfo') {
    pushLines([
      '',
      `Host Name:                 ${nextMachine.hostname}`,
      `OS Name:                   ${nextMachine.osName}`,
      `OS Version:                ${nextMachine.osVersion}`,
      `Domain:                    ${nextMachine.domain}`,
      `System Boot Time:          ${nextMachine.bootTime}`,
      `Network Card(s):           1 NIC(s) Installed.`,
      `                           [01]: ${nextMachine.adapterDescription}`,
      `                                 Connection Name: ${nextMachine.adapterName}`,
      `                                 DHCP Enabled:    ${nextMachine.dhcpEnabled ? 'Yes' : 'No'}`,
      `                                 IP address(es):  [01]: ${nextMachine.ipAddress}`,
      '',
    ]);
  } else if (cmd === 'whoami') {
    const flag = argsLower[0] || '';
    const userObj = nextMachine.users.find(
      (u) => `${nextMachine.domain.split('.')[0]}\\${u.username}`.toLowerCase() === nextMachine.currentUser.toLowerCase()
    );
    if (!flag) {
      pushLines([nextMachine.currentUser.toLowerCase()]);
    } else if (flag === '/groups' || flag === '/all') {
      pushLines([
        '',
        `USER INFORMATION: ${nextMachine.currentUser}`,
        '',
        'GROUP INFORMATION',
        'Group Name                           Type             Attributes',
        '==================================== ================ ==========================================',
        'Everyone                             Well-known group Mandatory group, Enabled by default',
        'BUILTIN\\Users                        Alias            Mandatory group, Enabled by default',
        ...(userObj
          ? userObj.groups.map(
              (g) => `MERIDIAN\\${g.padEnd(27)} Group            Mandatory group, Enabled by default`
            )
          : ['MERIDIAN\\Domain Users                Group            Mandatory group, Enabled by default']),
        '',
      ]);
    } else {
      pushLines(['Usage: whoami [/groups | /all]']);
    }
  } else if (cmd === 'net') {
    const sub = argsLower[0] || '';
    if (sub === 'user') {
      const targetUser = args[1];
      if (!targetUser) {
        pushLines([
          '',
          `User accounts for \\\\${nextMachine.hostname}`,
          '-------------------------------------------------------------------------------',
          nextMachine.users.map((u) => u.username.padEnd(22)).join(''),
          'The command completed successfully.',
          '',
        ]);
      } else {
        const u = nextMachine.users.find((acc) => acc.username.toLowerCase() === targetUser.toLowerCase());
        if (!u) {
          pushLines([`The user name "${targetUser}" could not be found.`], 'error');
        } else if (argsLower.includes('/active:no')) {
          commandCategory = 'repair';
          if (u.username.toLowerCase() !== 'm.halvorsen') {
            pushLines([`Refused: "${u.username}" is a legitimate active employee account.`], 'error');
          } else {
            u.active = false;
            u.groups = u.groups.filter((g) => g !== 'Administrators');
            nextMachine.localAdmins = nextMachine.localAdmins.filter((a) => !a.toLowerCase().includes('m.halvorsen'));
            pushLines(['The command completed successfully.', `Account MERIDIAN\\${u.username} is now DISABLED and removed from Administrators.`], 'success');
            if (scenario.id === 'case-6') {
              newCompletedRepairIds.push('c6-fix-account');
            }
          }
        } else {
          pushLines([
            `User name                    ${u.username}`,
            `Full Name                    ${u.fullName}`,
            `Comment                      ${u.comment}`,
            `Account active               ${u.active ? 'Yes' : 'No'}`,
            `Last logon                   ${u.lastLogon}`,
            `Group Memberships            ${u.groups.map((g) => `*${g}`).join('  ')}`,
            'The command completed successfully.',
          ]);
          if (scenario.id === 'case-4' && u.username.toLowerCase() === 'm.halvorsen') {
            newEvidenceIds.push('c4-ev-user');
          }
          if (scenario.id === 'case-6' && u.username.toLowerCase() === 'm.halvorsen') {
            if (u.active) newEvidenceIds.push('c6-ev-admin');
            if (!u.active && isAllRequiredRepairsDone()) newVerificationIds.push('c6-ver-acct');
          }
        }
      }
    } else if (sub === 'localgroup') {
      const grp = args[1];
      if (!grp) {
        pushLines(['Aliases for \\\\' + nextMachine.hostname, '---------------------------------------', '*Administrators', '*Users', 'The command completed successfully.']);
      } else if (grp.toLowerCase() === 'administrators') {
        pushLines([
          'Alias name     Administrators',
          'Comment        Administrators have complete and unrestricted access to the computer/domain',
          '',
          'Members',
          '-------------------------------------------------------------------------------',
          ...nextMachine.localAdmins,
          'The command completed successfully.',
        ]);
        if (scenario.id === 'case-6') {
          if (nextMachine.localAdmins.some((a) => a.toLowerCase().includes('m.halvorsen'))) {
            newEvidenceIds.push('c6-ev-admin');
          } else if (isAllRequiredRepairsDone()) {
            newVerificationIds.push('c6-ver-acct');
          }
        }
      } else {
        pushLines([`Group "${grp}" not found. Try: net localgroup Administrators`], 'error');
      }
    } else if (sub === 'start') {
      pushLines([
        'These Windows services are started:',
        '',
        ...nextMachine.services.filter((s) => s.state === 'RUNNING').map((s) => `   ${s.displayName} (${s.name})`),
        '',
        'The command completed successfully.',
      ]);
    } else {
      commandCategory = 'invalid';
      pushLines(['Usage: net [user [username] [/active:no] | localgroup [Administrators] | start]'], 'error');
    }
  } else if (cmd === 'icacls') {
    const rawPath = args[0];
    if (!rawPath) {
      commandCategory = 'invalid';
      pushLines(['Usage: icacls <path> [/remove:d <user> | /remove <user>]'], 'error');
    } else {
      const norm = normalizeWinPath(nextMachine.currentDir, rawPath);
      const acl = nextMachine.acls[norm];
      if (!acl) {
        pushLines([`${norm}: NT AUTHORITY\\SYSTEM:(I)(OI)(CI)(F)`, `    BUILTIN\\Administrators:(I)(OI)(CI)(F)`, `    BUILTIN\\Users:(I)(OI)(CI)(RX)`, '', 'Successfully processed 1 files; Failed processing 0 files']);
      } else if (argsLower.includes('/remove:d') || argsLower.includes('/remove')) {
        commandCategory = 'repair';
        const isDenyOnly = argsLower.includes('/remove:d');
        const idx = isDenyOnly ? argsLower.indexOf('/remove:d') : argsLower.indexOf('/remove');
        const principal = (args[idx + 1] || '').toLowerCase();
        nextMachine.acls[norm] = acl.filter((e) => {
          const matchPrincipal = e.principal.toLowerCase().includes(principal);
          if (!matchPrincipal) return true;
          return isDenyOnly ? e.type !== 'DENY' : false;
        });
        pushLines([`processed file: ${norm}`, 'Successfully processed 1 files; Failed processing 0 files'], 'success');
      } else {
        pushLines([
          `${norm} ${acl[0] ? `${acl[0].principal}:${acl[0].type === 'DENY' ? '(DENY)' : ''}${acl[0].permissions}` : ''}`,
          ...acl.slice(1).map((e) => `                   ${e.principal}:${e.type === 'DENY' ? '(DENY)' : ''}${e.permissions}`),
          '',
          'Successfully processed 1 files; Failed processing 0 files',
        ]);
        if (scenario.id === 'case-4' && norm === 'C:\\PAYROLL_EXPORTS') {
          const hasDeny = acl.some((e) => e.type === 'DENY');
          if (hasDeny) newEvidenceIds.push('c4-ev-acl');
          if (!hasDeny && isAllRequiredRepairsDone()) newVerificationIds.push('c4-ver-acl');
        }
      }
    }
  } else if (cmd === 'schtasks') {
    if (argsLower.includes('/delete')) {
      commandCategory = 'repair';
      const tnIdx = argsLower.indexOf('/tn');
      const taskName = tnIdx >= 0 ? (args[tnIdx + 1] || '').replace(/^"|"$/g, '') : '';
      const found = nextMachine.scheduledTasks.find((t) => t.name.toLowerCase() === taskName.toLowerCase());
      if (!found) {
        pushLines([`ERROR: The system cannot find the scheduled task "${taskName}".`], 'error');
      } else if (!found.suspicious) {
        pushLines([`ERROR: Refused to delete legitimate system task "${found.name}".`], 'error');
      } else {
        nextMachine.scheduledTasks = nextMachine.scheduledTasks.filter((t) => t.name !== found.name);
        pushLines([`SUCCESS: The scheduled task "${found.name}" was successfully deleted.`], 'success');
        if (scenario.id === 'case-6') {
          const relaySvc = nextMachine.services.find((s) => s.name === 'MaintRelaySvc');
          if (relaySvc && relaySvc.state === 'STOPPED') {
            newCompletedRepairIds.push('c6-fix-persistence');
          }
        }
      }
    } else {
      if (nextMachine.scheduledTasks.length === 0) {
        pushLines(['INFO: No custom scheduled tasks are registered on this host.']);
      } else {
        pushLines([
          '',
          'TaskName                         Next Run Time          Status   Run As User',
          '================================ ====================== ======== =======================',
          ...nextMachine.scheduledTasks.map(
            (t) => `${t.name.padEnd(32)} ${t.nextRun.padEnd(22)} ${t.status.padEnd(8)} ${t.runAs}\n   Task To Run: ${t.command}`
          ),
          '',
        ]);
      }
      if (scenario.id === 'case-6') {
        if (nextMachine.scheduledTasks.some((t) => t.name === 'MeridianNightlyPush')) {
          newEvidenceIds.push('c6-ev-persist');
        } else if (isAllRequiredRepairsDone()) {
          newVerificationIds.push('c6-ver-persist');
        }
      }
    }
  } else if (cmd === 'netsh') {
    if (fullLower.includes('show config')) {
      pushLines([
        '',
        `Configuration for interface "${nextMachine.adapterName}"`,
        `    DHCP enabled:                         ${nextMachine.dhcpEnabled ? 'Yes' : 'No'}`,
        `    IP Address:                           ${nextMachine.ipAddress}`,
        `    Subnet Prefix:                        ${nextMachine.ipAddress} (mask ${nextMachine.subnetMask})`,
        `    Default Gateway:                      ${nextMachine.defaultGateway}`,
        `    DNS servers configured:               ${nextMachine.dnsServers.join(', ')}`,
        '',
      ]);
      if (scenario.id === 'case-1' && nextMachine.defaultGateway === '192.168.10.254') newEvidenceIds.push('c1-ev-gw');
      if (scenario.id === 'case-2' && nextMachine.subnetMask === '255.255.255.192') newEvidenceIds.push('c2-ev-mask');
      if (scenario.id === 'case-3' && nextMachine.dnsServers.includes('192.168.10.214')) newEvidenceIds.push('c3-ev-dns');
    } else if (fullLower.includes('set address')) {
      commandCategory = 'repair';
      if (fullLower.includes('dhcp')) {
        nextMachine.dhcpEnabled = true;
        nextMachine.ipAddress = nextMachine.dhcpAssignedIp;
        nextMachine.subnetMask = '255.255.255.0';
        nextMachine.defaultGateway = nextMachine.realGatewayIp;
        pushLines([`Ok. Interface "${nextMachine.adapterName}" switched to DHCP (${nextMachine.ipAddress} / 255.255.255.0, GW ${nextMachine.defaultGateway}).`], 'success');
        if (scenario.id === 'case-1') newCompletedRepairIds.push('c1-fix-gateway');
        if (scenario.id === 'case-2') {
          const repaired = applyMachineRepair(nextMachine, 'c2_fix_subnet');
          Object.assign(nextMachine, repaired);
          newCompletedRepairIds.push('c2-fix-mask');
        }
      } else if (fullLower.includes('static')) {
        const ips = args.filter((a) => isValidIpv4(a));
        if (ips.length >= 3) {
          nextMachine.dhcpEnabled = false;
          nextMachine.ipAddress = ips[0];
          nextMachine.subnetMask = ips[1];
          nextMachine.defaultGateway = ips[2];
          pushLines([`Ok. Static IPv4 applied: IP ${ips[0]}, Mask ${ips[1]}, Gateway ${ips[2]}.`], 'success');
          if (scenario.id === 'case-1' && ips[2] === '192.168.10.1' && ips[1] === '255.255.255.0') {
            newCompletedRepairIds.push('c1-fix-gateway');
          }
          if (scenario.id === 'case-2' && ips[1] === '255.255.255.0' && ips[2] === '192.168.10.1') {
            const repaired = applyMachineRepair(nextMachine, 'c2_fix_subnet');
            repaired.dhcpEnabled = false;
            Object.assign(nextMachine, repaired);
            newCompletedRepairIds.push('c2-fix-mask');
          }
        } else {
          pushLines(['Usage: netsh interface ip set address "Ethernet0" static <ip> <mask> <gateway>  OR  ... dhcp'], 'error');
        }
      } else {
        pushLines(['Usage: netsh interface ip set address "Ethernet0" dhcp'], 'error');
      }
    } else if (fullLower.includes('set dns')) {
      commandCategory = 'repair';
      const ips = args.filter((a) => isValidIpv4(a));
      if (fullLower.includes('dhcp')) {
        nextMachine.dnsServers = [nextMachine.realDnsIp];
        pushLines([`Ok. DNS servers for "${nextMachine.adapterName}" set to DHCP (${nextMachine.realDnsIp}).`], 'success');
      } else if (ips.length >= 1) {
        nextMachine.dnsServers = [ips[0]];
        pushLines([`Ok. Static DNS server set to ${ips[0]}.`], 'success');
      } else {
        pushLines(['Usage: netsh interface ip set dns "Ethernet0" static 192.168.10.5'], 'error');
      }
    } else if (fullLower.includes('advfirewall')) {
      commandCategory = 'repair';
      const ips = args.filter((a) => isValidIpv4(a));
      if (ips.length > 0) {
        for (const ip of ips) {
          if (!nextMachine.firewallBlockedIps.includes(ip)) {
            nextMachine.firewallBlockedIps.push(ip);
          }
          nextMachine.netConnections = nextMachine.netConnections.filter((c) => !c.foreignAddress.startsWith(ip));
        }
        pushLines([`Ok. Windows Defender Firewall block rule added for ${ips.join(', ')}.`], 'success');
      } else {
        pushLines([
          'Windows Defender Firewall Active Block Rules:',
          nextMachine.firewallBlockedIps.length > 0
            ? nextMachine.firewallBlockedIps.map((ip) => `  BLOCK OUT/IN -> ${ip}`).join('\n')
            : '  (No custom IP block rules configured)',
        ]);
      }
    } else {
      pushLines(['Usage: netsh interface ip show config | set address ... | set dns ... | netsh advfirewall ...'], 'error');
    }
  } else if (cmd === 'cd' || cmd === 'chdir') {
    commandCategory = 'navigation';
    if (!args[0]) {
      pushLines([nextMachine.currentDir]);
    } else {
      const target = normalizeWinPath(nextMachine.currentDir, args[0]);
      const dirs = getAllDirectories(nextMachine.files);
      if (dirs.has(target)) {
        nextMachine.currentDir = target;
      } else {
        pushLines([`The system cannot find the path specified: ${args[0]}`], 'error');
      }
    }
  } else if (cmd === 'dir' || cmd === 'ls') {
    commandCategory = 'navigation';
    const targetDir = args[0] ? normalizeWinPath(nextMachine.currentDir, args[0]) : nextMachine.currentDir.toUpperCase();
    const dirs = getAllDirectories(nextMachine.files);
    if (!dirs.has(targetDir)) {
      pushLines([`File Not Found: ${targetDir}`], 'error');
    } else {
      const prefix = targetDir.endsWith('\\') ? targetDir : `${targetDir}\\`;
      const childDirs = new Set<string>();
      const childFiles: { name: string; size: number }[] = [];

      for (const d of dirs) {
        if (d.startsWith(prefix) && d !== targetDir) {
          const rel = d.slice(prefix.length);
          const firstSeg = rel.split('\\')[0];
          if (firstSeg) childDirs.add(firstSeg);
        }
      }
      for (const [fPath, content] of Object.entries(nextMachine.files)) {
        const up = fPath.toUpperCase();
        if (up.startsWith(prefix)) {
          const rel = up.slice(prefix.length);
          if (!rel.includes('\\')) {
            childFiles.push({ name: rel, size: content.length * 14 });
          }
        }
      }

      pushLines([
        '',
        ` Directory of ${targetDir}`,
        '',
        ...Array.from(childDirs)
          .sort()
          .map((d) => `24/11/2026  03:15    <DIR>          ${d}`),
        ...childFiles
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((f) => `24/11/2026  03:22        ${String(f.size).padStart(10)} ${f.name}`),
        `               ${childFiles.length} File(s)   ${childDirs.size} Dir(s)`,
        '',
      ]);
    }
  } else if (cmd === 'type' || cmd === 'cat') {
    const fileArg = args[0];
    if (!fileArg) {
      commandCategory = 'invalid';
      pushLines(['The syntax of the command is incorrect. Usage: type <filepath>'], 'error');
    } else {
      const norm = normalizeWinPath(nextMachine.currentDir, fileArg);
      const matchedKey = Object.keys(nextMachine.files).find((k) => k.toUpperCase() === norm);
      if (!matchedKey) {
        commandCategory = 'invalid';
        pushLines([`The system cannot find the file specified: ${fileArg}`], 'error');
      } else {
        // Check NTFS DENY ACL for Case 4 Payroll_Exports!
        if (
          scenario.id === 'case-4' &&
          norm.startsWith('C:\\PAYROLL_EXPORTS\\') &&
          nextMachine.acls['C:\\PAYROLL_EXPORTS']?.some(
            (e) => e.principal.toLowerCase() === 'meridian\\p.nair' && e.type === 'DENY'
          )
        ) {
          pushLines(['Access is denied.'], 'error');
          return {
            outputLines,
            nextMachine,
            newEvidenceIds,
            newVerificationIds,
            newCompletedRepairIds,
            commandCategory,
            normalizedCommand: `type ${fileArg.toLowerCase()}`,
          };
        }

        pushLines(nextMachine.files[matchedKey].split(/\r?\n/));

        // Evidence hooks for reading key logs & hosts
        if (scenario.id === 'demo-sandbox' && norm.includes('PRINT_ERR.LOG')) {
          newEvidenceIds.push('demo-ev-net');
        }
        if (scenario.id === 'case-1' && norm.includes('NET_SETUP.LOG')) {
          newEvidenceIds.push('c1-ev-log');
        }
        if (scenario.id === 'case-2' && norm.includes('NET_CHANGE.LOG')) {
          newEvidenceIds.push('c2-ev-log');
        }
        if (scenario.id === 'case-3' && norm.endsWith('\\HOSTS')) {
          if (nextMachine.hostsFile['files.meridian.local']) {
            newEvidenceIds.push('c3-ev-hosts');
          } else if (isAllRequiredRepairsDone()) {
            newVerificationIds.push('c3-ver-files');
          }
        }
        if (scenario.id === 'case-4' && norm.includes('SERVICE_MGR.LOG')) {
          newEvidenceIds.push('c4-ev-log');
        }
        if (scenario.id === 'case-4' && norm.includes('PAYROLL_Q4_SUMMARY.CSV') && isAllRequiredRepairsDone()) {
          newVerificationIds.push('c4-ver-acl');
        }
        if (scenario.id === 'case-5' && norm.includes('STAGE_MANIFEST.TXT')) {
          newEvidenceIds.push('c5-ev-manifest');
        }
        if (scenario.id === 'case-6' && (norm.includes('TIMELINE.LOG') || norm.includes('SWITCH_PORT24.LOG'))) {
          newEvidenceIds.push('c6-ev-timeline');
        }
      }
    }
  } else if (cmd === 'findstr') {
    const pattern = (args[0] || '').replace(/^"|"$/g, '').toLowerCase();
    const fileArg = args[1];
    if (!pattern || !fileArg) {
      commandCategory = 'invalid';
      pushLines(['Usage: findstr <search_text> <filepath>'], 'error');
    } else {
      const norm = normalizeWinPath(nextMachine.currentDir, fileArg);
      const matchedKey = Object.keys(nextMachine.files).find((k) => k.toUpperCase() === norm);
      if (!matchedKey) {
        pushLines([`FINDSTR: Cannot open ${fileArg}`], 'error');
      } else {
        const matches = nextMachine.files[matchedKey]
          .split(/\r?\n/)
          .filter((line) => line.toLowerCase().includes(pattern));
        if (matches.length === 0) {
          pushLines(['(No matching lines found)']);
        } else {
          pushLines(matches);
        }
        if (scenario.id === 'case-1' && norm.includes('NET_SETUP.LOG')) newEvidenceIds.push('c1-ev-log');
        if (scenario.id === 'case-2' && norm.includes('NET_CHANGE.LOG')) newEvidenceIds.push('c2-ev-log');
        if (scenario.id === 'case-3' && norm.endsWith('\\HOSTS') && nextMachine.hostsFile['files.meridian.local']) {
          newEvidenceIds.push('c3-ev-hosts');
        }
        if (scenario.id === 'case-4' && norm.includes('SERVICE_MGR.LOG')) newEvidenceIds.push('c4-ev-log');
        if (scenario.id === 'case-5' && norm.includes('STAGE_MANIFEST.TXT')) newEvidenceIds.push('c5-ev-manifest');
        if (scenario.id === 'case-6' && norm.includes('TIMELINE.LOG')) newEvidenceIds.push('c6-ev-timeline');
      }
    }
  } else {
    commandCategory = 'invalid';
    pushLines(
      [
        `'${tokens[0]}' is not recognized as an internal or external command, operable program or batch file.`,
        'Type "help" to view supported Windows diagnostic commands.',
      ],
      'error'
    );
  }

  // Reconcile CLI-only multi-command repairs against live machine state
  if (scenario.id === 'case-4') {
    const acl = nextMachine.acls['C:\\PAYROLL_EXPORTS'] || [];
    const denyGone = !acl.some((e) => e.principal.toLowerCase() === 'meridian\\p.nair' && e.type === 'DENY');
    const mhGone = !acl.some((e) => e.principal.toLowerCase().includes('m.halvorsen'));
    const auditSvc = nextMachine.services.find((s) => s.name === 'MeridianAuditSvc');
    if (denyGone && mhGone && auditSvc && auditSvc.state === 'RUNNING' && auditSvc.account === 'MERIDIAN\\svc_audit') {
      newCompletedRepairIds.push('c4-fix-complete');
    }
  }
  if (scenario.id === 'case-6') {
    const relaySvc = nextMachine.services.find((s) => s.name === 'MaintRelaySvc');
    const taskGone = !nextMachine.scheduledTasks.some((t) => t.name === 'MeridianNightlyPush');
    if (relaySvc && relaySvc.state === 'STOPPED' && taskGone) {
      newCompletedRepairIds.push('c6-fix-persistence');
    }
    if (
      nextMachine.firewallBlockedIps.includes('192.168.10.214') &&
      nextMachine.firewallBlockedIps.includes('203.0.113.47')
    ) {
      const cleaned = applyMachineRepair(nextMachine, 'c6_block_network');
      Object.assign(nextMachine, cleaned);
      newCompletedRepairIds.push('c6-fix-network');
    }
  }

  return {
    outputLines,
    nextMachine,
    newEvidenceIds: Array.from(new Set(newEvidenceIds)),
    newVerificationIds: Array.from(new Set(newVerificationIds)),
    newCompletedRepairIds: Array.from(new Set(newCompletedRepairIds)),
    commandCategory,
    normalizedCommand: `${cmd}${argsLower[0] ? ` ${argsLower[0]}` : ''}`,
  };
}
