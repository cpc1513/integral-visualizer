import { MathfieldElement } from "mathlive";
import { useCallback, useEffect, useId, useRef } from "react";
import { useMathfieldFocus } from "./MathfieldFocusContext";

MathfieldElement.soundsDirectory = null;

interface FormulaEditorProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export function FormulaEditor({ value, onChange, error = "" }: FormulaEditorProps) {
  const errorId = useId();
  const hostRef = useRef<HTMLDivElement>(null);
  const mathfieldRef = useRef<MathfieldElement | null>(null);
  const changeHandlerRef = useRef(onChange);
  const { activate, release, setDefault } = useMathfieldFocus();
  changeHandlerRef.current = onChange;

  const focusForEditing = useCallback((mathfield: MathfieldElement) => {
    activate(mathfield, "完整积分公式");
    mathfield.focus();
    window.setTimeout(() => {
      if (document.activeElement !== mathfield) mathfield.focus();
    }, 0);
  }, [activate]);

  useEffect(() => {
    if (!hostRef.current) return;
    const mathfield = new MathfieldElement();
    mathfield.className = "formula-mathfield";
    mathfield.mathVirtualKeyboardPolicy = "manual";
    mathfield.smartFence = true;
    mathfield.setAttribute("inputmode", "text");
    mathfield.setAttribute("aria-label", "输入完整积分公式");
    mathfield.setValue(value, { silenceNotifications: true });
    const handleInput = () => changeHandlerRef.current(mathfield.value);
    const handleFocus = () => focusForEditing(mathfield);
    mathfield.addEventListener("input", handleInput);
    mathfield.addEventListener("focusin", handleFocus);
    mathfield.addEventListener("pointerdown", handleFocus);
    mathfield.addEventListener("touchstart", handleFocus, { passive: true });
    hostRef.current.append(mathfield);
    mathfieldRef.current = mathfield;
    setDefault(mathfield, "完整积分公式");
    return () => {
      release(mathfield);
      setDefault(null);
      mathfield.removeEventListener("input", handleInput);
      mathfield.removeEventListener("focusin", handleFocus);
      mathfield.removeEventListener("pointerdown", handleFocus);
      mathfield.removeEventListener("touchstart", handleFocus);
      mathfield.remove();
      mathfieldRef.current = null;
    };
  }, [focusForEditing, release, setDefault]);

  useEffect(() => {
    const mathfield = mathfieldRef.current;
    if (mathfield && mathfield.value !== value) {
      mathfield.setValue(value, { silenceNotifications: true });
    }
  }, [value]);

  useEffect(() => {
    const mathfield = mathfieldRef.current;
    if (!mathfield) return;
    if (error) {
      mathfield.setAttribute("aria-invalid", "true");
      mathfield.setAttribute("aria-describedby", errorId);
    } else {
      mathfield.removeAttribute("aria-invalid");
      mathfield.removeAttribute("aria-describedby");
    }
  }, [error, errorId]);

  return (
    <div className="formula-editor">
      <div
        className="formula-editor-host"
        ref={hostRef}
        onPointerDown={() => {
          const mathfield = mathfieldRef.current;
          if (mathfield) focusForEditing(mathfield);
        }}
      />
      {error ? <p className="formula-editor-error" id={errorId} role="alert">{error}</p> : null}
    </div>
  );
}
