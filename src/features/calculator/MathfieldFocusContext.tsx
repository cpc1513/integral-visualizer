import type { MathfieldElement } from "mathlive";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

interface ActiveMathfield {
  element: MathfieldElement;
  label: string;
}

interface MathfieldFocusValue {
  active: ActiveMathfield | null;
  activate: (element: MathfieldElement, label: string) => void;
  release: (element: MathfieldElement) => void;
  setDefault: (element: MathfieldElement | null, label?: string) => void;
}

const MathfieldFocusContext = createContext<MathfieldFocusValue | null>(null);

export function MathfieldFocusProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<ActiveMathfield | null>(null);
  const defaultRef = useRef<ActiveMathfield | null>(null);
  const activate = useCallback((element: MathfieldElement, label: string) => setActive({ element, label }), []);
  const release = useCallback((element: MathfieldElement) => {
    setActive((current) => (current?.element === element ? defaultRef.current : current));
  }, []);
  const setDefault = useCallback((element: MathfieldElement | null, label = "完整积分公式") => {
    const previous = defaultRef.current;
    defaultRef.current = element ? { element, label } : null;
    setActive((current) => {
      if (element && (!current || current.element === previous?.element)) return { element, label };
      if (!element && current?.element === previous?.element) return null;
      return current;
    });
  }, []);
  const value = useMemo(() => ({ active, activate, release, setDefault }), [active, activate, release, setDefault]);
  return <MathfieldFocusContext.Provider value={value}>{children}</MathfieldFocusContext.Provider>;
}

export function useMathfieldFocus() {
  const value = useContext(MathfieldFocusContext);
  if (!value) throw new Error("useMathfieldFocus must be used inside MathfieldFocusProvider");
  return value;
}
