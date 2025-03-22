import { NextRequest } from "next/server";

const TARGET_RPC_URL =
  process.env.TARGET_RPC_URL || "https://evm.testnet.recall.chain.love/";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const response = await fetch(TARGET_RPC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        error: "Failed to proxy JSON-RPC request",
        detail: error.message,
      }),
      { status: 500 }
    );
  }
}
