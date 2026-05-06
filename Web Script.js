/* ============================================================
   PseudoKiai — script.js
   Sudoku game with backtracking generator, highlighting,
   mistake system, and popup feedback.
   ============================================================ */

// ── State ──────────────────────────────────────────────────
let solution   = [];   // 9×9 complete solution
let puzzle     = [];   // 9×9 puzzle (0 = empty)
let userBoard  = [];   // 9×9 user input (0 = empty)
let given      = [];   // 9×9 boolean: is cell given?

let selectedRow    = -1;
let selectedCol    = -1;
let selectedNumber = null;
let mistakes       = 0;
let timerInterval  = null;
let timerSeconds   = 0;
let gameActive     = false;
let istighfarCount = 0;
let hasExtraLifeUsed = false;

const MAX_MISTAKES = 3;
const ISTIGHFAR_TARGET = 10;

// ── DOM Refs ───────────────────────────────────────────────
// (pindahkan inisialisasi DOM ke DOMContentLoaded)
let board, mistakesDisplay, timerDisplay, newGameBtn, eraseBtn, numpad, numBtns;
let popupOverlay, popupClose, gameoverOverlay, gameoverRestart, gameoverIstighfar, winOverlay, winRestart;
let gameoverMessage, istighfarProgress, istighfarSection;

// ── Init ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // init DOM refs here so mereka pasti ada
  board            = document.getElementById('sudoku-board');
  mistakesDisplay  = document.getElementById('mistakes-display');
  timerDisplay     = document.getElementById('timer-display');
  newGameBtn       = document.getElementById('new-game-btn');
  eraseBtn         = document.getElementById('erase-btn');
  numpad           = document.getElementById('numpad');
  numBtns          = document.querySelectorAll('.num-btn');

  popupOverlay     = document.getElementById('popup-overlay');
  popupClose       = document.getElementById('popup-close');
  gameoverOverlay  = document.getElementById('gameover-overlay');
  gameoverRestart  = document.getElementById('gameover-restart');
  gameoverIstighfar = document.getElementById('gameover-istighfar');
  gameoverMessage  = document.getElementById('gameover-message');
  istighfarProgress = document.getElementById('istighfar-progress');
  istighfarSection = document.getElementById('istighfar-section');
  winOverlay       = document.getElementById('win-overlay');
  winRestart       = document.getElementById('win-restart');

  buildBoard();
  startNewGame();
  bindEvents();
});

function bindEvents() {
  newGameBtn.addEventListener('click', startNewGame);
  eraseBtn.addEventListener('click', eraseCell);
  popupClose.addEventListener('click', () => closeOverlay(popupOverlay));
  gameoverRestart.addEventListener('click', startNewGame);
  gameoverIstighfar.addEventListener('click', handleIstighfarClick);
  winRestart.addEventListener('click', startNewGame);

  numBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const num = parseInt(btn.dataset.num);
      selectNumber(num);
    });
  });

  document.addEventListener('keydown', handleKeyDown);
}

// ── Board DOM Construction ─────────────────────────────────
function buildBoard() {
  board.innerHTML = '';
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row = r;
      cell.dataset.col = c;

      // Determine which 3×3 box
      const boxRow = Math.floor(r / 3);
      const boxCol = Math.floor(c / 3);
      const boxIndex = boxRow * 3 + boxCol;
      cell.classList.add(boxIndex % 2 === 0 ? 'box-even' : 'box-odd');

      cell.addEventListener('click', () => handleCellClick(r, c));
      board.appendChild(cell);
    }
  }
}

function getCellEl(r, c) {
  return board.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
}

// ── New Game ───────────────────────────────────────────────
function startNewGame() {
  closeOverlay(popupOverlay);
  closeOverlay(gameoverOverlay);
  closeOverlay(winOverlay);

  mistakes = 0;
  selectedRow = -1;
  selectedCol = -1;
  selectedNumber = null;
  timerSeconds = 0;
  gameActive = true;
  istighfarCount = 0;
  hasExtraLifeUsed = false;

  clearTimer();
  updateMistakeDisplay();
  clearNumSelection();
  updateIstighfarDisplay();

  // Generate
  solution  = generateSolution();
  puzzle    = createPuzzle(solution, 40); // remove ~40 cells
  userBoard = puzzle.map(row => [...row]);
  given     = puzzle.map(row => row.map(v => v !== 0));

  renderBoard();
  startTimer();
}

// ── Sudoku Generator (backtracking) ───────────────────────
function generateSolution() {
  const grid = Array.from({ length: 9 }, () => Array(9).fill(0));
  solveSudoku(grid, true);
  return grid;
}

function solveSudoku(grid, randomize = false) {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] === 0) {
        let nums = [1,2,3,4,5,6,7,8,9];
        if (randomize) nums = shuffle(nums);
        for (const num of nums) {
          if (isValid(grid, r, c, num)) {
            grid[r][c] = num;
            if (solveSudoku(grid, randomize)) return true;
            grid[r][c] = 0;
          }
        }
        return false;
      }
    }
  }
  return true;
}

function isValid(grid, row, col, num) {
  // Row check
  if (grid[row].includes(num)) return false;
  // Col check
  for (let r = 0; r < 9; r++) if (grid[r][col] === num) return false;
  // Box check
  const br = Math.floor(row / 3) * 3;
  const bc = Math.floor(col / 3) * 3;
  for (let r = br; r < br + 3; r++)
    for (let c = bc; c < bc + 3; c++)
      if (grid[r][c] === num) return false;
  return true;
}

function createPuzzle(sol, removeCount) {
  const puzzle = sol.map(row => [...row]);
  const cells  = shuffle([...Array(81).keys()]);
  let removed  = 0;
  for (const idx of cells) {
    if (removed >= removeCount) break;
    const r = Math.floor(idx / 9);
    const c = idx % 9;
    const backup = puzzle[r][c];
    puzzle[r][c] = 0;
    // Quick uniqueness check: just ensure still solvable (light check)
    const test = puzzle.map(row => [...row]);
    if (countSolutions(test) === 1) {
      removed++;
    } else {
      puzzle[r][c] = backup;
    }
  }
  return puzzle;
}

function countSolutions(grid, limit = 2) {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] === 0) {
        let count = 0;
        for (let num = 1; num <= 9; num++) {
          if (isValid(grid, r, c, num)) {
            grid[r][c] = num;
            count += countSolutions(grid, limit);
            grid[r][c] = 0;
            if (count >= limit) return count;
          }
        }
        return count;
      }
    }
  }
  return 1;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Render Board ───────────────────────────────────────────
function renderBoard() {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      renderCell(r, c);
    }
  }
  updateHighlights();
}

function renderCell(r, c) {
  const cell = getCellEl(r, c);
  if (!cell) return;

  // Remove value classes
  cell.classList.remove('given', 'filled-correct', 'filled-wrong');
  cell.innerHTML = '';

  const val = userBoard[r][c];
  if (val !== 0) {
    const span = document.createElement('span');
    span.textContent = val;
    cell.appendChild(span);

    if (given[r][c]) {
      cell.classList.add('given');
    } else if (val === solution[r][c]) {
      cell.classList.add('filled-correct');
    } else {
      cell.classList.add('filled-wrong');
    }
  }
}

// ── Highlight System ───────────────────────────────────────
function updateHighlights() {
  // Clear all highlights
  document.querySelectorAll('.cell').forEach(cell => {
    cell.classList.remove('selected', 'highlight-area', 'highlight-box', 'highlight-same');
  });

  if (selectedRow === -1) return;

  const boxRowStart = Math.floor(selectedRow / 3) * 3;
  const boxColStart = Math.floor(selectedCol / 3) * 3;
  const selectedVal = userBoard[selectedRow][selectedCol];

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const cell = getCellEl(r, c);
      if (!cell) continue;

      const inRow  = r === selectedRow;
      const inCol  = c === selectedCol;
      const inBox  = r >= boxRowStart && r < boxRowStart + 3 &&
                     c >= boxColStart && c < boxColStart + 3;

      if (r === selectedRow && c === selectedCol) {
        cell.classList.add('selected');
      } else if (inBox) {
        cell.classList.add('highlight-box');
      } else if (inRow || inCol) {
        cell.classList.add('highlight-area');
      }

      // Highlight same number
      if (selectedVal !== 0 && userBoard[r][c] === selectedVal &&
          !(r === selectedRow && c === selectedCol)) {
        cell.classList.add('highlight-same');
      }
    }
  }
}

// ── Cell Click ─────────────────────────────────────────────
function handleCellClick(r, c) {
  if (!gameActive) return;

  selectedRow = r;
  selectedCol = c;
  updateHighlights();

  // If a number is already selected, try to place it
  if (selectedNumber !== null) {
    placeNumber(r, c, selectedNumber);
    clearNumSelection();
  }
}

// ── Number Selection ───────────────────────────────────────
function selectNumber(num) {
  if (!gameActive) return;
  selectedNumber = num;
  numBtns.forEach(b => b.classList.remove('selected'));

  if (selectedRow !== -1 && selectedCol !== -1) {
    placeNumber(selectedRow, selectedCol, num);
    clearNumSelection();
  }
}

function clearNumSelection() {
  selectedNumber = null;
  numBtns.forEach(b => b.classList.remove('selected'));
}

// ── Place Number ───────────────────────────────────────────
function placeNumber(r, c, num) {
  if (given[r][c]) return;         // can't change given cells
  if (userBoard[r][c] === solution[r][c] && userBoard[r][c] !== 0) return; // already correct

  userBoard[r][c] = num;
  renderCell(r, c);
  updateHighlights();

  if (num === solution[r][c]) {
    // Correct
    const cell = getCellEl(r, c);
    cell.classList.add('pop-in');
    setTimeout(() => cell.classList.remove('pop-in'), 300);

    showCorrectPopup();
    checkWin();
  } else {
    // Wrong
    mistakes++;
    updateMistakeDisplay();

    const cell = getCellEl(r, c);
    cell.classList.add('flash-error');
    setTimeout(() => {
      cell.classList.remove('flash-error');
      // Reset cell back to empty after flash
      userBoard[r][c] = 0;
      renderCell(r, c);
      updateHighlights();
    }, 600);

    if (mistakes >= MAX_MISTAKES) {
      gameOver();
    }
  }
}

// ── Erase ──────────────────────────────────────────────────
function eraseCell() {
  if (!gameActive || selectedRow === -1) return;
  if (given[selectedRow][selectedCol]) return;
  userBoard[selectedRow][selectedCol] = 0;
  renderCell(selectedRow, selectedCol);
  updateHighlights();
}

// ── Keyboard Input ─────────────────────────────────────────
function handleKeyDown(e) {
  if (!gameActive) return;

  if (e.key >= '1' && e.key <= '9') {
    selectNumber(parseInt(e.key));
    return;
  }
  if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
    eraseCell();
    return;
  }
  if (e.key === 'Escape') { clearNumSelection(); return; }

  // Arrow navigation
  if (selectedRow === -1) { selectedRow = 0; selectedCol = 0; }
  let nr = selectedRow, nc = selectedCol;
  if (e.key === 'ArrowUp')    nr = Math.max(0, nr - 1);
  if (e.key === 'ArrowDown')  nr = Math.min(8, nr + 1);
  if (e.key === 'ArrowLeft')  nc = Math.max(0, nc - 1);
  if (e.key === 'ArrowRight') nc = Math.min(8, nc + 1);

  if (nr !== selectedRow || nc !== selectedCol) {
    selectedRow = nr; selectedCol = nc;
    updateHighlights();
    e.preventDefault();
  }
}

// ── Mistake Display ────────────────────────────────────────
function updateMistakeDisplay() {
  mistakesDisplay.textContent = `${mistakes} / ${MAX_MISTAKES}`;
  for (let i = 1; i <= 3; i++) {
    const dot = document.getElementById(`dot-${i}`);
    dot.classList.toggle('active', i <= mistakes);
  }
}

// ── Timer ──────────────────────────────────────────────────
function startTimer() {
  clearTimer();
  timerInterval = setInterval(() => {
    timerSeconds++;
    const m = String(Math.floor(timerSeconds / 60)).padStart(2, '0');
    const s = String(timerSeconds % 60).padStart(2, '0');
    timerDisplay.textContent = `${m}:${s}`;
  }, 1000);
}

function clearTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
  timerDisplay.textContent = '00:00';
  timerSeconds = 0;
}

// ── Popup Helpers ──────────────────────────────────────────
function showOverlay(el)  { el.classList.add('active'); }
function closeOverlay(el) { el.classList.remove('active'); }

function showCorrectPopup() {
  const iconEl = document.getElementById('popup-icon');
  const titleEl = document.getElementById('popup-title');
  const msgEl = document.getElementById('popup-message');

  iconEl.textContent = '✓';
  titleEl.textContent = 'Tepat!';
  msgEl.innerHTML = 'Silakan ambil kertas dan cocokkan dengan angka yang kamu pilih';

  showOverlay(popupOverlay);
}

function gameOver() {
  gameActive = false;
  clearTimer();
  setTimeout(openGameOverMenu, 400);
}

function openGameOverMenu() {
  const hasBonus = !hasExtraLifeUsed;
  gameoverMessage.innerHTML = hasBonus
    ? 'Kesalahanmu sudah mencapai batas. Kamu bisa mendapat satu nyawa lagi jika melakukan <strong>istighfar 10x</strong>.'
    : 'Kesalahanmu sudah mencapai batas dan kesempatan tambahan sudah habis. Yuk coba lagi dan tetap sabar.';

  istighfarSection.style.display = hasBonus ? 'block' : 'none';
  gameoverIstighfar.disabled = false;
  gameoverIstighfar.classList.remove('disabled');
  gameoverOverlay.querySelector('.popup-card').classList.remove('bonus-active');
  updateIstighfarDisplay();
  showOverlay(gameoverOverlay);
}

function handleIstighfarClick() {
  if (hasExtraLifeUsed) return;

  istighfarCount++;
  updateIstighfarDisplay();

  if (istighfarCount >= ISTIGHFAR_TARGET) {
    grantExtraLife();
  }
}

function updateIstighfarDisplay() {
  if (!istighfarSection) return;
  istighfarProgress.textContent = `Istighfar: ${istighfarCount} / ${ISTIGHFAR_TARGET}`;
}

function grantExtraLife() {
  hasExtraLifeUsed = true;
  mistakes = MAX_MISTAKES - 1;
  updateMistakeDisplay();
  gameActive = true;

  gameoverMessage.innerHTML = 'Alhamdulillah! Kamu mendapat satu nyawa lagi. Yuk lanjutkan permainan dengan hati tenang.';
  istighfarSection.style.display = 'none';
  gameoverIstighfar.disabled = true;
  gameoverIstighfar.classList.add('disabled');
  const card = gameoverOverlay.querySelector('.popup-card');
  card.classList.add('bonus-active');
  setTimeout(() => closeOverlay(gameoverOverlay), 800);
}

function checkWin() {
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (userBoard[r][c] !== solution[r][c]) return;

  // All correct!
  gameActive = false;
  clearTimer();
  closeOverlay(popupOverlay);
  setTimeout(() => showOverlay(winOverlay), 300);
}