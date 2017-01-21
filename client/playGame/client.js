jQuery.fn.getCSSVal = function (p) {
	var v = parseInt(this.css(p), 10);
	return isNaN(v) ? 0 : v;
};
var rootUrl = window.location.href.split('/playGame')[0];
var model = new (function (rootUrl) {

	var self = this;
	self.rootUrl = ko.observable(rootUrl);
	self.browserIsChrome = ko.observable(!!window.chrome && !!window.chrome.webstore);
	var path = self.rootUrl().split(window.location.origin)[1]+'/server';
	self.socket = io(window.location.origin, {path: path});
	self.playerInfo = ko.observable();
	self.playerSetup = {};
	self.playerSetup.username = ko.observable('john cena');
	self.playerSetup.color = ko.observable('#ffff00');
	self.playerSetup.gameId = !!$.QueryString.gameId ? ko.observable($.QueryString.gameId) : ko.observable('48 character game Id');
	self.playerSetup.gameIdDisabled = ko.observable(!!$.QueryString.gameId);
	self.playerSetup.inSetup = ko.observable(true);
	self.playerSetup.number = ko.observable('');
	self.playerSetup.isHost = ko.observable('');
	self.playerSetup.createConnection = function () {
		if (self.socket.disconnected) {
			window.location.reload(true);
		}

		self.playerSetup.inSetup(false);
		var data_send = {
			username: self.playerSetup.username(),
			color: self.playerSetup.color(),
			gameId: self.playerSetup.gameId(),
			role: 'player'
		};
		self.socket.emit('connectToGame', data_send);
		self.setupClient();
	};
	self.playerSetup.registerHandlers = function () {
		self.socket.on('info', function (data) {
			self.playerInfo(data);
			self.playerSetup.color(data.color);
			self.playerSetup.username(data.username);
			self.playerSetup.number(data.number);
			self.playerSetup.isHost(data.isHost);
		});
		self.socket.on('join-game', function (data) {
			if (data.error == 'no-game-with-id') {
				window.location.href = self.rootUrl() + '/playGame/';
			}
		});
	};
	self.chat = {};
	self.chat.setupChat = function () {

		self.socket.on('chatLog', function (data) {
			var logWithInfo = data;
			for (var x in self.chat.chatLog()) {
				var item = self.chat.chatLog()[x];
				if (item.sender == "Info") {
					logWithInfo.push(item);
				}
			}

			self.chat.chatLog(logWithInfo);
		});
		self.socket.emit('requestChatLog');
		self.socket.on('chatMessage', function (data) {
			self.chat.chatLog.push(data);
		});
		self.socket.on('chatMessage', function (data) {
			var slst = self.chat.chatLog().length - 2;
			$('.chat-message-parent').get(slst).scrollIntoView(true);
		});
		self.socket.emit('requestInfo');
	};
	self.chat.chatLog = ko.observableArray([{sender: 'Info', message: 'Chat loading...'}]);
	self.chat.chatInput = ko.observable('');
	self.chat.canSendMessage = ko.observable(true);
	self.chat.sendChatMessage = function () {
		self.chat.canSendMessage(false);
		self.socket.emit('sendChatMessage', {message: self.chat.chatInput()});
		self.chat.chatInput('');
		setTimeout(function () {
			self.chat.canSendMessage(true);
		}, 800);
	};

	self.infoLog = {};
	self.infoLog.registerLogHandlers = function () {

		self.socket.on('create-player', function (d) {
			if (d.error == 'gameLocked') {
				window.location.href = self.rootUrl() + '/spectateGame/?gameId='+self.playerSetup.gameId();
			}
		});
		self.socket.on('gameConnected', function (d) {
			self.chat.chatLog.push({message: 'Game joined with role ' + d.role, sender: 'Info'});
		});
		self.socket.on('join-game', function (d) {
			if (d.success) {
				self.chat.chatLog.push({message: 'Connected to Game.', sender: 'Info'});
			} else if (d.error) {
				self.chat.chatLog.push({message: 'Failed to connect to Game - Error: ' + d.error, sender: 'Info'});
			} else {
				self.chat.chatLog.push({message: 'Failed to connect for unknown reasons.', sender: 'Info'});
			}
		});
		self.socket.on('chat-status', function (d) {
			if (!d.success) {
				self.chat.chatLog.push({message: 'Chat Message Rejected - Error: ' + d.error, sender: 'Info'});
			}
		});


	};
	self.infoLog.postInfo = function(info){
		self.chat.chatLog.push({message: info, sender: 'Info'});
	};

	self.gameInfo = {};
	self.gameInfo.boardSize = ko.observable('Loading...');
	self.gameInfo.connect = ko.observable('Loading...');
	self.gameInfo.keepPlaying = ko.observable('Loading...');
	self.gameInfo.gameName = ko.observable('Loading...');
	self.gameInfo.shareLink = ko.observable('Loading...');
	self.gameInfo.shareSpecLink = ko.observable('Loading...');
	self.gameInfo.setupHandlers = function () {
		self.socket.on('gameInfo', function (data) {
			var boardSize = data.boardWidth + ' * ' + data.boardHeight;
			self.gameInfo.boardSize(boardSize);
			self.gameInfo.connect(data.connect);
			var keepPlaying = data.keepPlaying ? 'Yes' : 'No';
			self.gameInfo.keepPlaying(keepPlaying);
			self.gameInfo.gameName(data.gameName);
			var shareLink = self.rootUrl() + '/playGame/?gameId=' + data.gameId;
			self.gameInfo.shareLink(shareLink);
			var shareSpecLink = self.rootUrl() + '/spectateGame/?gameId=' + data.gameId;
			self.gameInfo.shareSpecLink(shareSpecLink);
			self.gameInfo.rawData = {
				boardWidth: ko.observable(data.boardWidth),
				boardHeight: ko.observable(data.boardHeight),
				connect: ko.observable(data.connect),
				gameName: ko.observable(data.gameName),
				keepPlaying: ko.observable(data.keepPlaying)
			};
			self.gameInfo.onBoardInfo();
		});
		self.socket.emit('requestGameInfo');
	};
	self.gameInfo.onBoardInfo = function () {
		$(window).on('resize', function () {
			clearTimeout(self.game.gameResizeTimer);
			self.game.gameResizeTimer = setTimeout(self.game.updateBoardSize, 200);
		});
		self.game.updateBoardSize();
		self.game.populateBoard();
	};


	self.game = {};
	self.game.board = ko.observableArray();
	self.game.gameStarted = ko.observable(false);
	self.game.gameWidth = ko.observable(1);
	self.game.gameHeight = ko.observable(1);
	self.game.piecePart = ko.observable(1);
	self.game.pieceSize = ko.observable(1);
	self.game.emptyColor = ko.observable('#dc6e6e');
	self.game.rawBoardOld = [];
	self.spectators = ko.observableArray();
	self.players = ko.observableArray();
	self.permPlayers = ko.observableArray();
	self.permPlayersMap = ko.computed(function () {
		var comp = {
			'0': {
				username: ko.observable('Nobody'),
				color: ko.observable(self.game.emptyColor()),
				type: ko.observable('player'),
				number: ko.observable(0),
				isHost:ko.observable(false)
			}
		};
		var players = self.permPlayers();
		for (var x in players) {
			var player = players[x];
			comp[player.number().toString()] = player;
		}
		return comp;
	});
	self.playersMap = ko.computed(function () {
		var comp = {};
		var players = self.players();
		for (var x in players) {
			var player = players[x];
			comp[player.number().toString()] = player;
		}
		return comp;
	});
	self.game.populateBoard = function () {
		var board = [];
		var boardWidth = self.gameInfo.rawData.boardWidth();
		var boardHeight = self.gameInfo.rawData.boardHeight();
		for (var x = 0; x < boardWidth; x++) {
			var col = {arr: ko.observableArray([]), col: ko.observable(x)};
			for (var y = 0; y < boardHeight; y++) {
				var p = {
					username: ko.observable('Nobody'),
					color: ko.observable(self.game.emptyColor),
					type: ko.observable('player'),
					number: ko.observable(0),
					pieceVisible: ko.observable(true),
					isHost:ko.observable(false),
					x:ko.observable(x),
					y:ko.observable(y)
				};
				col.arr.push(p);
			}
			board.push(col);
		}
		self.game.board(board);
		for (var x = 0; x < boardWidth; x++) {
			var c = [];
			for (var y = 0; y < boardHeight; y++) {
				c.push(0);
			}
			self.game.rawBoardOld.push(c);
		}
	};
	self.game.updateBoardSize = function () {
		var game = $('.game');
		game.css('width', '100vw');
		game.css('height', '100vh');
		var gw = game.width() / self.gameInfo.rawData.boardWidth();
		var gh = game.height() / self.gameInfo.rawData.boardHeight();
		var ps = Math.min(gw, gh);
		var bw = self.gameInfo.rawData.boardWidth() * ps;
		var bh = self.gameInfo.rawData.boardHeight() * ps;
		self.game.piecePart((60*ps)/512);
		self.game.gameWidth(bw);
		self.game.gameHeight(bh);
		self.game.pieceSize(ps);
		game.css('width', '');
		game.css('height', '');

	};
	self.game.animatePiece =function(x,y){
		var pos = $('#piece_'+x+'_'+y).position();
		var pieceSize = self.game.pieceSize() - self.game.piecePart();
		var anim_piece = $('<div></div>');
		anim_piece.attr('class','piece-animation');
		anim_piece.css('border-radius', pieceSize/2);
		anim_piece.css('left',pos.left+self.game.piecePart()/2);
		anim_piece.css('width',self.game.pieceSize()-self.game.piecePart());
		anim_piece.css('height',self.game.pieceSize()-self.game.piecePart());
		anim_piece.css('background-color',self.game.board()[x].arr()[y].color());
		$('.animation-mask').append(anim_piece);
		var dist = self.gameInfo.rawData.boardHeight() - y;
		var time = 92*dist;
		var after_anim = function(){
			self.game.board()[x].arr()[y].pieceVisible(true);
			anim_piece.remove();
		};
		anim_piece.animate({top:pos.top+self.game.piecePart()/2},time,after_anim);


	};
	self.game.updateBoard = function (data) {
		var oldboard = self.game.rawBoardOld;
		var newboard = data;
		var changePos = [];
		for(var x in newboard){
			for(var y in newboard[x]){
				if(oldboard[x][y] != newboard[x][y]){
					changePos.push({x:x,y:y,player:newboard[x][y]});
				}
			}
		}
		for(var x in changePos){
			var piece = changePos[x];
			var player = self.permPlayersMap()[piece.player];
			var np = ko.mapping.toJS(player);
			np.pieceVisible = false;
			np.x = piece.x;
			np.y = piece.y;
			var ks = Object.keys(np);
			for(var z in ks){
				var key = ks[z];
				var pr =np[key];
				var pos = self.game.board()[piece.x].arr()[piece.y][key];
				pos(pr);
			}
			self.game.animatePiece(piece.x,piece.y);
		}
		self.game.rawBoardOld = newboard;
	};
	self.game.makeMove = function(col){
		self.socket.emit('move',{col:col});
	};
	self.game.playFromCol = function(){
		self.game.makeMove(this.col());
	};
	self.game.startGame = function(){
		self.socket.emit('lockGame');
	};
	self.game.setupGame = function () {
		self.game.registerHandlers();
		self.socket.emit('requestPlayers');
		self.socket.emit('requestSpectators');
		self.socket.emit('requestBoard');
	};
	self.game.registerHandlers = function () {
		self.socket.on('updatePlayers', function () {
			self.socket.emit('requestPlayers');
		});
		self.socket.on('updateSpecs', function () {
			self.socket.emit('requestSpectators');
		});
		self.socket.on('gameLocked', function () {
			self.socket.emit('requestPlayers');
			self.socket.emit('requestSpectators');
			self.socket.emit('requestPermPlayers');
			self.game.gameStarted(true);
		});
		self.socket.on('players', function (data) {
			var convdata = ko.mapping.fromJS(data);
			self.players(convdata());
		});
		self.socket.on('spectators', function (data) {
			var convdata = ko.mapping.fromJS(data);
			self.spectators(convdata());
		});
		self.socket.on('board', function (data) {
			self.game.updateBoard(data);

		});
		self.socket.on('moved',function(){
			self.socket.emit('requestBoard');
		});
		self.socket.on('move-status',function(data){
			if(!data.success){
				self.infoLog.postInfo('Your move failed. Error: '+data.error);
			}
		});
		self.socket.on('youWon',function(){
			console.log('win');
			window.location.href = self.rootUrl() + '/spectateGame/instant.html?' + $.param({gameId:self.playerSetup.gameId(),username:self.playerSetup.username()});
		});
		self.socket.on('permPlayers',function(data){
			var convdata = ko.mapping.fromJS(data);
			self.permPlayers(convdata());
		});

	};

	self.clientReady = ko.observable(false);
	self.setupClient = function () {
		self.playerSetup.registerHandlers();
		self.chat.setupChat();
		self.infoLog.registerLogHandlers();
		self.gameInfo.setupHandlers();
		self.game.setupGame();
		self.clientReady(true);
	}
})(rootUrl);
function clientReady() {
	ko.applyBindings(model);
}
$(document).ready(clientReady);