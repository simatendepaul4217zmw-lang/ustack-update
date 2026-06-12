import { createContext, useContext, useState, useCallback } from "react";
import { BTC_PRICE_ZMW } from "./ustack-data";

export type Currency = "ZMW" | "USD" | "BTC";

const USD_PER_ZMW = 0.037; // approx exchange rate
const CURRENCY_KEY = "ustack_currency";

function ls(fallback: Currency): Currency {
  try { return (localStorage.getItem(CURRENCY_KEY) as Currency) || fallback; } catch { return fallback; }
}

interface CurrencyContextValue {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  fmtValue: (sats: number, priceZmw?: number) => string;
  symbol: string;
}

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: "ZMW",
  setCurrency: () => {},
  fmtValue: () => "",
  symbol: "K",
});

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>(() => ls("ZMW"));

  const setCurrency = useCallback((c: Currency) => {
    setCurrencyState(c);
    try { localStorage.setItem(CURRENCY_KEY, c); } catch {}
  }, []);

  const fmtValue = useCallback((sats: number, priceZmw = BTC_PRICE_ZMW): string => {
    if (currency === "BTC") {
      const btc = sats / 100_000_000;
      return btc < 0.001 ? `${sats.toLocaleString()} sats` : `${btc.toFixed(6)} BTC`;
    }
    const zmw = (sats / 100_000_000) * priceZmw;
    if (currency === "USD") {
      const usd = zmw * USD_PER_ZMW;
      return `$${usd < 1 ? usd.toFixed(2) : Math.round(usd).toLocaleString()}`;
    }
    // ZMW default
    return `K ${zmw < 1 ? zmw.toFixed(2) : Math.round(zmw).toLocaleString()}`;
  }, [currency]);

  const symbol = currency === "ZMW" ? "K" : currency === "USD" ? "$" : "₿";

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, fmtValue, symbol }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
