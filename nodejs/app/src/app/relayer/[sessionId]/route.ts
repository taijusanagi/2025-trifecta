import { NextRequest, NextResponse } from "next/server";
import {
  getSessionAccount,
  setSessionRequest,
  waitForSessionResponse,
  deleteSessionRequest,
  deleteSessionResponse,
} from "@/lib/relayer";
import { JsonRpcRequest } from "@/types/json-rpc-request";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
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
      case "personal_sign":
      case "eth_sendTransaction":
        await setSessionRequest(sessionId, body);
        result = await waitForSessionResponse(sessionId);
        deleteSessionResponse(sessionId);
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
