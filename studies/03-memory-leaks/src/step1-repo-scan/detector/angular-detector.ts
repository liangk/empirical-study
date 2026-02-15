/**
 * Study 03 — Angular Memory Leak Detector
 *
 * Detects common memory leak patterns in Angular components and services
 * by walking the AST and checking for missing cleanup.
 *
 * Patterns detected:
 *   1. .subscribe() without .unsubscribe() or takeUntil in ngOnDestroy
 *   2. Missing ngOnDestroy in components/services that hold subscriptions
 *   3. Renderer2.listen() without stored unlisten function call
 *   4. addEventListener without removeEventListener in ngOnDestroy
 *   5. setInterval/setTimeout without clearInterval/clearTimeout in ngOnDestroy
 *   6. EventEmitter/Subject .subscribe() without cleanup
 *
 * Adapted from Code Evolution Lab's Angular analysis module.
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
// Angular-specific heuristics
// ---------------------------------------------------------------------------

/**
 * Check whether a class body implements ngOnDestroy.
 * We look for a method named ngOnDestroy in the class.
 */
function classHasNgOnDestroy(classBody: any): boolean {
  if (!classBody?.body) return false;
  return classBody.body.some(
    (member: any) =>
      (member.type === 'ClassMethod' || member.type === 'ClassProperty' || member.type === 'TSDeclareMethod') &&
      (member.key?.name === 'ngOnDestroy')
  );
}

/**
 * Check whether a class body contains a takeUntil pattern.
 * Heuristic: search for `.pipe(takeUntil(` in the class source.
 */
function classUsesTakeUntil(sourceCode: string, classNode: any): boolean {
  if (!classNode.start || !classNode.end) return false;
  const body = sourceCode.slice(classNode.start, classNode.end);
  return body.includes('takeUntil(') || body.includes('takeUntilDestroyed(');
}

/**
 * Check whether a class body contains an async pipe usage hint.
 * This is a rough heuristic — Angular templates use `| async` but we're
 * scanning .ts files. We check for comments or variable naming conventions.
 */
function classUsesAsyncPipe(sourceCode: string, classNode: any): boolean {
  if (!classNode.start || !classNode.end) return false;
  const body = sourceCode.slice(classNode.start, classNode.end);
  // Common pattern: observable$ property consumed by async pipe in template
  // We can't see the template from .ts, so we check for the $ convention
  // combined with no explicit subscribe — this reduces false positives.
  return false; // Conservative: don't assume async pipe without evidence
}

// ---------------------------------------------------------------------------
// Main detector
// ---------------------------------------------------------------------------

export function detectAngularLeaks(ast: any, ctx: AnalysisContext): ScanIssue[] {
  const issues: ScanIssue[] = [];
  const { sourceCode, filePath } = ctx;
  const pathContext = classifyContextFromPath(filePath);

  type RecordedCall = { node: any; path: any; line: number };
  type TimerCall = RecordedCall & { callName: string };

  interface ClassInfo {
    node: any;
    className: string;
    hasDestroy: boolean;
    hasTakeUntil: boolean;
    isService: boolean;
    subscribeCalls: RecordedCall[];
    timerCalls: TimerCall[];
    listenerCalls: RecordedCall[];
    rendererListenCalls: RecordedCall[];
  }

  const classInfos = new Map<any, ClassInfo>();

  traverse(ast, {
    // Disable Babel scope tracking to avoid duplicate declaration crashes in
    // bundled/minified Angular builds where helper vars repeat per module.
    noScope: true,
    ClassDeclaration(classPath: any) {
      const classNode = classPath.node;
      const className = classNode.id?.name || 'AnonymousClass';
      const hasDestroy = classHasNgOnDestroy(classNode.body);
      const hasTakeUntil = classUsesTakeUntil(sourceCode, classNode);
      const isComponent = hasDecorator(classPath, 'Component');
      const isDirective = hasDecorator(classPath, 'Directive');
      const isService = hasDecorator(classPath, 'Injectable');

      // Only analyse Angular-decorated classes
      if (!isComponent && !isDirective && !isService) return;

      classInfos.set(classNode, {
        node: classNode,
        className,
        hasDestroy,
        hasTakeUntil,
        isService,
        subscribeCalls: [],
        timerCalls: [],
        listenerCalls: [],
        rendererListenCalls: [],
      });
    },
    CallExpression(callPath: any) {
      const classPath = callPath.findParent((p: any) => p.isClassDeclaration && p.isClassDeclaration());
      if (!classPath) return;
      const info = classInfos.get(classPath.node);
      if (!info) return;

      if (isInsideMethod(callPath, 'ngOnDestroy')) return;

      const node = callPath.node;
      const callName = getCallName(node);
      if (!callName) return;

      if (callName === 'subscribe') {
        info.subscribeCalls.push({ node, path: callPath, line: node.loc?.start.line || 0 });
        return;
      }

      if (TIMER_SETUP_CALLS.includes(callName)) {
        info.timerCalls.push({ callName, node, path: callPath, line: node.loc?.start.line || 0 });
        return;
      }

      if (callName === 'addEventListener') {
        info.listenerCalls.push({ node, path: callPath, line: node.loc?.start.line || 0 });
        return;
      }

      if (callName === 'listen') {
        const callee = node.callee;
        if (callee?.type === 'MemberExpression') {
          const parent = callPath.parentPath?.node;
          const isStored = parent?.type === 'VariableDeclarator' || parent?.type === 'AssignmentExpression';
          if (!isStored) {
            info.rendererListenCalls.push({ node, path: callPath, line: node.loc?.start.line || 0 });
          }
        }
      }
    },
  });

  for (const info of classInfos.values()) {
    const {
      node: classNode,
      className,
      hasDestroy,
      hasTakeUntil,
      isService,
      subscribeCalls,
      timerCalls,
      listenerCalls,
      rendererListenCalls,
    } = info;

    if (subscribeCalls.length > 0 && !hasDestroy && !hasTakeUntil) {
      issues.push(makeIssue({
        type: 'missing_lifecycle_cleanup',
        severity: 'high',
        filePath,
        lineNumber: classNode.loc?.start.line || 0,
        title: `${className} has ${subscribeCalls.length} subscribe() call(s) but no ngOnDestroy`,
        description:
          `This Angular class has active subscriptions but does not implement ngOnDestroy ` +
          `or use a takeUntil pattern. Subscriptions will persist after the component is ` +
          `destroyed, causing memory leaks and potential stale-state bugs.`,
        code: getCode(classNode, sourceCode, 300),
        context: isService ? 'service_singleton' : (pathContext !== 'unknown' ? pathContext : 'component_lifecycle'),
        contextDetail: 'class_subscribes_no_ngOnDestroy',
        matchedBy: ['subscribe_without_destroy', `subscribe_count:${subscribeCalls.length}`],
        enclosingComponent: className,
        setupCall: `.subscribe() ×${subscribeCalls.length}`,
        expectedCleanup: 'ngOnDestroy() { subscription.unsubscribe(); }',
      }));
    } else if (subscribeCalls.length > 0 && hasDestroy && !hasTakeUntil) {
      const destroyBody = getDestroyBody(sourceCode, classNode);
      if (destroyBody && !destroyBody.includes('unsubscribe')) {
        for (const sub of subscribeCalls) {
          issues.push(makeIssue({
            type: 'missing_subscription_cleanup',
            severity: 'medium',
            filePath,
            lineNumber: sub.line,
            title: 'subscribe() without unsubscribe in ngOnDestroy',
            description:
              'This subscription is created but ngOnDestroy does not call .unsubscribe(). ' +
              'Consider storing the subscription and cleaning it up, or using takeUntil.',
            code: getCode(sub.node, sourceCode),
            context: pathContext !== 'unknown' ? pathContext : 'store_subscription',
            contextDetail: 'subscribe_destroy_no_unsubscribe',
            matchedBy: ['subscribe_destroy_missing_unsubscribe'],
            enclosingComponent: className,
            setupCall: 'subscribe',
            expectedCleanup: 'this.subscription.unsubscribe()',
          }));
        }
      }
    }

    for (const listen of rendererListenCalls) {
      issues.push(makeIssue({
        type: 'missing_renderer_unlisten',
        severity: 'high',
        filePath,
        lineNumber: listen.line,
        title: 'Renderer2.listen() return value not stored — cannot unlisten',
        description:
          'Renderer2.listen() returns an unlisten function that must be called ' +
          'in ngOnDestroy. Without storing the return value, the listener cannot ' +
          'be removed and will leak.',
        code: getCode(listen.node, sourceCode),
        context: pathContext !== 'unknown' ? pathContext : 'event_binding',
        contextDetail: 'renderer_listen_unstored',
        matchedBy: ['renderer_listen_return_not_captured'],
        enclosingComponent: className,
        setupCall: 'Renderer2.listen()',
        expectedCleanup: 'const unlisten = this.renderer.listen(...); ngOnDestroy: unlisten()',
      }));
    }

    if (listenerCalls.length > 0 && !hasDestroy) {
      for (const listener of listenerCalls) {
        issues.push(makeIssue({
          type: 'missing_event_listener_removal',
          severity: 'high',
          filePath,
          lineNumber: listener.line,
          title: 'addEventListener without removeEventListener in ngOnDestroy',
          description:
            'An event listener is added but the class has no ngOnDestroy to remove it. ' +
            'The listener will persist after component destruction.',
          code: getCode(listener.node, sourceCode),
          context: pathContext !== 'unknown' ? pathContext : 'event_binding',
          contextDetail: 'addEventListener_no_ngOnDestroy',
          matchedBy: ['addEventListener_no_destroy'],
          enclosingComponent: className,
          setupCall: 'addEventListener',
          expectedCleanup: 'ngOnDestroy() { removeEventListener(...); }',
        }));
      }
    }

    if (timerCalls.length > 0 && !hasDestroy) {
      for (const timer of timerCalls) {
        const cleanup = TIMER_CLEANUP_MAP[timer.callName] || 'clearInterval/clearTimeout';
        issues.push(makeIssue({
          type: 'missing_timer_cleanup',
          severity: 'medium',
          filePath,
          lineNumber: timer.line,
          title: `${timer.callName} without ${cleanup} in ngOnDestroy`,
          description:
            `A timer (${timer.callName}) is started but the class has no ngOnDestroy ` +
            `to clear it. The timer will continue firing after component destruction.`,
          code: getCode(timer.node, sourceCode),
          context: pathContext !== 'unknown' ? pathContext : 'timer',
          contextDetail: `${timer.callName}_no_ngOnDestroy`,
          matchedBy: [`${timer.callName}_no_destroy`],
          enclosingComponent: className,
          setupCall: timer.callName,
          expectedCleanup: `ngOnDestroy() { ${cleanup}(this.timerId); }`,
        }));
      }
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Check whether a class has a specific Angular decorator (e.g., @Component). */
function hasDecorator(classPath: any, decoratorName: string): boolean {
  const decorators = classPath.node.decorators;
  if (!decorators) return false;
  return decorators.some((d: any) => {
    const expr = d.expression;
    // @Component({...})
    if (expr?.type === 'CallExpression' && expr.callee?.name === decoratorName) return true;
    // @Component (no parens — rare but valid)
    if (expr?.type === 'Identifier' && expr.name === decoratorName) return true;
    return false;
  });
}

/** Check whether the current path is inside a specific class method. */
function isInsideMethod(path: any, methodName: string): boolean {
  let current = path.parentPath;
  while (current) {
    if (
      current.node?.type === 'ClassMethod' &&
      current.node.key?.name === methodName
    ) {
      return true;
    }
    current = current.parentPath;
  }
  return false;
}

/** Extract the source text of the ngOnDestroy method body for heuristic checks. */
function getDestroyBody(sourceCode: string, classNode: any): string | null {
  const body = classNode.body?.body;
  if (!body) return null;
  const destroy = body.find(
    (m: any) => m.type === 'ClassMethod' && m.key?.name === 'ngOnDestroy'
  );
  if (!destroy || !destroy.start || !destroy.end) return null;
  return sourceCode.slice(destroy.start, destroy.end);
}

function makeIssue(partial: Omit<ScanIssue, 'id' | 'framework'>): ScanIssue {
  return { id: generateId(), framework: 'angular', ...partial };
}
