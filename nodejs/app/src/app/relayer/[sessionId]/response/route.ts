import { NextRequest, NextResponse } from "next/server";
import { setSessionResponse } from "@/lib/relayer";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const body = await req.json();
  const { result } = body;
  console.log("response...!!");
  console.log(sessionId, result);
  await setSessionResponse(sessionId, result);
  return NextResponse.json({});
}
