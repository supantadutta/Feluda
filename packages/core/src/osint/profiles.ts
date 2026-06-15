/**
 * Passive OSINT profiles. For each target type, what Feluda MAY do (lawful,
 * passive, public-source) and what it must NEVER do. These are guardrails the
 * engine and Ethics layer rely on.
 */
import type { OsintProfile, OsintTargetType } from './types.js';

const NEVER = [
  'intrusive scanning or probing',
  'exploitation or vulnerability testing',
  'credential attacks or login attempts',
  'bypassing authentication or access controls',
  'scraping private/closed accounts',
  'doxxing or deanonymising private individuals',
  'harassment, surveillance, or tracking of individuals',
];

const PROFILES: Record<OsintTargetType, OsintProfile> = {
  domain: {
    targetType: 'domain',
    allowedSources: ['WHOIS/RDAP', 'DNS records', 'certificate transparency', 'public reputation feeds', 'web/news search'],
    disallowedActions: NEVER,
    enrichment: ['registration metadata', 'passive DNS', 'TLS certificates', 'public reputation'],
  },
  ip: {
    targetType: 'ip',
    allowedSources: ['RDAP/WHOIS', 'ASN/owner lookup', 'public reputation feeds', 'passive DNS'],
    disallowedActions: NEVER,
    enrichment: ['network owner / ASN', 'geolocation (coarse)', 'public reputation'],
  },
  url: {
    targetType: 'url',
    allowedSources: ['URL reputation feeds', 'public sandbox reports', 'web search'],
    disallowedActions: [...NEVER, 'live fetching of suspected-malicious URLs'],
    enrichment: ['reputation', 'known categorisation', 'public sandbox verdicts'],
  },
  email: {
    targetType: 'email',
    allowedSources: ['domain reputation of the email domain', 'public breach-exposure indicators (lawful, aggregate)'],
    disallowedActions: [...NEVER, 'exposing private personal data', 'enabling contact for harassment'],
    enrichment: ['email-domain reputation', 'public, lawful exposure indicators (aggregate only)'],
  },
  username: {
    targetType: 'username',
    allowedSources: ['public profile existence (lawful, passive)'],
    disallowedActions: [...NEVER, 'cross-site correlation to deanonymise a person'],
    enrichment: ['public presence (existence only, no personal profiling)'],
  },
  organization: {
    targetType: 'organization',
    allowedSources: ['public registries', 'official filings', 'news', 'official website'],
    disallowedActions: NEVER,
    enrichment: ['public corporate records', 'official communications', 'news coverage'],
  },
  person_public: {
    targetType: 'person_public',
    allowedSources: ['official statements', 'reputable news about public roles'],
    disallowedActions: [...NEVER, 'compiling a personal dossier', 'home address / private contact details'],
    enrichment: ['public-role information from reputable sources only'],
  },
  file_hash: {
    targetType: 'file_hash',
    allowedSources: ['public malware reputation', 'public sandbox reports', 'threat-intel feeds'],
    disallowedActions: NEVER,
    enrichment: ['known-malware reputation', 'public detection names', 'family attribution (public)'],
  },
  cve: {
    targetType: 'cve',
    allowedSources: ['NVD / vendor advisories', 'CISA KEV', 'public exploit-availability status (defensive)'],
    disallowedActions: [...NEVER, 'producing working exploit code'],
    enrichment: ['CVSS / severity', 'affected products', 'patch availability', 'KEV status'],
  },
  phone: {
    targetType: 'phone',
    allowedSources: ['public carrier/region metadata only'],
    disallowedActions: [...NEVER, 'locating or tracking the owner', 'exposing the owner identity'],
    enrichment: ['coarse region/carrier metadata only (no owner identification)'],
  },
  soc_alert: {
    targetType: 'soc_alert',
    allowedSources: ['user-provided logs/alerts', 'public reputation of contained indicators'],
    disallowedActions: NEVER,
    enrichment: ['indicator extraction', 'reputation enrichment', 'defensive triage'],
  },
  unknown: {
    targetType: 'unknown',
    allowedSources: ['web/news search'],
    disallowedActions: NEVER,
    enrichment: ['general public-source research'],
  },
};

export function profileFor(type: OsintTargetType): OsintProfile {
  return PROFILES[type];
}
