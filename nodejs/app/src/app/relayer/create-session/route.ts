import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { setSessionInfo } from "@/lib/relayer";

export async function POST(req: NextRequest) {
  try {
    const { address, chainId, task, anchorSessionId, liveViewUrl } =
      await req.json();
    if (!address || !chainId || !task) {
      return NextResponse.json(
        { error: "Missing address or chainId or task" },
        { status: 400 }
      );
    }
    const sessionId = uuidv4();
    await setSessionInfo(sessionId, {
      address,
      chainId,
      task,
      anchorSessionId,
      liveViewUrl,
    });
    return NextResponse.json({ sessionId });
  } catch (error) {
    console.error("Error creating session:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
