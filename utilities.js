var _ = require('lodash');
_.includes = _.contains || _.includes;
var randomString = function (len, chars) {
	len = len || 1;
	var s = chars || "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	var ticket = "";
	for (var x = 0; x < len; x++) {
		ticket += s.charAt(Math.floor(Math.random() * s.length));
	}
	return ticket;

}

var uGenerator = function () {
	var self = this;
	self.generated = [];
	self.genUnique = function (len, chars) {
		var s = chars || "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
		var ticket = "";
		for (var x = 0; x < len; x++) {
			ticket += s.charAt(Math.floor(Math.random() * s.length));
		}
		if(self.generated.includes(ticket)){
			return self.genUnique(len,chars);
		}else {
			self.generated.push(ticket);
			return ticket;
		}
	}


};
var roundHTMLColor = function(color,prec){
	var colors = [parseInt(color.substring(1,3),16),parseInt(color.substring(3,5),16),parseInt(color.substring(5,7),16)];
	var new_color = '#';
	for(var x in colors){
		var c = colors[x];
		var new_c = (Math.floor(c/prec)*prec).toString(16);
		new_c = new_c.length == 1 ? '0'+new_c : new_c;
		new_color += new_c;
	}
	return new_color;
};
module.exports.uGenerator = uGenerator;
module.exports.randomString = randomString;
module.exports.roundHTMLColor = roundHTMLColor;