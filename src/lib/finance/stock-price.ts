import "server-only";

export type StockQuote = {
  symbol: string;
  name: string;
  price: number;
  currency: "TWD" | "USD";
  usdTwd: number;
  updatedAt: string;
};

const symbolPattern = /^[A-Z0-9^=-]{1,15}(?:\.[A-Z]{1,5})?$/;

async function fetchChart(symbol: string) {
  const url = new URL(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`,
  );
  url.searchParams.set("range", "1d");
  url.searchParams.set("interval", "1m");
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 TandemFinance/1.0" },
    signal: AbortSignal.timeout(8_000),
    next: { revalidate: 60 },
  });
  if (!response.ok) throw new Error(`股價來源回傳 ${response.status}。`);

  const payload = (await response.json()) as {
    chart?: {
      error?: { description?: string } | null;
      result?: {
        meta?: {
          currency?: string;
          regularMarketPrice?: number;
          longName?: string;
          shortName?: string;
          symbol?: string;
        };
      }[] | null;
    };
  };
  const result = payload.chart?.result?.[0];
  if (payload.chart?.error || !result?.meta) {
    throw new Error(payload.chart?.error?.description ?? "找不到該股票代號。");
  }
  return result.meta;
}

async function fetchUsdTwdRate() {
  try {
    const quote = await fetchChart("USDTWD=X");
    const rate = Number(quote.regularMarketPrice);
    if (Number.isFinite(rate) && rate > 0) return rate;
  } catch {
    // Yahoo Finance's canonical symbol for USD/TWD is TWD=X.
  }

  const quote = await fetchChart("TWD=X");
  const rate = Number(quote.regularMarketPrice);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error("目前無法取得 USD/TWD 匯率。");
  }
  return rate;
}

export async function getStockQuote(inputSymbol: string): Promise<StockQuote> {
  const symbol = inputSymbol.trim().toUpperCase();
  if (!symbolPattern.test(symbol)) throw new Error("股票代號格式不正確。");

  const [stock, usdTwd] = await Promise.all([
    fetchChart(symbol),
    fetchUsdTwdRate(),
  ]);
  const currency = stock.currency;
  if (currency !== "TWD" && currency !== "USD") {
    throw new Error(`目前不支援 ${currency ?? "未知"} 幣別的股票。`);
  }
  const price = Number(stock.regularMarketPrice);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("目前無法取得有效的最新股價。");
  }
  return {
    symbol: stock.symbol ?? symbol,
    name: stock.longName || stock.shortName || symbol,
    price,
    currency,
    usdTwd,
    updatedAt: new Date().toISOString(),
  };
}
