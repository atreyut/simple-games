// --- Lógica del Juego Tic-Tac-Toe ---

document.addEventListener('appReady', () => {
    // Constantes del DOM
    const boardEl = document.getElementById('board');
    const statusEl = document.getElementById('game-status');
    const difficultyEl = document.getElementById('difficulty');
    const newGameBtn = document.getElementById('newGameBtn');
    const playerXBtn = document.getElementById('playerXBtn');
    const playerOBtn = document.getElementById('playerOBtn');
	const playerSelectEl = document.querySelector('.player-select');

    // Constantes del juego
    const PLAYER_X = 'X';
    const PLAYER_O = 'O';

    // Estado del juego
    let board;
    let playerSymbol = PLAYER_X;
    let botSymbol = PLAYER_O;
    let isGameOver;
    let currentPlayer;

    const winningCombinations = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Filas
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columnas
        [0, 4, 8], [2, 4, 6]  // Diagonales
    ];

    // --- Lógica de Inicio y Renderizado ---

    function startGame() {
        board = Array(9).fill(null);
        isGameOver = false;
        currentPlayer = PLAYER_X; // X siempre empieza
        renderBoard();
        updateStatus();
		updateControlVisibility();

        if (playerSymbol !== PLAYER_X && difficultyEl.value !== '2p') {
            // Si el jugador es O, el bot (X) hace el primer movimiento.
            setTimeout(botMove, 500);
        }
    }

    function renderBoard() {
        boardEl.innerHTML = '';
        board.forEach((value, index) => {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            if (value) {
                cell.innerHTML = `<span>${value}</span>`;
                cell.dataset.content = value;
                cell.classList.add('occupied');
            }
            cell.addEventListener('click', () => handleCellClick(index));
            boardEl.appendChild(cell);
        });
    }

    function updateStatus(winner = null) {
        const is2P = difficultyEl.value === '2p'; // Comprueba si es modo 2 jugadores

        if (winner) {
            isGameOver = true;
            if (winner.symbol === 'draw') {
                statusEl.textContent = i18next.t('tictactoe.draw');
            } else if (is2P) { // Mensajes de victoria para 2 jugadores
                const winnerNum = (winner.symbol === PLAYER_X) ? 1 : 2;
                statusEl.textContent = i18next.t('tictactoe.win_player_num', { num: winnerNum });
            } else { // Mensajes de victoria contra el bot
                statusEl.textContent = (winner.symbol === playerSymbol) 
                    ? i18next.t('tictactoe.win_player') 
                    : i18next.t('tictactoe.win_bot');
            }
        } else { // Mensajes de turno
            if (is2P) {
                statusEl.textContent = (currentPlayer === PLAYER_X) 
                    ? i18next.t('tictactoe.turn_player1') 
                    : i18next.t('tictactoe.turn_player2');
            } else {
                statusEl.textContent = (currentPlayer === playerSymbol) 
                    ? i18next.t('tictactoe.turn_player') 
                    : i18next.t('tictactoe.turn_bot');
            }
        }
    }
	
	function updateControlVisibility() {
        const is2P = difficultyEl.value === '2p';
        if (playerSelectEl) {
            playerSelectEl.style.display = is2P ? 'none' : 'flex';
        }
    }

    // --- Lógica de Juego y Movimientos ---

    function handleCellClick(index) {
        const is2P = difficultyEl.value === '2p';

        // En modo 2P, cualquier jugador puede hacer clic.
        // En modo vs Bot, solo el jugador humano puede.
        if (isGameOver || board[index] || (!is2P && currentPlayer !== playerSymbol)) {
            return;
        }
        
        makeMove(index, currentPlayer); // El movimiento siempre lo hace el jugador actual

        if (!isGameOver && !is2P) { // Llama al bot solo si no es 2P
            setTimeout(botMove, 500);
        }
    }

    function makeMove(index, symbol) {
        if (isGameOver || board[index]) return;

        board[index] = symbol;
        renderBoard();
        
        const winner = checkWinner(board);
        if (winner) {
            updateStatus(winner);
            if (winner.combination) {
                highlightWinningCells(winner.combination);
            }
        } else {
            currentPlayer = (currentPlayer === PLAYER_X) ? PLAYER_O : PLAYER_X;
            updateStatus();
        }
    }

    function botMove() {
        if (isGameOver) return;
        const difficulty = difficultyEl.value;
        let move;

        const useMinimax = 
            (difficulty === 'impossible') ||
            (difficulty === 'hard' && Math.random() < 0.75) ||
            (difficulty === 'medium' && Math.random() < 0.5);

        if (useMinimax) {
            move = findBestMove(board);
        } else {
            move = findRandomMove(board);
        }

        if (move !== null) {
            makeMove(move, botSymbol);
        }
    }
    
    // --- Lógica del Bot (IA) ---

    function findRandomMove(currentBoard) {
        const emptyCells = [];
        currentBoard.forEach((cell, index) => {
            if (cell === null) emptyCells.push(index);
        });
        if (emptyCells.length > 0) {
            return emptyCells[Math.floor(Math.random() * emptyCells.length)];
        }
        return null;
    }

    // Algoritmo Minimax
    function findBestMove(currentBoard) {
        let bestScore = -Infinity;
        let move = null;
        for (let i = 0; i < 9; i++) {
            if (currentBoard[i] === null) {
                currentBoard[i] = botSymbol;
                let score = minimax(currentBoard, 0, false);
                currentBoard[i] = null;
                if (score > bestScore) {
                    bestScore = score;
                    move = i;
                }
            }
        }
        return move;
    }

    function minimax(currentBoard, depth, isMaximizing) {
        const winner = checkWinner(currentBoard);
        if (winner) {
            if (winner.symbol === botSymbol) return 10 - depth;
            if (winner.symbol === playerSymbol) return depth - 10;
            if (winner.symbol === 'draw') return 0;
        }

        if (isMaximizing) {
            let bestScore = -Infinity;
            for (let i = 0; i < 9; i++) {
                if (currentBoard[i] === null) {
                    currentBoard[i] = botSymbol;
                    let score = minimax(currentBoard, depth + 1, false);
                    currentBoard[i] = null;
                    bestScore = Math.max(score, bestScore);
                }
            }
            return bestScore;
        } else {
            let bestScore = Infinity;
            for (let i = 0; i < 9; i++) {
                if (currentBoard[i] === null) {
                    currentBoard[i] = playerSymbol;
                    let score = minimax(currentBoard, depth + 1, true);
                    currentBoard[i] = null;
                    bestScore = Math.min(score, bestScore);
                }
            }
            return bestScore;
        }
    }

    // --- Funciones de Verificación y UI ---

    function checkWinner(currentBoard) {
        for (const combination of winningCombinations) {
            const [a, b, c] = combination;
            if (currentBoard[a] && currentBoard[a] === currentBoard[b] && currentBoard[a] === currentBoard[c]) {
                return { symbol: currentBoard[a], combination };
            }
        }
        if (currentBoard.every(cell => cell !== null)) {
            return { symbol: 'draw', combination: null };
        }
        return null;
    }
    
    function highlightWinningCells(combination) {
        combination.forEach(index => {
            boardEl.children[index].classList.add('winner');
        });
    }

    // --- Event Listeners ---

    newGameBtn.addEventListener('click', startGame);
    difficultyEl.addEventListener('change', startGame);

    playerXBtn.addEventListener('click', () => {
        if (playerSymbol === PLAYER_O) {
            playerSymbol = PLAYER_X;
            botSymbol = PLAYER_O;
            playerXBtn.classList.add('active');
            playerOBtn.classList.remove('active');
            startGame();
        }
    });

    playerOBtn.addEventListener('click', () => {
        if (playerSymbol === PLAYER_X) {
            playerSymbol = PLAYER_O;
            botSymbol = PLAYER_X;
            playerOBtn.classList.add('active');
            playerXBtn.classList.remove('active');
            startGame();
        }
    });

    document.addEventListener('languageChanged', () => {
        updateStatus(isGameOver ? checkWinner(board) : null);
    });

    // Inicia el juego cuando la app está lista
    startGame();
});
