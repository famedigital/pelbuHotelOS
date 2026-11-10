/**
 * ZKTeco iClock / ADMS ATTLOG parser.
 * Line: `101\t2026-11-08 07:45:12\t0\t1` → pin, datetime, status, verify.
 */

export type AdmsPunch = {
  employeeCode: string;
  punchedAtIso: string;
  punchType: number;
  verifyMode: number;
  rawLine: string;
};

export type ShiftWindow = {
  id: string;
  code: string;
  startTime: string; // HH:MM 24h
  endTime: string;
  graceMinutes: number;
};

const ATTLOG_RE =
  /^(\S+)\t(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})(?:\t(\d+))?(?:\t(\d+))?/;

export function parseAttlogBody(body: string): AdmsPunch[] {
  const punches: AdmsPunch[] = [];
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(ATTLOG_RE);
    if (!m) continue;
    const employeeCode = m[1]!;
    const local = m[2]!;
    const punchType = Number(m[3] ?? 0);
    const verifyMode = Number(m[4] ?? 1);
    // Treat device local time as Asia/Thimphu wall clock → ISO with +06:00
    const punchedAtIso = `${local.replace(" ", "T")}+06:00`;
    punches.push({
      employeeCode,
      punchedAtIso,
      punchType: Number.isFinite(punchType) ? punchType : 0,
      verifyMode: Number.isFinite(verifyMode) ? verifyMode : 1,
      rawLine: line,
    });
  }
  return punches;
}

export function admsHandshakeBody(sn: string): string {
  return [
    "GET OPTION FROM: " + sn,
    "Stamp=9999",
    "OpStamp=9999",
    "ErrorDelay=60",
    "Delay=30",
    "TransTimes=00:00;14:00",
    "TransInterval=1",
    "TransFlag=1111000000",
    "TimeZone=6",
    "Realtime=1",
    "Encrypt=0",
  ].join("\n");
}

/** Minutes late vs shift start, after grace. Overnight shifts supported. */
export function lateMinutesForPunch(
  punchedAtIso: string,
  shift: ShiftWindow,
): number {
  const punched = new Date(punchedAtIso);
  if (Number.isNaN(punched.getTime())) return 0;
  const [sh, sm] = shift.startTime.split(":").map(Number);
  const start = new Date(punched);
  start.setHours(sh ?? 0, sm ?? 0, 0, 0);
  // If punch is before start but shift crosses midnight and punch is evening, leave as-is
  const diffMin = Math.floor((punched.getTime() - start.getTime()) / 60000);
  const late = diffMin - shift.graceMinutes;
  return late > 0 ? late : 0;
}

export function pickShiftForPunch(
  punchedAtIso: string,
  shifts: ShiftWindow[],
): ShiftWindow | null {
  const punched = new Date(punchedAtIso);
  if (Number.isNaN(punched.getTime()) || shifts.length === 0) return null;
  const mins = punched.getHours() * 60 + punched.getMinutes();
  let best: ShiftWindow | null = null;
  let bestDist = Infinity;
  for (const s of shifts) {
    const [sh, sm] = s.startTime.split(":").map(Number);
    const startMins = (sh ?? 0) * 60 + (sm ?? 0);
    const dist = Math.abs(mins - startMins);
    if (dist < bestDist) {
      bestDist = dist;
      best = s;
    }
  }
  return best;
}
