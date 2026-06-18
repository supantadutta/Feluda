/**
 * Feluda CLI. Runs the investigator from the terminal — offline by default
 * (deterministic stubs/fixtures), upgrading to live providers when keys are set
 * in the environment. `run()` returns its output instead of exiting, so it is
 * testable; the bin wrapper at the bottom wires it to the process.
 *
 *   feluda investigate "<question>"
 *   feluda osint --target example.com [--type domain]
 *   feluda soc --type brute_force --log "Failed password ..." --log "..."
 *   feluda --help
 */
import {
  InvestigationCore,
  Council,
  Evidence as EvidenceLayer,
  Osint,
  Soc,
} from '@feluda/core';

export interface RunResult {
  code: number;
  out: string;
}

const HELP = `Feluda — investigative reasoning & lawful OSINT (defensive only)

Usage:
  feluda investigate "<question>"
  feluda osint --target <indicator> [--type <type>]
  feluda soc --type <alert_type> [--title <t>] [--context <c>] [--log <line> ...]
  feluda --help

Offline by default. Set ANTHROPIC_API_KEY / WEB_SEARCH_API_KEY for live mode.`;

/** Minimal flag parser: --key value (repeatable keys collect into arrays). */
function parseFlags(args: string[]): Record<string, string[]> {
  const flags: Record<string, string[]> = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = args[i + 1] && !args[i + 1]!.startsWith('--') ? args[++i]! : '';
      (flags[key] ??= []).push(val);
    }
  }
  return flags;
}

export async function run(argv: string[]): Promise<RunResult> {
  const [command, ...rest] = argv;
  if (!command || command === '--help' || command === '-h') return { code: 0, out: HELP };

  const flags = parseFlags(rest);
  const env = process.env;

  switch (command) {
    case 'investigate': {
      const question = rest.filter((a) => !a.startsWith('--')).join(' ').trim();
      if (!question) return { code: 1, out: 'error: a question is required\n' };
      const orchestrator = InvestigationCore.createOrchestrator({
        gateway: Council.createModelGateway({ apiKey: env.ANTHROPIC_API_KEY, model: env.FELUDA_DEFAULT_MODEL }),
        evidence: EvidenceLayer.createEvidencePort({ searchApiKey: env.WEB_SEARCH_API_KEY }),
      });
      const v = await orchestrator.investigate({ id: 'cli', text: question, receivedAt: new Date().toISOString() });
      return { code: 0, out: renderVerdict(v) };
    }
    case 'osint': {
      const target = flags.target?.[0];
      if (!target) return { code: 1, out: 'error: --target is required\n' };
      const result = await new Osint.OsintEngine().investigate(target, flags.type?.[0] as Osint.OsintTargetType | undefined);
      return { code: 0, out: renderOsint(result) };
    }
    case 'soc': {
      const type = flags.type?.[0] as Soc.SocAlertType | undefined;
      if (!type) return { code: 1, out: 'error: --type is required\n' };
      const assessment = new Soc.SocAnalyzer().analyze({
        type,
        title: flags.title?.[0],
        context: flags.context?.[0],
        logs: flags.log,
      });
      return { code: 0, out: renderSoc(assessment) };
    }
    default:
      return { code: 1, out: `error: unknown command "${command}"\n\n${HELP}` };
  }
}

function renderVerdict(v: { answer: string; confidence: { band: string; score: number; gaps: string[] }; citations: { source: string }[]; investigation?: { rounds: number; mode: string } }): string {
  return [
    'ANSWER',
    v.answer,
    '',
    `CONFIDENCE: ${v.confidence.band} (${(v.confidence.score * 100).toFixed(0)}%)`,
    v.confidence.gaps.length ? `GAPS: ${v.confidence.gaps.join('; ')}` : '',
    v.investigation ? `ROUNDS: ${v.investigation.rounds} (${v.investigation.mode})` : '',
    v.citations.length ? `CITATIONS:\n${v.citations.map((c) => `  - ${c.source}`).join('\n')}` : 'CITATIONS: none',
    '',
  ].filter(Boolean).join('\n');
}

function renderOsint(r: Osint.OsintResult): string {
  const rows = r.findings.map((f) => `  [${f.grade}] ${f.claim} (${f.citation.source})`).join('\n');
  return [
    `OSINT — ${r.target.type}: ${r.target.normalized}${r.offline ? ' (offline fixtures)' : ''}`,
    'FINDINGS:',
    rows || '  (none)',
    `ENTITIES: ${r.graph.nodes.map((n) => `${n.type}:${n.value}`).join(', ') || '(none)'}`,
    `NOTES:\n${r.notes.map((n) => `  - ${n}`).join('\n')}`,
    '',
  ].join('\n');
}

function renderSoc(a: Soc.SocAssessment): string {
  return [
    `SOC — ${a.alertSummary}`,
    `ASSESSMENT: ${a.verdict.replace(/_/g, ' ')} (confidence: ${a.confidence.replace(/_/g, ' ')})${a.escalate ? ' — ESCALATE' : ''}`,
    `REASONING: ${a.reasoning}`,
    'RECOMMENDED ACTIONS (defensive):',
    ...a.recommendedActions.map((x) => `  - ${x}`),
    '',
  ].join('\n');
}

// Bin wrapper — only runs when executed directly, not when imported by tests.
const invokedDirectly = process.argv[1] && /cli[/\\](src[/\\]index\.ts|dist[/\\]index\.js)$/.test(process.argv[1]);
if (invokedDirectly) {
  run(process.argv.slice(2)).then((r) => {
    process.stdout.write(r.out.endsWith('\n') ? r.out : r.out + '\n');
    process.exit(r.code);
  });
}
