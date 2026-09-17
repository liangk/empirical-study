# Scan Results Summary

Two scans are recorded here: the first run of the N+1 Query Detector against three
real codebases, and the run after seven rounds of fixing what that first run
exposed. Raw JSON output for both is in this folder, along with the expanded-corpus
results in `expanded-corpus/`.

| | Before | After |
|---|---|---|
| Raw findings (3 repos) | 78 | 42 |
| Manually confirmed genuine | 31 | 42 |
| False positives | 47 | 0 |
| False-positive rate | **60.3%** | **0.0%** |
| Recall against verified truth | 73.8% | 100% |

Both columns are scored against the same verified ground truth
(`../eval/labels.json`): 42 loop locations across the three repositories where a
real per-item database or repository call happens, each confirmed by reading the
source. The scoring script is `../eval/score.js`, so these numbers can be
recomputed from the raw JSON without trusting this table.

The before column's 73.8% recall is not a typo. The original detector didn't just
report things that weren't there — it also missed 11 genuine N+1 patterns, because
it never looked at write calls (`update`, `upsert`, `create`) at all.

## Files in this folder

- `outline-outline.json`, `calcom-cal.com.json`, `immich-immich.json` — current
  (post-fix) scan output, including the CLI's generated fix for every finding.
- `baseline/*.json` — the original pre-fix scan output, kept so the comparison is
  checkable rather than asserted.

## outline/outline (Sequelize) — `server/{routes,commands,presenters,queues,policies,services}`, 334 files

27 findings, all genuine. The pre-fix scan reported 38, of which 22 were genuine.

The dominant pattern is unchanged and is what makes this repository the flagship
case: Outline's notification pipeline fans out one background job per event
(comment posted, document published, revision created, mention added), and each
job resolves "who should be notified" by looping over recipients, mentions, or
group members and calling `findByPk()` / `findAll()` once per entry.

| Severity | File : line | Pattern | Impact at 100 items |
|---|---|---|---|
| CRITICAL | `queues/tasks/RevisionCreatedNotificationsTask.ts:108` | `Group.findByPk` + `GroupUser.findAll` + `User.findByPk` nested in one loop | 301 queries vs 1 |
| CRITICAL | `queues/tasks/DocumentPublishedNotificationsTask.ts:73` | same 3-query nested pattern | 301 queries vs 1 |
| HIGH | `queues/processors/WebsocketsProcessor.ts:544` | `Collection.findByPk` + `User.findByPk` per group member | 201 queries vs 1 |
| HIGH | `queues/tasks/InviteReminderTask.ts:23` | `User.findByPk` in a transaction per invited user | 201 queries vs 1 |
| HIGH | `queues/tasks/ExportJSONTask.ts:100` | `Document.findByPk` per exported node | 201 queries vs 1 |
| HIGH | `queues/processors/BacklinksProcessor.ts:27` / `:77` | `Document.findByPk` per linked document id | 201 queries vs 1 |
| HIGH | `routes/api/documents/documents.ts:140` | `Document.findByPk` per document id in an API response | 201 queries vs 1 |
| MEDIUM | `queues/processors/WebsocketsProcessor.ts:823` / `:886` | `Collection.findByPk` per group membership | 101 queries vs 1 |
| MEDIUM | `routes/api/groups/groups.ts:169` | `GroupUser.findAll` per group | 101 queries vs 1 |
| MEDIUM | `queues/processors/ImportsProcessor.ts:400` | per-item id resolution that falls through to `Document.findOne` | 101 queries vs 1 |
| MEDIUM | `commands/groupsSyncer.ts:52` | `ExternalGroup.findOrCreate` per synced group | 101 queries vs 1 |
| MEDIUM | `commands/documentPermanentDeleter.ts:28` | `Attachment.findAll` per purged document | 101 queries vs 1 |
| MEDIUM | 13 further notification/task locations | `User.findByPk` / `Group.findByPk` per mention, member, or recipient | 101 queries vs 1 |

Newly surfaced by the fix: `WebsocketsProcessor.ts:823`, `ImportsProcessor.ts:400`,
`groups.ts:169`, `UpdateDocumentsPopularityScoreTask.ts:505`,
`RollupWeeklyDocumentInsightsTask.ts:49`.

## calcom/cal.com (Prisma) — `packages/trpc`, 398 files

7 findings, all genuine. The pre-fix scan reported 22, of which 3 were genuine —
the worst signal-to-noise of the three, and the repository that drove most of the
fixes.

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

8 findings, all genuine. The pre-fix scan reported 18, of which 2 were genuine.

| Severity | File : line | Pattern | Impact at 100 items |
|---|---|---|---|
| HIGH | `services/album.service.ts:292` | `userRepository.get()` + `albumUserRepository.create()` per invited user | 201 queries vs 1 |
| HIGH | `services/person.service.ts:155` | `personRepository.getRandomFace()` + `.update()` per person | 201 queries vs 1 |
| HIGH | `services/media.service.ts:92` | same two calls per person, inside a batched outer loop | 201 queries vs 1 |
| MEDIUM | `repositories/asset.repository.ts:441` | `deleteBulkMetadata()` runs one `DELETE` per item in its own loop | 101 queries vs 1 |
| MEDIUM | `services/album.service.ts:104` | `userRepository.get()` per user being added to an album | 101 queries vs 1 |
| MEDIUM | `services/album.service.ts:226` | `albumRepository.getAssetIds()` per album | 101 queries vs 1 |
| MEDIUM | `services/person.service.ts:617` | `personRepository.update()` per merged person | 101 queries vs 1 |
| MEDIUM | `services/memory.service.ts:59` | `memoryRepository.create()` per generated memory | 101 queries vs 1 |

## Expanded corpus

After the fix was finished, the 20 candidates from the original pool that had never
been scanned properly were scoped and scanned with both detector versions. 341
findings became 148, all 148 confirmed genuine by hand. That pass drove three
further rounds of fixes; full detail in `expanded-corpus/`.

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

Across all three passes — 3 study repositories, 5 held-out, 20 expanded — the fixed
detector reported 213 findings, every one of them verified genuine, against 514
findings from the original detector on the same files.

Every one of the 23 was checked against the source by hand. AFFiNE is the clearest
illustration of the two-sided change: its noisy `Map.get()` reports are gone, and
in their place are eleven real ones the old detector never found, including a
migration that issues five queries per document row and an invite handler that
looks up each email address separately.

Medusa dropping to zero is the right answer, not a loss: all three of its original
findings were `Map.get()` and `Array.find()` calls.
