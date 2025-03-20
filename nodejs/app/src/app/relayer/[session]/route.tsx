import { NextRequest, NextResponse } from "next/server";

interface JsonRpcRequest {
  jsonrpc: string;
  id: number;
  method: string;
  params?: any[];
}

interface RelayerInfo {
  address: string;
  chainId: string;
}

const relayerInfo: RelayerInfo = {
  address: "0x1234567890abcdef1234567890abcdef12345678",
  chainId: "0x1", // Ethereum mainnet
};

export async function GET() {
  return NextResponse.json(relayerInfo);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { session: string } }
) {
  try {
    const { session } = await params;
    const body: JsonRpcRequest = await req.json();
    console.log(`Received request for session ${session}:`, body);

    let result;
    switch (body.method) {
      case "eth_accounts":
        result = [relayerInfo.address];
        break;
      case "eth_chainId":
        result = relayerInfo.chainId;
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
