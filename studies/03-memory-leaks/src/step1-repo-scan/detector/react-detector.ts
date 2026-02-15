/**
 * Study 03 — React Memory Leak Detector
 *
 * Detects common memory leak patterns in React components by walking the AST
 * and checking for missing cleanup in lifecycle hooks.
 *
 * Patterns detected:
 *   1. useEffect without cleanup return (when it sets up listeners/timers/subscriptions)
 *   2. addEventListener without corresponding removeEventListener
 *   3. setInterval/setTimeout without clearInterval/clearTimeout
 *   4. .subscribe() without .unsubscribe() in effect or component body
 *   5. IntersectionObserver/MutationObserver/ResizeObserver without .disconnect()
 *   6. requestAnimationFrame without cancelAnimationFrame
 *
 * Adapted from Code Evolution Lab's React analysis module.
 */

import traverse from '@babel/traverse';
import type { ScanIssue, AnalysisContext, LeakPatternType, LeakContext } from './types';
import {
  generateId,
  getCode,
  getEnclosingComponentName,
  isCallTo,
  getCallName,
  hasReturnStatement,
  classifyContextFromPath,
  TIMER_SETUP_CALLS,
  TIMER_CLEANUP_MAP,
  OBSERVER_APIS,
} from './framework-utils';

// ---------------------------------------------------------------------------
// useEffect cleanup detection
// ---------------------------------------------------------------------------

/**
 * Check whether a useEffect callback sets up resources that need cleanup,
 * and whether it returns a cleanup function.
 *
 * Heuristic: if the effect body contains any of these setup patterns,
 * it SHOULD return a cleanup function. If it doesn't, that's a finding.
 *
 * Setup patterns that require cleanup:
 *   - addEventListener
 *   - setInterval / setTimeout
 *   - subscribe / on (event emitter)
 *   - new IntersectionObserver / MutationObserver / ResizeObserver
 *   - requestAnimationFrame
 */
const EFFECT_SETUP_INDICATORS = [
  'addEventListener',
  'setInterval',
  'setTimeout',
  'subscribe',
  '.on(',
  'IntersectionObserver',
  'MutationObserver',
  'ResizeObserver',
  'requestAnimationFrame',
];

function effectBodyNeedsCleanup(sourceCode: string, node: any): string | null {
  if (!node.start || !node.end) return null;
  const body = sourceCode.slice(node.start, node.end);
  for (const indicator of EFFECT_SETUP_INDICATORS) {
    if (body.includes(indicator)) return indicator;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main detector
// ---------------------------------------------------------------------------

export function detectReactLeaks(ast: any, ctx: AnalysisContext): ScanIssue[] {
  const issues: ScanIssue[] = [];
  const { sourceCode, filePath } = ctx;
  const pathContext = classifyContextFromPath(filePath);

  traverse(ast, {
    noScope: true,
    CallExpression(path: any) {
      const node = path.node;
      const callName = getCallName(node);
      if (!callName) return;

      // -----------------------------------------------------------------
      // Pattern 1: useEffect without cleanup return
      // -----------------------------------------------------------------
      if (callName === 'useEffect' && node.arguments?.length >= 1) {
        const callback = node.arguments[0];
        if (
          callback &&
          (callback.type === 'ArrowFunctionExpression' || callback.type === 'FunctionExpression')
        ) {
          const setupIndicator = effectBodyNeedsCleanup(sourceCode, callback);
          if (setupIndicator && !hasReturnStatement(path.get('arguments.0'))) {
            issues.push(makeIssue({
              type: 'missing_effect_cleanup',
              severity: 'high',
              filePath,
              lineNumber: node.loc?.start.line || 0,
              title: `useEffect sets up ${setupIndicator} without cleanup return`,
              description:
                `This useEffect calls ${setupIndicator} but does not return a cleanup function. ` +
                `Resources created in useEffect should be torn down in the returned function to ` +
                `prevent memory leaks when the component unmounts or the effect re-runs.`,
              code: getCode(node, sourceCode),
              context: pathContext,
              contextDetail: 'useEffect_missing_cleanup_return',
              matchedBy: ['useEffect_no_return', `setup_indicator:${setupIndicator}`],
              enclosingComponent: getEnclosingComponentName(path),
              setupCall: `useEffect(${setupIndicator})`,
              expectedCleanup: 'return () => { /* cleanup */ }',
            }));
          }
        }
      }

      // -----------------------------------------------------------------
      // Pattern 2: addEventListener without removeEventListener
      //
      // Heuristic: if addEventListener is called inside a useEffect that
      // has a return, we assume cleanup is handled. If it's called outside
      // useEffect or in a useEffect without return, it's a finding.
      // -----------------------------------------------------------------
      if (callName === 'addEventListener') {
        const inEffect = isInsideUseEffect(path);
        if (inEffect) {
          // Already covered by Pattern 1 if the effect has no return
          // Skip to avoid double-reporting
        } else {
          // addEventListener outside useEffect — likely a leak
          issues.push(makeIssue({
            type: 'missing_event_listener_removal',
            severity: 'high',
            filePath,
            lineNumber: node.loc?.start.line || 0,
            title: 'addEventListener without removeEventListener',
            description:
              'An event listener is added outside of a useEffect cleanup pattern. ' +
              'Without explicit removal, the listener persists after unmount, causing a memory leak.',
            code: getCode(node, sourceCode),
            context: pathContext !== 'unknown' ? pathContext : 'event_binding',
            contextDetail: 'addEventListener_outside_effect',
            matchedBy: ['addEventListener_no_effect_wrapper'],
            enclosingComponent: getEnclosingComponentName(path),
            setupCall: 'addEventListener',
            expectedCleanup: 'removeEventListener',
          }));
        }
      }

      // -----------------------------------------------------------------
      // Pattern 3: setInterval/setTimeout without cleanup
      //
      // If inside useEffect with return, assume cleanup is handled.
      // If outside useEffect or in effect without return, flag it.
      // -----------------------------------------------------------------
      if (TIMER_SETUP_CALLS.includes(callName) && callName !== 'requestAnimationFrame') {
        const inEffect = isInsideUseEffect(path);
        if (!inEffect) {
          const cleanup = TIMER_CLEANUP_MAP[callName] || 'clearInterval/clearTimeout';
          issues.push(makeIssue({
            type: 'missing_timer_cleanup',
            severity: 'medium',
            filePath,
            lineNumber: node.loc?.start.line || 0,
            title: `${callName} without ${cleanup}`,
            description:
              `A timer (${callName}) is started outside of a useEffect cleanup pattern. ` +
              `The timer will continue firing after unmount unless explicitly cleared.`,
            code: getCode(node, sourceCode),
            context: pathContext !== 'unknown' ? pathContext : 'timer',
            contextDetail: `${callName}_outside_effect`,
            matchedBy: [`${callName}_no_effect_wrapper`],
            enclosingComponent: getEnclosingComponentName(path),
            setupCall: callName,
            expectedCleanup: cleanup,
          }));
        }
      }

      // -----------------------------------------------------------------
      // Pattern 4: .subscribe() without cleanup
      //
      // Common with RxJS observables, WebSocket connections, and
      // custom event emitter patterns in React apps.
      // -----------------------------------------------------------------
      if (callName === 'subscribe') {
        const inEffect = isInsideUseEffect(path);
        if (!inEffect) {
          issues.push(makeIssue({
            type: 'missing_subscription_cleanup',
            severity: 'high',
            filePath,
            lineNumber: node.loc?.start.line || 0,
            title: 'subscribe() without unsubscribe in cleanup',
            description:
              'A subscription is created outside of a useEffect cleanup pattern. ' +
              'Without calling .unsubscribe() on unmount, the subscription remains active ' +
              'and may keep the component in memory.',
            code: getCode(node, sourceCode),
            context: pathContext !== 'unknown' ? pathContext : 'store_subscription',
            contextDetail: 'subscribe_outside_effect',
            matchedBy: ['subscribe_no_effect_wrapper'],
            enclosingComponent: getEnclosingComponentName(path),
            setupCall: 'subscribe',
            expectedCleanup: 'unsubscribe()',
          }));
        }
      }

      // -----------------------------------------------------------------
      // Pattern 5: requestAnimationFrame without cancel
      // -----------------------------------------------------------------
      if (callName === 'requestAnimationFrame') {
        const inEffect = isInsideUseEffect(path);
        if (!inEffect) {
          issues.push(makeIssue({
            type: 'missing_raf_cancel',
            severity: 'medium',
            filePath,
            lineNumber: node.loc?.start.line || 0,
            title: 'requestAnimationFrame without cancelAnimationFrame',
            description:
              'A requestAnimationFrame call is made outside of a useEffect cleanup pattern. ' +
              'The animation frame callback may fire after unmount.',
            code: getCode(node, sourceCode),
            context: pathContext !== 'unknown' ? pathContext : 'timer',
            contextDetail: 'raf_outside_effect',
            matchedBy: ['raf_no_effect_wrapper'],
            enclosingComponent: getEnclosingComponentName(path),
            setupCall: 'requestAnimationFrame',
            expectedCleanup: 'cancelAnimationFrame',
          }));
        }
      }
    },

    // -------------------------------------------------------------------
    // Pattern 6: new IntersectionObserver / MutationObserver / ResizeObserver
    // without .disconnect()
    // -------------------------------------------------------------------
    NewExpression(path: any) {
      const node = path.node;
      const className = node.callee?.name;
      if (!className || !OBSERVER_APIS.includes(className)) return;

      const inEffect = isInsideUseEffect(path);
      if (!inEffect) {
        issues.push(makeIssue({
          type: 'missing_observer_disconnect',
          severity: 'medium',
          filePath,
          lineNumber: node.loc?.start.line || 0,
          title: `new ${className} without disconnect()`,
          description:
            `A ${className} is created outside of a useEffect cleanup pattern. ` +
            `Without calling .disconnect() on unmount, the observer continues tracking ` +
            `and may retain DOM nodes in memory.`,
          code: getCode(node, sourceCode),
          context: pathContext !== 'unknown' ? pathContext : 'event_binding',
          contextDetail: `${className}_outside_effect`,
          matchedBy: [`${className}_no_effect_wrapper`],
          enclosingComponent: getEnclosingComponentName(path),
          setupCall: `new ${className}`,
          expectedCleanup: `${className}.disconnect()`,
        }));
      }
    },
  });

  return issues;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Check whether the current path is inside a useEffect callback. */
function isInsideUseEffect(path: any): boolean {
  let current = path.parentPath;
  while (current) {
    if (
      current.node?.type === 'CallExpression' &&
      (current.node.callee?.name === 'useEffect' ||
       current.node.callee?.name === 'useLayoutEffect')
    ) {
      return true;
    }
    current = current.parentPath;
  }
  return false;
}

/** Helper to construct a ScanIssue with defaults. */
function makeIssue(partial: Omit<ScanIssue, 'id' | 'framework'>): ScanIssue {
  return { id: generateId(), framework: 'react', ...partial };
}
