// El script espera la señal 'appReady' de main.js para empezar.
document.addEventListener('appReady', () => {

    // --- CONSTANTES Y ESTADO ---
    // Toda la lógica del juego va DENTRO de este listener.
    const difficultySettings = {
        easy: { rows: 9, cols: 9, dangers: 10 },
        medium: { rows: 16, cols: 16, dangers: 40 },
        hard: { rows: 16, cols: 32, dangers: 99 }
    };

    const DOM = {
        app: document.querySelector('.app'),
        board: document.getElementById('board'),
		boardContainer: document.getElementById('board-container'),
        dangerCount: document.getElementById('danger-count'),
        timer: document.getElementById('timer'),
        newGameBtn: document.getElementById('newGameBtn'),
        difficultyEl: document.getElementById('difficulty'),
        gameOverOverlay: document.getElementById('game-over-overlay'),
        gameOverText: document.getElementById('game-over-text'),
        toolpadBtns: document.querySelectorAll('.toolpad .btn'),
        longPressToggleBtn: document.getElementById('longPressToggleBtn'),
        // Modal
        modalOverlay: document.getElementById('custom-modal-overlay'),
        widthSlider: document.getElementById('width-slider'),
        heightSlider: document.getElementById('height-slider'),
        dangerSlider: document.getElementById('danger-slider'),
        widthValue: document.getElementById('width-value'),
        heightValue: document.getElementById('height-value'),
        dangerValue: document.getElementById('danger-value'),
        startCustomBtn: document.getElementById('start-custom-game-btn'),
    };

    let state = {};
    let timerInterval;
    let activeTool = 'shovel';
    let isLongPressMode = false;

    // --- LÓGICA DE PULSACIÓN LARGA ---
    let pressTimer = null;
    let isLongPress = false;

	function handleTouchStart(e, r, c) {
		// Cancela cualquier temporizador anterior para evitar errores
		clearTimeout(pressTimer);
		isLongPress = false;
		
		// Inicia un nuevo temporizador
		pressTimer = setTimeout(() => {
			isLongPress = true;
			// Llama a la lógica del clic derecho sin un evento
			handleRightClick(null, r, c); 
		}, 200); // 500ms para una pulsación larga
	}

	function handleTouchEnd(e, r, c) {
		// Si el dedo se levanta antes de los 500ms, se cancela el temporizador
		clearTimeout(pressTimer);
		
		// Si el temporizador no llegó a dispararse, fue un toque corto
		if (!isLongPress) {
			handleLeftClick(r, c);
		}
	}

    // --- LÓGICA DE INICIO Y GENERACIÓN ---
    
    function resetState(settings) {
        state = {
            rows: settings.rows,
            cols: settings.cols,
            dangerCount: settings.dangers,
            board: [],
            isFirstClick: true,
            isGameOver: false,
            flagsPlaced: 0,
            revealedCount: 0,
            time: 0,
        };
        DOM.dangerCount.textContent = state.dangerCount;
        DOM.timer.textContent = 0;
        clearInterval(timerInterval);
        DOM.gameOverOverlay.classList.add('hidden');
        DOM.gameOverOverlay.classList.remove('win');
    }

    function createEmptyBoard() {
        for (let r = 0; r < state.rows; r++) {
            state.board[r] = [];
            for (let c = 0; c < state.cols; c++) {
                state.board[r][c] = {
                    isDanger: false, isRevealed: false, isFlagged: false, 
                    isQuestion: false, adjacentDangers: 0, decoration: null,
                };
            }
        }
    }

    function generateBoard(firstClickR, firstClickC) {
        const safeZone = new Set();
        const secondRing = [];
        for (let dr = -2; dr <= 2; dr++) {
            for (let dc = -2; dc <= 2; dc++) {
                const r = firstClickR + dr;
                const c = firstClickC + dc;
                if (r >= 0 && r < state.rows && c >= 0 && c < state.cols) {
                    const key = `${r}-${c}`;
                    if (Math.abs(dr) <= 1 && Math.abs(dc) <= 1) {
                        safeZone.add(key);
                    } else {
                        secondRing.push(key);
                    }
                }
            }
        }
        
        const difficulty = DOM.difficultyEl.value;
        const toFreeCount = 
            difficulty === 'easy' ? Math.floor(Math.random() * 3) + 14 :
            difficulty === 'medium' ? Math.floor(Math.random() * 8) + 7 :
            difficulty === 'hard' ? Math.floor(Math.random() * 13) : 0;
        
        shuffleArray(secondRing).slice(0, toFreeCount).forEach(key => safeZone.add(key));

        const possibleCoords = [];
        for (let r = 0; r < state.rows; r++) {
            for (let c = 0; c < state.cols; c++) {
                if (!safeZone.has(`${r}-${c}`)) {
                    possibleCoords.push({ r, c });
                }
            }
        }
        
        shuffleArray(possibleCoords).slice(0, state.dangerCount).forEach(({ r, c }) => {
            state.board[r][c].isDanger = true;
        });

        for (let r = 0; r < state.rows; r++) {
            for (let c = 0; c < state.cols; c++) {
                if (!state.board[r][c].isDanger) {
                    let count = 0;
                    for (let dr = -1; dr <= 1; dr++) {
                        for (let dc = -1; dc <= 1; dc++) {
                            const nr = r + dr, nc = c + dc;
                            if (nr >= 0 && nr < state.rows && nc >= 0 && nc < state.cols && state.board[nr][nc]?.isDanger) {
                                count++;
                            }
                        }
                    }
                    state.board[r][c].adjacentDangers = count;
                    if (count === 0) {
                        if (Math.random() < 1 / 100) state.board[r][c].decoration = '🐞';
                        else if (Math.random() < 1 / 22) state.board[r][c].decoration = '🐌';
                        else if (Math.random() < 1 / 10) state.board[r][c].decoration = '🌱';
                    }
                }
            }
        }
    }

    // --- LÓGICA DEL JUEGO ---

    function revealCell(r, c) {
        if (state.isGameOver || r < 0 || r >= state.rows || c < 0 || c >= state.cols) return;
        const cell = state.board[r][c];
        if (cell.isRevealed || cell.isFlagged) return;
        cell.isRevealed = true;
        state.revealedCount++;
        if (cell.isDanger) {
            cell.isTriggeringDanger = true;
            gameOver(false);
            return;
        }
        if (cell.adjacentDangers === 0) {
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    revealCell(r + dr, c + dc);
                }
            }
        }
        renderBoard();
        checkWinCondition();
    }
    
    function checkWinCondition() {
        const nonDangerCells = state.rows * state.cols - state.dangerCount;
        if (state.revealedCount === nonDangerCells) {
            gameOver(true);
        }
    }
    
    function gameOver(isWin) {
        state.isGameOver = true;
        clearInterval(timerInterval);
        DOM.gameOverText.textContent = isWin ? i18next.t('shroomsweeper.win') : i18next.t('shroomsweeper.lose');
        if (isWin) DOM.gameOverOverlay.classList.add('win');
        DOM.gameOverOverlay.classList.remove('hidden');
        for (let r = 0; r < state.rows; r++) {
            for (let c = 0; c < state.cols; c++) {
                if (state.board[r][c].isDanger) {
                    state.board[r][c].isRevealed = true;
                }
            }
        }
        renderBoard();
    }

    // --- RENDERIZADO Y UI ---
    
	function renderBoard() {
		// 1. Memoriza la posición actual del scroll ANTES de borrar el tablero
		const { scrollLeft, scrollTop } = DOM.boardContainer;

		DOM.board.innerHTML = '';
		DOM.board.style.gridTemplateColumns = `repeat(${state.cols}, 28px)`;
		
		for (let r = 0; r < state.rows; r++) {
			for (let c = 0; c < state.cols; c++) {
				const cellData = state.board[r][c];
				const cellEl = document.createElement('div');
                cellEl.className = 'cell';
                if (cellData.isRevealed) {
                    cellEl.classList.add('revealed');
                    if (cellData.isDanger) {
                        cellEl.classList.add('danger');
                        cellEl.textContent = cellData.isTriggeringDanger ? '🍄‍🟫' : '🍄';
                    } else if (cellData.adjacentDangers > 0) {
                        cellEl.textContent = cellData.adjacentDangers;
                        cellEl.dataset.adjacent = cellData.adjacentDangers;
                    } else {
                        cellEl.textContent = cellData.decoration || '';
                    }
                } else {
                    cellEl.classList.add('unrevealed');
                    if (cellData.isFlagged) {
                        cellEl.classList.add('flagged');
                        cellEl.textContent = '🚩';
                    } else if (cellData.isQuestion) {
                        cellEl.textContent = '❓';
                    }
                }
                if (isLongPressMode && window.innerWidth <= 768) {
                    cellEl.addEventListener('touchstart', (e) => handleTouchStart(e, r, c));
                    cellEl.addEventListener('touchend', (e) => handleTouchEnd(e, r, c));
                    cellEl.addEventListener('touchmove', () => clearTimeout(pressTimer));
                } else {
                    cellEl.addEventListener('click', () => handleCellInteraction(r, c));
                    cellEl.addEventListener('contextmenu', (e) => handleRightClick(e, r, c));
                }
                DOM.board.appendChild(cellEl);
            }
        }
		DOM.boardContainer.scrollTop = scrollTop;
		DOM.boardContainer.scrollLeft = scrollLeft;
	}

    function updateDangerCounter() {
        DOM.dangerCount.textContent = state.dangerCount - state.flagsPlaced;
    }

    function updateLongPressModeUI() {
        DOM.app.classList.toggle('long-press-active', isLongPressMode);
        const status = isLongPressMode ? i18next.t('shroomsweeper.on') : i18next.t('shroomsweeper.off');
        DOM.longPressToggleBtn.innerHTML = `👆<span class="btn-text"> ${i18next.t('shroomsweeper.longPressMode', { status })}</span>`;
        DOM.longPressToggleBtn.classList.toggle('primary', isLongPressMode);
    }
    
    // --- MANEJO DE EVENTOS ---
    
    function handleCellInteraction(r, c) {
        if (state.isGameOver) return;
        switch (activeTool) {
            case 'shovel': handleLeftClick(r, c); break;
            case 'flag': toggleFlagState(r, c, 'flag'); break;
            case 'question': toggleFlagState(r, c, 'question'); break;
        }
    }

    function toggleFlagState(r, c, targetState) {
        if (state.board[r][c].isRevealed) return;
        const cell = state.board[r][c];
        if (targetState === 'flag') {
            if (cell.isFlagged) {
                cell.isFlagged = false;
                state.flagsPlaced--;
            } else {
                cell.isFlagged = true;
                cell.isQuestion = false;
                state.flagsPlaced++;
            }
        } else if (targetState === 'question') {
            if (cell.isQuestion) {
                cell.isQuestion = false;
            } else {
                if (cell.isFlagged) {
                    state.flagsPlaced--;
                    cell.isFlagged = false;
                }
                cell.isQuestion = true;
            }
        }
        updateDangerCounter();
        renderBoard();
    }
    
    function handleLeftClick(r, c) {
        if (state.isGameOver || state.board[r][c].isFlagged) return;
        if (state.isFirstClick) {
            state.isFirstClick = false;
            generateBoard(r, c);
            timerInterval = setInterval(() => {
                state.time++;
                DOM.timer.textContent = state.time;
            }, 1000);
        }
        revealCell(r, c);
    }
    
    function handleRightClick(e, r, c) {
        if (e) e.preventDefault();
        if (window.innerWidth <= 768 && !isLongPressMode) return;
        if (state.isGameOver || state.board[r][c].isRevealed) return;
        const cell = state.board[r][c];
        if (!cell.isFlagged && !cell.isQuestion) {
            cell.isFlagged = true;
            state.flagsPlaced++;
        } else if (cell.isFlagged) {
            cell.isFlagged = false;
            cell.isQuestion = true;
            state.flagsPlaced--;
        } else if (cell.isQuestion) {
            cell.isQuestion = false;
        }
        updateDangerCounter();
        renderBoard();
    }
    
    function setupEventListeners() {
        DOM.newGameBtn.addEventListener('click', initGame);
        DOM.difficultyEl.addEventListener('change', (e) => {
            if (e.target.value === 'custom') {
                DOM.modalOverlay.classList.remove('hidden');
            } else {
                initGame();
            }
        });
        
        DOM.modalOverlay.addEventListener('click', (e) => {
            if (e.target === DOM.modalOverlay) DOM.modalOverlay.classList.add('hidden');
        });
        
        const updateSliderMax = () => {
            const w = parseInt(DOM.widthSlider.value);
            const h = parseInt(DOM.heightSlider.value);
            const maxDangers = Math.max(1, w * h - 100);
            DOM.dangerSlider.max = maxDangers;
            if (parseInt(DOM.dangerSlider.value) > maxDangers) {
                DOM.dangerSlider.value = maxDangers;
                DOM.dangerValue.textContent = maxDangers;
            }
        };
        
        DOM.widthSlider.addEventListener('input', () => {
            DOM.widthValue.textContent = DOM.widthSlider.value;
            updateSliderMax();
        });
        DOM.heightSlider.addEventListener('input', () => {
            DOM.heightValue.textContent = DOM.heightSlider.value;
            updateSliderMax();
        });
        DOM.dangerSlider.addEventListener('input', () => {
            DOM.dangerValue.textContent = DOM.dangerSlider.value;
        });

        DOM.startCustomBtn.addEventListener('click', () => {
            DOM.modalOverlay.classList.add('hidden');
            initGame();
        });

        DOM.toolpadBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                activeTool = btn.dataset.tool;
                DOM.toolpadBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        DOM.longPressToggleBtn.addEventListener('click', () => {
            isLongPressMode = !isLongPressMode;
            if (isLongPressMode) activeTool = 'shovel';
            updateLongPressModeUI();
            renderBoard();
        });
    }

    // --- INICIALIZACIÓN ---
    
    function initGame() {
        let settings;
        const difficulty = DOM.difficultyEl.value;
        if (difficulty === 'custom') {
            settings = {
                rows: parseInt(DOM.heightSlider.value),
                cols: parseInt(DOM.widthSlider.value),
                dangers: parseInt(DOM.dangerSlider.value)
            };
        } else {
            settings = difficultySettings[difficulty];
        }
        resetState(settings);
        createEmptyBoard();
        updateLongPressModeUI();
        renderBoard();
        
        activeTool = 'shovel';
        const shovelBtn = document.querySelector('.toolpad .btn[data-tool="shovel"]');
        if (shovelBtn) {
            DOM.toolpadBtns.forEach(b => b.classList.remove('active'));
            shovelBtn.classList.add('active');
        }
    }

    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    // Los listeners de eventos globales también van aquí dentro.
    document.addEventListener('languageChanged', () => {
        if (DOM.longPressToggleBtn) updateLongPressModeUI();
        // `checkWinner` necesita el tablero, que vive en `state`.
        if (typeof state !== 'undefined' && state.board) {
             // `updateStatus` no existe en este scope, pero asumiendo que lo tuvieras
             // updateStatus(state.isGameOver ? checkWinner(state.board) : null);
        }
    });

    initGame();
    setupEventListeners();

});

