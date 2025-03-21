import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { kv } from "@vercel/kv";

export async function POST(req: NextRequest) {
  try {
    const { address, chainId } = await req.json();
    if (!address || !chainId) {
      return NextResponse.json(
        { error: "Missing address or chainId" },
        { status: 400 }
      );
    }

    const sessionId = uuidv4();
    console.log("session created", sessionId);
    await kv.set(`${sessionId}:account`, JSON.stringify({ address, chainId }));
    return NextResponse.json({ sessionId });
  } catch (error) {
    console.error("Error creating session:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
