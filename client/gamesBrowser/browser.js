var rootUrl = window.location.href.split('/gamesBrowser')[0];
var model = new (function (r) {
	var self = this;
	self.rootUrl = ko.observable(r);
	var path = self.rootUrl().split(window.location.origin)[1]+'/server';
	self.socket = io(window.location.origin, {path: path,reconnect:true});
	self.games = ko.observableArray();
	self.side = {};
	self.side.gameId = ko.observable('666666');
	self.side.joinGameById = function(){
		window.location.href = self.rootUrl() + '/playGame/?gameId=' + (self.side.gameId() || '');
	};
	self.side.specGameById = function(){
		window.location.href = (self.rootUrl()) + '/spectateGame/?gameId=' + (self.side.gameId() || '');
	};

	self.filters = {};
	self.filters.gameName = ko.observable('');
	self.filters.ignorePassword = ko.observable(false);
	self.filteredGames = ko.computed(function(){
		var games = self.games();
		var ng = [];
		for(var x in games){
			var game = games[x];
			if(game.info.gameName().toLowerCase().includes(self.filters.gameName().toLowerCase()) && !(self.filters.ignorePassword() && game.isPassworded())){
				ng.push(game);
			}
		}
		return ng;
	});
	self.joinPassword = ko.observable('');
	//Awful hack please help D:<
	self.selectedGame = ko.observable([{info:{}}]);
	self.selectGame = function(){
		var game = this;
		self.selectedGame([game]);
	};
	self.selectedGame.subscribe(function(){
		self.joinPassword('');
	});
	self.playOnSuccess = ko.observable(true);
	self.playGame = function(){
		self.socket.emit('requestPublicGameId',{password:self.joinPassword(),gameName:self.selectedGame()[0].info.gameName()});
		self.playOnSuccess(true);
	};
	self.spectateGame = function(){
		self.socket.emit('requestPublicGameId',{password:self.joinPassword(),gameName:self.selectedGame()[0].info.gameName()});
		self.playOnSuccess(false);
	};
	self.setup = function(){
		self.socket.on('publicGames',function(data){
			self.games(ko.mapping.fromJS(data)());
		});
		self.socket.emit('registerPublicGamesInterest');
		self.socket.emit('requestPublicGames');
		self.socket.on('publicGameId',function(d){
			if(self.playOnSuccess()){
				window.location.href = self.rootUrl() + '/playGame/?gameId='+d;
			}else{
				window.location.href = self.rootUrl() + '/spectateGame/?gameId='+d;
			}
		});
	};

})(rootUrl);

function beforebind() {}

$(document).ready(function () {
	beforebind();
	ko.applyBindings(model);
	model.setup();
});
