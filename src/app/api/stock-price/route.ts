import { NextResponse } from "next/server";

import { getFinanceContext } from "@/lib/finance/context";
import { getStockQuote } from "@/lib/finance/stock-price";

export async function GET(request: Request) {
  const context = await getFinanceContext();
  if (!context.context) {
    return NextResponse.json({ error: context.error }, { status: 401 });
  }

  const symbol = new URL(request.url).searchParams.get("symbol");
  if (!symbol) return NextResponse.json({ error: "請提供股票代號。" }, { status: 400 });

  try {
    const quote = await getStockQuote(symbol);
    return NextResponse.json(quote, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "無法取得股票報價。" },
      { status: 422 },
    );
  }
}
