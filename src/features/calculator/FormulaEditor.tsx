import { MathfieldElement } from "mathlive";
import { useEffect, useRef } from "react";
import { useMathfieldFocus } from "./MathfieldFocusContext";

MathfieldElement.soundsDirectory = null;

interface FormulaEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function FormulaEditor({ value, onChange }: FormulaEditorProps) {
    const hostRef = useRef<HTMLDivElement>(null);
    const mathfieldRef = useRef<MathfieldElement | null>(null);
    const changeHandlerRef = useRef(onChange);
    const { activate, release, setDefault } = useMathfieldFocus();
    changeHandlerRef.current = onChange;

    useEffect(() => {
      if (!hostRef.current) return;
      const mathfield = new MathfieldElement();
      mathfield.className = "formula-mathfield";
      mathfield.mathVirtualKeyboardPolicy = "manual";
      mathfield.smartFence = true;
      mathfield.setAttribute("aria-label", "输入完整积分公式");
      mathfield.setValue(value, { silenceNotifications: true });
      const handleInput = () => changeHandlerRef.current(mathfield.value);
      const handleFocus = () => activate(mathfield, "完整积分公式");
      mathfield.addEventListener("input", handleInput);
      mathfield.addEventListener("focusin", handleFocus);
      mathfield.addEventListener("pointerdown", handleFocus);
      hostRef.current.append(mathfield);
      mathfieldRef.current = mathfield;
      setDefault(mathfield);
      return () => {
        release(mathfield);
        setDefault(null);
        mathfield.removeEventListener("input", handleInput);
        mathfield.removeEventListener("focusin", handleFocus);
        mathfield.removeEventListener("pointerdown", handleFocus);
        mathfield.remove();
        mathfieldRef.current = null;
      };
    }, [activate, release, setDefault]);

    useEffect(() => {
      const mathfield = mathfieldRef.current;
      if (mathfield && mathfield.value !== value) {
        mathfield.setValue(value, { silenceNotifications: true });
      }
    }, [value]);

    return <div className="formula-editor-host" ref={hostRef} />;
}
