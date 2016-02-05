// LIBS
var com = require("serialport");
var mqtt = require('mqtt');

// SERIAL PORT SETTINGS
var serial_port = '/dev/ttyACM0';
// var serial_port = 'COM3'; // windows

// MQTT SETTINGS
var mqtt_host     = 'mqtts://m10.cloudmqtt.com';
var mqtt_port     =  8883;
var mqtt_username =  'user name';
var mqtt_password =  'password';

var KEY = 'yourkey';

// publications will be made into /haall/yourkey/out/x/x/x/x
// subcriptions will come from /haall/yourkey/in/x/x/x/
// adjust as necessary

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
            qos:    1,                                              // the QoS
            retain: false                                           // the retain flag 
    }    
}

// SERIAL PORT
var serialPort = new com.SerialPort(serial_port, {
    baudrate: 115200,
	parser: com.parsers.readline('\n')
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
	}
	else{
		console.log(data);
		mqttPublish(data);
	}
});

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
