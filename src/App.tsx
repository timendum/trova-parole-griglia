import { useState } from "react";

import "./styles.css";

import CharGrid from "./chargrid";
import Words from "./parole_uniche.json";
import { findLongestWord } from "./algo";

export default function App() {
  const [solutions, setSolutions] = useState<string[]>([]);
  function solve(matrix: string[][]) {
    console.log(matrix);
    let board = [];
    for (const row of matrix) {
      let newRow = [];
      for (const c of row) {
        let p = c.trim();
        if (p.length) {
          newRow.push(p);
        }
      }
      if (newRow.length > 0) {
        board.push(newRow);
      }
    }
    const n = board.length;
    console.log("n=", n, board);
    if (n < 3) {
      return;
    }
    if (board.some((row) => row.length !== n)) {
      console.log(
        "row n=",
        board.map((row) => row.length)
      );
      return;
    }
    let solved = findLongestWord(board, Words);
    setSolutions(solved);
  }
  let rows = [];
  rows.push(<div>solutions[0]</div>);
  return (
    <div className="mx-auto px-1 py-1 xl:py-3">
      <h1 className="text-xl font-medium">Trova le parole nella griglia</h1>
      <p>Start editing to see some magic happen!</p>
      <CharGrid
        size={6}
        defaultValues={[
          ["", "", "", "", "", ""],
          ["", "", "", "", "", ""],
          ["", "", "", "", "", ""],
          ["", "", "", "", "", ""],
          ["", "", "", "", "", ""],
          ["", "", "", "", "", ""],
        ]}
        onChange={solve}
        autoFocus={true}
      />
      <div>
        <p>Soluzioni:</p>
        <ol className="pl-5 list-decimal">
          {solutions.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ol>
      </div>
    </div>
  );
}
