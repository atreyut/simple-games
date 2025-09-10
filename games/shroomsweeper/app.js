document.addEventListener('appReady', () => {

    // CONSTANTS AND DOM
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
        toolpad: document.getElementById('toolpad'),
        toolpadBtns: document.querySelectorAll('.toolpad .btn'),
        longPressToggleBtn: document.getElementById('longPressToggleBtn'),
        modalOverlay: document.getElementById('custom-modal-overlay'),
        widthSlider: document.getElementById('width-slider'),
        heightSlider: document.getElementById('height-slider'),
        dangerSlider: document.getElementById('danger-slider'),
        widthValue: document.getElementById('width-value'),
        heightValue: document.getElementById('height-value'),
        dangerValue: document.getElementById('danger-value'),
        startCustomBtn: document.getElementById('start-custom-game-btn'),
    };

    // STATE
    let state = {};
    let timerInterval;
    let activeTool = 'shovel';
    let isToolMode = false;

    // Reset state before a new game
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

    // Create empty board data
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

    // Board generation: ensure first 3x3 is safe; second ring gets some safe cells depending on difficulty
	function generateBoard(firstClickR, firstClickC) {
		const safeZone = new Set();
		const difficulty = DOM.difficultyEl.value;

		for (let dr = -1; dr <= 1; dr++) {
			for (let dc = -1; dc <= 1; dc++) {
				const r = firstClickR + dr;
				const c = firstClickC + dc;
				if (r >= 0 && r < state.rows && c >= 0 && c < state.cols) {
					safeZone.add(`${r}-${c}`);
				}
			}
		}

		if (difficulty !== 'custom') {
			const secondRing = [];
			for (let dr = -2; dr <= 2; dr++) {
				for (let dc = -2; dc <= 2; dc++) {
					const r = firstClickR + dr;
					const c = firstClickC + dc;
					if (
						r >= 0 && r < state.rows &&
						c >= 0 && c < state.cols &&
						!safeZone.has(`${r}-${c}`)
					) {
						secondRing.push(`${r}-${c}`);
					}
				}
			}

			const toFreeCount =
				difficulty === 'easy' ? Math.floor(Math.random() * 3) + 14 :
				difficulty === 'medium' ? Math.floor(Math.random() * 8) + 7 :
				difficulty === 'hard' ? Math.floor(Math.random() * 13) : 0;

			shuffleArray(secondRing).slice(0, toFreeCount).forEach(key => safeZone.add(key));
		}

		// Place dangers everywhere except the safeZone
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

        // compute adjacent counts and decorations
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
						if (Math.random() < 1 / 1000) state.board[r][c].decoration = '🦋';
                        else if (Math.random() < 1 / 100) state.board[r][c].decoration = '🐞';
                        else if (Math.random() < 1 / 22) state.board[r][c].decoration = '🐌';
                        else if (Math.random() < 1 / 10) state.board[r][c].decoration = '🌱';
                    }
                }
            }
        }
    }

    // Efficient reveal: iterative flood-fill; single render at end
    function revealCell(r, c) {
        if (state.isGameOver || r < 0 || r >= state.rows || c < 0 || c >= state.cols) return;
        const startCell = state.board[r][c];
        if (startCell.isRevealed || startCell.isFlagged) return;

        // If it's a danger, reveal and end game
        if (startCell.isDanger) {
            startCell.isRevealed = true;
            startCell.isTriggeringDanger = true;
            state.revealedCount++;
            gameOver(false);
            return;
        }

        // BFS/stack flood fill for contiguous zero-adjacent areas
        const stack = [];
        stack.push({ r, c });
        const visited = new Set();

        while (stack.length) {
            const { r: cr, c: cc } = stack.pop();
            const key = `${cr}-${cc}`;
            if (visited.has(key)) continue;
            visited.add(key);

            const cell = state.board[cr][cc];
            if (cell.isRevealed || cell.isFlagged) continue;
            cell.isRevealed = true;
            state.revealedCount++;

            // If zero adjacent, add neighbors to flood-fill
            if (cell.adjacentDangers === 0) {
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        const nr = cr + dr, nc = cc + dc;
                        if (nr >= 0 && nr < state.rows && nc >= 0 && nc < state.cols) {
                            const neighKey = `${nr}-${nc}`;
                            if (!visited.has(neighKey)) stack.push({ r: nr, c: nc });
                        }
                    }
                }
            }
        }

        renderBoard();
        checkWinCondition();
    }

    // Check win condition
    function checkWinCondition() {
        const nonDangerCells = state.rows * state.cols - state.dangerCount;
        if (state.revealedCount === nonDangerCells) {
            gameOver(true);
        }
    }

    // Game over handling
	function gameOver(isWin) {
		state.isGameOver = true;
		clearInterval(timerInterval);

		const boardWidth = DOM.board.offsetWidth;
		const boardHeight = DOM.board.offsetHeight;
		const boardTop = DOM.board.offsetTop;
		const boardLeft = DOM.board.offsetLeft;

		DOM.gameOverOverlay.style.width = `${boardWidth}px`;
		DOM.gameOverOverlay.style.height = `${boardHeight}px`;
		DOM.gameOverOverlay.style.top = `${boardTop}px`;
		DOM.gameOverOverlay.style.left = `${boardLeft}px`;

		DOM.gameOverText.textContent = isWin 
			? i18next.t('shroomsweeper.win')
			: i18next.t('shroomsweeper.lose');
		
		if (isWin) {
			DOM.gameOverOverlay.classList.add('win');
		}
		
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

    // Render board: single DOM update pass
    function renderBoard() {
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

                // Always attach click and contextmenu. Mobile long-press will trigger native contextmenu.
                cellEl.addEventListener('click', () => handleCellInteraction(r, c));
                cellEl.addEventListener('contextmenu', (e) => handleRightClick(e, r, c));

                DOM.board.appendChild(cellEl);
            }
        }

        DOM.boardContainer.scrollTop = scrollTop;
        DOM.boardContainer.scrollLeft = scrollLeft;

        // Toolpad visibility
        DOM.toolpad.style.display = isToolMode ? '' : 'none';
    }

    // Danger counter update
    function updateDangerCounter() {
        DOM.dangerCount.textContent = state.dangerCount - state.flagsPlaced;
    }

    // Update toggle UI for tool mode
    function updateToolModeUI() {
        DOM.app.classList.toggle('tool-mode-active', isToolMode);
        const status = isToolMode ? i18next.t('shroomsweeper.on') : i18next.t('shroomsweeper.off');
        DOM.longPressToggleBtn.innerHTML = `🧰<span class="btn-text"> ${i18next.t('shroomsweeper.toolsMode', { status })}</span>`;
        DOM.longPressToggleBtn.classList.toggle('primary', isToolMode);
    }

    // Cell interaction depending on active tool
    function handleCellInteraction(r, c) {
        if (state.isGameOver) return;
        switch (activeTool) {
            case 'shovel': handleLeftClick(r, c); break;
            case 'flag': toggleFlagState(r, c, 'flag'); break;
            case 'question': toggleFlagState(r, c, 'question'); break;
        }
    }

    // Toggle flag/question on a cell
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

    // Left-click (shovel) handling
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

    // Right-click / contextmenu handling: toggle flag/question
    function handleRightClick(e, r, c) {
        if (e) e.preventDefault();
        // On very small screens, we still allow contextmenu action (native long-press may trigger it)
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

    // Set up event listeners
	function setupEventListeners() {
		DOM.newGameBtn.addEventListener('click', () => {
			if (DOM.difficultyEl.value === 'custom') {
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
			const maxDangers = Math.max(1, w * h - 11);
			DOM.dangerSlider.max = maxDangers;

			let current = parseInt(DOM.dangerSlider.value);
			if (current > maxDangers) current = maxDangers;
			if (current < 1) current = 1;

			DOM.dangerSlider.value = current;
			DOM.dangerValue.textContent = current;
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

        // Toggle now toggles the toolpad (tools mode)
        DOM.longPressToggleBtn.addEventListener('click', () => {
            isToolMode = !isToolMode;
            if (isToolMode) activeTool = 'shovel';
            updateToolModeUI();
            renderBoard();
        });

        // Keyboard accessibility: space/enter on a focused cell should reveal (optional)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                // close modal, etc.
                if (!DOM.modalOverlay.classList.contains('hidden')) DOM.modalOverlay.classList.add('hidden');
            }
        });

        // i18n or theme change hook
        document.addEventListener('languageChanged', () => {
            if (DOM.longPressToggleBtn) updateToolModeUI();
        });
    }

    // Initialize a new game
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
        updateToolModeUI();
        renderBoard();

        activeTool = 'shovel';
        const shovelBtn = document.querySelector('.toolpad .btn[data-tool="shovel"]');
        if (shovelBtn) {
            DOM.toolpadBtns.forEach(b => b.classList.remove('active'));
            shovelBtn.classList.add('active');
        }
    }

    // Utility: Fisher-Yates shuffle
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    initGame();
    setupEventListeners();
});
