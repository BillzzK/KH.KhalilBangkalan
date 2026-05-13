/* =====================================================================
   PseudoKiai — The Journey of KH. Khalil Bangkalan
   Multiplayer Sudoku Game — script.js
   ===================================================================== */

// ======================== STATE ========================
let players = [];
let currentPlayerIndex = 0;
let board = [];       // 9x9 current state (0 = empty)
let solution = [];    // 9x9 solution
let given = [];       // 9x9 boolean: is cell given?
let selectedCell = null; // {row, col}
let selectedNum = null;
let timerInterval = null;
let timerSeconds = 0;
let totalEmpty = 0;
let correctCount = 0;
let istighfarCount = 0;
let istighfarTarget = 10;
let pendingLivesPlayerIdx = null;

// ======================== SUDOKU GENERATOR ========================
function generateFullBoard() {
  const b = Array.from({length:9}, () => Array(9).fill(0));
  fillBoard(b);
  return b;
}

function fillBoard(b) {
  for (let r=0; r<9; r++) {
    for (let c=0; c<9; c++) {
      if (b[r][c] === 0) {
        const nums = shuffle([1,2,3,4,5,6,7,8,9]);
        for (const n of nums) {
          if (isValid(b,r,c,n)) {
            b[r][c] = n;
            if (fillBoard(b)) return true;
            b[r][c] = 0;
          }
        }
        return false;
      }
    }
  }
  return true;
}

function isValid(b, row, col, num) {
  for (let i=0; i<9; i++) {
    if (b[row][i] === num) return false;
    if (b[i][col] === num) return false;
  }
  const br = Math.floor(row/3)*3, bc = Math.floor(col/3)*3;
  for (let i=0; i<3; i++) for (let j=0; j<3; j++)
    if (b[br+i][bc+j] === num) return false;
  return true;
}

function shuffle(arr) {
  for (let i=arr.length-1; i>0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]] = [arr[j],arr[i]];
  }
  return arr;
}

function countSolutions(b, limit=2) {
  let count = 0;
  function solve() {
    if (count >= limit) return;
    for (let r=0; r<9; r++) {
      for (let c=0; c<9; c++) {
        if (b[r][c] === 0) {
          for (let n=1; n<=9; n++) {
            if (isValid(b,r,c,n)) {
              b[r][c] = n;
              solve();
              b[r][c] = 0;
            }
          }
          return;
        }
      }
    }
    count++;
  }
  solve();
  return count;
}

function createPuzzle() {
  solution = generateFullBoard();
  board = solution.map(r => [...r]);
  given = Array.from({length:9}, () => Array(9).fill(false));

  let toRemove = 40;
  let attempts = 0;
  while (toRemove > 0 && attempts < 300) {
    const r = Math.floor(Math.random()*9);
    const c = Math.floor(Math.random()*9);
    if (board[r][c] === 0) { attempts++; continue; }
    const backup = board[r][c];
    board[r][c] = 0;
    const tmp = board.map(row => [...row]);
    if (countSolutions(tmp) !== 1) {
      board[r][c] = backup;
    } else {
      toRemove--;
    }
    attempts++;
  }

  for (let r=0; r<9; r++) for (let c=0; c<9; c++)
    given[r][c] = (board[r][c] !== 0);

  totalEmpty = board.flat().filter(v => v === 0).length;
  correctCount = 0;
}

// ======================== DICE ========================
const DICE_DOTS = {
  1: [[50,50]],
  2: [[25,25],[75,75]],
  3: [[25,25],[50,50],[75,75]],
  4: [[25,25],[75,25],[25,75],[75,75]],
  5: [[25,25],[75,25],[50,50],[25,75],[75,75]],
  6: [[25,25],[75,25],[25,50],[75,50],[25,75],[75,75]]
};

function renderDiceFace(value) {
  const dots = DICE_DOTS[value] || [];
  const g = document.getElementById('dice-dots');
  g.innerHTML = dots.map(([cx,cy]) =>
    `<circle cx="${cx}" cy="${cy}" r="7" fill="#fff" />`
  ).join('');
}

// ======================== DOM HELPERS ========================
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function showOverlay(id) { document.getElementById(id).style.display = 'flex'; }
function hideOverlay(id) { document.getElementById(id).style.display = 'none'; }

function showToast(msg, duration=2200) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

// ======================== SCREEN 1: LOBBY ========================
let playerCount = 2;

function initLobby() {
  const countBtns = document.querySelectorAll('.count-btn');
  countBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      countBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      playerCount = parseInt(btn.dataset.count);
      renderNameInputs();
    });
  });
  renderNameInputs();

  document.getElementById('btn-start').addEventListener('click', startFromLobby);
}

function renderNameInputs() {
  const container = document.getElementById('player-names-container');
  const existing = [];
  container.querySelectorAll('.player-input').forEach(inp => existing.push(inp.value));
  container.innerHTML = '';
  for (let i=0; i<playerCount; i++) {
    const row = document.createElement('div');
    row.className = 'player-input-row';
    row.style.animationDelay = `${i*0.06}s`;
    row.innerHTML = `
      <span class="player-input-label">Pemain ${i+1}</span>
      <input class="player-input" type="text" maxlength="20"
        placeholder="Nama Pemain ${i+1}" value="${existing[i] || ''}" />
    `;
    container.appendChild(row);
  }
}

function startFromLobby() {
  const inputs = document.querySelectorAll('.player-input');
  players = [];
  inputs.forEach((inp, i) => {
    const name = inp.value.trim() || `Pemain ${i+1}`;
    players.push({ name, score:0, lives:3, mistakes:0, refillUsed:0, isSkipped:false });
  });
  initDiceScreen();
  showScreen('screen-dice');
}

// ======================== SCREEN 2: DICE ROLL ========================
let diceRolls = [];  // [{name, roll}]
let diceCurrentIdx = 0;

function initDiceScreen() {
  diceRolls = [];
  diceCurrentIdx = 0;
  document.getElementById('dice-results').innerHTML = '';
  document.getElementById('dice-order').style.display = 'none';
  renderDiceFace(1);
  updateDiceTurnInfo();

  document.getElementById('btn-roll').disabled = false;
  document.getElementById('btn-roll').onclick = rollDice;
  document.getElementById('btn-start-game').onclick = startGame;
}

function updateDiceTurnInfo() {
  if (diceCurrentIdx < players.length) {
    document.getElementById('dice-current-name').textContent = players[diceCurrentIdx].name;
    document.getElementById('dice-turn-info').style.display = '';
  } else {
    document.getElementById('dice-turn-info').style.display = 'none';
  }
}

async function rollDice() {
  if (diceCurrentIdx >= players.length) return;
  const btn = document.getElementById('btn-roll');
  btn.disabled = true;

  // Faster dice animation
  const svg = document.getElementById('dice-svg');
  svg.classList.add('rolling');
  await sleep(260);
  svg.classList.remove('rolling');

  const roll = Math.ceil(Math.random()*6);
  renderDiceFace(roll);

  diceRolls.push({ idx: diceCurrentIdx, name: players[diceCurrentIdx].name, roll });
  renderDiceResults(diceRolls);

  diceCurrentIdx++;
  if (diceCurrentIdx < players.length) {
    updateDiceTurnInfo();
    btn.disabled = false;
  } else {
    await resolveTies();
  }
}

async function resolveTies() {
  document.getElementById('dice-turn-info').style.display = 'none';

  // Find ties for max position and cascade
  let sorted = [...diceRolls].sort((a,b) => b.roll - a.roll);

  // Check for any duplicates
  let hasTies = false;
  for (let i=0; i<sorted.length-1; i++) {
    if (sorted[i].roll === sorted[i+1].roll) { hasTies = true; break; }
  }

  while (hasTies) {
    // Find groups of ties
    const groups = {};
    for (const r of sorted) {
      if (!groups[r.roll]) groups[r.roll] = [];
      groups[r.roll].push(r);
    }
    // Find all tie groups (size > 1)
    let tieGroup = null;
    for (const k of Object.keys(groups).sort((a,b)=>b-a)) {
      if (groups[k].length > 1) { tieGroup = groups[k]; break; }
    }
    if (!tieGroup) break;

    showToast(`${tieGroup.map(t=>t.name).join(', ')} seri! Lempar ulang...`, 1200);
    await sleep(1300);

    for (const tied of tieGroup) {
      document.getElementById('dice-turn-info').style.display = '';
      document.getElementById('dice-current-name').textContent = tied.name;
      await sleep(260);

      const svg = document.getElementById('dice-svg');
      svg.classList.add('rolling');
      await sleep(260);
      svg.classList.remove('rolling');

      const newRoll = Math.ceil(Math.random()*6);
      tied.roll = newRoll;
      renderDiceFace(newRoll);
      renderDiceResults(diceRolls);
      await sleep(260);
    }

    sorted = [...diceRolls].sort((a,b) => b.roll - a.roll);
    hasTies = false;
    for (let i=0; i<sorted.length-1; i++) {
      if (sorted[i].roll === sorted[i+1].roll) { hasTies = true; break; }
    }
  }

  document.getElementById('dice-turn-info').style.display = 'none';

  // Final order
  sorted = [...diceRolls].sort((a,b) => b.roll - a.roll);
  const orderedPlayers = sorted.map(r => players[r.idx]);
  players = orderedPlayers;

  // Show final order
  const ol = document.getElementById('order-list');
  ol.innerHTML = players.map((p,i) => `<li>${p.name}</li>`).join('');
  document.getElementById('dice-order').style.display = 'block';
}

function renderDiceResults(rolls) {
  const container = document.getElementById('dice-results');
  container.innerHTML = rolls.map(r => `
    <div class="dice-result-row">
      <span class="dice-result-name">${r.name}</span>
      <span class="dice-result-val">${r.roll}</span>
    </div>
  `).join('');
}

// ======================== SCREEN 3: GAME ========================
function startGame() {
  currentPlayerIndex = 0;
  createPuzzle();
  selectedCell = null;
  selectedNum = null;

  renderBoard();
  renderPlayersPanel();
  updateActivePlayerPanel();
  updateProgress();
  startTimer();

  showScreen('screen-game');
  updateTurnBadge();

  // Keyboard
  document.addEventListener('keydown', handleKeydown);

  // Numpad
  document.querySelectorAll('.num-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const n = parseInt(btn.dataset.num);
      selectNum(n);
      if (selectedCell) attemptInput(n);
    });
  });
  document.getElementById('btn-delete').addEventListener('click', deleteCell);
  document.getElementById('btn-new-game').addEventListener('click', goToLobby);
  document.getElementById('btn-correct-continue').addEventListener('click', () => {
    hideOverlay('overlay-correct');
  });
  document.getElementById('btn-gameover-retry').addEventListener('click', goToLobby);
  document.getElementById('btn-win-again').addEventListener('click', goToLobby);
  document.getElementById('btn-do-istighfar').addEventListener('click', () => {
    hideOverlay('overlay-lives');
    openIstighfar();
  });
  document.getElementById('btn-skip-turn').addEventListener('click', () => {
    hideOverlay('overlay-lives');
    players[pendingLivesPlayerIdx].isSkipped = true;
    nextTurn();
  });
  document.getElementById('btn-istighfar-click').addEventListener('click', doIstighfar);
}

function goToLobby() {
  stopTimer();
  document.removeEventListener('keydown', handleKeydown);
  hideOverlay('overlay-correct');
  hideOverlay('overlay-lives');
  hideOverlay('overlay-istighfar');
  hideOverlay('overlay-gameover');
  hideOverlay('overlay-win');
  showScreen('screen-lobby');
}

// ======================== BOARD RENDER ========================
function renderBoard() {
  const boardEl = document.getElementById('sudoku-board');
  boardEl.innerHTML = '';
  for (let r=0; r<9; r++) {
    for (let c=0; c<9; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row = r;
      cell.dataset.col = c;

      // Box alternating
      const boxIdx = Math.floor(r/3)*3 + Math.floor(c/3);
      cell.classList.add(boxIdx%2===0 ? 'box-even' : 'box-odd');

      if (given[r][c]) {
        cell.classList.add('given');
        cell.textContent = board[r][c];
      } else if (board[r][c] !== 0) {
        cell.classList.add('correct');
        cell.textContent = board[r][c];
      }

      cell.addEventListener('click', () => onCellClick(r, c));
      boardEl.appendChild(cell);
    }
  }
}

function getCell(r, c) {
  return document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
}

function onCellClick(r, c) {
  if (given[r][c]) {
    selectedCell = {row:r, col:c};
    applyHighlights();
    return;
  }
  if (players[currentPlayerIndex].isSkipped) return;
  selectedCell = {row:r, col:c};
  applyHighlights();

  if (selectedNum) {
    attemptInput(selectedNum);
  }
}

function applyHighlights() {
  document.querySelectorAll('.cell').forEach(c => {
    c.classList.remove('hl-area','hl-box','hl-sel','hl-same');
  });
  if (!selectedCell) return;
  const {row, col} = selectedCell;
  const val = board[row][col];

  for (let r=0; r<9; r++) {
    for (let c=0; c<9; c++) {
      const cell = getCell(r,c);
      if (!cell) continue;
      // same box
      const sameBox = Math.floor(r/3)===Math.floor(row/3) && Math.floor(c/3)===Math.floor(col/3);
      if (r===row || c===col) cell.classList.add('hl-area');
      if (sameBox)             cell.classList.add('hl-box');
      if (val !== 0 && board[r][c]===val && !(r===row&&c===col)) cell.classList.add('hl-same');
    }
  }
  getCell(row,col).classList.add('hl-sel');
}

function selectNum(n) {
  selectedNum = n;
  document.querySelectorAll('.num-btn').forEach(b => {
    b.classList.toggle('selected', parseInt(b.dataset.num)===n);
  });
}

function deleteCell() {
  if (!selectedCell) return;
  const {row, col} = selectedCell;
  if (given[row][col]) return;
  if (board[row][col] === 0) return;
  board[row][col] = 0;
  correctCount--;
  const cell = getCell(row,col);
  cell.textContent = '';
  cell.classList.remove('correct');
  applyHighlights();
  updateProgress();
}

function attemptInput(num) {
  if (!selectedCell) return;
  const {row, col} = selectedCell;
  if (given[row][col]) return;
  if (board[row][col] !== 0) return; // already filled, don't allow

  const player = players[currentPlayerIndex];
  const cell = getCell(row, col);

  if (num === solution[row][col]) {
    // Correct
    board[row][col] = num;
    correctCount++;
    cell.textContent = num;
    cell.classList.remove('wrong');
    cell.classList.add('correct');

    applyHighlights();
    updateProgress();

    // Show popup
    document.getElementById('popup-points-text').textContent = `+15 poin untuk ${player.name}`;
    player.score += 15;
    renderPlayersPanel();
    updateActivePlayerPanel();

    // Check win
    if (correctCount === totalEmpty) {
      setTimeout(showWin, 600);
      return;
    }

    showOverlay('overlay-correct');
    setTimeout(() => {
      hideOverlay('overlay-correct');
      nextTurn();
    }, 500);

  } else {
    // Wrong
    player.score = Math.max(0, player.score - 5);
    player.lives = Math.max(0, player.lives - 1);
    player.mistakes++;
    cell.classList.add('wrong');
    setTimeout(() => cell.classList.remove('wrong'), 400);
    renderPlayersPanel();
    updateActivePlayerPanel();

    document.getElementById('wrong-popup-text').textContent = `-5 poin · ${player.name} kehilangan 1 nyawa`;
    showOverlay('overlay-wrong');

    if (player.lives <= 0) {
      player.lives = 0;
      pendingLivesPlayerIdx = currentPlayerIndex;
      setTimeout(() => {
        hideOverlay('overlay-wrong');
        document.getElementById('popup-lives-name').textContent = player.name;
        const hasRefill = player.refillUsed < 3;
        document.getElementById('btn-do-istighfar').style.display = hasRefill ? '' : 'none';
        showOverlay('overlay-lives');
      }, 700);
    } else {
      setTimeout(() => {
        hideOverlay('overlay-wrong');
        nextTurn();
      }, 700);
    }
  }
}

// ======================== TURN SYSTEM ========================
function nextTurn() {
  // Check game over: all skipped
  const allSkipped = players.every(p => p.isSkipped || p.lives <= 0);
  if (allSkipped) {
    showGameOver();
    return;
  }
  // Advance index
  do {
    currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
    const p = players[currentPlayerIndex];
    if (p.lives <= 0) p.isSkipped = true;
    if (p.isSkipped) {
      showToast(`${p.name} di-skip (nyawa habis)`, 1600);
    }
  } while (players[currentPlayerIndex].isSkipped && !players.every(p => p.isSkipped));

  if (players.every(p => p.isSkipped)) {
    showGameOver();
    return;
  }

  updateTurnBadge();
  updateActivePlayerPanel();
  renderPlayersPanel();
  selectedCell = null;
  selectedNum = null;
  applyHighlights();
  document.querySelectorAll('.num-btn').forEach(b => b.classList.remove('selected'));
}

function updateTurnBadge() {
  document.getElementById('turn-name').textContent = players[currentPlayerIndex].name;
}

// ======================== PLAYERS PANEL ========================
function renderPlayersPanel() {
  const list = document.getElementById('players-list');
  list.innerHTML = players.map((p, i) => {
    const isActive = i === currentPlayerIndex;
    const hearts = Array(3).fill(0).map((_,j) => j < p.lives ? '❤️' : '🖤').join('');
    const canRefill = p.lives <= 0 && p.refillUsed < 3;
    return `
      <div class="player-card ${isActive?'active-turn':''} ${p.isSkipped?'skipped':''}">
        ${isActive ? '<span class="badge-turn">GILIRAN</span>' : ''}
        ${p.isSkipped ? '<span class="badge-skip">SKIP</span>' : ''}
        <div class="player-card-name">${p.name}</div>
        <div class="player-card-lives">${hearts}</div>
        <div class="player-card-score">${p.score} <small style="font-size:11px;color:#9aa5b8">poin</small></div>
        ${canRefill ? `<button class="btn-refill" onclick="triggerRefillFor(${i})">🌙 Istighfar</button>` : ''}
      </div>
    `;
  }).join('');
}

window.triggerRefillFor = function(idx) {
  pendingLivesPlayerIdx = idx;
  openIstighfar();
};

function updateActivePlayerPanel() {
  const p = players[currentPlayerIndex];
  document.getElementById('active-player-name').textContent = p.name;
  document.getElementById('active-player-lives').textContent = Array(3).fill(0).map((_,j) => j < p.lives ? '❤️' : '🖤').join('');
  document.getElementById('active-player-score').textContent = p.score;
}

// ======================== ISTIGHFAR ========================
function openIstighfar() {
  istighfarCount = 0;
  const p = players[pendingLivesPlayerIdx];
  document.getElementById('istighfar-counter').textContent = `0 / ${istighfarTarget}`;
  document.getElementById('istighfar-progress').style.width = '0%';
  document.getElementById('istighfar-remaining').textContent =
    `Sisa kesempatan refill: ${3 - p.refillUsed}/3`;
  showOverlay('overlay-istighfar');
}

function doIstighfar() {
  if (istighfarCount >= istighfarTarget) return;
  istighfarCount++;
  document.getElementById('istighfar-counter').textContent = `${istighfarCount} / ${istighfarTarget}`;
  document.getElementById('istighfar-progress').style.width = `${(istighfarCount/istighfarTarget)*100}%`;

  if (istighfarCount >= istighfarTarget) {
    const p = players[pendingLivesPlayerIdx];
    p.lives = 3;
    p.isSkipped = false;
    p.refillUsed++;
    renderPlayersPanel();
    updateActivePlayerPanel();
    setTimeout(() => {
      hideOverlay('overlay-istighfar');
      showToast(`${p.name} nyawa penuh! Bismillah 🌙`, 2000);
      // If this was the active player needing refill, don't auto-next
    }, 400);
  }
}

// ======================== TIMER ========================
function startTimer() {
  stopTimer();
  timerSeconds = 0;
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    timerSeconds++;
    updateTimerDisplay();
  }, 1000);
}

function stopTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

function updateTimerDisplay() {
  const m = String(Math.floor(timerSeconds/60)).padStart(2,'0');
  const s = String(timerSeconds%60).padStart(2,'0');
  document.getElementById('timer-display').textContent = `${m}:${s}`;
}

// ======================== PROGRESS ========================
function updateProgress() {
  const filled = correctCount;
  const total = totalEmpty;
  document.getElementById('progress-info').textContent = `${filled} / ${total} terisi`;
  const pct = total ? (filled/total)*100 : 0;
  document.getElementById('progress-bar-inner').style.width = `${pct}%`;
}

// ======================== KEYBOARD ========================
function handleKeydown(e) {
  if (!selectedCell) return;
  const {row, col} = selectedCell;

  if (e.key >= '1' && e.key <= '9') {
    const n = parseInt(e.key);
    selectNum(n);
    attemptInput(n);
  } else if (e.key === 'Backspace' || e.key === 'Delete') {
    deleteCell();
  } else if (e.key === 'ArrowUp'    && row>0) { selectedCell={row:row-1,col}; applyHighlights(); }
  else if (e.key === 'ArrowDown'  && row<8) { selectedCell={row:row+1,col}; applyHighlights(); }
  else if (e.key === 'ArrowLeft'  && col>0) { selectedCell={row,col:col-1}; applyHighlights(); }
  else if (e.key === 'ArrowRight' && col<8) { selectedCell={row,col:col+1}; applyHighlights(); }
}

// ======================== GAME OVER / WIN ========================
function showGameOver() {
  stopTimer();
  setTimeout(() => showOverlay('overlay-gameover'), 400);
}

function showWin() {
  stopTimer();
  // Sort leaderboard
  const sorted = [...players].sort((a,b) => b.score - a.score);
  const medals = ['🥇','🥈','🥉'];
  document.getElementById('win-title').textContent =
    `🏆 ${sorted[0].name} Menang!`;
  document.getElementById('leaderboard').innerHTML = sorted.map((p,i) => `
    <div class="leaderboard-row">
      <span class="lb-medal">${medals[i] || `${i+1}.`}</span>
      <span class="lb-name">${p.name}</span>
      <span class="lb-lives">${Array(3).fill(0).map((_,j)=>j<p.lives?'❤️':'🖤').join('')}</span>
      <span class="lb-score">${p.score}</span>
    </div>
  `).join('');
  spawnConfetti();
  showOverlay('overlay-win');
}

function spawnConfetti() {
  const container = document.getElementById('confetti-container');
  container.innerHTML = '';
  const colors = ['#3a7ab5','#c9993a','#3a9e6a','#e05252','#7ab3d9','#f0d89a','#2563a8'];
  for (let i=0; i<60; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = `${Math.random()*100}%`;
    piece.style.background = colors[Math.floor(Math.random()*colors.length)];
    piece.style.animationDuration = `${1.5 + Math.random()*2}s`;
    piece.style.animationDelay = `${Math.random()*1.2}s`;
    piece.style.width = `${6+Math.random()*8}px`;
    piece.style.height = `${6+Math.random()*8}px`;
    piece.style.borderRadius = Math.random()>0.5 ? '50%' : '2px';
    container.appendChild(piece);
  }
}

// ======================== UTIL ========================
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ======================== INIT ========================
document.addEventListener('DOMContentLoaded', () => {
  initLobby();
  renderDiceFace(1);
});