import { NextRequest, NextResponse } from "next/server";
import { getSessionRequest } from "@/lib/relayer";

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const data = await getSessionRequest(sessionId).catch(() => undefined);
  return NextResponse.json(data || {});
}
