# Kibana Case Study

This folder contains helper scripts for the Kibana case study referenced in the large payloads research plan.

## Files

- `types.ts` — shared type definitions for Kibana findings and git metadata.
- `kibana-enrich.ts` — enriches detector findings with Kibana package and layer metadata.
- `scan-kibana.ts` — scans a local Kibana repo with the existing payload detector and writes enriched findings.
- `analyze-findings.ts` — summarizes findings by pattern, severity, layer, package, and test coverage.
- `git-temporal.ts` — attaches Git blame metadata for each finding, useful for temporal origin analysis.

## Usage

Run from the study root using `ts-node`:

```bash
node -r ts-node/register src/kibana-case-study/scan-kibana.ts --repo /path/to/kibana --out results/kibana-findings.json
node -r ts-node/register src/kibana-case-study/analyze-findings.ts --input results/kibana-findings.json --out results/kibana-findings-summary.json
node -r ts-node/register src/kibana-case-study/git-temporal.ts --repo /path/to/kibana --input results/kibana-findings.json --out results/kibana-findings-git.json
```

## Notes

- The scan script reuses the existing Study 09 AST detector in `src/step3-static-analysis/detector/payload-detector.ts`.
- The package mapper is optimized for Kibana monorepo package layouts such as `x-pack/plugins/*`, `src/plugins/*`, and `packages/*`.
- The git temporal reporter uses `git blame --line-porcelain` to capture the commit that last touched each finding line.
