import { NextRequest, NextResponse } from "next/server";
import { getSessionAccount } from "@/lib/relayer";

export async function GET(
  _: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const { sessionId } = await params;
  const sessionAccount = await getSessionAccount(sessionId);
  return NextResponse.json(sessionAccount);
}
