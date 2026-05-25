import { NextResponse } from "next/server";
import { getAllTodos, createTodo, type Priority } from "@/lib/db";

export function GET() {
  const todos = getAllTodos();
  return NextResponse.json(todos);
}

export async function POST(request: Request) {
  const body = await request.json();
  const title = (body.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  const priority: Priority = ["low", "medium", "high"].includes(body.priority)
    ? body.priority
    : "medium";
  const todo = createTodo(title, priority);
  return NextResponse.json(todo, { status: 201 });
}
