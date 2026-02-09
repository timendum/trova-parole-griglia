// SatorGrid.jsx
import React, {
  type KeyboardEvent,
  type ClipboardEvent,
  type ChangeEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

interface CharGridProp {
  size: number;
  defaultValues: string[][];
  onChange: null | ((matrix: string[][]) => void);
  autoFocus: boolean;
}

export default function CharGrid({
  size = 5,
  defaultValues, // pass [] or undefined for empty grid
  onChange, // callback when grid changes
  autoFocus = true,
}: CharGridProp) {
  const gridColsClass =
    {
      3: "grid-cols-3",
      4: "grid-cols-4",
      5: "grid-cols-5",
      6: "grid-cols-6",
      7: "grid-cols-7",
    }[size] ?? "grid-cols-5";
  // Flatten default values into a single array of strings
  const toFlat: (arr: string[][], n: number) => string[] = (
    arr: string[][],
    n: number
  ) => {
    if (!arr || arr.length !== n) return Array(n * n).fill("");
    const flat: string[] = [];
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        flat.push((arr[r]?.[c] ?? "").toString().slice(0, 1).toUpperCase());
      }
    }
    return flat;
  };

  const [cells, setCells] = useState<string[]>(() =>
    toFlat(defaultValues, size)
  );
  const inputsRef = useRef<HTMLInputElement[]>([]);

  // Keep a stable list of indexes for iteration
  const idxs = useMemo(
    () => Array.from({ length: size * size }, (_, i) => i),
    [size]
  );

  useEffect(() => {
    if (autoFocus && inputsRef.current[0]) {
      inputsRef.current[0].focus();
    }
  }, [autoFocus]);

  const setCell = (i: number, ch: string) => {
    setCells((prev: string[]) => {
      const next = [...prev];
      next[i] = ch;
      onChange?.(toMatrix(next, size));
      return next;
    });
  };

  const toMatrix = (flat: string[], n: number) => {
    const m = [];
    for (let r = 0; r < n; r++) {
      m.push(flat.slice(r * n, r * n + n));
    }
    return m;
  };

  const isLetter = (s: string) => /^[A-Za-z]$/.test(s);

  const moveFocus = (from: number, delta: number) => {
    const to = from + delta;
    if (to >= 0 && to < size * size) {
      inputsRef.current[to]?.focus();
      inputsRef.current[to]?.select?.();
    }
  };

  const handleChange = (i: number, e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.toUpperCase();
    if (!v) {
      setCell(i, "");
      return;
    }
    // Support typing or IME: take the last typed letter
    const lastChar = v[v.length - 1];
    if (isLetter(lastChar)) {
      setCell(i, lastChar);
      // auto-advance to the right if not last in row
      if (i % size !== size - 1) moveFocus(i, 1);
    } else {
      // non-letter: ignore but keep previous
      e.target.value = "";
    }
  };

  const handleKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    const key = e.key;

    if (key === "Backspace") {
      if (!cells[i]) {
        // Go back and clear previous if empty
        if (i > 0) {
          e.preventDefault();
          setCell(i - 1, "");
          moveFocus(i, -1);
        }
      } else {
        // Clear current but don't move
        setCell(i, "");
      }
    }

    if (key === "ArrowLeft") {
      e.preventDefault();
      moveFocus(i, -1);
    }
    if (key === "ArrowRight") {
      e.preventDefault();
      moveFocus(i, +1);
    }
    if (key === "ArrowUp") {
      e.preventDefault();
      moveFocus(i, -size);
    }
    if (key === "ArrowDown") {
      e.preventDefault();
      moveFocus(i, +size);
    }
  };

  const handlePaste = (i: number, e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (!e.clipboardData) {
      return;
    }
    const text = (e.clipboardData.getData("text") || "")
      .toUpperCase()
      .replace(/[^A-Z]/g, "");
    if (!text) return;

    const next = [...cells];
    let p = i;
    for (const ch of text) {
      if (p >= size * size) break;
      next[p] = ch;
      p++;
    }
    setCells(next);
    onChange?.(toMatrix(next, size));
    // Move focus to next empty or the last filled
    const nextFocus = Math.min(p, size * size - 1);
    inputsRef.current[nextFocus]?.focus();
    inputsRef.current[nextFocus]?.select?.();
  };

  // Utilities to draw thick outer border + thin inner lines
  const outer = "border-2 border-black";
  const inner = "border border-black/70"; // slightly lighter inner lines

  // Given (r,c), decide borders to create thick outer frame
  const bordersFor = (r: number, c: number) => {
    const classes = [];
    if (r === 0) classes.push("border-t-2 border-t-black");
    if (c === 0) classes.push("border-l-2 border-l-black");
    if (r === size - 1) classes.push("border-b-2 border-b-black");
    if (c === size - 1) classes.push("border-r-2 border-r-black");
    // inner lines (avoid double-overwriting thick ones by checking middle cells)
    if (r !== 0) classes.push("border-t border-black/70");
    if (c !== 0) classes.push("border-l border-black/70");
    return classes.join(" ");
  };

  return (
    <div className="block max-w-150">
      <div className={`grid grid-cols-${size} ${outer}`}>
        {idxs.map((i) => {
          const r = Math.floor(i / size);
          const c = i % size;
          return (
            <div
              key={i}
              className={`aspect-square ${inner} ${bordersFor(r, c)} bg-white`}
            >
              <input
                ref={(el) => {
                  if (el) {
                    inputsRef.current[i] = el;
                  }
                }}
                value={cells[i] || ""}
                onChange={(e) => handleChange(i, e)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onPaste={(e) => handlePaste(i, e)}
                onFocus={(e) => {
                  e.target.focus();
                  e.target.select();
                }}
                inputMode="text"
                maxLength={1}
                aria-label={`Riga ${r + 1}, Colonna ${c + 1}`}
                className="w-full h-full text-center text-2xl font-black tracking-widest uppercase
                           focus:outline-none focus:ring-2 focus:ring-blue-400
                           caret-transparent select-none"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
``;
