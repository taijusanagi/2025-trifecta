import { NextRequest, NextResponse } from "next/server";
import {
  setSessionLog,
  getSessionLog,
  getSessionInfo,
  setSessionInfo,
} from "@/lib/relayer";

const defaultLog = {
  current_state: {
    evaluation_previous_goal: "Start wallet injected browser",
    next_goal: "Connect browser",
  },
  action: [
    {
      connect: { type: "chromium" },
    },
  ],
};

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
  const done = body.action.find((obj: any) => obj.done);

  if (done) {
    const {
      done: { success },
    } = done;
    console.log("Session done", success);
    const info = await getSessionInfo(sessionId);
    await setSessionInfo(sessionId, {
      ...info,
      success,
    });
  }

  return NextResponse.json({ message: "Log appended" });
}

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  try {
    let logs = await getSessionLog(sessionId);

    if (!logs || logs.length === 0) {
      // Automatically append default log if no logs exist
      await setSessionLog(sessionId, JSON.stringify(defaultLog));
      logs = [JSON.stringify(defaultLog)];
    }

    return NextResponse.json({ logs: logs.map((log) => JSON.parse(log)) });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 404 }
    );
  }
}
