import { NextRequest, NextResponse } from "next/server";

export async function POST(_: NextRequest) {
  console.log("test...");
  const response = await fetch("https://api.anchorbrowser.io/api/sessions", {
    method: "POST",
    headers: {
      "anchor-api-key": process.env.ANCHOR_BROWSER_API_KEY || "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      headless: false,
      recording: {
        active: true,
      },
      idle_timeout: 1,
      timeout: 10,
    }),
  });

  const json = await response.json();
  return NextResponse.json(json);
}
