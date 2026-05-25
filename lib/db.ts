import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "todos.db");

let db: Database.Database;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.exec(`
      CREATE TABLE IF NOT EXISTS todos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        completed INTEGER NOT NULL DEFAULT 0,
        priority TEXT NOT NULL DEFAULT 'medium',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  }
  return db;
}

export type Priority = "low" | "medium" | "high";

export interface Todo {
  id: number;
  title: string;
  completed: boolean;
  priority: Priority;
  created_at: string;
}

export function getAllTodos(): Todo[] {
  const rows = getDb()
    .prepare("SELECT * FROM todos ORDER BY created_at DESC")
    .all() as Array<Omit<Todo, "completed"> & { completed: number }>;
  return rows.map((r) => ({ ...r, completed: r.completed === 1 }));
}

export function createTodo(
  title: string,
  priority: Priority = "medium"
): Todo {
  const stmt = getDb().prepare(
    "INSERT INTO todos (title, priority) VALUES (?, ?) RETURNING *"
  );
  const row = stmt.get(title, priority) as Omit<Todo, "completed"> & {
    completed: number;
  };
  return { ...row, completed: row.completed === 1 };
}

export function updateTodo(
  id: number,
  fields: Partial<Pick<Todo, "title" | "completed" | "priority">>
): Todo | null {
  const sets: string[] = [];
  const values: unknown[] = [];

  if (fields.title !== undefined) {
    sets.push("title = ?");
    values.push(fields.title);
  }
  if (fields.completed !== undefined) {
    sets.push("completed = ?");
    values.push(fields.completed ? 1 : 0);
  }
  if (fields.priority !== undefined) {
    sets.push("priority = ?");
    values.push(fields.priority);
  }

  if (sets.length === 0) return null;

  values.push(id);
  const stmt = getDb().prepare(
    `UPDATE todos SET ${sets.join(", ")} WHERE id = ? RETURNING *`
  );
  const row = stmt.get(...values) as
    | (Omit<Todo, "completed"> & { completed: number })
    | undefined;
  if (!row) return null;
  return { ...row, completed: row.completed === 1 };
}

export function deleteTodo(id: number): boolean {
  const result = getDb()
    .prepare("DELETE FROM todos WHERE id = ?")
    .run(id);
  return result.changes > 0;
}
