import { NextResponse } from "next/server";
import { updateTodo, deleteTodo, type Priority } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id: rawId } = await params;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const body = await request.json();
  const fields: Parameters<typeof updateTodo>[1] = {};

  if (typeof body.title === "string") fields.title = body.title.trim();
  if (typeof body.completed === "boolean") fields.completed = body.completed;
  if (["low", "medium", "high"].includes(body.priority))
    fields.priority = body.priority as Priority;

  const todo = updateTodo(id, fields);
  if (!todo) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(todo);
}

export async function DELETE(_: Request, { params }: Params) {
  const { id: rawId } = await params;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const ok = deleteTodo(id);
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
