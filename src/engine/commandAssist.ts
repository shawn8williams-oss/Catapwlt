export interface CommandSuggestion {
  key: string; // Normalized command family key to count repeated attempts
  suggestedCommand: string;
}

const VALID_BASE_COMMANDS = [
  'ipconfig',
  'ping',
  'tracert',
  'nslookup',
  'arp',
  'route',
  'netstat',
  'tasklist',
  'taskkill',
  'sc',
  'schtasks',
  'systeminfo',
  'whoami',
  'net',
  'icacls',
  'netsh',
  'dir',
  'cd',
  'type',
  'findstr',
  'hostname',
  'help',
  'cls',
];

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

/**
 * Analyzes an invalid or failed terminal command and returns a suggested
 * correct Windows command if the student was on the right track.
 * Never auto-executes the command; used strictly for two-strike coaching pop-ups.
 */
export function detectNearMissCommand(rawInput: string): CommandSuggestion | null {
  const trimmed = rawInput.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  const parts = trimmed.split(/\s+/);
  const first = parts[0].toLowerCase();
  const rest = parts.slice(1).join(' ');

  // 1. Missing space before slash/dash flags (classic Windows beginner mistake)
  if (/^ipconfig\/.+/.test(lower)) {
    const flag = lower.slice('ipconfig'.length);
    const fixedFlag =
      flag === '/al' || flag === '/a'
        ? '/all'
        : flag.startsWith('/flush')
        ? '/flushdns'
        : flag.startsWith('/display')
        ? '/displaydns'
        : flag;
    return { key: 'ipconfig', suggestedCommand: `ipconfig ${fixedFlag}` };
  }
  if (/^whoami\/.+/.test(lower)) {
    const flag = lower.slice('whoami'.length);
    return { key: 'whoami', suggestedCommand: `whoami ${flag}` };
  }
  if (/^tasklist\/.+/.test(lower)) {
    const flag = lower.slice('tasklist'.length);
    return { key: 'tasklist', suggestedCommand: `tasklist ${flag}` };
  }
  if (/^arp-[a-z]+/.test(lower)) {
    return { key: 'arp', suggestedCommand: 'arp -a' };
  }
  if (/^netstat-[a-z]+/.test(lower)) {
    return { key: 'netstat', suggestedCommand: 'netstat -ano' };
  }
  if (/^ping\d/.test(lower)) {
    return { key: 'ping', suggestedCommand: `ping ${trimmed.slice(4)}` };
  }
  if (lower === 'routeprint') {
    return { key: 'route', suggestedCommand: 'route print' };
  }
  if (lower.startsWith('scquery')) {
    return { key: 'sc', suggestedCommand: `sc query${rest ? ` ${rest}` : ''}` };
  }
  if (lower.startsWith('scqc')) {
    return { key: 'sc', suggestedCommand: `sc qc${rest ? ` ${rest}` : ''}` };
  }

  // 2. Extra space inside a single command word
  if (lower.startsWith('ip config')) {
    const tail = trimmed.slice(9).trim();
    return { key: 'ipconfig', suggestedCommand: tail ? `ipconfig ${tail}` : 'ipconfig /all' };
  }
  if (lower.startsWith('net stat')) {
    const tail = trimmed.slice(8).trim();
    return { key: 'netstat', suggestedCommand: tail ? `netstat ${tail}` : 'netstat -ano' };
  }
  if (lower.startsWith('task list')) {
    const tail = trimmed.slice(9).trim();
    return { key: 'tasklist', suggestedCommand: tail ? `tasklist ${tail}` : 'tasklist /svc' };
  }
  if (lower.startsWith('task kill')) {
    const tail = trimmed.slice(9).trim();
    return { key: 'taskkill', suggestedCommand: tail ? `taskkill ${tail}` : 'taskkill /PID <id> /F' };
  }
  if (lower.startsWith('ns lookup')) {
    const tail = trimmed.slice(9).trim();
    return { key: 'nslookup', suggestedCommand: tail ? `nslookup ${tail}` : 'nslookup <hostname>' };
  }
  if (lower === 'system info') {
    return { key: 'systeminfo', suggestedCommand: 'systeminfo' };
  }
  if (lower.startsWith('who ami')) {
    const tail = trimmed.slice(7).trim();
    return { key: 'whoami', suggestedCommand: tail ? `whoami ${tail}` : 'whoami' };
  }

  // 3. Common Linux commands or Windows flag near-misses
  if (first === 'ifconfig') {
    return { key: 'ipconfig', suggestedCommand: 'ipconfig /all' };
  }
  if (first === 'traceroute') {
    return { key: 'tracert', suggestedCommand: rest ? `tracert ${rest}` : 'tracert 8.8.8.8' };
  }
  if (first === 'ps') {
    return { key: 'tasklist', suggestedCommand: 'tasklist' };
  }
  if (first === 'ipconfig' && parts[1]) {
    const fl = parts[1].toLowerCase();
    if (fl === '-all' || fl === 'all' || fl === '/al' || fl === '/a') {
      return { key: 'ipconfig', suggestedCommand: 'ipconfig /all' };
    }
    if (fl.includes('flush')) {
      return { key: 'ipconfig', suggestedCommand: 'ipconfig /flushdns' };
    }
    if (fl.includes('display')) {
      return { key: 'ipconfig', suggestedCommand: 'ipconfig /displaydns' };
    }
    if (fl.includes('renew')) {
      return { key: 'ipconfig', suggestedCommand: 'ipconfig /renew' };
    }
    if (fl.includes('release')) {
      return { key: 'ipconfig', suggestedCommand: 'ipconfig /release' };
    }
  }
  if (first === 'arp' && lower !== 'arp -a') {
    return { key: 'arp', suggestedCommand: 'arp -a' };
  }
  if (first === 'route' && lower !== 'route print') {
    return { key: 'route', suggestedCommand: 'route print' };
  }
  if (first === 'net' && parts[1]?.toLowerCase() === 'users') {
    return {
      key: 'net',
      suggestedCommand: `net user${parts.slice(2).length ? ` ${parts.slice(2).join(' ')}` : ''}`,
    };
  }
  if (first === 'sc' && parts[1]) {
    const sub = parts[1].toLowerCase();
    const tail = parts.slice(2).join(' ');
    if (levenshtein(sub, 'query') <= 2 && sub !== 'query') {
      return { key: 'sc', suggestedCommand: `sc query${tail ? ` ${tail}` : ''}` };
    }
    if (sub === 'status' || sub === 'state') {
      return { key: 'sc', suggestedCommand: `sc query${tail ? ` ${tail}` : ''}` };
    }
  }
  if (first === 'type' && parts[1]?.toLowerCase() === 'hosts') {
    return { key: 'type-hosts', suggestedCommand: 'type C:\\Windows\\System32\\drivers\\etc\\hosts' };
  }
  if (first === 'ping' && !rest) {
    return { key: 'ping', suggestedCommand: 'ping 192.168.10.1' };
  }
  if (first === 'nslookup' && !rest) {
    return { key: 'nslookup', suggestedCommand: 'nslookup erp.meridian.local' };
  }

  // 4. Close spelling typo on any valid base command (Levenshtein distance <= 2)
  if (!VALID_BASE_COMMANDS.includes(first) && first.length >= 2) {
    let bestCmd: string | null = null;
    let bestDist = 3;
    for (const candidate of VALID_BASE_COMMANDS) {
      const maxAllowed = candidate.length <= 3 ? 1 : 2;
      const dist = levenshtein(first, candidate);
      if (dist <= maxAllowed && dist < bestDist) {
        bestDist = dist;
        bestCmd = candidate;
      }
    }
    if (bestCmd) {
      return {
        key: bestCmd,
        suggestedCommand: rest ? `${bestCmd} ${rest}` : bestCmd,
      };
    }
  }

  return null;
}
