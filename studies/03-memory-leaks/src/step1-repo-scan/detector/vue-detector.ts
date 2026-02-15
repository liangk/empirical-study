/**
 * Study 03 — Vue Memory Leak Detector
 *
 * Detects common memory leak patterns in Vue 3 Composition API and
 * Options API components by walking the AST.
 *
 * Patterns detected:
 *   1. onMounted setup without onUnmounted/onBeforeUnmount cleanup
 *   2. watch/watchEffect without storing and calling the stop handle
 *   3. addEventListener in setup/mounted without removeEventListener in unmounted
 *   4. setInterval/setTimeout in setup without cleanup in onUnmounted
 *   5. .subscribe() / .on() without .unsubscribe() / .off()
 *   6. Global event bus on() without off()
 *
 * Adapted from Code Evolution Lab's Vue analysis module.
 */

import traverse from '@babel/traverse';
import type { ScanIssue, AnalysisContext, LeakPatternType } from './types';
import {
  generateId,
  getCode,
  getEnclosingComponentName,
  getCallName,
  classifyContextFromPath,
  TIMER_SETUP_CALLS,
  TIMER_CLEANUP_MAP,
  OBSERVER_APIS,
} from './framework-utils';

// ---------------------------------------------------------------------------
// Vue lifecycle hook names (Composition API)
// ---------------------------------------------------------------------------

const VUE_SETUP_HOOKS = ['onMounted', 'onActivated'];
const VUE_CLEANUP_HOOKS = ['onUnmounted', 'onBeforeUnmount', 'onDeactivated'];

// ---------------------------------------------------------------------------
// File-level tracking
//
// Because Vue Composition API setup functions are flat (not nested callbacks
// like React useEffect), we need to track which setup hooks and cleanup hooks
// are present at the file level and compare them.
// ---------------------------------------------------------------------------

interface VueSetupCall {
  hookName: string;
  line: number;
  node: any;
  path: any;
  containsSetup: string | null;  // which resource-setup pattern was found
}

interface VueCleanupCall {
  hookName: string;
  line: number;
}

const RESOURCE_SETUP_INDICATORS = [
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

function bodyContainsSetup(sourceCode: string, node: any): string | null {
  if (!node.start || !node.end) return null;
  const body = sourceCode.slice(node.start, node.end);
  for (const indicator of RESOURCE_SETUP_INDICATORS) {
    if (body.includes(indicator)) return indicator;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main detector
// ---------------------------------------------------------------------------

export function detectVueLeaks(ast: any, ctx: AnalysisContext): ScanIssue[] {
  const issues: ScanIssue[] = [];
  const { sourceCode, filePath } = ctx;
  const pathContext = classifyContextFromPath(filePath);

  // Collect lifecycle hook calls for paired analysis
  const setupCalls: VueSetupCall[] = [];
  const cleanupCalls: VueCleanupCall[] = [];

  // Track standalone resource-setup calls outside lifecycle hooks
  const standaloneSetups: Array<{ callName: string; node: any; path: any }> = [];

  traverse(ast, {
    // Disable Babel scope tracking because bundled/minified files often shadow
    // identifiers (e.g., duplicate vars) which triggers "Duplicate declaration"
    // errors. We only need structural matching, so noScope keeps traversal safe.
    noScope: true,
    CallExpression(path: any) {
      const node = path.node;
      const callName = getCallName(node);
      if (!callName) return;

      // -----------------------------------------------------------------
      // Collect Vue lifecycle hooks
      // -----------------------------------------------------------------
      if (VUE_SETUP_HOOKS.includes(callName) && node.arguments?.[0]) {
        const callback = node.arguments[0];
        const indicator = bodyContainsSetup(sourceCode, callback);
        setupCalls.push({
          hookName: callName,
          line: node.loc?.start.line || 0,
          node,
          path,
          containsSetup: indicator,
        });
        return;
      }

      if (VUE_CLEANUP_HOOKS.includes(callName)) {
        cleanupCalls.push({
          hookName: callName,
          line: node.loc?.start.line || 0,
        });
        return;
      }

      // -----------------------------------------------------------------
      // Pattern 2: watch/watchEffect without stop handle
      //
      // In Vue 3, watch() and watchEffect() return a stop function.
      // If the return value is not captured, the watcher can't be stopped.
      // -----------------------------------------------------------------
      if (callName === 'watchEffect' || callName === 'watch') {
        const parent = path.parentPath?.node;
        const isStored =
          parent?.type === 'VariableDeclarator' ||
          parent?.type === 'AssignmentExpression' ||
          parent?.type === 'ReturnStatement';

        if (!isStored) {
          issues.push(makeIssue({
            type: 'missing_watch_stop',
            severity: 'medium',
            filePath,
            lineNumber: node.loc?.start.line || 0,
            title: `${callName}() return value not captured — cannot stop watcher`,
            description:
              `The return value of ${callName}() is not stored. Without the stop handle, ` +
              `the watcher cannot be explicitly stopped in onUnmounted, which may cause ` +
              `it to persist beyond the component's lifecycle.`,
            code: getCode(node, sourceCode),
            context: pathContext !== 'unknown' ? pathContext : 'component_lifecycle',
            contextDetail: `${callName}_unstored_stop_handle`,
            matchedBy: [`${callName}_return_not_captured`],
            enclosingComponent: getEnclosingComponentName(path),
            setupCall: callName,
            expectedCleanup: `const stop = ${callName}(...); onUnmounted(() => stop())`,
          }));
        }
      }

      // -----------------------------------------------------------------
      // Track standalone resource-setup calls (addEventListener, timers, etc.)
      // that are NOT inside onMounted/onActivated callbacks.
      // These are setup() scope calls that may lack cleanup.
      // -----------------------------------------------------------------
      if (
        callName === 'addEventListener' ||
        TIMER_SETUP_CALLS.includes(callName) ||
        callName === 'subscribe'
      ) {
        if (!isInsideVueLifecycleHook(path, [...VUE_SETUP_HOOKS, ...VUE_CLEANUP_HOOKS])) {
          standaloneSetups.push({ callName, node, path });
        }
      }
    },

    // -------------------------------------------------------------------
    // Observer pattern: new IntersectionObserver etc.
    // -------------------------------------------------------------------
    NewExpression(path: any) {
      const node = path.node;
      const className = node.callee?.name;
      if (!className || !OBSERVER_APIS.includes(className)) return;

      if (!isInsideVueLifecycleHook(path, VUE_CLEANUP_HOOKS)) {
        issues.push(makeIssue({
          type: 'missing_observer_disconnect',
          severity: 'medium',
          filePath,
          lineNumber: node.loc?.start.line || 0,
          title: `new ${className} without disconnect in onUnmounted`,
          description:
            `A ${className} is created but may not be disconnected in onUnmounted. ` +
            `Without cleanup, the observer continues tracking DOM elements after ` +
            `the component is destroyed.`,
          code: getCode(node, sourceCode),
          context: pathContext !== 'unknown' ? pathContext : 'event_binding',
          contextDetail: `${className}_missing_unmount_disconnect`,
          matchedBy: [`${className}_no_cleanup_hook`],
          enclosingComponent: getEnclosingComponentName(path),
          setupCall: `new ${className}`,
          expectedCleanup: `onUnmounted(() => observer.disconnect())`,
        }));
      }
    },
  });

  // -----------------------------------------------------------------
  // Pattern 1: onMounted with resource setup but no onUnmounted/onBeforeUnmount
  //
  // Post-traversal: compare setup hooks vs cleanup hooks.
  // If any onMounted contains resource-setup indicators but no cleanup
  // hook exists in the same file, flag it.
  // -----------------------------------------------------------------
  const hasCleanupHook = cleanupCalls.length > 0;

  for (const setup of setupCalls) {
    if (setup.containsSetup && !hasCleanupHook) {
      issues.push(makeIssue({
        type: 'missing_lifecycle_cleanup',
        severity: 'high',
        filePath,
        lineNumber: setup.line,
        title: `${setup.hookName} sets up ${setup.containsSetup} but no onUnmounted cleanup found`,
        description:
          `This ${setup.hookName} hook creates resources (${setup.containsSetup}) but the file ` +
          `contains no onUnmounted or onBeforeUnmount hook to clean them up. Resources ` +
          `set up in onMounted should be torn down in onUnmounted.`,
        code: getCode(setup.node, sourceCode),
        context: pathContext !== 'unknown' ? pathContext : 'component_lifecycle',
        contextDetail: `${setup.hookName}_without_unmount_cleanup`,
        matchedBy: ['mounted_setup_no_unmount', `setup_indicator:${setup.containsSetup}`],
        enclosingComponent: getEnclosingComponentName(setup.path),
        setupCall: `${setup.hookName}(${setup.containsSetup})`,
        expectedCleanup: 'onUnmounted(() => { /* cleanup */ })',
      }));
    }
  }

  // -----------------------------------------------------------------
  // Standalone resource-setup calls outside lifecycle hooks
  // Flag if no cleanup hook exists
  // -----------------------------------------------------------------
  for (const { callName, node, path } of standaloneSetups) {
    if (!hasCleanupHook) {
      const cleanup = TIMER_CLEANUP_MAP[callName] || 'removeEventListener/unsubscribe';
      const type: LeakPatternType = callName === 'addEventListener'
        ? 'missing_event_listener_removal'
        : callName === 'subscribe'
          ? 'missing_subscription_cleanup'
          : 'missing_timer_cleanup';

      issues.push(makeIssue({
        type,
        severity: 'medium',
        filePath,
        lineNumber: node.loc?.start.line || 0,
        title: `${callName} in setup scope without onUnmounted cleanup`,
        description:
          `${callName} is called in the component setup scope but no onUnmounted ` +
          `hook is present to clean it up.`,
        code: getCode(node, sourceCode),
        context: pathContext !== 'unknown' ? pathContext : callName === 'subscribe' ? 'store_subscription' : 'event_binding',
        contextDetail: `${callName}_setup_scope_no_unmount`,
        matchedBy: [`${callName}_no_unmount_hook`],
        enclosingComponent: getEnclosingComponentName(path),
        setupCall: callName,
        expectedCleanup: `onUnmounted(() => ${cleanup}(...))`,
      }));
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Check whether the current path is inside a specific Vue lifecycle hook callback. */
function isInsideVueLifecycleHook(path: any, hookNames: string[]): boolean {
  let current = path.parentPath;
  while (current) {
    if (
      current.node?.type === 'CallExpression' &&
      current.node.callee?.type === 'Identifier' &&
      hookNames.includes(current.node.callee.name)
    ) {
      return true;
    }
    current = current.parentPath;
  }
  return false;
}

function makeIssue(partial: Omit<ScanIssue, 'id' | 'framework'>): ScanIssue {
  return { id: generateId(), framework: 'vue', ...partial };
}
