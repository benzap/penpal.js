/*
  Penpal is a library for performing a request on a javascript server,
  which uses the Request-Response style of messaging.

  Dependencies:

  - flyer.js
  - jquery
*/

var Penpal = Penpal || {};
(function(context) {
    var PenpalServer = function(serverName, requestHandlers) {
	this.serverInstances = [{instanceName: "default", instanceSettings: {}}];
	this.requestHandlers = requestHandlers || {};

	//subscribe each of our request handlers
	for (var handlerKey in this.requestHandlers) {
	    if (this.requestHandlers.hasOwnProperty(handlerKey)) {
		var handler = this.requestHandlers[handlerKey];

		if (typeof handler == "function") {
		    var requestName = handlerKey;
		    flyer.subscribe({
			channel: "Penpal." + serverName,
			topic: requestName,
			callback: function(data) {
			    console.log("Got this far");
			}
		    });
		}
		
	    }
	}
    }
    
    PenpalServer.prototype.start = function(instanceName, serverSettings) {
	
    }

    PenpalServer.prototype.newClient = function(instanceName, clientName) {
	
    }
    
    var PenpalClient = function(serverInstance, clientName) {
	this.serverInstance = serverInstance
	this.clientName = clientName || "test";
    }
    
    context.newServer = function(serverName, requestHandlers) {
	return new PenpalServer(serverName, requestHandlers);
    }

    return context;
}(Penpal))

