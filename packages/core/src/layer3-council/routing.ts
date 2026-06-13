/**
 * Specialist Routing (Layer III). Routes a task to the model best suited for it
 * (code, math, long-context, vision, general). A simple, declarative map keeps
 * routing explicit and testable; the gateway uses the returned model id.
 */
import type { ModelRequest } from './index.js';

export type TaskType = NonNullable<ModelRequest['task']>;

export class SpecialistRouter {
  constructor(
    private readonly routes: Partial<Record<TaskType, string>>,
    private readonly fallback: string,
  ) {}

  /** Choose a model id for a task. */
  route(task: TaskType = 'general'): string {
    return this.routes[task] ?? this.fallback;
  }
}
