import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";

import { Account } from "@/types/account";

interface JsonRpcRequest {
  jsonrpc: string;
  id: number;
  method: string;
  params?: any[];
}

const getSessionAccount = async (sessionId: string) => {
  const sessionAccountData = await kv.get(`${sessionId}:account`);
  if (!sessionAccountData) {
    throw new Error("Session not found");
  }
  return sessionAccountData as Account;
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
    const { address, chainId } = await getSessionAccount(sessionId);
    let result;
    switch (body.method) {
      case "eth_account":
        result = address;
        break;
      case "eth_accounts":
        result = [address];
        break;
      case "eth_requestAccounts":
        result = [address];
        break;
      case "eth_chainId":
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
