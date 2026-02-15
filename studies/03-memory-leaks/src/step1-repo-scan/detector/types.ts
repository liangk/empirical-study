/**
 * Study 03 — Memory Leak Detection Types
 *
 * Core interfaces for the static analysis pipeline. Mirrors the structure
 * from Study 02 (blocking-io) for cross-study consistency, with fields
 * specific to lifecycle-based leak detection in React, Vue, and Angular.
 */

// ---------------------------------------------------------------------------
// Framework enum — used throughout scanner, detectors, and aggregation.
// ---------------------------------------------------------------------------

export type Framework = 'react' | 'vue' | 'angular' | 'unknown';

// ---------------------------------------------------------------------------
// Leak pattern taxonomy
// ---------------------------------------------------------------------------

/** High-level categories for the leak patterns we detect. */
export type LeakPatternType =
  | 'missing_effect_cleanup'       // React useEffect without return cleanup
  | 'missing_event_listener_removal' // addEventListener without removeEventListener
  | 'missing_timer_cleanup'        // setInterval/setTimeout without clear*
  | 'missing_subscription_cleanup' // .subscribe() without unsubscribe / takeUntil
  | 'missing_observer_disconnect'  // IntersectionObserver/MutationObserver without disconnect
  | 'missing_raf_cancel'           // requestAnimationFrame without cancelAnimationFrame
  | 'missing_lifecycle_cleanup'    // Framework-specific: onMounted without onUnmounted, ngOnDestroy missing
  | 'missing_watch_stop'           // Vue watch/watchEffect without stop handle
  | 'missing_renderer_unlisten'    // Angular Renderer2.listen without stored unlisten
  | 'global_event_bus_leak';       // EventEmitter/mitt on() without off()

/** Where in the component/service architecture the leak occurs. */
export type LeakContext =
  | 'component_lifecycle'   // Inside a component (hook, method, template script)
  | 'service_singleton'     // In a service/provider that outlives components
  | 'store_subscription'    // State management subscriptions (Redux, Pinia, NgRx)
  | 'event_binding'         // DOM or custom event listeners
  | 'timer'                 // setInterval, setTimeout, requestAnimationFrame
  | 'unknown';              // Couldn't determine from static analysis

// ---------------------------------------------------------------------------
// Core issue interface
// ---------------------------------------------------------------------------

/** One normalized memory-leak finding emitted by a framework detector. */
export interface ScanIssue {
  /** Stable identifier for debugging and traceability. */
  id: string;
  /** Which framework's detector found this issue. */
  framework: Framework;
  /** Normalized leak pattern category. */
  type: LeakPatternType;
  /** Risk level based on leak context and pattern severity. */
  severity: 'critical' | 'high' | 'medium' | 'low';
  /** Repo-relative file path. */
  filePath: string;
  /** 1-based line number of the setup call (e.g., useEffect, addEventListener). */
  lineNumber: number;
  /** Human-readable title for triage. */
  title: string;
  /** Explanation of why this is a potential leak. */
  description: string;
  /** Compact source snippet for quick review. */
  code: string;
  /** Architectural context where the leak lives. */
  context: LeakContext;
  /** Fine-grained reason for context classification. */
  contextDetail: string;
  /** Which heuristics matched to produce this finding. */
  matchedBy: string[];
  /** Name of the component/function enclosing the leak site. */
  enclosingComponent?: string;
  /** The setup API that creates the resource (e.g., addEventListener, useEffect). */
  setupCall: string;
  /** The expected cleanup API that is missing (e.g., removeEventListener, cleanup return). */
  expectedCleanup: string;
}

// ---------------------------------------------------------------------------
// Scanner I/O interfaces
// ---------------------------------------------------------------------------

/** Input context passed into each detector per file. */
export interface AnalysisContext {
  sourceCode: string;
  filePath: string;
  ast: any;
  framework: Framework;
}

/** Per-repository scan output. */
export interface ScanResult {
  repoUrl: string;
  repoName: string;
  framework: Framework;
  filesScanned: number;
  issues: ScanIssue[];
  scanDurationMs: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// Aggregation interfaces
// ---------------------------------------------------------------------------

/** Cross-repository summary for reporting and article generation. */
export interface AggregatedResults {
  totalRepos: number;
  totalFilesScanned: number;
  totalIssues: number;
  reposWithIssues: number;
  prevalenceRate: number;
  byFramework: Record<string, number>;
  byType: Record<string, number>;
  byContext: Record<string, number>;
  byContextDetail: Record<string, number>;
  bySeverity: Record<string, number>;
  bySetupCall: Record<string, number>;
  /** Highest-issue repos for qualitative follow-up. */
  topOffenders: Array<{ repo: string; framework: string; issueCount: number }>;
}
