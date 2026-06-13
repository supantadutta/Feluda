/**
 * Doc & Data Ingest (Layer IV). Parses user-supplied documents into evidence
 * the loop can use, each carrying provenance back to the file. Phase 2 supports
 * plain text and markdown; PDF parsing is a documented extension point (needs a
 * parser dependency) and is reported honestly rather than faked.
 */
import type { Evidence } from '../types.js';
import { newId } from '../util/ids.js';

export interface IngestInput {
  /** Logical name / path of the document — used as the citation source. */
  name: string;
  mime: string;
  content: string;
}

export class DocIngestor {
  /** Turn a document into evidence chunks (one per non-empty paragraph). */
  ingest(doc: IngestInput): Evidence[] {
    if (!this.supports(doc.mime)) {
      throw new Error(`Unsupported document type "${doc.mime}" (Phase 2 supports text/markdown).`);
    }
    const retrievedAt = new Date().toISOString();
    return doc.content
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
      .map((p) => ({
        id: newId('ev'),
        claim: p,
        citation: { source: doc.name, title: doc.name, retrievedAt },
        credibility: 0.6, // user-supplied: trusted as provided, not independently verified
        relevance: 0.5,
        flags: ['user-document'],
      }));
  }

  supports(mime: string): boolean {
    return /^text\/(plain|markdown)$|^application\/(markdown)$/.test(mime);
  }
}
