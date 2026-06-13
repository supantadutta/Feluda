/**
 * Lawful-Use Gate + Defensive Filter (Layer VII).
 *
 * A rule-based first line that enforces the CLAUDE.md hard boundaries on every
 * inbound request and outbound answer. It is intentionally conservative and
 * explainable: when it blocks, it names the boundary and proposes a lawful
 * alternative. Heuristics here are a floor, not a ceiling — they catch clear
 * cases; nuanced judgement still belongs to the model's own safety training.
 */
import type { Boundary } from '../types.js';
import type { EthicsGate, GateDecision } from './index.js';

interface Rule {
  boundary: Boundary;
  pattern: RegExp;
}

/** Weapon / CBRN uplift — blocked everywhere, in and out. */
const WEAPON_RULES: Rule[] = [
  {
    boundary: 'weapon-cbrn',
    pattern:
      /\b(bioweapon|biological weapon|chemical weapon|nerve agent|sarin|vx gas|nuclear (?:weapon|bomb)|dirty bomb|pipe bomb|\bied\b|improvised explosive|weaponi[sz]e (?:a )?(?:pathogen|virus|anthrax)|synthesize (?:a )?(?:nerve agent|pathogen))\b/i,
  },
];

/** Offensive cyber — blocked. Defensive security is allowed (SPEC Layer VI). */
const OFFENSIVE_CYBER_RULES: Rule[] = [
  {
    // The malicious artifact must be the direct object of the create-verb, so
    // "write a detection rule to catch malware" (defensive) is NOT blocked while
    // "write malware" / "build a keylogger" are.
    boundary: 'defensive-only',
    pattern:
      /\b(?:write|build|create|develop|code|generate|make)\s+(?:a|an|the|some|me|my)?\s*(?:new|custom|simple|working|functional|undetectable)?\s*(?:malware|ransomware|keylogger|rootkit|botnet|spyware|trojan|computer virus|exploit|0-?day|zero-?day|c2 framework|command[- ]and[- ]control framework)\b/i,
  },
  {
    boundary: 'defensive-only',
    pattern:
      /\b(ddos|denial[- ]of[- ]service attack|credential stuffing|phishing kit|sql injection payload|bypass (?:the )?(?:authentication|auth|login|2fa|mfa|paywall)|crack (?:the |a |his |her |their )?password)\b/i,
  },
];

/** Stalking / surveillance / doxxing / private-data digging on individuals. */
const LAWFUL_USE_RULES: Rule[] = [
  {
    boundary: 'lawful-use',
    pattern:
      /\b(stalk|surveil|spy on|doxx?|track (?:down )?(?:someone|a person|my ex|her|him|this person)|find out where (?:\w+ )?lives|home address of|hack (?:into )?(?:his|her|their|someone'?s|somebody'?s) (?:account|email|phone|instagram|facebook|whatsapp)|read (?:his|her|their|someone'?s) (?:private|dm|messages)|(?:social security number|ssn|passport number) of)\b/i,
  },
];

const ALTERNATIVES: Record<Boundary, string> = {
  'lawful-use':
    "I can't help locate, track, or dig up private information about a specific person. " +
    'I can help with publicly available information, lawful OSINT on organizations, or general ' +
    'guidance on privacy, safety, and how to report a concern through proper channels.',
  'defensive-only':
    "I can't help build offensive security tooling. I can help with the defensive side: " +
    'detecting this activity, hardening systems, drafting detection rules, or triaging logs.',
  'weapon-cbrn':
    "I can't help with weapons or CBRN topics. I can point you to general, safety-focused " +
    'science education from reputable public sources instead.',
};

function firstMatch(rules: Rule[], text: string): GateDecision | undefined {
  for (const rule of rules) {
    if (rule.pattern.test(text)) {
      return {
        allowed: false,
        boundary: rule.boundary,
        reason: `Request appears to cross the ${rule.boundary} boundary.`,
        lawfulAlternative: ALTERNATIVES[rule.boundary],
      };
    }
  }
  return undefined;
}

const ALLOWED: GateDecision = { allowed: true };

export class RuleBasedEthicsGate implements EthicsGate {
  screenRequest(text: string): GateDecision {
    return (
      firstMatch(WEAPON_RULES, text) ??
      firstMatch(OFFENSIVE_CYBER_RULES, text) ??
      firstMatch(LAWFUL_USE_RULES, text) ??
      ALLOWED
    );
  }

  /**
   * Screen generated answers. We re-check only the hard-harm categories
   * (weapon/CBRN, offensive cyber) to catch a model that complied with
   * something it shouldn't; the personal-privacy heuristics would over-trigger
   * on benign mentions in prose, so they are not applied to outputs.
   */
  screenResponse(text: string): GateDecision {
    return firstMatch(WEAPON_RULES, text) ?? firstMatch(OFFENSIVE_CYBER_RULES, text) ?? ALLOWED;
  }
}
