# Scan Results Summary

Two scans are recorded here: the first run of the N+1 Query Detector against three
real codebases, and the run after seven rounds of fixing what that first run
exposed. Raw JSON output for both is in this folder, along with the expanded-corpus
results in `expanded-corpus/`.

Every number below was recomputed from the raw JSON in this folder on 2026-09-19.
Severity and impact figures are the detector's own output, not an estimate of what
the source code does across nested loops.

| | Before | After |
|---|---|---|
| Raw findings (3 repos) | 78 | 42 |
| Matched a verified genuine location | 31 | 42 |
| False positives | 47 | 0 |
| False-positive rate | **60.3%** | **0.0%** |
| Genuine locations missed | 11 | 0 |
| Recall against verified truth | 73.8% | 100% |

Both columns are scored against the same verified ground truth
(`../eval/labels.json`): 42 loop locations across the three repositories where a
real per-item database or repository call happens, each confirmed by reading the
source. The scoring script is `../eval/score.js`, so these numbers can be
recomputed from the raw JSON without trusting this table.

One wrinkle worth stating, because it is easy to misread the per-repository counts
below: `score.js` counts true positives as *findings that land on a labelled
location*, while it counts misses as *labelled locations nobody reported*. The two
happen to agree here (no labelled location was reported twice), so 31 + 11 = 42.

The before column's 73.8% recall is not a typo. The original detector didn't just
report things that weren't there — it also missed 11 genuine N+1 patterns, because
it never looked at write calls (`update`, `upsert`, `create`) at all.

## Files in this folder

- `outline-outline.json`, `calcom-cal.com.json`, `immich-immich.json` — current
  (post-fix) scan output, including the CLI's generated fix for every finding.
- `baseline/*.json` — the original pre-fix scan output, kept so the comparison is
  checkable rather than asserted.

## Severity distribution (post-fix)

No finding in any of the three repositories is reported as CRITICAL, and none is
reported as LOW.

| Repository | Critical | High | Medium | Low | Total |
|---|---:|---:|---:|---:|---:|
| outline/outline | 0 | 9 | 18 | 0 | 27 |
| calcom/cal.com | 0 | 0 | 7 | 0 | 7 |
| immich-app/immich | 0 | 1 | 7 | 0 | 8 |

HIGH corresponds to two per-item queries in one loop (201 queries at N=100); MEDIUM
to one (101 queries at N=100).

## outline/outline (Sequelize) — `server/{routes,commands,presenters,queues,policies,services}`, 334 files

27 findings, all genuine. The pre-fix scan reported 38, of which 25 landed on a
genuine location and 13 were false positives; it missed 2.

The dominant pattern is unchanged and is what makes this repository the flagship
case: Outline's notification pipeline fans out one background job per event
(comment posted, document published, revision created, mention added), and each
job resolves "who should be notified" by looping over recipients, mentions, or
group members and calling `findByPk()` / `findAll()` once per entry.

All nine HIGH findings:

| Severity | File : line | Pattern | Impact at 100 items |
|---|---|---|---|
| HIGH | `commands/groupsSyncer.ts:52` | `ExternalGroup.findOrCreate` + `findByPk` per synced group | 201 queries vs 1 |
| HIGH | `queues/tasks/RevisionCreatedNotificationsTask.ts:108` | `findByPk` + `findAll` per mentioned group | 201 queries vs 1 |
| HIGH | `queues/tasks/DocumentPublishedNotificationsTask.ts:73` | same two-query pattern | 201 queries vs 1 |
| HIGH | `queues/tasks/InviteReminderTask.ts:23` | two `User.findByPk` in a transaction per invited user | 201 queries vs 1 |
| HIGH | `queues/tasks/ExportJSONTask.ts:100` | `Document.findByPk` + `Attachment.findAll` per exported node | 201 queries vs 1 |
| HIGH | `queues/processors/WebsocketsProcessor.ts:544` | two `findByPk` per group member | 201 queries vs 1 |
| HIGH | `queues/processors/BacklinksProcessor.ts:27` | `Document.findByPk` + `findOne` per linked document id | 201 queries vs 1 |
| HIGH | `queues/processors/BacklinksProcessor.ts:77` | same | 201 queries vs 1 |
| HIGH | `routes/api/documents/documents.ts:140` | `Document.findByPk` + `findOne` per document id in an API response | 201 queries vs 1 |

The 18 MEDIUM findings, each one per-item query (101 queries vs 1):

| File : line | Query |
|---|---|
| `commands/documentPermanentDeleter.ts:28` | `Attachment.findAll` per purged document |
| `queues/tasks/UploadAttachmentsForImportTask.ts:29` | `findByPk` |
| `queues/tasks/UpdateDocumentsPopularityScoreTask.ts:505` | raw SQL `query()` |
| `queues/tasks/RollupWeeklyDocumentInsightsTask.ts:49` | raw SQL `query()` |
| `queues/tasks/RevokeUserNotificationsTask.ts:90` | `findByPk` |
| `queues/tasks/RevisionCreatedNotificationsTask.ts:56` / `:127` | `findByPk` per mention or recipient |
| `queues/tasks/DocumentPublishedNotificationsTask.ts:32` / `:92` | `findByPk` per mention or recipient |
| `queues/tasks/CommentUpdatedNotificationsTask.ts:46` / `:80` / `:141` | `findByPk` per mention or recipient |
| `queues/tasks/CommentCreatedNotificationsTask.ts:53` / `:90` | `findByPk` per mention or recipient |
| `queues/processors/WebsocketsProcessor.ts:823` / `:886` | `Collection.findByPk` per group membership |
| `queues/processors/ImportsProcessor.ts:400` | `findAll` per imported item |
| `routes/api/groups/groups.ts:169` | `GroupUser.findAll` per group |

Newly surfaced by the fix (reported by neither the pre-fix scan nor anything
before it): `UpdateDocumentsPopularityScoreTask.ts:505` and
`RollupWeeklyDocumentInsightsTask.ts:49`. The other locations added to
`labels.json` after the baseline was written — `WebsocketsProcessor.ts:823`,
`ImportsProcessor.ts:400`, `groups.ts:169` — were in the pre-fix output already;
they were added to the label file later, during verification, not surfaced by the
fix.

## calcom/cal.com (Prisma) — `packages/trpc`, 398 files

7 findings, all genuine. The pre-fix scan reported 22, of which 3 landed on a
genuine location and 19 were false positives; it missed 4 — the worst
signal-to-noise of the three, and the repository that drove most of the fixes.

| Severity | File : line | Pattern | Impact at 100 items |
|---|---|---|---|
| MEDIUM | `viewer/bookings/get.handler.ts:748` | `prisma.booking.findUnique()` per booking, resolving its reschedule source | 101 queries vs 1 |
| MEDIUM | `viewer/apps/queryForDependencies.handler.ts:21` | `prisma.credential.findFirst()` per app dependency | 101 queries vs 1 |
| MEDIUM | `viewer/apps/toggle.handler.ts:122` | `prisma.eventType.update()` per event type while disabling an app | 101 queries vs 1 |
| MEDIUM | `loggedInViewer/eventTypeOrder.handler.ts:56` | `prisma.eventType.update()` per id, to persist ordering | 101 queries vs 1 |
| MEDIUM | `viewer/slots/reserveSlot.handler.ts:83` | `prisma.selectedSlots.upsert()` per assigned user | 101 queries vs 1 |
| MEDIUM | `viewer/me/updateProfile.handler.ts:369` | `prisma.secondaryEmail.update()` per modified record | 101 queries vs 1 |
| MEDIUM | `viewer/eventTypes/heavy/update.handler.ts:434` | `tx.hostGroup.update()` per group, sequentially inside one transaction | 101 queries vs 1 |

Four of these seven were invisible before the fix. The last one is the most
telling: the loop runs one `UPDATE` per group, and the very next block in the same
function uses `deleteMany` — the codebase already knows the batch form, it just
isn't used on the update path.

## immich-app/immich (Kysely + custom repositories) — `server/src/{services,repositories,controllers,workers,commands}`, 172 files

8 findings, all genuine. The pre-fix scan reported 18, of which 3 landed on a
genuine location and 15 were false positives; it missed 5.

| Severity | File : line | Pattern | Impact at 100 items |
|---|---|---|---|
| HIGH | `services/album.service.ts:292` | `userRepository.get()` + `albumUserRepository.create()` per invited user | 201 queries vs 1 |
| MEDIUM | `services/person.service.ts:155` | `personRepository.update()` per person whose feature photo changes | 101 queries vs 1 |
| MEDIUM | `services/media.service.ts:92` | `personRepository.update()` per person, inside a batched outer loop | 101 queries vs 1 |
| MEDIUM | `repositories/asset.repository.ts:441` | `deleteBulkMetadata()` runs one `DELETE` per item in its own loop | 101 queries vs 1 |
| MEDIUM | `services/album.service.ts:104` | `userRepository.get()` per user being added to an album | 101 queries vs 1 |
| MEDIUM | `services/album.service.ts:226` | `albumRepository.getAssetIds()` per album | 101 queries vs 1 |
| MEDIUM | `services/person.service.ts:617` | `personRepository.update()` per merged person | 101 queries vs 1 |
| MEDIUM | `services/memory.service.ts:59` | `memoryRepository.create()` per generated memory | 101 queries vs 1 |

`person.service.ts:155` and `media.service.ts:92` both also call
`personRepository.getRandomFace()` in the same loop, but the detector attributes
one query to each of these locations, not two — hence MEDIUM rather than HIGH.

## Expanded corpus

After the fix was finished, the 20 candidates from the original pool that had never
been scanned properly were scoped and scanned with both detector versions. 341
findings became 148, of which 147 were confirmed genuine by hand. The one that was
not — `keystonejs/keystone`'s fallback chain over candidate database connections —
is documented in `expanded-corpus/README.md`; it is kept in the raw JSON because
that is what the scan reported, and excluded from the genuine count. That makes
this pass 0.7%, not 0%. The pass drove three further rounds of fixes; full detail
in `expanded-corpus/`. The per-repository counts are in
`expanded-corpus/scan-counts.tsv` and sum to 341, 148 and 5,862 files.

## Held-out validation

The three repositories above were used while fixing the detector, so their 0%
false-positive rate is measured on data the fix was tuned against. To check the
fix generalises, the same before/after comparison was run on five repositories
that were never used during tuning and never inspected while writing the rules:

| Repository | Findings before | Findings after | Genuine after | False positives after |
|---|---:|---:|---:|---:|
| toeverything/AFFiNE | 26 | 11 | 11 | 0 |
| twentyhq/twenty | 18 | 9 | 9 | 0 |
| civitai/civitai | 18 | 2 | 2 | 0 |
| novuhq/novu | 30 | 1 | 1 | 0 |
| medusajs/medusa | 3 | 0 | 0 | 0 |
| **Total** | **95** | **23** | **23** | **0** |

The "after" column is verified against the JSON in `held-out/`. The "before"
column is reported from the original run; no pre-fix JSON for these five
repositories is kept in this folder.

Across all three passes — 3 study repositories, 5 held-out, 20 expanded — the fixed
detector reported 213 findings, 212 of which are genuine, against 514 findings from
the original detector on the same files. The single false positive is keystone's,
described in `expanded-corpus/README.md`: 1 in 213, or 0.5%.

Every one of the 23 was checked against the source by hand. AFFiNE is the clearest
illustration of the two-sided change: its noisy `Map.get()` reports are gone, and
in their place are eleven real ones the old detector never found, including a
migration that issues five queries per document row and an invite handler that
looks up each email address separately.

Medusa dropping to zero is the right answer, not a loss: all three of its original
findings were `Map.get()` and `Array.find()` calls.

## Scan provenance

These scans were run on 2026-09-17. The three study repositories are pinned:

| Repository | Commit | Scope |
|---|---|---|
| outline/outline | `1a0c7f47c8470aa972262558bc7409795e0ecc6b` | `server/{routes,commands,presenters,queues,policies,services}` |
| calcom/cal.com | `6bc45298226f96ff79e0c070c8b2ce39727e8477` | `packages/trpc` |
| immich-app/immich | `efbbd32e55067eb02a51030c5c948ae617484f8b` | `server/src/{services,repositories,controllers,workers,commands}` |

Each commit is also recorded in the corresponding result file, alongside the
scope and scan date. Re-scanning at these commits reproduces the counts, the
file paths and the line numbers in this file exactly; `../scripts/scan-repo.sh`
takes `CEL_COMMIT=<sha>` to do that.

The original scans were taken at whatever was HEAD that day, with no commit
recorded — the pins above were recovered afterwards by date
(`git rev-list -1 --before="2026-09-17T11:20:00Z" origin/HEAD`) and verified by
re-scanning. The held-out and expanded-corpus results are not pinned; their
line numbers are only valid against whatever was HEAD on 2026-09-17.
