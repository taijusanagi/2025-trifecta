import { NextRequest, NextResponse } from "next/server";
import { setSessionLog, getSessionLog } from "@/lib/relayer";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const body = await req.json();

  if (!body) {
    return NextResponse.json({ error: "Missing log content" }, { status: 400 });
  }

  await setSessionLog(sessionId, JSON.stringify(body));
  return NextResponse.json({ message: "Log appended" });
}

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  try {
    const logs = await getSessionLog(sessionId);
    return NextResponse.json({ logs: logs.map((log) => JSON.parse(log)) });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 404 }
    );
  }
}
