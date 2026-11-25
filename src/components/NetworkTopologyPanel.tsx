import { useState } from 'react';
import { X, Network } from 'lucide-react';
import { MachineState, ScenarioConfig, ScenarioProgress } from '../types/game';
import { isSameSubnet } from '../engine/terminalEngine';

interface NetworkTopologyPanelProps {
  scenario: ScenarioConfig;
  progress: ScenarioProgress;
  unlockedCaseNumbers: number[];
  onClose: () => void;
}

interface NodeDetail {
  id: string;
  label: string;
  ip: string;
  mac: string;
  role: string;
  status: string;
  tone: 'healthy' | 'active' | 'alert' | 'muted';
}

export function NetworkTopologyPanel({
  scenario,
  progress,
  unlockedCaseNumbers,
  onClose,
}: NetworkTopologyPanelProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string>('target');
  const m: MachineState = progress.machine;
  const ev = progress.discoveredEvidenceIds;

  const allRepairsDone = scenario.requiredRepairIds.every((id) =>
    progress.completedRepairIds.includes(id)
  );

  // Determine whether rogue host 192.168.10.214 has been observed in this case or prior solved cases
  const rogueDiscovered =
    unlockedCaseNumbers.length >= 1 ||
    ev.includes('c1-ev-arp') ||
    ev.includes('c2-ev-log') ||
    ev.includes('c3-ev-dns') ||
    ev.includes('c3-ev-hosts') ||
    ev.includes('c5-ev-netstat') ||
    ev.includes('c5-ev-manifest') ||
    scenario.id === 'case-6';

  const relayDiscovered =
    ev.includes('c5-ev-manifest') ||
    ev.includes('c6-ev-relay') ||
    ev.includes('c6-ev-persist') ||
    unlockedCaseNumbers.includes(5);

  const isCase1 = scenario.id === 'case-1';
  const isCase2 = scenario.id === 'case-2';
  const isCase3 = scenario.id === 'case-3';
  const isCase4 = scenario.id === 'case-4';
  const isCase5 = scenario.id === 'case-5';
  const isCase6 = scenario.id === 'case-6';
  const isDemo = scenario.id === 'demo-sandbox';

  // Live diagnostic status computations directly from MachineState
  const gwValid = m.defaultGateway === m.realGatewayIp && isSameSubnet(m.ipAddress, m.defaultGateway, m.subnetMask);
  const subnetIsolated = !isSameSubnet(m.ipAddress, m.realGatewayIp, m.subnetMask);
  const dnsHijacked = m.dnsServers.includes('192.168.10.214') || Boolean(m.hostsFile['files.meridian.local']);
  const c4AclBroken =
    isCase4 &&
    (m.acls['C:\\PAYROLL_EXPORTS']?.some((a) => a.type === 'DENY') ||
      m.services.find((s) => s.name === 'MeridianAuditSvc')?.state !== 'RUNNING');
  const c5ExfilActive =
    isCase5 && m.netConnections.some((c) => c.foreignAddress.includes('192.168.10.214:8443'));
  const c6RelayActive =
    isCase6 &&
    (m.netConnections.some((c) => c.foreignAddress.includes('203.0.113.47')) ||
      m.services.find((s) => s.name === 'MaintRelaySvc')?.state === 'RUNNING');
  const demoSpoolerStopped =
    isDemo && m.services.find((s) => s.name === 'Spooler')?.state !== 'RUNNING';

  const nodes: Record<string, NodeDetail> = {
    gw: {
      id: 'gw',
      label: 'GW-CORE-01',
      ip: '192.168.10.1',
      mac: '00-1a-2b-3c-4d-01',
      role: 'Default Gateway & Edge Firewall',
      status: isCase1 && !gwValid
        ? 'Healthy (bypassed — workstation points to .254)'
        : subnetIsolated
        ? 'Unreachable from WS-DSP-07 (/26 subnet mismatch)'
        : 'Online · Routing 192.168.10.0/24 ↔ WAN',
      tone: 'healthy',
    },
    dc: {
      id: 'dc',
      label: 'DC-CORE-01',
      ip: '192.168.10.5',
      mac: '00-1a-2b-3c-4d-05',
      role: 'Domain Controller · DNS · DHCP',
      status: isCase6
        ? c6RelayActive
          ? 'Alert: Active persistence & outbound relay on DC'
          : 'Contained: Account disabled, persistence removed, relay blocked'
        : isCase3 && dnsHijacked
        ? 'Online (workstation bypassing .5 to query .214)'
        : 'Online · Authoritative DNS for meridian.local',
      tone: isCase6 && c6RelayActive ? 'alert' : isCase6 ? 'active' : 'healthy',
    },
    file: {
      id: 'file',
      label: 'SRV-FILE01',
      ip: '192.168.10.10',
      mac: '00-1a-2b-3c-4d-10',
      role: 'Central File & ERP Server',
      status: isCase5
        ? c5ExfilActive
          ? 'Alert: PID 4812 (winupd_sync.exe) streaming to .214:8443'
          : 'Contained: MeridianSyncHelper disabled & .214 blocked'
        : 'Online · Hosting erp.meridian.local & SMB shares',
      tone: isCase5 && c5ExfilActive ? 'alert' : isCase5 ? 'active' : 'healthy',
    },
    target: {
      id: 'target',
      label: m.hostname,
      ip: m.ipAddress,
      mac: m.macAddress,
      role: isCase5 || isCase6 ? 'Active Server Under Investigation' : 'Active Workstation Under Investigation',
      status:
        isCase1 && !gwValid
          ? `Fault: Static GW ${m.defaultGateway} (unreachable)`
          : isCase2 && subnetIsolated
          ? `Fault: Mask ${m.subnetMask} (/26 isolates .74 from .1/.5/.10)`
          : isCase3 && dnsHijacked
          ? `Fault: DNS ${m.dnsServers[0]} + hijacked hosts entry`
          : c4AclBroken
          ? 'Fault: Explicit NTFS DENY on Payroll_Exports & AuditSvc Error 1069'
          : demoSpoolerStopped
          ? 'Fault: Local Print Spooler service STOPPED (Exit 1067)'
          : allRepairsDone
          ? `Nominal · IP ${m.ipAddress} / ${m.subnetMask} · GW ${m.defaultGateway}`
          : `Inspecting live host (${m.ipAddress})`,
      tone:
        (isCase1 && !gwValid) ||
        (isCase2 && subnetIsolated) ||
        (isCase3 && dnsHijacked) ||
        c4AclBroken ||
        c5ExfilActive ||
        c6RelayActive ||
        demoSpoolerStopped
          ? 'alert'
          : 'healthy',
    },
    printer: {
      id: 'printer',
      label: 'PRN-DSP-01',
      ip: '192.168.10.80',
      mac: '3c-52-82-44-10-80',
      role: 'Dispatch Network Label Printer',
      status: isCase2 && subnetIsolated
        ? 'Reachable (inside .64/26 range alongside .74!)'
        : 'Online · Listening on TCP 9100',
      tone: 'healthy',
    },
    rogue: {
      id: 'rogue',
      label: rogueDiscovered ? 'MAINT-NODE-04' : 'Unknown LAN Host',
      ip: '192.168.10.214',
      mac: '00-50-56-9a-4f-c1',
      role: 'Uncatalogued Staging Device (Comms Switch Port 24)',
      status:
        m.firewallBlockedIps.includes('192.168.10.214')
          ? 'Blocked by Windows Firewall'
          : isCase5 && c5ExfilActive
          ? 'Alert: Receiving Finance/HR archive on TCP :8443'
          : isCase3 && dnsHijacked
          ? 'Alert: Target of Finance DNS & hosts redirection'
          : 'Suspicious uncatalogued VMware MAC (00-50-56)',
      tone: m.firewallBlockedIps.includes('192.168.10.214') ? 'muted' : 'alert',
    },
    relay: {
      id: 'relay',
      label: 'External Relay',
      ip: '203.0.113.47:443',
      mac: 'External WAN',
      role: 'relay.meridian-update.test (RFC 5737 Documentation IP)',
      status: m.firewallBlockedIps.includes('203.0.113.47')
        ? 'Blocked · Exfiltration channel severed'
        : 'Alert: Scheduled 10:00 AM external upload target',
      tone: m.firewallBlockedIps.includes('203.0.113.47') ? 'muted' : 'alert',
    },
  };

  const selected = nodes[selectedNodeId] || nodes.target;

  // Dynamic caption explaining what the diagram currently reflects
  let topologyCaption = 'Live representation of Meridian LAN (192.168.10.0/24). Click any node to inspect its state.';
  if (isCase1) {
    topologyCaption = !gwValid
      ? `WS-REC-01 reaches LAN servers directly, but off-subnet packets fail at non-existent gateway ${m.defaultGateway}.`
      : 'WS-REC-01 default gateway restored to 192.168.10.1 — external routing through GW-CORE-01 is active.';
  } else if (isCase2) {
    topologyCaption = subnetIsolated
      ? 'Subnet mask 255.255.255.192 (/26) traps WS-DSP-07 (.74) inside 192.168.10.64–127 with printer .80, cutting off .1, .5, and .10.'
      : 'Subnet mask restored to 255.255.255.0 (/24) — WS-DSP-07 can now reach gateway .1 and core servers.';
  } else if (isCase3) {
    topologyCaption = dnsHijacked
      ? 'IP routing to SRV-FILE01 works, but Finance name resolution (DNS / hosts) is being diverted toward 192.168.10.214.'
      : 'DNS restored to DC-CORE-01 (192.168.10.5) and rogue hosts entry cleared.';
  } else if (isCase4) {
    topologyCaption = c4AclBroken
      ? 'Network links are healthy — fault is local on WS-HR-02 (NTFS explicit DENY on Payroll_Exports & MeridianAuditSvc Error 1069).'
      : 'WS-HR-02 NTFS permissions cleaned and MeridianAuditSvc restored to RUNNING.';
  } else if (isCase5) {
    topologyCaption = c5ExfilActive
      ? 'SRV-FILE01 PID 4812 (winupd_sync.exe) holds an active outbound session to 192.168.10.214:8443.'
      : 'MeridianSyncHelper disabled and outbound traffic to 192.168.10.214 blocked.';
  } else if (isCase6) {
    topologyCaption = allRepairsDone
      ? 'DC-CORE-01 fully contained: m.halvorsen disabled, MaintRelaySvc & MeridianNightlyPush removed, rogue IPs blocked.'
      : 'DC-CORE-01 holds active persistence linking MAINT-NODE-04 (.214) and external relay 203.0.113.47:443.';
  } else if (isDemo) {
    topologyCaption = demoSpoolerStopped
      ? 'LAN link to PRN-DSP-01 (192.168.10.80) is healthy; fault is the stopped local Print Spooler service on WS-TRAIN-01.'
      : 'Print Spooler is RUNNING on WS-TRAIN-01 — ready to print to PRN-DSP-01.';
  }

  // Only render Workstation node separately if active target isn't SRV-FILE01 or DC-CORE-01
  const targetIsCoreServer = isCase5 || isCase6;

  return (
    <section
      aria-label="Interactive Office Network Topology"
      className="mb-4 overflow-hidden rounded-lg border border-[#232D3F] bg-[#0D131D]"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1E2738] bg-[#111722] px-4 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <Network className="h-4 w-4 text-amber-400 shrink-0" aria-hidden="true" />
          <h2 className="font-display text-sm font-bold text-[#F8FAFC]">
            Meridian LAN Topology (Live State)
          </h2>
          <span className="hidden md:inline font-mono text-xs text-[#64748B]">·</span>
          <span className="hidden md:inline truncate text-xs text-[#94A3B8]">
            {topologyCaption}
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close network map"
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-[#94A3B8] transition-colors hover:bg-[#1C2536] hover:text-[#F8FAFC] cursor-pointer"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Hide Map</span>
        </button>
      </div>

      {/* Interactive SVG Canvas */}
      <div className="px-4 py-3">
        <p className="mb-2 text-xs text-[#94A3B8] md:hidden">{topologyCaption}</p>
        <div className="overflow-x-auto">
          <svg
            viewBox="0 0 920 235"
            className="mx-auto h-auto w-full min-w-[680px] max-w-[960px] select-none"
            role="img"
            aria-label="Interactive network diagram of Meridian Freight and Logistics LAN"
          >
            {/* Subtle LAN Backbone Bus */}
            <rect
              x="24"
              y="14"
              width="660"
              height="206"
              rx="8"
              fill="#0A0F17"
              stroke="#1E2738"
              strokeWidth="1"
            />
            <text x="38" y="32" fill="#64748B" fontSize="10.5" fontFamily="JetBrains Mono, monospace">
              MERIDIAN OFFICE LAN · 192.168.10.0/24 (SW-CORE-01)
            </text>

            {/* Case 2 /26 Subnet Isolation Bubble */}
            {isCase2 && subnetIsolated && (
              <g>
                <rect
                  x="36"
                  y="124"
                  width="350"
                  height="84"
                  rx="8"
                  fill="rgba(239, 68, 68, 0.07)"
                  stroke="#EF4444"
                  strokeWidth="1.5"
                  strokeDasharray="6 4"
                />
                <text x="48" y="139" fill="#F87171" fontSize="10" fontFamily="JetBrains Mono, monospace">
                  ISOLATED /26 SUBNET (192.168.10.64 – .127)
                </text>
              </g>
            )}

            {/* External WAN Area */}
            <rect
              x="714"
              y="14"
              width="184"
              height="206"
              rx="8"
              fill="#090D14"
              stroke="#1E2738"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <text x="728" y="32" fill="#64748B" fontSize="10.5" fontFamily="JetBrains Mono, monospace">
              EXTERNAL / WAN
            </text>

            {/* === CONNECTION LINES === */}
            {/* Core LAN spine lines */}
            <line x1="204" y1="74" x2="274" y2="74" stroke="#334155" strokeWidth="1.5" />
            <line x1="424" y1="74" x2="494" y2="74" stroke="#334155" strokeWidth="1.5" />

            {/* Gateway to WAN Internet */}
            <line
              x1="644"
              y1="74"
              x2="734"
              y2="74"
              stroke={isCase1 && !gwValid ? '#475569' : '#10B981'}
              strokeWidth="1.75"
              strokeDasharray={isCase1 && !gwValid ? '4 4' : undefined}
            />

            {/* Workstation links (Cases 1–4 & Demo) */}
            {!targetIsCoreServer && (
              <>
                {/* Workstation -> DC/DNS (.5) */}
                <line
                  x1="128"
                  y1="146"
                  x2="128"
                  y2="104"
                  stroke={
                    subnetIsolated
                      ? '#EF4444'
                      : isCase3 && dnsHijacked
                      ? '#475569'
                      : '#10B981'
                  }
                  strokeWidth="1.5"
                  strokeDasharray={subnetIsolated || (isCase3 && dnsHijacked) ? '5 4' : undefined}
                />

                {/* Workstation -> SRV-FILE01 (.10) */}
                <line
                  x1="168"
                  y1="146"
                  x2="335"
                  y2="104"
                  stroke={subnetIsolated ? '#EF4444' : '#10B981'}
                  strokeWidth="1.5"
                  strokeDasharray={subnetIsolated ? '5 4' : undefined}
                />

                {/* Case 1: Bad Gateway vs Fixed Gateway */}
                {isCase1 && !gwValid && (
                  <>
                    <line
                      x1="204"
                      y1="176"
                      x2="494"
                      y2="176"
                      stroke="#EF4444"
                      strokeWidth="1.75"
                      strokeDasharray="6 4"
                    />
                    <text x="275" y="170" fill="#F87171" fontSize="10" fontFamily="JetBrains Mono, monospace">
                      Route Fail → GW 192.168.10.254 (Missing)
                    </text>
                  </>
                )}

                {isCase1 && gwValid && (
                  <line
                    x1="204"
                    y1="162"
                    x2="514"
                    y2="104"
                    stroke="#10B981"
                    strokeWidth="2"
                  />
                )}

                {/* Case 2 / Demo: Link to Dispatch Printer (.80) */}
                {(isCase2 || isDemo) && (
                  <line
                    x1="204"
                    y1="176"
                    x2="246"
                    y2="176"
                    stroke="#10B981"
                    strokeWidth="2"
                  />
                )}

                {/* Case 3: Hijacked DNS/hosts detour to .214 */}
                {isCase3 && dnsHijacked && (
                  <>
                    <line
                      x1="204"
                      y1="176"
                      x2="494"
                      y2="176"
                      stroke="#EF4444"
                      strokeWidth="2"
                      strokeDasharray="6 4"
                    />
                    <text x="260" y="169" fill="#F87171" fontSize="10" fontFamily="JetBrains Mono, monospace">
                      DNS / hosts Hijack → .214
                    </text>
                  </>
                )}
              </>
            )}

            {/* Case 5: Exfiltration line SRV-FILE01 (.10) -> MAINT-NODE-04 (.214) */}
            {isCase5 && (ev.includes('c5-ev-netstat') || allRepairsDone) && (
              <>
                <line
                  x1="360"
                  y1="104"
                  x2="510"
                  y2="152"
                  stroke={c5ExfilActive ? '#EF4444' : '#64748B'}
                  strokeWidth="2"
                  strokeDasharray="6 4"
                />
                <text
                  x="385"
                  y="142"
                  fill={c5ExfilActive ? '#F87171' : '#94A3B8'}
                  fontSize="10"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {c5ExfilActive ? 'PID 4812 → :8443' : 'Blocked'}
                </text>
              </>
            )}

            {/* Case 6: DC-CORE-01 -> MAINT-NODE-04 -> 203.0.113.47 */}
            {isCase6 && (
              <>
                <line
                  x1="150"
                  y1="104"
                  x2="494"
                  y2="168"
                  stroke={c6RelayActive ? '#EF4444' : '#64748B'}
                  strokeWidth="2"
                  strokeDasharray="6 4"
                />
                <text
                  x="240"
                  y="146"
                  fill={c6RelayActive ? '#F87171' : '#94A3B8'}
                  fontSize="10"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {c6RelayActive ? 'PID 6104 → :8443' : 'Relay Severed'}
                </text>
              </>
            )}

            {/* Rogue Node -> External Relay (Cases 5 & 6 once discovered) */}
            {rogueDiscovered && relayDiscovered && (
              <line
                x1="644"
                y1="176"
                x2="734"
                y2="176"
                stroke={
                  m.firewallBlockedIps.includes('203.0.113.47') ? '#64748B' : '#EF4444'
                }
                strokeWidth="2"
                strokeDasharray="6 4"
              />
            )}

            {/* === CORE NODES (Top Row) === */}
            {/* DC-CORE-01 */}
            <g
              onClick={() => setSelectedNodeId(isCase6 ? 'target' : 'dc')}
              className="cursor-pointer"
            >
              <rect
                x="54"
                y="46"
                width="150"
                height="58"
                rx="6"
                fill={isCase6 ? '#1A1F2E' : '#131A26'}
                stroke={
                  selectedNodeId === 'dc' || (isCase6 && selectedNodeId === 'target')
                    ? '#F59E0B'
                    : isCase6 && c6RelayActive
                    ? '#EF4444'
                    : '#2E3B52'
                }
                strokeWidth={isCase6 ? '2' : '1.25'}
              />
              <text x="66" y="66" fill="#F8FAFC" fontSize="11.5" fontWeight="600" fontFamily="Plus Jakarta Sans, sans-serif">
                DC-CORE-01
              </text>
              <text x="66" y="81" fill="#94A3B8" fontSize="10.5" fontFamily="JetBrains Mono, monospace">
                192.168.10.5
              </text>
              <text x="66" y="95" fill={isCase6 && c6RelayActive ? '#F87171' : '#34D399'} fontSize="9.5" fontFamily="JetBrains Mono, monospace">
                {isCase6 ? (c6RelayActive ? 'PERSISTENCE ALERT' : 'CONTAINED') : 'AD · DNS · DHCP'}
              </text>
            </g>

            {/* SRV-FILE01 */}
            <g
              onClick={() => setSelectedNodeId(isCase5 ? 'target' : 'file')}
              className="cursor-pointer"
            >
              <rect
                x="274"
                y="46"
                width="150"
                height="58"
                rx="6"
                fill={isCase5 ? '#1A1F2E' : '#131A26'}
                stroke={
                  selectedNodeId === 'file' || (isCase5 && selectedNodeId === 'target')
                    ? '#F59E0B'
                    : isCase5 && c5ExfilActive
                    ? '#EF4444'
                    : '#2E3B52'
                }
                strokeWidth={isCase5 ? '2' : '1.25'}
              />
              <text x="286" y="66" fill="#F8FAFC" fontSize="11.5" fontWeight="600" fontFamily="Plus Jakarta Sans, sans-serif">
                SRV-FILE01
              </text>
              <text x="286" y="81" fill="#94A3B8" fontSize="10.5" fontFamily="JetBrains Mono, monospace">
                192.168.10.10
              </text>
              <text x="286" y="95" fill={isCase5 && c5ExfilActive ? '#F87171' : '#34D399'} fontSize="9.5" fontFamily="JetBrains Mono, monospace">
                {isCase5 ? (c5ExfilActive ? 'EXFIL ACTIVE' : 'CONTAINED') : 'ERP · FILES'}
              </text>
            </g>

            {/* GW-CORE-01 */}
            <g onClick={() => setSelectedNodeId('gw')} className="cursor-pointer">
              <rect
                x="494"
                y="46"
                width="150"
                height="58"
                rx="6"
                fill="#131A26"
                stroke={selectedNodeId === 'gw' ? '#F59E0B' : '#2E3B52'}
                strokeWidth="1.25"
              />
              <text x="506" y="66" fill="#F8FAFC" fontSize="11.5" fontWeight="600" fontFamily="Plus Jakarta Sans, sans-serif">
                GW-CORE-01
              </text>
              <text x="506" y="81" fill="#94A3B8" fontSize="10.5" fontFamily="JetBrains Mono, monospace">
                192.168.10.1
              </text>
              <text x="506" y="95" fill="#34D399" fontSize="9.5" fontFamily="JetBrains Mono, monospace">
                GATEWAY · FIREWALL
              </text>
            </g>

            {/* Public Internet Node */}
            <g>
              <rect
                x="734"
                y="46"
                width="144"
                height="58"
                rx="6"
                fill="#111722"
                stroke="#263144"
                strokeWidth="1.25"
              />
              <text x="746" y="66" fill="#E2E8F0" fontSize="11.5" fontWeight="600" fontFamily="Plus Jakarta Sans, sans-serif">
                Internet / WAN
              </text>
              <text x="746" y="81" fill="#94A3B8" fontSize="10" fontFamily="JetBrains Mono, monospace">
                8.8.8.8 · Portals
              </text>
              <text x="746" y="95" fill={isCase1 && !gwValid ? '#F87171' : '#94A3B8'} fontSize="9.5" fontFamily="JetBrains Mono, monospace">
                {isCase1 && !gwValid ? 'UNREACHABLE' : 'EXTERNAL ROUTES'}
              </text>
            </g>

            {/* === BOTTOM ROW NODES === */}
            {/* Active Workstation (Cases 1–4 & Demo) */}
            {!targetIsCoreServer && (
              <g onClick={() => setSelectedNodeId('target')} className="cursor-pointer">
                <rect
                  x="54"
                  y="146"
                  width="150"
                  height="56"
                  rx="6"
                  fill="#172030"
                  stroke={
                    selectedNodeId === 'target'
                      ? '#F59E0B'
                      : nodes.target.tone === 'alert'
                      ? '#EF4444'
                      : '#10B981'
                  }
                  strokeWidth="2"
                />
                <text x="66" y="165" fill="#F8FAFC" fontSize="11.5" fontWeight="600" fontFamily="Plus Jakarta Sans, sans-serif">
                  {m.hostname}
                </text>
                <text x="66" y="180" fill="#FBBF24" fontSize="10.5" fontFamily="JetBrains Mono, monospace">
                  {m.ipAddress}
                </text>
                <text
                  x="66"
                  y="194"
                  fill={nodes.target.tone === 'alert' ? '#F87171' : '#34D399'}
                  fontSize="9.5"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {nodes.target.tone === 'alert' ? 'FAULT DETECTED' : 'NOMINAL'}
                </text>
              </g>
            )}

            {/* Dispatch Printer (.80) in Case 2 & Demo */}
            {(isCase2 || isDemo) && (
              <g onClick={() => setSelectedNodeId('printer')} className="cursor-pointer">
                <rect
                  x="246"
                  y="146"
                  width="126"
                  height="56"
                  rx="6"
                  fill="#131A26"
                  stroke={selectedNodeId === 'printer' ? '#F59E0B' : '#2E3B52'}
                  strokeWidth="1.25"
                />
                <text x="256" y="165" fill="#F8FAFC" fontSize="11" fontWeight="600" fontFamily="Plus Jakarta Sans, sans-serif">
                  PRN-DSP-01
                </text>
                <text x="256" y="180" fill="#94A3B8" fontSize="10" fontFamily="JetBrains Mono, monospace">
                  192.168.10.80
                </text>
                <text x="256" y="194" fill="#34D399" fontSize="9.5" fontFamily="JetBrains Mono, monospace">
                  REACHABLE
                </text>
              </g>
            )}

            {/* Case 1 Phantom Gateway (.254) when not yet repaired */}
            {isCase1 && !gwValid && !rogueDiscovered && (
              <g>
                <rect
                  x="494"
                  y="146"
                  width="150"
                  height="56"
                  rx="6"
                  fill="#191116"
                  stroke="#EF4444"
                  strokeWidth="1.25"
                  strokeDasharray="4 4"
                />
                <text x="506" y="165" fill="#FCA5A5" fontSize="11" fontWeight="600" fontFamily="Plus Jakarta Sans, sans-serif">
                  Configured GW
                </text>
                <text x="506" y="180" fill="#F87171" fontSize="10.5" fontFamily="JetBrains Mono, monospace">
                  192.168.10.254
                </text>
                <text x="506" y="194" fill="#F87171" fontSize="9.5" fontFamily="JetBrains Mono, monospace">
                  NO HOST / TIMEOUT
                </text>
              </g>
            )}

            {/* Rogue Host MAINT-NODE-04 (.214) — revealed ONLY once discovered */}
            {rogueDiscovered && !isDemo && (
              <g onClick={() => setSelectedNodeId('rogue')} className="cursor-pointer">
                <rect
                  x="494"
                  y="146"
                  width="150"
                  height="56"
                  rx="6"
                  fill={m.firewallBlockedIps.includes('192.168.10.214') ? '#131822' : '#1E1117'}
                  stroke={
                    selectedNodeId === 'rogue'
                      ? '#F59E0B'
                      : m.firewallBlockedIps.includes('192.168.10.214')
                      ? '#475569'
                      : '#EF4444'
                  }
                  strokeWidth="1.75"
                />
                <text x="506" y="165" fill="#FCA5A5" fontSize="11" fontWeight="600" fontFamily="Plus Jakarta Sans, sans-serif">
                  {unlockedCaseNumbers.includes(5) || isCase6 || ev.includes('c5-ev-manifest')
                    ? 'MAINT-NODE-04'
                    : 'Unknown Host'}
                </text>
                <text x="506" y="180" fill="#F87171" fontSize="10.5" fontFamily="JetBrains Mono, monospace">
                  192.168.10.214
                </text>
                <text
                  x="506"
                  y="194"
                  fill={m.firewallBlockedIps.includes('192.168.10.214') ? '#94A3B8' : '#F87171'}
                  fontSize="9.5"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {m.firewallBlockedIps.includes('192.168.10.214') ? 'BLOCKED' : 'PORT 24 · ROGUE'}
                </text>
              </g>
            )}

            {/* External Relay (203.0.113.47) — revealed ONLY once discovered */}
            {relayDiscovered && !isDemo && (
              <g onClick={() => setSelectedNodeId('relay')} className="cursor-pointer">
                <rect
                  x="734"
                  y="146"
                  width="144"
                  height="56"
                  rx="6"
                  fill={m.firewallBlockedIps.includes('203.0.113.47') ? '#131822' : '#1E1117'}
                  stroke={
                    selectedNodeId === 'relay'
                      ? '#F59E0B'
                      : m.firewallBlockedIps.includes('203.0.113.47')
                      ? '#475569'
                      : '#EF4444'
                  }
                  strokeWidth="1.5"
                />
                <text x="746" y="165" fill="#FCA5A5" fontSize="11" fontWeight="600" fontFamily="Plus Jakarta Sans, sans-serif">
                  External Relay
                </text>
                <text x="746" y="180" fill="#F87171" fontSize="10" fontFamily="JetBrains Mono, monospace">
                  203.0.113.47:443
                </text>
                <text
                  x="746"
                  y="194"
                  fill={m.firewallBlockedIps.includes('203.0.113.47') ? '#94A3B8' : '#F87171'}
                  fontSize="9.5"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {m.firewallBlockedIps.includes('203.0.113.47') ? 'BLOCKED' : '10:00 UPLOAD TARGET'}
                </text>
              </g>
            )}
          </svg>
        </div>

        {/* Interactive Selected Node Inspector Strip */}
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-[#1A2232] pt-2.5 font-mono text-xs">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-semibold text-amber-400">{selected.label}</span>
            <span className="text-[#CBD5E1]">{selected.ip}</span>
            <span aria-hidden="true" className="text-[#475569]">·</span>
            <span className="text-[#94A3B8]">MAC: {selected.mac}</span>
            <span aria-hidden="true" className="text-[#475569]">·</span>
            <span className="text-[#94A3B8]">{selected.role}</span>
          </div>
          <span
            className={
              selected.tone === 'alert'
                ? 'font-medium text-red-400'
                : selected.tone === 'healthy'
                ? 'font-medium text-emerald-400'
                : 'text-[#94A3B8]'
            }
          >
            {selected.status}
          </span>
        </div>
      </div>
    </section>
  );
}
