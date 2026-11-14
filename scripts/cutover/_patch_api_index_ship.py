from pathlib import Path
import subprocess
import sys

repo = Path(__file__).resolve().parents[2]
out = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/tmp/api-index-ship.ts")

clean = subprocess.check_output(
    ["git", "show", "01cdaab:v2/apps/api/src/index.ts"],
    cwd=repo,
).decode("utf-8")
new = (repo / "v2/apps/api/src/index.ts").read_text(encoding="utf-8")

if "quoteNight" not in clean:
    needle = "pickShiftForPunch,\n} from \"@hos-v2/domain\";"
    repl = "pickShiftForPunch,\n  quoteNight,\n} from \"@hos-v2/domain\";"
    if needle not in clean:
        needle = "pickShiftForPunch,\r\n} from \"@hos-v2/domain\";"
        repl = "pickShiftForPunch,\r\n  quoteNight,\r\n} from \"@hos-v2/domain\";"
    if needle not in clean:
        raise SystemExit("could not find domain import for quoteNight")
    clean = clean.replace(needle, repl, 1)

marker = "  // Agency room+meal must hydrate onto desk master bill"
start = new.find("  const mapLines = (")
end = new.find(marker, start)
old_start = clean.find("  const mapLines = (")
old_end = clean.find(marker, old_start)
if min(start, end, old_start, old_end) < 0:
    raise SystemExit(f"mapLines markers missing: {start, end, old_start, old_end}")

clean = clean[:old_start] + new[start:end] + clean[old_end:]
out.write_text(clean, encoding="utf-8", newline="\n")
print(f"wrote {out} bytes={out.stat().st_size}")
print("agency-org", "agency-org" in clean)
print("auth-unified", "auth-unified" in clean)
print("quoteNight", "quoteNight" in clean)
print("taxRates", "taxRates" in clean)
