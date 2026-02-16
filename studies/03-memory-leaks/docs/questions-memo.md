# Questions Memo (for Study 03 Report Writing)

This memo summarizes the key questions raised during development of Study 03 (Memory Leak Epidemic in React/Vue/Angular Apps). Use it as a checklist for what the report must explain and justify.

## Research logic and end-to-end pipeline

- What is the complete research logic end-to-end (static scan -> issue taxonomy -> benchmark design -> interpretation of results)?
- How do the benchmarks connect to the issues found in scanned data (i.e., how do detected issue types map to benchmark scenarios)?

## Measurement validity and methodology

- Can `process.memoryUsage().heapUsed` be measured correctly for this purpose?
- What measurement method do we use (snapshots, forced GC, growth computation)?
- Do we use the same detectors as in Code Evolution Lab, and if not, what are the differences and why?
- Are we fulfilling the stated research objectives for the benchmark step (including “rate” and “budget” framing)?

## Benchmark scenario coverage and representativeness

- Have our benchmark scenarios covered all issue types detected by the scan?
- For issue types that were missing, can/should we design benchmark scenarios for them?

## Parameter justification (allocation sizes / calibration)

- Why do we assign a fixed-size array payload in scenarios?
- How is the payload size decided, and what is the justification?
- Can we design a preliminary calibration experiment to pick a small set of sizes to support rate/budget framing?

## Practical significance and thresholds

- In most real-world scenarios, can memory leaks be ignored because the leak size is small?
- What leak size / growth rate / ratio tends to cause trouble on real operating systems (desktop vs mobile)?
- Can we cite research or credible sources about memory pressure thresholds and failure modes?

## Fundamental correctness concerns

- If benchmarks produce counterintuitive results (e.g., BAD ≤ GOOD, negative growth), is our research methodology or harness logic incorrect?
- If so, how do we diagnose from first principles and fix the benchmark harness so that BAD shows retained heap growth while GOOD stays stable?

## Conceptual framing: GC vs “memory leaks”

- Since React/Vue/Angular run in garbage-collected runtimes, does that make a memory leak study useless?
- How should the report explain that GC only collects unreachable objects, and most frontend leaks are unintended retention via long-lived references?
