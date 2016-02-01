// SETTINGS
var    KEY = 'anpj63w4mm6wk8tasmyfww9mw';
var SECRET = 'ryaykwoamnddbjh4trjeihxvxhc365hi3me8p65qlq1og1k6le';
var   HOST = 'barduino.outsystemscloud.com';

var mqtt_host = 'mqtts://m10.cloudmqtt.com';
var mqtt_port = 20116
var mqtt_username = 'xpxjokix';
var mqtt_password = 'muWRRbZs9hoW';
// mqtt client options
var mqtt_Options = {
     port:mqtt_port
    ,keepalive: 10 //seconds, set to 0 to disable
    ,clientId: 'mqttjs_' + Math.random().toString(16).substr(2, 8)
    ,protocolId: 'MQTT'
    //,protocolVersion: 4
    ,clean: true //set to false to receive QoS 1 and 2 messages while offline
    ,reconnectPeriod: 1000 // milliseconds, interval between two reconnections
    ,connectTimeout: 30 * 1000  //milliseconds, time to wait before a CONNACK is received
    ,username:mqtt_username //the username required by your broker, if any
    ,password:mqtt_password//the password required by your broker, if any
    /*
    ,incomingStore: , // a Store for the incoming packets
    ,outgoingStore: , // a Store for the outgoing packets
    ,will: { //a message that will sent by the broker automatically when the client disconnect badly. The format is:
        topic: , // the topic to publish
        payload:, // the message to publish
        qos: , //the QoS
        retain: // the retain flag 
    }
    */
}


// LIBS
var com = require("serialport");
var http = require('http');
var https = require('https');
var crypto = require('crypto');
var sleep = require('sleep');
var mqtt = require('mqtt');


var SHORT_WAIT = 500000; //microseconds (1 second is 1000000 microseconds)
var sha256 = crypto.createHash('sha256').update(KEY+':'+SECRET).digest("hex");
console.log('Authorization:'+sha256);

var serialPort = new com.SerialPort('/dev/ttyACM0', {
    baudrate: 115200,
	parser: com.parsers.readline('\n')
  });
 

var mqtt_client  = mqtt.connect(mqtt_host,mqtt_Options);

mqtt_client.subscribe('/haall/'+KEY+'/in/#');

mqtt_client.on('message', function (topic, message) {
  // message is Buffer 
	var m = topic.toString();
	m = m.replace('/haall/'+KEY+'/in/','');
	m = m.split('/').join(';');
	m=m+';'+message.toString();
	serialPort.write(''+m+'\n');

  	console.log('MQTT INCOMING: '+topic+':'+message.toString());
	console.log('To MySensors: '+m);
});
mqtt_client.publish('/haall/'+KEY+'/out', 'HAALL mqtt client started at '+ new Date());

server = http.createServer( function(req, res) {

    //console.log(req.param);

    if (req.method == 'POST') {
        //console.log('POST');
		//console.log('ControllerKey: '+req.headers['controllerkey']);
		//console.log('Authorization: '+req.headers['authorization']);
		if (authenticate(req.headers['controllerkey'],req.headers['authorization'])){
			var body = '';
			req.on('data', function (data) {
				body += data;
				//console.log('Partial body: ' + body);
			});
			req.on('end', function () {
				var i = 0;
				while (i < body.length)
				{
					var j;
					j = body.indexOf('\n',i);
					if (j == -1) j = body.length;
					console.log('INCOMING yy: '+body.substr(i, j-i));
					serialPort.write(''+body.substr(i, j-i)+'\n');
					i = j+1;
					sleep.usleep(SHORT_WAIT);
				}
			});
			res.writeHead(200, {'Content-Type': 'text/html'});
			res.end();
		} else{
			var html = '<html><body>401:Invalid Authorization</body></html>';
			res.writeHead(401, {'Content-Type': 'text/html'});
			res.end(html);
		}
    }
    else
    {
        //console.log("GET");
        var html = '<html><body>403:Forbiden</body></html>';
        res.writeHead(403, {'Content-Type': 'text/html'});
        res.end(html);
    }

});

function authenticate(controllerKey,authorization){
	var testAuth = crypto.createHash('sha256').update(controllerKey+':'+SECRET).digest("hex");
	return testAuth == authorization;
}

port = 7070;
host = '0.0.0.0';
server.listen(port, host);
console.log('Listening at http://' + host + ':' + port);
 


var postheaders = {
    'Content-Type' : 'text/xml',
    'ControllerKey' : KEY,
	'Authorization' : sha256
};
  
var optionspost = {
    host : HOST,
    port : 443,
    path : '/api/rest/barduino/receive',
    method : 'POST',
    headers : postheaders
};

console.log('Opening Serial port');

serialPort.open(function (error) {
  if ( error ) {
    console.log('failed to open: '+error);
  } else {
    console.log('open');
  }
});

//console.log('Serial port opened');

serialPort.on('data', function(data) {
	
	if (data.indexOf('0;0;3;0;9;') == 0) {
		console.log('	'+data);
		//Comment next line to Ignore I_MESSAGE_LOG
		execREST(data);
		mqttPublish(data);
	}
	else{
		console.log(data);
		mqttPublish(data);
		execREST(data);
	}

});

function execREST(post_content){
	var reqPost = https.request(optionspost, function(res) {
		var resp='';
    	res.on('data', function (chunk) {
			resp += chunk;
			// console.log('INCOMING: '+chunk);
			// serialPort.write(''+chunk.substr+'\n');
		});
		res.on('end', function(){
			var i = 0;
			while (i < resp.length)
			{
				var j;
				j = resp.indexOf('\n',i);
				if (j == -1) j = resp.length;
				console.log('INCOMING xx: '+resp.substr(i, j-i));
				serialPort.write(''+resp.substr(i, j-i)+'\n');
				i = j+1;
				sleep.usleep(SHORT_WAIT);
			}
		})
});

	// write the json data
	reqPost.write(post_content);
	reqPost.end();
	reqPost.on('error', function(e) {
    		console.error(e);
	});
}

function mqttPublish(data){
	var topic = '/haall/'+KEY+'/out/';
	var params = data.split(';');
	topic = topic + params[0] + '/';
	topic = topic + params[1] + '/';
	topic = topic + params[2] + '/';
	topic = topic + params[3] + '/';
	topic = topic + params[4] + '';
	var payload = params[5];
	mqtt_client.publish(topic,payload);
	//console.log('MQTT publish: '+topic + ' Payload: '+ payload);
}

