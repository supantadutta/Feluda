/**
 * Phase 0 scaffold helper. Layer logic is implemented phase-by-phase
 * (see BUILD_PLAN.md). Stubs throw this so an accidental early call is loud
 * rather than silently wrong.
 */
export class NotImplementedError extends Error {
  constructor(what: string) {
    super(`${what} is not implemented yet (see BUILD_PLAN.md for the phase).`);
    this.name = 'NotImplementedError';
  }
}

export function notImplemented(what: string): never {
  throw new NotImplementedError(what);
}
