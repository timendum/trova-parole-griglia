type Char = string; // single lowercase character a-z

class TrieNode {
  children: Map<Char, TrieNode> = new Map();
  isWord: boolean = false;
  /** Longest remaining chain length from this node (in characters).
   *  Used for pruning: if currentLen + maxDepth <= bestLen, stop. */
  maxDepth: number = 0;
}

class Trie {
  root = new TrieNode();

  insert(word: string) {
    let node = this.root;
    for (const ch of word) {
      let child = node.children.get(ch);
      if (!child) {
        child = new TrieNode();
        node.children.set(ch, child);
      }
      node = child;
    }
    node.isWord = true;
  }

  /**
   * Post-order compute maxDepth for pruning.
   * maxDepth(node) = 0 if leaf; else 1 + max(maxDepth(children))
   */
  computeMaxDepths() {
    const dfs = (node: TrieNode): number => {
      if (node.children.size === 0) {
        node.maxDepth = 0;
        return 0;
      }
      let best = 0;
      for (const child of node.children.values()) {
        const d = dfs(child);
        if (d > best) best = d;
      }
      node.maxDepth = 1 + best;
      return node.maxDepth;
    };
    dfs(this.root);
  }
}

/** Normalize: lowercase ASCII letters only; optionally strip others. */
function normalizeWord(raw: string): string {
  // If your dictionary has accents/apostrophes, adjust normalization accordingly.
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

/** Count letters in the 5×5 board. */
function countBoardLetters(board: string[][]): Record<Char, number> {
  const cnt: Record<Char, number> = Object.create(null);
  const n = board.length;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const ch = board[r][c].toLowerCase();
      if (!/^[a-z]$/.test(ch))
        throw new Error(`Invalid board letter '${board[r][c]}' at (${r},${c})`);
      cnt[ch] = (cnt[ch] ?? 0) + 1;
    }
  }
  return cnt;
}

/** Quick check: does word require any letter more times than board provides? */
function fitsBoardMultiset(
  word: string,
  boardCnt: Record<Char, number>
): boolean {
  // Early reject by counting letters in the word up to the board's need.
  const need: Record<Char, number> = Object.create(null);
  for (let i = 0; i < word.length; i++) {
    const ch = word[i] as Char;
    const have = boardCnt[ch] ?? 0;
    const cur = (need[ch] ?? 0) + 1;
    if (cur > have) return false;
    need[ch] = cur;
  }
  return true;
}

/** Precompute neighbors (4-directional) for n*n cells flattened to 0..(n*n-1) indices. */
function precomputeAdjacency(n: number): number[][] {
  const adj: number[][] = Array.from({ length: n * n }, () => []);
  const idx = (r: number, c: number) => r * n + c;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const u = idx(r, c);
      if (r > 0) adj[u].push(idx(r - 1, c));
      if (r < n - 1) adj[u].push(idx(r + 1, c));
      if (c > 0) adj[u].push(idx(r, c - 1));
      if (c < n - 1) adj[u].push(idx(r, c + 1));
    }
  }
  return adj;
}

/** Flatten board into a n*n-char array and map each cell to its char. */
function flattenBoard(board: string[][]): Char[] {
  const n = board.length;
  if (board.some((row) => row.length !== n)) {
    throw new Error(`Board must be ${n}x${n}`);
  }
  const arr: Char[] = new Array(n * n);
  let k = 0;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const ch = board[r][c].toLowerCase();
      if (!/^[a-z]$/.test(ch))
        throw new Error(`Invalid board letter '${board[r][c]}' at (${r},${c})`);
      arr[k++] = ch;
    }
  }
  return arr;
}

/**
 * Build a trie from an Iterable of words with pre-filtering by board letter multiset.
 * Returns the constructed trie and the count of inserted words.
 */
function buildTrieForBoard(
  words: Iterable<string>,
  boardCnt: Record<Char, number>
): { trie: Trie; inserted: number } {
  const trie = new Trie();
  let inserted = 0;
  for (const raw of words) {
    const w = normalizeWord(raw);
    if (w.length === 0) continue;
    // Optional: cap by board path length. You can’t exceed 25 cells.
    // if (w.length > 25) continue;
    if (!fitsBoardMultiset(w, boardCnt)) continue;
    trie.insert(w);
    inserted++;
  }
  trie.computeMaxDepths();
  return { trie, inserted };
}

/**
 * Find the single longest word on the board according to:
 * - Start anywhere
 * - Move up/down/left/right
 * - Do not reuse cells
 * - Must follow a dictionary word path (trie)
 */

export function findLongestWord(
  board: string[][],
  words: Iterable<string>
): string[] {
  const letters = flattenBoard(board);
  const boardCnt = countBoardLetters(board);
  const { trie } = buildTrieForBoard(words, boardCnt);
  const n = board.length;
  const adj = precomputeAdjacency(n);

  // Collect unique words grouped by their lengths.
  const byLen = new Map<number, Set<string>>();
  const lengthCounts = new Array<number>(26).fill(0); // 0..25
  let totalUnique = 0;

  // Dynamic pruning threshold (5th longest length seen so far).
  // 0 means "no threshold yet" (collect everything).
  let threshold = 0;

  function addWord(w: string, len: number) {
    let bucket = byLen.get(len);
    if (!bucket) {
      bucket = new Set<string>();
      byLen.set(len, bucket);
    }
    const sizeBefore = bucket.size;
    bucket.add(w);
    if (bucket.size !== sizeBefore) {
      // New unique word
      totalUnique++;
      lengthCounts[len]++;
      // Update threshold iff we already have at least 5 words
      if (totalUnique >= 5) {
        threshold = computeFifthLength(lengthCounts);
      }
    }
  }

  function computeFifthLength(counts: number[]): number {
    let acc = 0;
    for (let L = 25; L >= 1; L--) {
      acc += counts[L];
      if (acc >= 5) return L; // this is the 5th word's length
    }
    return 0;
  }

  // Reuse a char buffer for the current path.
  const path: Char[] = new Array(n * n);

  // DFS: cell u, trie node, visited mask, depth (word length so far)
  function dfs(u: number, node: TrieNode, visited: number, depth: number) {
    if (node.isWord) {
      const w = path.slice(0, depth).join("");
      addWord(w, depth);
    }

    // If we already have at least 5 words, prune branches that cannot reach the 5th-length threshold.
    if (threshold > 0) {
      const maxIfContinueByTrie = depth + node.maxDepth;
      if (maxIfContinueByTrie < threshold) return;
    }

    const neigh = adj[u];
    for (let i = 0; i < neigh.length; i++) {
      const v = neigh[i];
      const bit = 1 << v;
      if ((visited & bit) !== 0) continue;
      const ch = letters[v];
      const child = node.children.get(ch);
      if (!child) continue;

      path[depth] = ch;
      dfs(v, child, visited | bit, depth + 1);
    }
  }

  // Start DFS from cells that match a root edge
  for (let u = 0; u < n * n; u++) {
    const ch = letters[u];
    const child = trie.root.children.get(ch);
    if (!child) continue;
    path[0] = ch;
    dfs(u, child, 1 << u, 1);
  }

  // Assemble final result: sort by length desc, and lexicographically within each length.
  const result: string[] = [];
  for (let L = 25; L >= 1; L--) {
    const set = byLen.get(L);
    if (!set || set.size === 0) continue;
    const wordsAtL = Array.from(set).sort(); // deterministic
    result.push(...wordsAtL);
    if (result.length >= 5) {
      // We just included all words of this length L (the 5th word's length).
      // Requirement met: at least 5, including all ties for the 5th.
      break;
    }
  }

  return result;
}
