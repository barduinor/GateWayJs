// LIBS
var com = require("serialport");
var http = require('http');
var https = require('https');
var crypto = require('crypto');
var sleep = require('sleep');
var mqtt = require('mqtt');

// CONTROLLER SETTINGS
var    KEY = 'anpj63w4mm6wk8tasmyfww9mw';
var SECRET = 'ryaykwoamnddbjh4trjeihxvxhc365hi3me8p65qlq1og1k6le';
var   HOST = 'barduino.outsystemscloud.com';

// SERIAL PORT SETTINGS
var serial_port = '/dev/ttyACM0';

// REST SERVER SETTINGS
var rest_port = 7070;
var rest_host = '0.0.0.0';

// MQTT SETTINGS
var mqtt_host     = 'mqtts://m10.cloudmqtt.com';
var mqtt_port     =  29839
var mqtt_username = 'kknntiab';
var mqtt_password = 'O6zi0W_1o0sf';

// OTHER SETTINGS
var SHORT_WAIT = 500000; //microseconds (1 second is 1000000 microseconds)

// INIT AUTHENTICATION
var sha256 = crypto.createHash('sha256').update(KEY+':'+SECRET).digest("hex");
console.log('Authorization:'+sha256);

// REST OPTIONS
var rest_postheaders = {
    'Content-Type'  : 'text/xml',
    'ControllerKey' : KEY,
	'Authorization' : sha256
};
var rest_postoptions = {
    host : HOST,
    port : 443,
    path : '/api/rest/barduino/receive',
    method : 'POST',
    headers : rest_postheaders
};

// MQTT CLIENT OPTIONS
var mqtt_Options = {
     port:              mqtt_port
    ,keepalive:         10                  //seconds, set to 0 to disable
    ,clientId:          'haall_' + KEY
    ,protocolId:        'MQTT'
    //,protocolVersion: 4
    ,clean:             false               //set to false to receive QoS 1 and 2 messages while offline
    ,reconnectPeriod:   1000                // milliseconds, interval between two reconnections
    ,connectTimeout:    30 * 1000           //milliseconds, time to wait before a CONNACK is received
    ,username:          mqtt_username       //the username required by your broker, if any
    ,password:          mqtt_password       //the password required by your broker, if any
    /*
    ,incomingStore: , // a Store for the incoming packets
    ,outgoingStore: , // a Store for the outgoing packets
    */
    //a message that will sent by the broker automatically when the client disconnect badly. The format is:
    ,will: {topic:  '/haall/'+KEY+'/out',                           // the topic to publish
            payload:'Client haall_' + KEY +'has lost connection',   // the message to publish
            qos:    1,                                              //the QoS
            retain: false                                           // the retain flag 
    }    
}

// SERIAL PORT
var serialPort = new com.SerialPort(serial_port, {
    baudrate: 115200,
	parser: com.parsers.readline('\n')
  });
 
// REST INCOMING
var rest_server = http.createServer( function(req, res) {

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
					console.log('INCOMING REST: '+body.substr(i, j-i));
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

// START SERIAL PORT 
console.log('Opening Serial port...');
serialPort.open(function (error) {
  if ( error ) {
    console.log('failed to open: '+error);
  } else {
    console.log('Serial port opened!');
  }
});

// START REST
console.log('Starting REST...');
rest_server.listen(rest_port, rest_host);
console.log('Listening at http://' + rest_host + ':' + rest_port);
 
// START MQTT
console.log('Starting MQTT...'); 
var mqtt_client  = mqtt.connect(mqtt_host,mqtt_Options);
console.log('Subscribing MQTT...'); 
mqtt_client.subscribe('/haall/'+KEY+'/in/#');
console.log('Publish MQTT...'); 
mqtt_client.publish('/haall/'+KEY+'/out', 'HAALL mqtt client started at '+ new Date());

// SERIAL PORT OUTGOING
serialPort.on('data', function(data) {
	
	if (data.indexOf('0;0;3;0;9;') == 0) {
		console.log('        I_LOG: '+data);
        mqttPublish(data);
		execREST(data);		
	}
	else{
		console.log(data);
		mqttPublish(data);
		execREST(data);
	}
});

// REST OUTGOING
function execREST(post_content){
	var reqPost = https.request(rest_postoptions, function(res) {
		var resp='';
    	res.on('data', function (chunk) {
			resp += chunk;
		});
		res.on('end', function(){
			var i = 0;
			while (i < resp.length)
			{
				var j;
				j = resp.indexOf('\n',i);
				if (j == -1) j = resp.length;
				console.log('OUTGOING REST: '+resp.substr(i, j-i));
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

// MQTT INCOMING
mqtt_client.on('message', function (topic, message) {
	var m = topic.toString();
	m = m.replace('/haall/'+KEY+'/in/','');
	m = m.split('/').join(';');
	m = m + ';' + message.toString();
	serialPort.write('' + m + '\n');

  	console.log('INCOMING MQTT: ' + topic + ':' + message.toString());
});

// MQTT OUTGOING
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
	console.log('OUTGOING MQTT: ' + topic + ' Payload: ' + payload);
}

// AUTHENICATION
function authenticate(controllerKey,authorization){
	var testAuth = crypto.createHash('sha256').update(controllerKey+':'+SECRET).digest("hex");
	return testAuth == authorization;
}