/**
 * Daily Ops (Layer VI) — tasks, reminders, follow-ups. A small in-process store
 * behind an interface so it can be swapped for a calendar/DB integration later.
 */
import { newId } from '../util/ids.js';

export interface Task {
  id: string;
  title: string;
  due?: string;
  done: boolean;
  createdAt: string;
}

export class DailyOps {
  private tasks = new Map<string, Task>();

  add(title: string, due?: string): Task {
    const task: Task = { id: newId('task'), title, due, done: false, createdAt: new Date().toISOString() };
    this.tasks.set(task.id, task);
    return task;
  }

  list(): Task[] {
    return [...this.tasks.values()];
  }

  complete(id: string): Task | undefined {
    const t = this.tasks.get(id);
    if (t) t.done = true;
    return t;
  }

  delete(id: string): boolean {
    return this.tasks.delete(id);
  }
}
