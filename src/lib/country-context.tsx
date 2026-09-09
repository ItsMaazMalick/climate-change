"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  CountryCode,
  CountryConfig,
  COUNTRIES,
  DEFAULT_COUNTRY,
  getCountry,
} from "@/lib/climate/countries";

interface CountryContextType {
  country: CountryCode;
  config: CountryConfig;
  setCountry: (country: CountryCode) => void;
}

const CountryContext = createContext<CountryContextType>({
  country: DEFAULT_COUNTRY,
  config: COUNTRIES[DEFAULT_COUNTRY],
  setCountry: () => {},
});

const STORAGE_KEY = "climate_platform_selected_country";
const CODES: CountryCode[] = ["PAK", "UZB", "AUS", "NZL"];

function isCode(v: string | null | undefined): v is CountryCode {
  return v === "PAK" || v === "UZB" || v === "AUS" || v === "NZL";
}

/** URL is the source of truth, then localStorage, then the default. */
function readInitial(): CountryCode {
  if (typeof window === "undefined") return DEFAULT_COUNTRY;
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("country");
    if (fromUrl && isCode(fromUrl.toUpperCase())) {
      return fromUrl.toUpperCase() as CountryCode;
    }
  } catch {
    /* ignore */
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isCode(saved)) return saved;
  } catch {
    /* ignore */
  }
  return DEFAULT_COUNTRY;
}

export function CountryProvider({ children }: { children: ReactNode }) {
  const [country, setCountryState] = useState<CountryCode>(DEFAULT_COUNTRY);

  // Hydrate once from URL / localStorage.
  useEffect(() => {
    const initial = readInitial();
    if (initial !== country) setCountryState(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setCountry = useCallback((next: CountryCode) => {
    setCountryState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("country", next.toLowerCase());
      window.history.replaceState(null, "", url.toString());
    } catch {
      /* ignore */
    }
  }, []);

  // Keep `?country=` present so every view is a shareable link.
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get("country")?.toUpperCase() !== country) {
        url.searchParams.set("country", country.toLowerCase());
        window.history.replaceState(null, "", url.toString());
      }
    } catch {
      /* ignore */
    }
  }, [country]);

  return (
    <CountryContext.Provider value={{ country, config: getCountry(country), setCountry }}>
      {children}
    </CountryContext.Provider>
  );
}

export function useCountry() {
  return useContext(CountryContext);
}

export { CODES as COUNTRY_CODE_LIST };
