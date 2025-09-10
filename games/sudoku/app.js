// --- Lógica Específica del Juego de Sudoku ---

// Constantes de los elementos del juego
const boardEl = document.getElementById('board');
const difficultyEl = document.getElementById('difficulty');
const newGameBtn = document.getElementById('newGame');
const checkBtn = document.getElementById('check');
const padEraseBtn = document.getElementById('padErase');
const padNotesBtn = document.getElementById('padNotes');
const padBtns = Array.from(document.querySelectorAll('.pad[data-num]'));
const selectablePadBtns = [...padBtns, padEraseBtn];
const modeBtn = document.getElementById('toggleMode');
const clearBtn = document.getElementById('clearBtn');
const DEBUG_SUPER_EASY = true;

// Variables de estado del juego
let grid = makeEmptyGrid();
let solutionGrid = null;
let locked = makeBoolGrid(false);
let notesMode = false;
let selected = { r: 0, c: 0 };
let hasWon = false;
let inputMode = 'tile';
let selectedKey = null;

/* ---------- Utilidades del Sudoku ---------- */
function makeEmptyGrid(){ return Array.from({length:9}, ()=> Array(9).fill(0)); }
function cloneGrid(g){ return g.map(row => row.slice()); }
function makeBoolGrid(val){ return Array.from({length:9}, ()=> Array(9).fill(val)); }
function inBounds(r,c){ return r>=0 && r<9 && c>=0 && c<9; }
function boxIndex(r,c){ return Math.floor(r/3)*3 + Math.floor(c/3); }
function randInt(n){ return Math.floor(Math.random()*n); }
function shuffled(arr){ const a=arr.slice(); for(let i=a.length-1;i>0;i--){ const j=randInt(i+1); [a[i],a[j]]=[a[j],a[i]]; } return a; }

/* ---------- Solucionador ---------- */
function findEmpty(g){
  for(let r=0;r<9;r++) for(let c=0;c<9;c++) if(g[r][c]===0) return [r,c];
  return null;
}
function isValid(g, r, c, v){
  for(let i=0;i<9;i++) if(g[r][i]===v || g[i][c]===v) return false;
  const br = Math.floor(r/3)*3, bc=Math.floor(c/3)*3;
  for(let i=0;i<3;i++) for(let j=0;j<3;j++) if(g[br+i][bc+j]===v) return false;
  return true;
}
function solveGrid(g){
  const gridCopy = cloneGrid(g);
  return backtrack(gridCopy) ? gridCopy : null;

  function backtrack(gc){
    const empty = findEmpty(gc);
    if(!empty) return true;
    const [r,c]=empty;
    for(const v of shuffled([1,2,3,4,5,6,7,8,9])){
      if(isValid(gc, r, c, v)){
        gc[r][c]=v;
        if(backtrack(gc)) return true;
        gc[r][c]=0;
      }
    }
    return false;
  }
}
function countSolutions(g, cap=2){
  let count=0;
  const gc = cloneGrid(g);
  search();
  return count;

  function search(){
    if(count>=cap) return;
    const empty = findEmpty(gc);
    if(!empty){ count++; return; }
    const [r,c]=empty;
    for(const v of shuffled([1,2,3,4,5,6,7,8,9])){
      if(isValid(gc, r, c, v)){
        gc[r][c]=v;
        search();
        if(count>=cap) return;
        gc[r][c]=0;
      }
    }
  }
}

/* ---------- Generador de Puzzles ---------- */
function generateFullSolution(){
  const g = makeEmptyGrid();
  for(let b=0; b<9; b+=3){
    const nums = shuffled([1,2,3,4,5,6,7,8,9]);
    let k=0;
    for(let i=0;i<3;i++) for(let j=0;j<3;j++) g[b+i][b+j] = nums[k++];
  }
  const solved = solveGrid(g);
  return solved || generateFullSolution();
}
function makePuzzleFromSolution(solved, difficulty){
    const g = cloneGrid(solved);

    if(difficulty === 'super'){
        g[0][0] = 0;
        g[4][4] = 0;
        return g;
    }
    const targets = { easy: randInt(5)+36, medium: randInt(5)+30, hard: randInt(5)+25 };
    const targetClues = targets[difficulty] ?? 32;

    const positions = [];
    for(let r=0;r<9;r++) for(let c=0;c<9;c++) positions.push([r,c]);
    const order = shuffled(positions);
    let removed = 0;

    for(const [r,c] of order){
        const r2 = 8-r, c2 = 8-c;
        const cells = [[r,c],[r2,c2]];
        for(const [rr,cc] of cells){
            if(g[rr][cc]===0) continue;
            const backup = g[rr][cc];
            g[rr][cc] = 0;

            if(countSolutions(g,2)!==1) g[rr][cc] = backup;
            else removed++;

            const clues = 81-removed;
            if(clues <= targetClues) break;
        }
        const clues = 81-removed;
        if(clues <= targetClues) break;
    }
    return g;
}
function generateGame(difficulty){
    const solved = generateFullSolution();
    const puzzle = makePuzzleFromSolution(solved, difficulty);
    return { puzzle, solution: solved };
}

/* ---------- Renderizado de la Interfaz ---------- */
function clearWinState(){
  boardEl.classList.remove('won');
  for(const c of boardEl.children) c.classList.remove('won-tile');
  const existing = document.querySelector('.congrats');
  if(existing) existing.remove();
  hasWon = false;
}
function renderBoard(){
  boardEl.innerHTML = '';
  for(let r=0;r<9;r++){
    for(let c=0;c<9;c++){
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.r = r;
      cell.dataset.c = c;
      if(locked[r][c]) cell.classList.add('locked');
      if(grid[r][c] !== 0){
        cell.textContent = grid[r][c];
      } else {
        const notesEl = document.createElement('div');
        notesEl.className = 'notes';
        for(let n=1;n<=9;n++){
          const ne = document.createElement('div');
          ne.className = 'note';
          ne.dataset.n = n;
          notesEl.appendChild(ne);
        }
        cell.appendChild(notesEl);
      }
      cell.tabIndex = locked[r][c] ? -1 : 0;
      cell.addEventListener('click', ()=> selectCell(r,c));
      boardEl.appendChild(cell);
    }
  }
  highlightSelection();
  refreshNotes();
}
function refreshNotes(){
  for(const cell of boardEl.children){
    const r = +cell.dataset.r, c = +cell.dataset.c;
    if(grid[r][c] !== 0) continue;
    const notes = (cell.dataset.notes || '').split('').map(n => +n);
    const notesEl = cell.querySelector('.notes');
    if(!notesEl) continue;
    Array.from(notesEl.children).forEach((ne, idx)=>{
      const n = idx+1;
      ne.textContent = notes.includes(n) ? n : '';
    });
  }
}
function selectCell(r,c){
  if(inputMode === 'key' && selectedKey !== null && !locked[r][c]){
    setCellValue(r,c, selectedKey, { asNote: notesMode });
  }
  selected = { r, c };
  highlightSelection();
}
function highlightSelection(){
  for(const cell of boardEl.children){
    cell.classList.remove('selected','peer');
    const rr = +cell.dataset.r, cc = +cell.dataset.c;
    if(rr === selected.r && cc === selected.c) cell.classList.add('selected');
    else if(rr === selected.r || cc === selected.c || boxIndex(rr,cc) === boxIndex(selected.r, selected.c)) cell.classList.add('peer');
  }
}
function cellAt(r,c){ return boardEl.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`); }

/* ---------- Lógica de Juego ---------- */
function setCellValue(r, c, val, { asNote = false } = {}) {
  if (locked[r][c]) return;
  const cell = cellAt(r, c);
  cell.classList.remove('mistake');

  if (hasWon) {
    clearWinState();
  }

  if (asNote) {
    if (grid[r][c] !== 0) return;
    const cur = cell.dataset.notes || '';
    let set = new Set(cur.split('').filter(Boolean));
    if (set.has(String(val))) set.delete(String(val));
    else set.add(String(val));
    cell.dataset.notes = Array.from(set).sort().join('');
  } else {
    // --- LÓGICA DE TOGGLE AÑADIDA ---
    // 1. Comprueba si el valor actual de la celda es el mismo que el que se intenta poner.
    const currentValue = grid[r][c];
    // 2. Si son iguales, el valor final será 0 (borrar). Si no, será el nuevo valor.
    const finalVal = (currentValue === val) ? 0 : val;

    // 3. Usa 'finalVal' para todas las operaciones.
    grid[r][c] = finalVal;
    cell.textContent = finalVal === 0 ? '' : finalVal;
    
    if (finalVal === 0) {
      if (!cell.querySelector('.notes')) {
        const notesEl = document.createElement('div');
        notesEl.className = 'notes';
        for (let n = 1; n <= 9; n++) {
          const ne = document.createElement('div');
          ne.className = 'note';
          ne.dataset.n = n;
          notesEl.appendChild(ne);
        }
        cell.appendChild(notesEl);
      }
    } else {
      const notesEl = cell.querySelector('.notes');
      if (notesEl) notesEl.remove();
      delete cell.dataset.notes;
    }

    syncHighlights();
  }
  
  refreshNotes();
  updateNumpad();

  if (isBoardFilled() && isBoardCorrect()) {
    triggerWinAnimation();
  }
}

function isBoardFilled(){ return grid.every(row=>row.every(v=>v!==0)); }

function isBoardCorrect(){ return grid.every((row,r)=>row.every((v,c)=>v===solutionGrid[r][c])); }

function clearMistakes(){ for(const cell of boardEl.children) cell.classList.remove('mistake'); }

function markMistakes(requireFilled){
  let ok = true;
  for(let r=0;r<9;r++){
    for(let c=0;c<9;c++){
      const v = grid[r][c], cell = cellAt(r,c);
      if(v===0 && requireFilled){ ok=false; continue; }
      if(v!==0 && v !== solutionGrid[r][c]){
        cell.classList.add('mistake');
        ok = false;
      }
    }
  }
  return ok;
}
function triggerWinAnimation(){
  if(hasWon) return;
  hasWon = true;
  boardEl.classList.add('won');

  const msg = document.createElement('div');
  msg.className = 'congrats';
  msg.textContent = i18next.t('sudoku.congrats');
  document.body.appendChild(msg);

  requestAnimationFrame(() => setTimeout(() => msg.classList.add('show'), 20));
  setTimeout(() => {
    msg.classList.remove('show');
    setTimeout(() => { if (msg.parentElement) msg.remove(); }, 350);
  }, 3000);

  const cells = Array.from(boardEl.children).sort((a,b)=>((+a.dataset.r)+(+a.dataset.c))-((+b.dataset.r)+(+b.dataset.c)));
  cells.forEach((cell, idx) => {
    setTimeout(() => cell.classList.add('won-tile'), idx * 35);
  });
}

/* ---------- Eventos del Juego ---------- */
document.addEventListener('keydown', (e)=>{
  const {r,c} = selected;
  if(e.key === 'ArrowUp'){ e.preventDefault(); moveSel(-1,0); }
  else if(e.key === 'ArrowDown'){ e.preventDefault(); moveSel(1,0); }
  else if(e.key === 'ArrowLeft'){ e.preventDefault(); moveSel(0,-1); }
  else if(e.key === 'ArrowRight'){ e.preventDefault(); moveSel(0,1); }
  else if(/^[1-9]$/.test(e.key)){
    e.preventDefault();
    setCellValue(r,c, parseInt(e.key,10), { asNote: notesMode || e.shiftKey });
  }
  else if(['0','Backspace','Delete'].includes(e.key)){
    e.preventDefault();
    setCellValue(r,c,0);
  }
  else if(e.key.toLowerCase() === 'n'){
    e.preventDefault();
    notesMode = !notesMode;
    updateNotesUI();
  }
});
function moveSel(dr,dc){
  let {r,c} = selected;
  do {
    r = (r + dr + 9) % 9;
    c = (c + dc + 9) % 9;
  } while(locked[r][c] && !(r===selected.r && c===selected.c));
  selectCell(r,c);
}
newGameBtn.addEventListener('click', ()=> startNewGame(difficultyEl.value));
checkBtn.addEventListener('click', ()=>{
  clearMistakes();
  if(!isBoardFilled()){ markMistakes(false); return; }
  if(markMistakes(true)) triggerWinAnimation();
});
padEraseBtn.addEventListener('click', () => {
  if (inputMode === 'key') {
    selectedKey = 0;
    selectablePadBtns.forEach(b => b.classList.remove('primary'));
    padEraseBtn.classList.add('primary');
	syncHighlights();
  } else {
    setCellValue(selected.r, selected.c, 0);
  }
});
padNotesBtn.addEventListener('click', ()=>{ notesMode = !notesMode; updateNotesUI(); });
padBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const val = parseInt(btn.dataset.num, 10);
    if (inputMode === 'tile') {
      // LÍNEA RESTAURADA: Llama a la función para poner el número en la celda seleccionada.
      setCellValue(selected.r, selected.c, val, { asNote: notesMode });
    } else {
      // La lógica del modo 'Key' se mantiene igual.
      selectedKey = val;
      selectablePadBtns.forEach(b => b.classList.remove('primary'));
      btn.classList.add('primary');
      syncHighlights();
    }
  });
});
modeBtn.addEventListener('click', () => {
  if (inputMode === 'tile') {
    inputMode = 'key';
    modeBtn.textContent = i18next.t('sudoku.modeKey');
  } else {
    inputMode = 'tile';
    modeBtn.textContent = i18next.t('sudoku.modeTile');
    selectedKey = null;
    selectablePadBtns.forEach(b => b.classList.remove('primary'));
	clearHighlights();
  }
});

clearBtn.addEventListener('click', clearUserInputs);
/* ---------- Funciones de Ayuda (Helpers) ---------- */
function updateNotesUI() {
  padNotesBtn.classList.toggle('primary', notesMode);
}
function updateModeButtonText() {
  if (modeBtn) { // Verifica si el botón existe
    modeBtn.textContent = (inputMode === 'key') ? i18next.t('sudoku.modeKey') : i18next.t('sudoku.modeTile');
  }
}
function startNewGame(difficulty='medium'){
  selectedKey = null; 
  selectablePadBtns.forEach(b => b.classList.remove('primary'));

  clearHighlights();
  clearWinState();
  const { puzzle, solution } = generateGame(difficulty);
  grid = cloneGrid(puzzle);
  solutionGrid = cloneGrid(solution);
  locked = makeBoolGrid(false);
  for(let r=0;r<9;r++) for(let c=0;c<9;c++) if(grid[r][c] !== 0) locked[r][c] = true;
  notesMode = false;
  updateNotesUI();
  updateModeButtonText();
  renderBoard();
  for(let r=0;r<9;r++) for(let c=0;c<9;c++) if(!locked[r][c]){ selectCell(r,c); r=9; break; }
  clearMistakes();
  updateNumpad();
}
function updateNumpad(){
  for(const btn of padBtns){
    const n = parseInt(btn.dataset.num,10);
    let count = 0;
    for(let r=0;r<9;r++) for(let c=0;c<9;c++) if(grid[r][c] === n) count++;
    btn.disabled = count >= 9;
    btn.classList.toggle('disabled', count >= 9);
  }
}
function clearHighlights() {
  document.querySelectorAll('.cell.highlight').forEach(cell => {
    cell.classList.remove('highlight');
  });
}

/**
 * Sincroniza el resaltado visual con el estado actual del juego.
 * Limpia los resaltados anteriores y aplica los nuevos según el selectedKey.
 */
function syncHighlights() {
  clearHighlights();
  if (difficultyEl.value === 'easy' && inputMode === 'key' && selectedKey) {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (grid[r][c] === selectedKey) {
          cellAt(r, c).classList.add('highlight');
        }
      }
    }
  }
}

function clearUserInputs() {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      // Solo modifica las celdas que no están bloqueadas
      if (!locked[r][c]) {
        // Resetea el valor en la cuadrícula de datos
        grid[r][c] = 0;
        // Limpia las notas del DOM
        const cell = cellAt(r, c);
        if (cell) {
          delete cell.dataset.notes;
        }
      }
    }
  }
  // Vuelve a renderizar el tablero para mostrar los cambios
  renderBoard();
  
  // Limpia otros estados de la UI
  clearMistakes();
  updateNumpad();
  syncHighlights();
}
/* ---------- Inicialización del Juego ---------- */
document.addEventListener('languageChanged', () => {
  updateNotesUI();
  updateModeButtonText();
});

document.addEventListener('appReady', () => {
  // Añade la opción de dificultad "Super Easy" si está en modo debug
  if(DEBUG_SUPER_EASY && difficultyEl){
      const opt = document.createElement('option');
      opt.value = 'super';
      opt.textContent = 'Super Easy';
      difficultyEl.appendChild(opt);
  }

  // Inicia el primer juego solo cuando la app principal está lista
  startNewGame(difficultyEl.value);
});