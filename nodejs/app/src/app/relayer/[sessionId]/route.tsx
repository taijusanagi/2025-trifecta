import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";

interface JsonRpcRequest {
  jsonrpc: string;
  id: number;
  method: string;
  params?: any[];
}

const getSessionAccount = async (sessionId: string) => {
  const sessionAccountData = await kv.get(`${sessionId}:account`);
  if (!sessionAccountData || typeof sessionAccountData != "string") {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  const parsedSessionAccount = JSON.parse(sessionAccountData);
  return parsedSessionAccount;
};

export async function GET(
  _: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const { sessionId } = await params;
  const sessionAccount = await getSessionAccount(sessionId);
  return NextResponse.json(sessionAccount);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = await params;
    const body: JsonRpcRequest = await req.json();
    console.log(`Received request for session ${sessionId}:`, body);

    let result;
    switch (body.method) {
      case "eth_accounts":
        const { address } = await getSessionAccount(sessionId);
        result = [address];
        break;
      case "eth_chainId":
        const { chainId } = await getSessionAccount(sessionId);
        result = chainId;
        break;
      default:
        result = `NOT IMPLEMENTED: ${body.method}`;
    }

    const response = {
      jsonrpc: "2.0",
      id: body.id,
      result,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error handling request:", error);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
