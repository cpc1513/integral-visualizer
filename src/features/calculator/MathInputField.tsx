import { MathfieldElement } from "mathlive";
import { useCallback, useEffect, useId, useRef } from "react";
import { useMathfieldFocus } from "./MathfieldFocusContext";

interface MathInputFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
}

export function MathInputField({ label, value, onChange, compact = false }: MathInputFieldProps) {
  const id = useId();
  const hostRef = useRef<HTMLDivElement>(null);
  const mathfieldRef = useRef<MathfieldElement | null>(null);
  const changeHandlerRef = useRef(onChange);
  const { activate, release } = useMathfieldFocus();
  changeHandlerRef.current = onChange;

  const focusForEditing = useCallback((mathfield: MathfieldElement) => {
    activate(mathfield, label);
    mathfield.focus();
    window.setTimeout(() => {
      if (document.activeElement !== mathfield) mathfield.focus();
    }, 0);
  }, [activate, label]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const mathfield = new MathfieldElement();
    mathfield.id = id;
    mathfield.className = "math-input-control";
    mathfield.mathVirtualKeyboardPolicy = "manual";
    mathfield.smartFence = true;
    mathfield.setAttribute("inputmode", "text");
    mathfield.setAttribute("aria-label", label);
    mathfield.setValue(value, { silenceNotifications: true });
    const handleInput = () => changeHandlerRef.current(mathfield.value);
    const handleFocus = () => focusForEditing(mathfield);
    mathfield.addEventListener("input", handleInput);
    mathfield.addEventListener("focusin", handleFocus);
    mathfield.addEventListener("pointerdown", handleFocus);
    mathfield.addEventListener("touchstart", handleFocus, { passive: true });
    host.append(mathfield);
    mathfieldRef.current = mathfield;
    return () => {
      release(mathfield);
      mathfield.removeEventListener("input", handleInput);
      mathfield.removeEventListener("focusin", handleFocus);
      mathfield.removeEventListener("pointerdown", handleFocus);
      mathfield.removeEventListener("touchstart", handleFocus);
      mathfield.remove();
      mathfieldRef.current = null;
    };
  }, [focusForEditing, id, label, release]);

  useEffect(() => {
    const mathfield = mathfieldRef.current;
    if (mathfield && mathfield.value !== value) mathfield.setValue(value, { silenceNotifications: true });
  }, [value]);

  return (
    <label
      className={`expression-field${compact ? " is-compact" : ""}`}
      htmlFor={id}
      onPointerDown={() => {
        const mathfield = mathfieldRef.current;
        if (mathfield) focusForEditing(mathfield);
      }}
    >
      <span>{label}</span>
      <div className="math-input-host" ref={hostRef} />
    </label>
  );
}
