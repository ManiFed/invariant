import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface AmmyContextValue {
  /** Extra context string pages can set dynamically */
  pageContext: string;
  setPageContext: (ctx: string) => void;
}

const AmmyContext = createContext<AmmyContextValue>({
  pageContext: "",
  setPageContext: () => {},
});

export function AmmyContextProvider({ children }: { children: ReactNode }) {
  const [pageContext, setPageContextRaw] = useState("");
  const setPageContext = useCallback((ctx: string) => setPageContextRaw(ctx), []);
  return (
    <AmmyContext.Provider value={{ pageContext, setPageContext }}>
      {children}
    </AmmyContext.Provider>
  );
}

export function useAmmyContext() {
  return useContext(AmmyContext);
}
