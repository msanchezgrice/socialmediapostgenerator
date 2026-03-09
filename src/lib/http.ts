import { NextResponse } from "next/server";

export function jsonOk(data: unknown, init?: ResponseInit) {
  return NextResponse.json({ ok: true, ...((data as Record<string, unknown>) ?? {}) }, init);
}

export function jsonError(code: string, message: string, status = 500, details?: Record<string, unknown>) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code,
        message,
        ...(details ?? {}),
      },
    },
    { status },
  );
}
