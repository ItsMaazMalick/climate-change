"use client";

import {
  createContext,
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

export function CountryProvider({ children }: { children: ReactNode }) {
  const [country, setCountryState] = useState<CountryCode>(DEFAULT_COUNTRY);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as CountryCode | null;
      if (saved && (saved === "PAK" || saved === "UZB")) {
        setCountryState(saved);
      }
    } catch {
      // localStorage may not be available in private mode or SSR
    }
  }, []);

  const setCountry = (next: CountryCode) => {
    setCountryState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore
    }
  };

  const config = getCountry(country);

  return (
    <CountryContext.Provider value={{ country, config, setCountry }}>
      {children}
    </CountryContext.Provider>
  );
}

export function useCountry() {
  return useContext(CountryContext);
}
