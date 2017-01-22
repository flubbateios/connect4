var board = function (w, h, c) {
	var self = this;
	self.connect = c;
	self.board = [];
	self.players = [];
	self.boardHeight = h;
	self.boardWidth = w;
	self.players = [];
	var m = self.connect;

	for (var x = 0; x < self.boardWidth; x++) {
		var c = [];
		for (var y = 0; y < self.boardHeight; y++) {
			c.push(0);
		}
		self.board.push(c);
	}
	self.testBoard = function () {
		var test = self.checkAllVert() || self.checkAllHoriz() || self.checkAllDiagLeft() || self.checkAllDiagRight();
		return test;
	};
	self.checkAllVert = function () {
		for (var player in self.players) {
			var p = self.players[player];
			for (var x = 0; x < self.boardWidth; x++) {
				for (var y = 0; y <= (self.boardHeight - m); y++) {
					for (var z = 0; z < m; z++) {
						if (self.board[x][y + z] != p) {
							break;
						}
						if (z == (m - 1)) {
							return p;
						}
					}

				}

			}

		}

	};
	self.checkAllHoriz = function () {
		for (var player in self.players) {
			var p = self.players[player];
			for (var x = 0; x <= (self.boardWidth - m); x++) {
				for (var y = 0; y < (self.boardHeight); y++) {
					for (var z = 0; z < m; z++) {
						if (self.board[x + z][y] != p) {
							break;
						}
						if (z == (m - 1)) {
							return p;
						}
					}

				}

			}

		}

	};
	self.checkAllDiagRight = function () {
		for (var player in self.players) {
			var p = self.players[player];
			for (var x = 0; x <= (self.boardWidth - m); x++) {
				for (var y = 0; y <= (self.boardHeight - m); y++) {
					for (var z = 0; z < m; z++) {
						if (self.board[x + z][y + z] != p) {
							break;
						}
						if (z == (m - 1)) {
							return p;
						}
					}

				}

			}

		}

	};
	self.checkAllDiagLeft = function () {
		for (var player in self.players) {
			var p = self.players[player];
			for (var x = (m - 1); x < self.boardWidth; x++) {
				for (var y = 0; y <= (self.boardHeight - m); y++) {
					for (var z = 0; z < m; z++) {
						if (self.board[x - z][y + z] != p) {
							break;
						}
						if (z == (m - 1)) {
							return p;
						}
					}

				}

			}

		}

	};
	self.play = function (player, col) {
		var c = self.board[col];
		var placed = false;
		for (var x in c) {
			var square = c[x];
			if (square == 0) {
				self.board[col][x] = player;
				placed = true;
				break;

			}
		}
		return placed;
	};
	self.getPlayerTurn = function () {
		var playedSquares = 0;
		for (var x in self.board) {
			for (var y in self.board[x]) {
				if (self.board[x][y] != 0) {
					playedSquares += 1;
				}
			}
		}
		var turn = (playedSquares % self.players.length);
		return self.players[turn];
	};
	self.getPlayedSquares = function(){
		var playedSquares = 0;
		for (var x in self.board) {
			for (var y in self.board[x]) {
				if (self.board[x][y] != 0) {
					playedSquares += 1;
				}
			}
		}
		return playedSquares;
	};
	self.isTurn = function (p) {
		return p == self.getPlayerTurn();
	};
};
module.exports = board;
