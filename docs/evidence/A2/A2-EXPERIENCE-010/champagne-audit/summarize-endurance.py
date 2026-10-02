"""Summarize observed browser samples; do not turn them into device acceptance."""
import json
from pathlib import Path
import re
from statistics import median
import sys

report_path = Path(sys.argv[1])
report = json.loads(report_path.read_text(encoding="utf-8"))
samples = report["samples"]
frame_windows = [row["rafMeanMs"] for row in samples if row["rafMeanMs"] > 0]
heaps = [row["heap"] / 1024**2 for row in samples]
underruns = [int(match.group(1)) for row in samples
             if (match := re.search(r"补缓冲 (\d+) 次", row["status"]))]
buffers = [float(match.group(1)) for row in samples
           if (match := re.search(r"缓冲 ([\d.]+) s", row["status"]))]
summary = {
    "source": str(report_path),
    "hardware": report["hardware"],
    "checks": report["checks"],
    "wallSeconds": samples[-1]["wallSeconds"],
    "sampleCount": len(samples),
    "distinctRuns": len({row["run"] for row in samples}),
    "observedMaxAudioUnderruns": max(underruns, default=None),
    "observedBufferRangeSeconds": [min(buffers), max(buffers)] if buffers else None,
    "rafWindowMeanMsRange": [min(frame_windows), max(frame_windows)],
    "rafWindowMeanMsMedian": median(frame_windows),
    "rafWindowRateRangeHz": [1000 / max(frame_windows), 1000 / min(frame_windows)],
    "rafWindowP95MsMax": max(row["rafP95Ms"] for row in samples),
    "heapMiBRange": [min(heaps), max(heaps)],
    "heapMiBFirstLast": [heaps[0], heaps[-1]],
    "heapMiBFirstLastFiveMedian": [median(heaps[:5]), median(heaps[-5:])],
    "pageErrors": report["errors"],
    "resourceFailures": report["failures"],
    "limits": [
        "Headless Chrome on the reported GPU; not a target integrated-GPU signoff.",
        "Every 30 seconds, RAF statistics cover the most recent 1800 frames. Windows overlap.",
        "RAF scheduling is a frame-cadence proxy, not GPU render timing or exact whole-session FPS.",
        "Heap samples include garbage collection; they do not prove absence of all memory leaks.",
        "Software audio queue observations do not replace physical audio/video synchronization checks.",
    ],
}
print(json.dumps(summary, ensure_ascii=False, indent=2))
