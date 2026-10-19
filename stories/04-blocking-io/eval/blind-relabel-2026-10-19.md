# Second labeller, blind (2026-10-19)

## Setup

- 144 locations, seed 20261019: every location labelled `tp` or `unsure` (84) plus 60 drawn at random from the rest.
- Order shuffled and ids replaced with B001-B144. Labels are in `eval/second-labeller-2026-10-19.tsv`; the B-to-L key is in its `id` column.
- Two agent runs of 72 items each, with the same prompt and the same inputs: `criteria.md` without the Study 02 context section, the code, and checkouts at the pinned commits.
- The labellers saw no first-pass labels, notes, Study 02 context or core-engine severity.
- The set over-represents `tp` by design, so the agreement figures describe the hard cases, not the population.

## Agreement

| Level | Agreement | Cohen's kappa |
|---|---|---|
| Six labels | 81.3% | 0.73 |
| tp / unsure / fp | 81.9% | 0.71 |
| tp vs not tp | **93.8%** | **0.86** |

Rows are the first labels; columns are the second labeller's.

| | tp | unsure | fp |
|---|---|---|---|
| **tp** | 47 | 4 | 3 |
| **unsure** | 2 | 11 | 17 |
| **fp** | 0 | 0 | 60 |

None of the 60 random fp locations came back as `tp`.

## The 26 disagreements, by kind

1. **unsure vs fp: library and vendored code (17).** These are shelljs (6), nock, yarn fslib and the PnP loader (5), compiled bundles in Next.js, and the Budibase isolate bundle. Both labellers agree they are not `tp`, so the estimate does not move; only the upper bound does.
2. **The second labeller traced further, and was right (7).** These were adopted:
   - L603: the documenso signer is memoised in `signing/index.ts:21`, so the label is `fp-once`. This was a first-pass error.
   - L079: pm2 `which` reaches `lib/API.js`, the CLI client, so the label is `fp-tooling`.
   - L060: the Budibase offline license is cached by `cache.ts:37`, so the label is `fp-once`.
   - L332: the uuid rng runs inside the isolated-vm sandbox and uses a crypto shim, so the label is `fp-not-blocking`.
   - L265: the image-size file branch is unreachable from a buffer, so the label is `fp-not-blocking`.
   - L243: the compiled tar is used by `download-swc`, so the label is `fp-tooling`.
   - L381: nock is a test-only library, so the label is `fp-tooling`.
3. **How the two-level rule is counted (5).**
   - The first labels used three levels for L769, L634, L432 and L561 (`tp`); the second labeller used two strictly (`unsure`).
   - The reverse happened for L104: the second labeller followed four levels to a `setInterval` (`tp`).
4. **Disagreements that need a decision from you (2).**
   - L037: atom loads stylesheets at package activation and again on theme change.
   - L750: the n8n log writer runs in a dedicated `worker_threads` thread.
5. **The second labeller missed a call (1).** For L351, directus `requireText` is called inside the tool handler at `ai/tools/system/index.ts:26`, not only at module top level. It stays `tp`.

## Effect on the estimates

| Scenario | Study 02 | core-engine |
|---|---|---|
| Current labels | 340 (CI 191-489), upper 1,002 | 584 (CI 279-890), upper 910 |
| With kind 2 adopted | 340 (191-489), upper 877 | 563 (260-866), upper 888 |
| ... and strict two levels | 340 (191-489), upper 877 | 465 (184-745), upper 888 |
| ... and following any depth to an entry | 378 (213-543), upper 877 | 563 (260-866), upper 888 |

Every scenario's interval overlaps the current one. The `tp`-or-not judgement is stable (kappa 0.86); what moves the number is the depth rule.
