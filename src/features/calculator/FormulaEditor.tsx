import { MathfieldElement } from "mathlive";
import { useEffect, useRef } from "react";

MathfieldElement.soundsDirectory = null;

interface FormulaEditorProps {
  value: string;
  onChange: (value: string) => void;
  onReady?: (mathfield: MathfieldElement | null) => void;
}

export function FormulaEditor({ value, onChange, onReady }: FormulaEditorProps) {
    const hostRef = useRef<HTMLDivElement>(null);
    const mathfieldRef = useRef<MathfieldElement | null>(null);
    const changeHandlerRef = useRef(onChange);
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
      mathfield.addEventListener("input", handleInput);
      hostRef.current.append(mathfield);
      mathfieldRef.current = mathfield;
      onReady?.(mathfield);
      return () => {
        mathfield.removeEventListener("input", handleInput);
        mathfield.remove();
        mathfieldRef.current = null;
        onReady?.(null);
      };
    }, [onReady]);

    useEffect(() => {
      const mathfield = mathfieldRef.current;
      if (mathfield && mathfield.value !== value) {
        mathfield.setValue(value, { silenceNotifications: true });
      }
    }, [value]);

    return <div className="formula-editor-host" ref={hostRef} />;
}
