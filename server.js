var board = require('./board.js');
var utilities = require('./utilities.js');
var express = require('express');
var io = require('socket.io');
var _ = require('lodash');
var http = require('http');
var html_escape = require('escape-html');
var bodyParser = require('body-parser');
var randomcolor = require('randomcolor');
var fs = require('fs');
var c4game = function (w, h, c, id, keepPlaying, gameName, selfdestruct, public) {
	var self = this;
	self.keepPlaying = keepPlaying;
	self.generator = new utilities.uGenerator();
	self.board = new board(w, h, c);
	self.players = [];
	self.gameReady = false;
	self.gameId = id;
	self.gameName = gameName;
	self.public = public;
	self.spectators = [];
	self.chatMessages = [];
	self.winners = [];
	self.originalPlayers = 0;
	self.chatLog = [];
	self.gameOver = false;
	self.publicGameInfo = {
		gameId: self.gameId,
		boardWidth: self.board.boardWidth,
		boardHeight: self.board.boardHeight,
		keepPlaying: self.keepPlaying,
		gameName:self.gameName,
		connect:self.board.connect
	};
	self.destroyTimer = setTimeout(function(){
		if(self.players.length == 0){
			self.destroyGame();
		}
	},(80 * 1000));
	self.lockGame = function () {
		self.gameReady = true;
		self.createPlayer = function (d, sock) {
			sock.emit('create-player', {success: false, error: "gameLocked"});
			sock.disconnect();
		};
		self.permPlayers = [];
		for(var x in self.players){
			self.permPlayers.push(self.players[x].public);
		};
		self.sendInfoToAll('gameLocked');
		self.originalPlayers = self.players.length;
	};
	self.endGame = function () {
		self.attemptMove = function () {
			return {success: false, error: "Game is over"};
		};
		self.sendInfoToAll('gameOver');
		self.sendServerMessage('Game Over.');
		self.gameOver = true;
	};
	self.destroyGame = function () {
		for (var x in self.players) {
			var socket = self.players[x].socket;
			socket.disconnect();
		}
		selfdestruct();
	};
	self.createPlayer = function (data, sock) {
		var player = {};
		var colors = ['#d25a3c'];
		var names = ['Info','Server','info','server'];
		for (var x in self.players) {
			var pSelect = self.players[x];
			colors.push(pSelect.color);
			names.push(pSelect.username);
		}
		for (var x in self.spectators) {
			var pSelect = self.spectators[x];
			names.push(pSelect.username);
		}
		player.type = 'player';

		var rndcolor = utilities.roundHTMLColor(randomcolor(),30);
		player.color = data.color;
		player.color = player.color.toLowerCase();
		player.color = /^#[0-9A-F]{6}$/i.test(player.color) ? player.color : rndcolor;
		player.color = utilities.roundHTMLColor(player.color,30);
		player.color = !(_.includes(colors, player.color)) ? player.color : rndcolor;


		player.username = !(_.includes(names, data.username)) ? (data.username || self.generator.genUnique(16)) : self.generator.genUnique(16);
		//player.username = html_escape(player.username);
		player.username = player.username.substring(0, 24);

		player.number = (self.board.players.length == 0) ? 1 : (Math.max.apply(Math, self.board.players) + 1 );
		player.socket = sock;
		player.isHost = self.players.length == 0;

		player.returnable = {
			number: player.number,
			type: player.type,
			username: player.username,
			color: player.color,
			isHost:player.isHost
		};
		player.public = {
			number: player.number,
			type: player.type,
			username: player.username,
			color: player.color,
			isHost:player.isHost
		};
		self.players.push(player);
		self.board.players.push(player.number);
		self.setupPlayer(player);
		if(player.isHost){
			self.setupHost(player);
		}

		//NOTIFY ALL PEOPLE OF JOIN
		self.sendInfoToAll('updatePlayers');

		return player;
	};

	self.setupPlayer = function (player) {
		player.socket.emit('gameConnected', {role: 'player', gameId: self.gameId});
		player.socket.on('requestInfo', function () {
			player.socket.emit('info', player.returnable);
		});
		player.socket.on('requestPlayers', function () {
			var info = [];
			for (var x in self.players) {
				info.push(self.players[x].public);
			}
			player.socket.emit('players', info);
		});
		player.socket.on('requestSpectators', function () {
			var info = [];
			for (var x in self.spectators) {
				info.push(self.spectators[x].returnable);
			}
			player.socket.emit('spectators', info);
		});
		player.socket.on('move', function (data) {
			var mv = self.attemptMove(data,player);
			player.socket.emit('move-status', mv);
		});
		player.socket.on('requestBoard', function () {
			player.socket.emit('board', self.board.board);
		});
		player.socket.on('requestGameInfo', function () {
			player.socket.emit('gameInfo', self.publicGameInfo);
		});
		player.socket.on('sendChatMessage', function (data) {
			var msg = data;
			if (self.filterChatMessage(msg)) {
				msg.sender = player.username;
				msg.senderId = player.number;
				msg.time = Date.now();
				//msg.message = html_escape(msg.message);
				self.sendChatMessage(msg);
				player.socket.emit('chat-status', {success: true});
			} else {
				player.socket.emit('chat-status', {success: false, error: "rejected-filtered"});
			}
		});
		player.socket.on('disconnect', function () {
			self.removePlayer(player.number);
		});
		player.socket.on('requestChatLog', function () {
			player.socket.emit('chatLog', self.chatLog);
		});
		player.socket.on('requestPermPlayers',function(){
			player.socket.emit('permPlayers',self.permPlayers)
		});
		player.socket.on('requestTurn',function(){
			player.socket.emit('turn',self.board.getPlayerTurn())
		});

	};
	self.setupHost = function(player){
		player.public.isHost = true;
		player.returnable.isHost = true;
		player.socket.on('lockGame',function(){
			self.lockGame();
		});
		player.socket.on('kickPlayer',function(data){
			if(!self.gameReady){
				self.removePlayer(data);
			}
		});
	};

	self.createSpec = function (data, sock) {
		var spectator = {};
		var names = ['Info','Server','info','server'];
		for (var x in self.players) {
			var pSelect = self.players[x];
			names.push(pSelect.username);
		}
		for (var x in self.spectators) {
			var pSelect = self.spectators[x];
			names.push(pSelect.username);
		}
		spectator.username = data.username;
		spectator.username = spectator.username.substring(0, 24);
		spectator.username = !(_.includes(names, spectator.username)) ? spectator.username : self.generator.genUnique(16);
		spectator.type = 'spectator';
		spectator.socket = sock;
		spectator.returnable = {
			type: spectator.type,
			username: spectator.username
		};
		self.spectators.push(spectator);
		self.setupSpec(spectator);
		//NOTIFY
		self.sendInfoToAll('updateSpecs');
		return spectator;
	};

	self.setupSpec = function (spec) {
		spec.socket.emit('gameConnected', {role: 'spectator', gameId: self.gameId});
		spec.socket.on('requestInfo', function () {
			spec.socket.emit('info', spec.returnable);
		});
		spec.socket.on('requestBoard', function () {
			spec.socket.emit('board', self.board.board);
		});
		spec.socket.on('requestSpectators', function () {
			var info = [];
			for (var x in self.spectators) {
				info.push(self.spectators[x].returnable);
			}
			spec.socket.emit('spectators', info);
		});
		spec.socket.on('requestPlayers', function () {
			var info = [];
			for (var x in self.players) {
				info.push(self.players[x].public);
			}
			spec.socket.emit('players', info);
		});
		spec.socket.on('requestGameInfo', function () {
			spec.socket.emit('gameInfo', self.publicGameInfo);
		});
		spec.socket.on('sendChatMessage', function (data) {
			var msg = data;
			if (self.filterChatMessage(msg)) {
				msg.sender = spec.username;
				msg.time = Date.now();
				//msg.message = html_escape(msg.message);
				self.sendChatMessage(msg);
				spec.socket.emit('chat-status', {success: true});
			} else {
				spec.socket.emit('chat-status', {success: false, error: "rejected-filtered"});
			}
		});
		spec.socket.on('disconnect', function () {
			self.removeSpec(spec);
		});
		spec.socket.on('requestChatLog', function () {
			spec.socket.emit('chatLog', self.chatLog);
		});
		spec.socket.on('hasGameStarted', function () {
			if(self.gameReady){
				spec.socket.emit('gameLocked')
			}
		});
		spec.socket.on('requestPermPlayers',function(){
			spec.socket.emit('permPlayers',self.permPlayers)
		});
		spec.socket.on('requestTurn',function(){
			spec.socket.emit('turn',self.board.getPlayerTurn())
		});

	};

	self.sendInfoToPlayers = function (ev, data) {
		for (var x in self.players) {
			var sock = self.players[x].socket;
			sock.emit(ev, data);
		}
	};
	self.sendInfoToSpecs = function (ev, data) {
		for (var x in self.spectators) {
			var sock = self.spectators[x].socket;
			sock.emit(ev, data);
		}
	};
	self.sendInfoToAll = function (ev, data) {
		self.sendInfoToPlayers(ev, data);
		self.sendInfoToSpecs(ev, data);
	};

	self.sendChatMessage = function (msg) {
		self.chatLog.push(msg);
		if (self.chatLog.length > 200) {
			self.chatLog.splice(0, 1);
		}
		self.sendInfoToAll('chatMessage', msg);
	};
	self.filterChatMessage = function (msg) {
		return (msg.message.length <= 256) && msg.message;

	};
	self.sendServerMessage = function (message) {
		var msg = {
			message: message,
			sender: "Server",
			senderId: -1,
			time: Date.now()
		};
		self.sendChatMessage(msg);
	};

	self.attemptMove = function (data, player) {
		if (self.gameReady && !self.gameOver) {
			data.col = parseInt(data.col);
			if (!(self.board.isTurn(player.number))) {
				return {error: "not-your-move", success: false};
			}
			if (!(data.col < self.board.boardWidth)) {
				return {error: "move-out-of-bounds", success: false};
			}
			if (data.col < 0) {
				return {error: "move-out-of-bounds", success: false};
			}
			var success = self.board.play(player.number, data.col);
			if (success) {
				self.sendInfoToAll('moved');
				self.testGame();
				return {success: true};
			} else {
				return {success: false, error: "misc-error"};
			}

		}else{
			return {success:false, error:'game-not-ready'};
		}
	};
	self.testGame = function () {
		var won = self.board.testBoard();
		var winner_username;
		var winner_p;
		for (var x in self.players) {
			if (self.players[x].number == won) {
				winner_p = self.players[x];
				winner_username = self.players[x].username;
			}
		}

		if (self.keepPlaying && won && (self.permPlayers.length>2)) {
			winner_p.socket.emit('youWon');
			self.sendServerMessage(winner_username + ' has won!');
			self.sendInfoToAll('board',self.board.board);
			self.sendInfoToAll('playerWon', won);
			self.winners.push(won);
			self.removePlayer(won);
		} else if (won) {
			self.sendServerMessage(winner_username + ' is the winner!');
			self.sendInfoToAll('playerWon', won);
			self.sendInfoToAll('board',self.board.board);
			self.endGame();
		}
		if ((self.winners.length == (self.originalPlayers - 1)) || (self.board.getPlayedSquares() == (self.board.boardWidth * self.board.boardHeight))) {
			for (var x in self.board.players) {
				var player = self.board.players[x];
				if (!_.includes(self.winners, player)) {
					self.winners.push('player');
					
				}
			}
		}
		if(self.board.getPlayedSquares() == (self.board.boardWidth * self.board.boardHeight)){
			self.sendServerMessage("It's a draw!");
		}
		if (self.winners.length == self.originalPlayers) {
			self.sendInfoToAll('board',self.board.board);
			self.endGame();
		}

	};

	self.removePlayer = function (p) {
		var i = self.board.players.indexOf(p);
		if (i > -1) {
			self.board.players.splice(i, 1);
		} else {
			return false;
		}

		for (var x in self.players) {
			if (self.players[x].number == p) {
				self.players[x].socket.disconnect();
				self.players.splice(x, 1);
				self.replaceHost();
				self.sendInfoToAll('updatePlayers');
				if(self.players.length == 0){
					self.destroyGame();
				}
				return true;
			}
		}
		return false;
	};
	self.removeSpec = function (spec) {
		var pos = self.spectators.indexOf(spec);

		if (pos > -1) {
			self.spectators[pos].socket.disconnect();
			self.spectators.splice(pos, 1);
			self.sendInfoToAll('updateSpecs');
		}
	};
	self.replaceHost = function(){
		if(self.players.length == 0){
			self.destroyGame();
			return false;
		}
		var newhost = Math.min.apply(Math, self.board.players);
		for(var x in self.players){
			var p = self.players[x];
			if(p.isHost){
				return false;
			}else if(p.number == newhost){
				p.isHost = true;
				self.setupHost(p);
				self.sendInfoToAll('updatePlayers');
				p.socket.emit('info',p.returnable);
				return true;
			}

		}

	};

};

var c4serv = function (port,host,logfile) {
	var self = this;
	self.port = port;
	self.host = host;
	self.logfile = logfile || false;
	self.games = [];
	self.publicGames = [];
	self.publicGamesInfo =[];
	self.publicGamesListeners=[];
	self.app = express();
	self.httpServer = http.createServer(self.app);
	self.gameIdGen = new utilities.tempGenerator();
	self.server = io(self.httpServer, {
		path: '/server',
		wsEngine:'uws'
	});
	self.server.on('connect', function (sock) {
		sock.emit('ready');
		sock.on('connectToGame', function (data) {
			var foundGame = false;
			if (sock.game) {
				sock.emit('join-game', {error: "in-a-game", success: false});
				return;
			}

			for (var x in self.games) {
				var game = self.games[x];
				if (game.gameId == data.gameId) {
					foundGame = true;
					if(data.role == 'player'){
						game.createPlayer(data, sock);
						sock.emit('join-game', {success: true});
						sock.game = data.gameId;
					}else if(data.role == 'spectator'){
						game.createSpec(data, sock);
						sock.emit('join-game', {success: true});
						sock.game = data.gameId;
					}
					data.role || sock.emit('join-game', {error: "no-role", success: false});

				}
			}

			if (!foundGame){
				sock.emit('join-game', {error: "no-game-with-id", success: false});
			}
		});
		sock.on('registerPublicGamesInterest',function(){
			if(!_.includes(self.publicGamesListeners,sock)){
				self.publicGamesListeners.push(sock);
			}
		});
		sock.on('requestPublicGames',function(){
			sock.emit('publicGames',self.publicGamesInfo);
		});
		sock.on('requestPublicGameId',function(data){
			var pwd = data.password  || '';
			if(!data.gameName){return;}
			for(var x in self.publicGames){
				var game = self.publicGames[x];
				if(game.info.gameName == data.gameName){
					if(!game.isPassworded){
						sock.emit('publicGameId',game.info.gameId);
					}else if(game.password == pwd){
						sock.emit('publicGameId',game.info.gameId);
					}
				}
			}
		})
	});
	self.notifyAllPublicGamesListeners = function(){
		for(var x in self.publicGamesListeners){
			self.publicGamesListeners[x].emit('publicGames',self.publicGamesInfo);
		}
	};
	self.createGame = function (data) {
		var game;
		var sd = function () {
			self.removeGame(game);
		};
		var gameNames = [];
		for(var x in self.games){
			gameNames.push(self.games[x].gameName);
		}
		var realGameName = _.includes(gameNames,data.gameName) ? utilities.randomString(20) : data.gameName;
		var gameId = self.gameIdGen.genUnique(6,'1234567890');
		game = new c4game(data.width, data.height, data.connect, gameId, data.keepPlaying, realGameName, sd, data.public);
		if(game.public.public){
			self.publicGames.push({info:game.publicGameInfo,password:game.public.password,isPassworded:!!game.public.password});
			var pi = _.cloneDeep(game.publicGameInfo);
			pi.gameId = '';
			self.publicGamesInfo.push({info:pi,isPassworded:!!game.public.password});
			self.notifyAllPublicGamesListeners();
		}
		self.games.push(game);
		return game;
	};
	self.removeGame = function (game) {
		var pos = self.games.indexOf(game);
		if (pos > -1) {
			self.gameIdGen.removeGen(game.gameId);
			self.games.splice(pos, 1);
			for(var x in self.publicGames){
				if(self.publicGames[x].info == game.publicGameInfo){
					self.publicGames.splice(x,1);
					self.publicGamesInfo.splice(x,1);
					self.notifyAllPublicGamesListeners();
				}
			}
		}

	};
	self.lastCreateGameRequest = 0;
	//Express routing
	self.app.use(bodyParser.json());
	self.app.use(bodyParser.urlencoded({extended: true}));
	self.app.use(express.static('./client',{redirect:false}));
	self.app.post('/createGame/api',function(req,res){
		var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
		var timenow = Date.now();
		self.logfile && fs.appendFileSync(self.logfile,'Game Create Request from: '+ip+'\n');
		var td = timenow - self.lastCreateGameRequest;
		if(td > (1000 * 4)){
			var data = req.body;
			var type_validation = (typeof data.width == 'number') && (typeof data.height == 'number') && (typeof data.connect == 'number') && (typeof data.keepPlaying == 'boolean') && (typeof data.gameName == 'string')&& (typeof data.public.password == 'string');
			var number_validation = (data.width > 0) && (data.height > 0) && (data.connect > 0);
			var validated = type_validation && number_validation;
			if(validated){
				data.width = Math.floor(data.width) || 7;
				data.height = Math.floor(data.height) || 6;
				data.connect = Math.floor(data.connect) || 4;
				data.gameName = data.gameName.substring(0,24);
				data.public.password = data.public.password.substring(0,16);
				data.public.password = data.public.password || false;
				data.public.public = !!data.public.public;
				data.public = {public:data.public.public,password:data.public.password};
				var gm = self.createGame(data);
				res.json({success:true,gameInfo:gm.publicGameInfo});
			}else{
				res.json({success:false,error:'invalid-request'});
			}
		}else{
			res.json({success:false,error:'too-frequent'});
		}
		self.lastCreateGameRequest = Date.now();
	});
	self.httpServer.listen(self.port,self.host);
};
module.exports = c4serv;