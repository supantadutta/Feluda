/**
 * Layer VI — Action (boundary module)
 * ───────────────────────────────────
 * Turn conclusions into deliverables and handle daily admin: Report Builder
 * (Markdown/HTML), Data & Charts (sandbox-safe CSV analysis + SVG), defensive-
 * only security helpers, and Daily Ops (tasks/reminders).
 *
 * EVERY consequential action passes through the Layer VII approval gate before
 * it runs (CLAUDE.md — Human-in-the-loop). The ActionService blocks a
 * consequential action with `awaitingApproval` until `payload.confirmed` is set.
 *
 * Phase: implemented in Phase 5.
 */
import type { Verdict } from '../types.js';
import type { ApprovalGate } from '../layer7-ethics/index.js';
import { createApprovalGate } from '../layer7-ethics/index.js';
import { ReportBuilder, type ReportFormat } from './report-builder.js';
import { DataAnalyzer } from './data-analyzer.js';
import { DefensiveSecurity } from './defensive-security.js';
import { DailyOps } from './daily-ops.js';

/** A proposed action the user may need to confirm. */
export interface ActionRequest {
  kind: string;
  payload: Record<string, unknown>;
}

/** Result of attempting an action. */
export interface ActionResult {
  ok: boolean;
  /** Set when the action is blocked pending user confirmation. */
  awaitingApproval?: boolean;
  detail?: Record<string, unknown>;
}

/** The boundary the Orchestrator/API uses to perform actions. */
export interface ActionPort {
  perform(req: ActionRequest): Promise<ActionResult>;
}

export { ReportBuilder, type ReportFormat, type Report } from './report-builder.js';
export { DataAnalyzer, type DataAnalysis, type ColumnStats } from './data-analyzer.js';
export { DefensiveSecurity, type LogFinding } from './defensive-security.js';
export { DailyOps, type Task } from './daily-ops.js';

export interface ActionServiceConfig {
  approval?: ApprovalGate;
}

export class ActionService implements ActionPort {
  private readonly reports = new ReportBuilder();
  private readonly data = new DataAnalyzer();
  private readonly security = new DefensiveSecurity();
  private readonly ops = new DailyOps();
  private readonly approval: ApprovalGate;

  constructor(config: ActionServiceConfig = {}) {
    this.approval = config.approval ?? createApprovalGate();
  }

  async perform(req: ActionRequest): Promise<ActionResult> {
    // ── Approval gate: consequential actions need explicit confirmation ──
    if (this.approval.requiresApproval(req.kind) && req.payload.confirmed !== true) {
      return {
        ok: false,
        awaitingApproval: true,
        detail: { message: `"${req.kind}" is consequential — confirm to proceed.`, kind: req.kind },
      };
    }

    switch (req.kind) {
      case 'report.export':
      case 'report.share': {
        const report = this.reports.build(
          req.payload.verdict as Verdict,
          (req.payload.format as ReportFormat) ?? 'markdown',
          (req.payload.title as string) ?? undefined,
        );
        return { ok: true, detail: { report } };
      }
      case 'data.analyze':
        return { ok: true, detail: { analysis: this.data.analyzeCsv(String(req.payload.csv ?? '')) } };
      case 'security.triage':
        return {
          ok: true,
          detail: { findings: this.security.triageLogs((req.payload.lines as string[]) ?? []) },
        };
      case 'security.detection-rule':
        return {
          ok: true,
          detail: {
            rule: this.security.draftDetectionRule(
              String(req.payload.title ?? 'Untitled'),
              String(req.payload.pattern ?? ''),
            ),
          },
        };
      case 'security.hardening':
        return { ok: true, detail: { checklist: this.security.hardeningChecklist(String(req.payload.system ?? '')) } };
      case 'ops.task.add':
        return { ok: true, detail: { task: this.ops.add(String(req.payload.title ?? ''), req.payload.due as string | undefined) } };
      case 'ops.task.list':
        return { ok: true, detail: { tasks: this.ops.list() } };
      case 'ops.task.complete':
        return { ok: true, detail: { task: this.ops.complete(String(req.payload.id ?? '')) } };
      case 'ops.task.delete':
        return { ok: true, detail: { deleted: this.ops.delete(String(req.payload.id ?? '')) } };
      default:
        return { ok: false, detail: { error: `Unknown action kind "${req.kind}".` } };
    }
  }

  /** Direct access to the task store (the API reuses it for listing). */
  get tasks(): DailyOps {
    return this.ops;
  }
}

/** Build the default Action service with the consequential-action approval gate. */
export function createActionPort(config: ActionServiceConfig = {}): ActionService {
  return new ActionService(config);
}
