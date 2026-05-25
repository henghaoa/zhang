"use client";

import { useEffect, useState, useRef } from "react";

type Priority = "low" | "medium" | "high";

interface Todo {
  id: number;
  title: string;
  completed: boolean;
  priority: Priority;
  created_at: string;
}

const PRIORITY_COLORS: Record<Priority, string> = {
  low: "bg-blue-100 text-blue-700",
  medium: "bg-yellow-100 text-yellow-700",
  high: "bg-red-100 text-red-700",
};

type Filter = "all" | "active" | "completed";

export default function Home() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [input, setInput] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [filter, setFilter] = useState<Filter>("all");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const editRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/todos")
      .then((r) => r.json())
      .then(setTodos);
  }, []);

  useEffect(() => {
    if (editingId !== null) editRef.current?.focus();
  }, [editingId]);

  async function addTodo(e: React.FormEvent) {
    e.preventDefault();
    const title = input.trim();
    if (!title) return;
    const res = await fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, priority }),
    });
    const todo: Todo = await res.json();
    setTodos((prev) => [todo, ...prev]);
    setInput("");
  }

  async function toggleTodo(todo: Todo) {
    const res = await fetch(`/api/todos/${todo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !todo.completed }),
    });
    const updated: Todo = await res.json();
    setTodos((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  }

  async function deleteTodo(id: number) {
    await fetch(`/api/todos/${id}`, { method: "DELETE" });
    setTodos((prev) => prev.filter((t) => t.id !== id));
  }

  async function saveEdit(id: number) {
    const title = editText.trim();
    if (!title) return cancelEdit();
    const res = await fetch(`/api/todos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    const updated: Todo = await res.json();
    setTodos((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    cancelEdit();
  }

  function startEdit(todo: Todo) {
    setEditingId(todo.id);
    setEditText(todo.title);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditText("");
  }

  const filtered = todos.filter((t) => {
    if (filter === "active") return !t.completed;
    if (filter === "completed") return t.completed;
    return true;
  });

  const remaining = todos.filter((t) => !t.completed).length;

  async function clearCompleted() {
    const completed = todos.filter((t) => t.completed);
    await Promise.all(
      completed.map((t) => fetch(`/api/todos/${t.id}`, { method: "DELETE" }))
    );
    setTodos((prev) => prev.filter((t) => !t.completed));
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold text-center text-gray-800 mb-8">
        todos
      </h1>

      {/* Add todo form */}
      <form onSubmit={addTodo} className="flex gap-2 mb-6">
        <input
          className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          placeholder="What needs to be done?"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <select
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
          value={priority}
          onChange={(e) => setPriority(e.target.value as Priority)}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <button
          type="submit"
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition-colors"
        >
          Add
        </button>
      </form>

      {/* Todo list */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {filtered.length === 0 ? (
          <p className="text-center text-gray-400 py-10 text-sm">
            {filter === "completed"
              ? "No completed tasks yet."
              : filter === "active"
              ? "Nothing left to do!"
              : "Add your first task above."}
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {filtered.map((todo) => (
              <li
                key={todo.id}
                className="flex items-center gap-3 px-4 py-3 group hover:bg-gray-50 transition-colors"
              >
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={todo.completed}
                  onChange={() => toggleTodo(todo)}
                  className="w-4 h-4 accent-indigo-600 cursor-pointer flex-shrink-0"
                />

                {/* Title / edit input */}
                {editingId === todo.id ? (
                  <input
                    ref={editRef}
                    className="flex-1 border border-indigo-400 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onBlur={() => saveEdit(todo.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit(todo.id);
                      if (e.key === "Escape") cancelEdit();
                    }}
                  />
                ) : (
                  <span
                    onDoubleClick={() => startEdit(todo)}
                    className={`flex-1 text-sm cursor-pointer select-none ${
                      todo.completed
                        ? "line-through text-gray-400"
                        : "text-gray-700"
                    }`}
                    title="Double-click to edit"
                  >
                    {todo.title}
                  </span>
                )}

                {/* Priority badge */}
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                    PRIORITY_COLORS[todo.priority]
                  }`}
                >
                  {todo.priority}
                </span>

                {/* Delete button */}
                <button
                  onClick={() => deleteTodo(todo.id)}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all text-lg leading-none flex-shrink-0"
                  title="Delete"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Footer */}
        {todos.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-500">
            <span>{remaining} item{remaining !== 1 ? "s" : ""} left</span>
            <div className="flex gap-1">
              {(["all", "active", "completed"] as Filter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2 py-1 rounded capitalize transition-colors ${
                    filter === f
                      ? "border border-indigo-400 text-indigo-600"
                      : "hover:text-gray-700"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <button
              onClick={clearCompleted}
              className="hover:text-red-500 transition-colors"
            >
              Clear completed
            </button>
          </div>
        )}
      </div>

      <p className="text-center text-xs text-gray-400 mt-6">
        Double-click a task to edit it
      </p>
    </main>
  );
}
