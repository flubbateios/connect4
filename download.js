var exec = require('child_process').exec;
var packs = ['escape-html','randomcolor','express','lodash','socket.io','body-parser','uws'];
var command = 'npm install ';
for(var x in packs){
	command += packs[x] + ' ';
}

exec(command);