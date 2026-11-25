export interface CommandDoc {
  command: string;
  syntax: string;
  category: 'Networking' | 'DNS & Routing' | 'Processes & Services' | 'Accounts & Security' | 'Files & Logs';
  summary: string;
  examples: string[];
}

export const COMMAND_REFERENCE: CommandDoc[] = [
  {
    command: 'ipconfig',
    syntax: 'ipconfig [/all | /displaydns | /flushdns | /release | /renew]',
    category: 'Networking',
    summary: 'Displays TCP/IP adapter configuration, DHCP status, gateway, DNS servers, and local DNS resolver cache.',
    examples: ['ipconfig /all', 'ipconfig /displaydns', 'ipconfig /flushdns'],
  },
  {
    command: 'ping',
    syntax: 'ping <IP or hostname> [-n count]',
    category: 'Networking',
    summary: 'Sends ICMP Echo Request packets to test Layer 3 reachability and name resolution to a local or remote host.',
    examples: ['ping 192.168.10.1', 'ping 8.8.8.8', 'ping erp.meridian.local'],
  },
  {
    command: 'arp',
    syntax: 'arp -a',
    category: 'Networking',
    summary: 'Displays the Address Resolution Protocol cache mapping local IPv4 addresses to physical MAC addresses.',
    examples: ['arp -a'],
  },
  {
    command: 'netsh',
    syntax: 'netsh interface ip [show config | set address | set dns] | netsh advfirewall ...',
    category: 'Networking',
    summary: 'Inspects and modifies network interface IP/subnet/gateway/DNS settings and Windows Firewall rules.',
    examples: [
      'netsh interface ip show config',
      'netsh interface ip set address "Ethernet0" dhcp',
      'netsh interface ip set dns "Ethernet0" static 192.168.10.5',
    ],
  },
  {
    command: 'tracert',
    syntax: 'tracert <IP or hostname>',
    category: 'DNS & Routing',
    summary: 'Traces the hop-by-hop routing path packets take from this machine to a destination.',
    examples: ['tracert 8.8.8.8', 'tracert 192.168.10.10'],
  },
  {
    command: 'route',
    syntax: 'route print',
    category: 'DNS & Routing',
    summary: 'Shows the Windows IPv4 routing table, including on-link subnets and the 0.0.0.0 default route.',
    examples: ['route print'],
  },
  {
    command: 'nslookup',
    syntax: 'nslookup <hostname> [dns-server-ip]',
    category: 'DNS & Routing',
    summary: 'Queries either the configured DNS server or a specific DNS server IP to test hostname resolution.',
    examples: ['nslookup erp.meridian.local', 'nslookup erp.meridian.local 192.168.10.5'],
  },
  {
    command: 'netstat',
    syntax: 'netstat [-a | -an | -ano]',
    category: 'Processes & Services',
    summary: 'Displays active TCP connections, listening ports, and owning Process IDs (PIDs) with -ano.',
    examples: ['netstat -ano', 'netstat -an'],
  },
  {
    command: 'tasklist',
    syntax: 'tasklist [/svc]',
    category: 'Processes & Services',
    summary: 'Lists currently running processes, their PIDs, memory usage, and hosted Windows services.',
    examples: ['tasklist', 'tasklist /svc'],
  },
  {
    command: 'taskkill',
    syntax: 'taskkill /PID <pid> /F  or  taskkill /IM <image.exe> /F',
    category: 'Processes & Services',
    summary: 'Terminates a running process by Process ID or executable name.',
    examples: ['taskkill /PID 4812 /F'],
  },
  {
    command: 'sc',
    syntax: 'sc [query | qc | start | stop | config] [serviceName]',
    category: 'Processes & Services',
    summary: 'Queries service status, inspects binary paths and logon accounts (qc), and starts/stops/configures services.',
    examples: ['sc query', 'sc query MeridianAuditSvc', 'sc qc MeridianAuditSvc', 'sc stop MeridianSyncHelper'],
  },
  {
    command: 'schtasks',
    syntax: 'schtasks [/query | /delete /tn <TaskName>]',
    category: 'Processes & Services',
    summary: 'Lists or removes Windows Scheduled Tasks configured to run automatically.',
    examples: ['schtasks /query', 'schtasks /delete /tn MeridianNightlyPush'],
  },
  {
    command: 'whoami',
    syntax: 'whoami [/groups | /all]',
    category: 'Accounts & Security',
    summary: 'Displays the current logged-on domain user account and security group memberships.',
    examples: ['whoami', 'whoami /groups'],
  },
  {
    command: 'net',
    syntax: 'net [user [name] [/active:no] | localgroup [Administrators] | start]',
    category: 'Accounts & Security',
    summary: 'Inspects user accounts, last logon timestamps, account status, local admin members, and running services.',
    examples: ['net user', 'net user m.halvorsen', 'net localgroup Administrators'],
  },
  {
    command: 'icacls',
    syntax: 'icacls <path> [/remove:d <user> | /remove <user>]',
    category: 'Accounts & Security',
    summary: 'Displays or modifies NTFS file and folder Access Control Lists (Allow and Deny permissions).',
    examples: ['icacls C:\\Payroll_Exports', 'icacls C:\\Payroll_Exports /remove:d MERIDIAN\\p.nair'],
  },
  {
    command: 'systeminfo',
    syntax: 'systeminfo',
    category: 'Files & Logs',
    summary: 'Displays OS version, hostname, domain membership, system boot time, and network adapter overview.',
    examples: ['systeminfo'],
  },
  {
    command: 'dir / cd / type',
    syntax: 'dir [path] | cd <path> | type <filepath> | findstr <text> <filepath>',
    category: 'Files & Logs',
    summary: 'Browses directories, reads configuration files (like hosts) and local log files, or searches file contents.',
    examples: [
      'dir C:\\Logs',
      'type C:\\Windows\\System32\\drivers\\etc\\hosts',
      'type C:\\Temp\\net_setup.log',
    ],
  },
];
