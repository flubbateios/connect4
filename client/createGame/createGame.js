var randomString = function (len, chars) {
	len = len || 1;
	var s = chars || "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	var ticket = "";
	for (var x = 0; x < len; x++) {
		ticket += s.charAt(Math.floor(Math.random() * s.length));
	}
	return ticket;
};
var model = new function () {
	var self = this;
	self.rootUrl = window.location.href.split('/createGame')[0];
	self.gameName = ko.observable('My Awesome game!');
	self.gameName.subscribe(function (nv) {
		if (nv.length > 24) {
			self.gameName(nv.substring(0, 24));
		}
	});

	self.gameWidth = ko.observable(7);
	self.gameWidth.subscribe(function (v) {
		if ((typeof v == 'number') && (Math.floor(v) == v) && v <= 100) {
			return;
		}
		if (typeof v == 'string' && v != '') {
			try {
				var k = parseInt(v);
				k = Math.min(100, k);
				self.gameWidth(k);
			} catch (e) {
				self.gameWidth(7);
			}
		} else if (typeof v == 'number') {
			var k = Math.min(100, Math.floor(v));
			self.gameWidth(k);
		} else if (v != '') {
			self.gameWidth(7);
		}

	});

	self.gameHeight = ko.observable(6);
	self.gameHeight.subscribe(function (v) {
		if ((typeof v == 'number') && (Math.floor(v) == v) && v <= 100) {
			return;
		}
		if (typeof v == 'string' && v != '') {
			try {
				var k = parseInt(v);
				k = Math.min(100, k);
				self.gameHeight(k);
			} catch (e) {
				self.gameHeight(6);
			}
		} else if (typeof v == 'number') {
			self.gameHeight(Math.min(100, Math.floor(v)));
		} else if (v != '') {
			self.gameHeight(6);
		}

	});

	self.gameConnect = ko.observable(4);
	self.gameConnect.subscribe(function (v) {
		var max_connect = Math.min(self.gameHeight(),self.gameWidth());
		if ((typeof v == 'number') && (Math.floor(v) == v) && v <= max_connect) {
			return;
		}
		if (typeof v == 'string' && v != '') {
			try {
				var k = parseInt(v);
				k = Math.min(max_connect, k);
				self.gameConnect(k);
			} catch (e) {
				self.gameConnect(4);
			}
		} else if (typeof v == 'number') {
			self.gameConnect(Math.min(max_connect, Math.floor(v)));
		} else if (v != '') {
			self.gameConnect(4);
		}
	});

	self.gameKeepPlaying = ko.observable(false);
	self.public = {
		public:ko.observable(false),
		password:ko.observable('')
	};
	self.public.public.subscribe(function(n){
		if(!n){
			self.public.password('');
		}
	});
	self.public.password.subscribe(function(n){
		if(n.length > 16){
			self.public.password(n.substring(0,16));
		}
	});
	self.gameCreateStatus = ko.observable('');
	self.joinGameById = function(){
		window.location.href = self.rootUrl + '/playGame/?gameId='+self.gameLink();
	};
	self.gameLink = ko.observable();
	self.submitInfo = function () {
		$('input').prop('disabled', true);
		$('#createGameButton').css('display','none');
		var sendToServer = {};
		sendToServer.gameName = self.gameName() || randomString(48);
		sendToServer.width = self.gameWidth() || 7;
		sendToServer.height = self.gameHeight() || 6;
		sendToServer.connect = self.gameConnect() || 4;
		sendToServer.keepPlaying = self.gameKeepPlaying();
		sendToServer.public = {public:self.public.public(),password:self.public.password()};
		$.ajax({
			url: self.rootUrl+'/createGame/api',
			error: function () {
				self.gameCreateStatus('Failed to make POST request to API');
			},
			success: function (d) {
				if (d.success) {
					self.gameCreateStatus('<b>Game created successfully <br> Game ID</b> '+d.gameInfo.gameId + '<br> <b>Game Name</b> <br>'+ d.gameInfo.gameName);
				} else {
					if(d.error == 'too-frequent'){
						self.gameCreateStatus('Please try again in a few seconds - too many games are being created at the moment.');
					}else if(d.error == 'invalid-request'){
						self.gameCreateStatus('Your request is invalid. I honestly have no clue how this is even possible given the fail-safes I have implemented.')
					}
				}
				self.gameLink(d.gameInfo.gameId);

			},
			contentType: 'application/json; charset=UTF-8',
			data: JSON.stringify(sendToServer),
			dataType: 'json',
			method:'POST'
		});
	}

};
$(document).ready(function () {
	ko.applyBindings(model);
});