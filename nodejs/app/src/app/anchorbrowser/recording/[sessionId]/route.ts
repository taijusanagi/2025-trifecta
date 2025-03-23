import { getSessionInfo } from "@/lib/relayer";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  const { anchorSessionId } = await getSessionInfo(sessionId);
  const response = await fetch(
    `https://api.anchorbrowser.io/api/sessions/${anchorSessionId}/recording`,
    {
      method: "GET",
      headers: {
        "anchor-api-key": process.env.ANCHOR_BROWSER_API_KEY || "",
      },
    }
  );
  let recordingUrl = "";
  if (response.ok) {
    const { data } = await response.json();
    recordingUrl = data.videos[0];
  }
  return NextResponse.json({ recordingUrl });
}
