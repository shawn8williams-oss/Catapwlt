export interface ColleagueMessage {
  id: string;
  scenarioId: string;
  sender: string;
  role: string;
  time: string;
  text: string;
  trigger: 'start' | 'repaired' | 'verified' | `evidence:${string}`;
}

export const COLLEAGUE_MESSAGES: ColleagueMessage[] = [
  // Demo Sandbox
  {
    id: 'msg-demo-1',
    scenarioId: 'demo-sandbox',
    sender: 'Sarah Jenkins',
    role: 'IT Operations Manager',
    time: '08:40',
    text: 'Use this sandbox host to warm up before the live queue. Check the local Print Spooler service and test reachability to printer 192.168.10.80.',
    trigger: 'start',
  },

  // Case 1
  {
    id: 'msg-c1-1',
    scenarioId: 'case-1',
    sender: 'Sarah Jenkins',
    role: 'IT Operations Manager',
    time: '08:48',
    text: 'Morning! Reception logged the first ticket of the day—probably a straightforward IP or routing setting. Check WS-REC-01 when you are ready.',
    trigger: 'start',
  },
  {
    id: 'msg-c1-2',
    scenarioId: 'case-1',
    sender: 'Hannah Patel',
    role: 'Front Desk & Reception',
    time: '08:50',
    text: 'Wait—you found a log saying someone changed my PC at 23:41 on Sunday night? Nobody from Reception has weekend access to the office.',
    trigger: 'evidence:c1-ev-log',
  },
  {
    id: 'msg-c1-3',
    scenarioId: 'case-1',
    sender: 'Hannah Patel',
    role: 'Front Desk & Reception',
    time: '08:52',
    text: 'The courier booking portal just loaded again—thank you! Still feels weird that my settings changed over the weekend.',
    trigger: 'verified',
  },

  // Case 2
  {
    id: 'msg-c2-1',
    scenarioId: 'case-2',
    sender: 'David Okafor',
    role: 'Warehouse Dispatch',
    time: '08:55',
    text: 'Lorries are waiting on dispatch notes! Strangely the label printer right next to me (192.168.10.80) still prints fine, I just cannot hit the ERP server or gateway.',
    trigger: 'start',
  },
  {
    id: 'msg-c2-2',
    scenarioId: 'case-2',
    sender: 'Sarah Jenkins',
    role: 'IT Operations Manager',
    time: '08:59',
    text: 'Hold on… MERIDIAN\\m.halvorsen? Martin Halvorsen finished his IT contract Friday at 5pm. Why is his account running remote netsh commands from 192.168.10.214 at 02:14am?',
    trigger: 'evidence:c2-ev-log',
  },

  // Case 3
  {
    id: 'msg-c3-1',
    scenarioId: 'case-3',
    sender: 'Claire Bennett',
    role: 'Senior Finance Accountant',
    time: '09:06',
    text: 'I need the Q4 tariff ledger before 10am and none of the company hostnames work. Also, when I tried files.meridian.local earlier, Edge threw a weird certificate error.',
    trigger: 'start',
  },
  {
    id: 'msg-c3-2',
    scenarioId: 'case-3',
    sender: 'Sarah Jenkins',
    role: 'IT Operations Manager',
    time: '09:11',
    text: '192.168.10.214 again?! That IP is not on our asset register. Someone deliberately pointed Finance DNS and the hosts file at it at 02:38am. Clean WS-FIN-03 and look at HR immediately after.',
    trigger: 'evidence:c3-ev-hosts',
  },

  // Case 4
  {
    id: 'msg-c4-1',
    scenarioId: 'case-4',
    sender: 'Priya Nair',
    role: 'HR & Payroll Manager',
    time: '09:19',
    text: 'My account is acting completely wrong—Access Denied on C:\\Payroll_Exports even though I am in HR-Payroll, and Meridian Audit Sync will not start.',
    trigger: 'start',
  },
  {
    id: 'msg-c4-2',
    scenarioId: 'case-4',
    sender: 'Priya Nair',
    role: 'HR & Payroll Manager',
    time: '09:23',
    text: 'Wait—Martin Halvorsen’s domain account is STILL ACTIVE?! I sent IT his offboarding notice Friday afternoon, and now the logs show him on my PC at 03:04am!',
    trigger: 'evidence:c4-ev-user',
  },

  // Case 5
  {
    id: 'msg-c5-1',
    scenarioId: 'case-5',
    sender: 'Sarah Jenkins',
    role: 'IT Operations Manager',
    time: '09:33',
    text: 'Drop routine tickets—SRV-FILE01 is showing sustained outbound traffic right now. Inspect active sockets, correlate the PID, and check what is leaving the server.',
    trigger: 'start',
  },
  {
    id: 'msg-c5-2',
    scenarioId: 'case-5',
    sender: 'Sarah Jenkins',
    role: 'IT Operations Manager',
    time: '09:38',
    text: 'An external upload to 203.0.113.47 queued for 10:00am?! Stop that rogue service and block 192.168.10.214 right now—I am sending Security straight to Comms Room Switch Port 24.',
    trigger: 'evidence:c5-ev-manifest',
  },

  // Case 6
  {
    id: 'msg-c6-1',
    scenarioId: 'case-6',
    sender: 'Sarah Jenkins',
    role: 'IT Operations Manager',
    time: '09:48',
    text: 'Security just confirmed an unlabelled mini-PC (MAINT-NODE-04) plugged into Switch Port 24. Do not pull the cable until you audit DC-CORE-01 and clear every persistence layer he left behind.',
    trigger: 'start',
  },
  {
    id: 'msg-c6-2',
    scenarioId: 'case-6',
    sender: 'Sarah Jenkins',
    role: 'IT Operations Manager',
    time: '09:52',
    text: 'Huge catch on MeridianNightlyPush—if we had only disabled m.halvorsen, that 10:00am task would have re-enabled his account automatically! Clear all three layers: account, persistence, and network.',
    trigger: 'evidence:c6-ev-persist',
  },
  {
    id: 'msg-c6-3',
    scenarioId: 'case-6',
    sender: 'Sarah Jenkins',
    role: 'IT Operations Manager',
    time: '09:57',
    text: 'All three containment layers verified clean on DC-CORE-01. Security just disconnected Port 24—zero files reached 203.0.113.47. Outstanding diagnostic work today.',
    trigger: 'verified',
  },
];

export function getUnlockedMessages(
  scenarioId: string,
  discoveredEvidenceIds: string[],
  allRepairsDone: boolean,
  allVerified: boolean
): ColleagueMessage[] {
  return COLLEAGUE_MESSAGES.filter((msg) => {
    if (msg.scenarioId !== scenarioId) return false;
    if (msg.trigger === 'start') return true;
    if (msg.trigger === 'repaired') return allRepairsDone;
    if (msg.trigger === 'verified') return allVerified;
    if (msg.trigger.startsWith('evidence:')) {
      const evId = msg.trigger.slice('evidence:'.length);
      return discoveredEvidenceIds.includes(evId);
    }
    return false;
  });
}
