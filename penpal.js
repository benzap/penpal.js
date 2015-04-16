/*
  Penpal is a library for performing a request on a javascript server,
  which uses the Request-Response style of messaging.

  Dependencies:

  - flyer.js
  - jquery
*/

var Penpal = Penpal || {};
(function(context) {

    /*
      Generates a random strings of characters between 0-9a-fA-F
      which can be used as an ID
     */
    var generateRandomId = function() {
	var text = "";
	var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	
	for(var i = 0; i < 16; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	
	return text;
    }
    
    var PenpalServer = function(serverName, requestHandlers) {
	this.serverName = serverName;
	this.serverInstances = {};
	this.requestHandlers = requestHandlers || {};

	//subscribe each of our request handlers
	for (var handlerKey in this.requestHandlers) {
	    if (this.requestHandlers.hasOwnProperty(handlerKey)) {
		var handler = this.requestHandlers[handlerKey];

		if (typeof handler == "function") {
		    var requestName = handlerKey;
		    flyer.subscribe({
			channel: "Penpal.Request." + serverName,
			topic: requestName,
			callback: function(data) {
			    if (!this.serverInstances.hasOwnProperty(data.instanceName)) {
				return;
			    }
			    this.settings = this.serverInstances[data.instanceName] || {};
			    var responseData = handler.apply(this, data.args);
			    
			    console.log(this.serverInstances);
			    console.log("Got this far", data);
			    //grab the current serverInstance, and apply the settings as the server settings
			    
			    flyer.broadcast({
				channel: "Penpal.Response." + serverName,
				topic: requestName,
				data: {
				    clientRequest: data,
				    responseData: responseData
				}
			    });
			    
			}.bind(this)
		    });
		}
		
	    }
	}
    }
    
    PenpalServer.prototype.start = function(instanceName, serverSettings) {
	this.serverInstances[instanceName] = {settings: serverSettings || {}};
    }

    PenpalServer.prototype.newClient = function(instanceName, clientName) {
	var clientName = clientName || generateRandomId();
	var client = new PenpalClient(this, instanceName, clientName);


	
	return client;
    }
    
    var PenpalClient = function(server, instanceName, clientName) {
	this.server = server;
	this.instanceName = instanceName;
	this.clientName = clientName;
	this.requestListing = {};
	
	//grab all of the request names
	var requestNames = [];
	for (var k in server.requestHandlers) {
	    if (server.requestHandlers.hasOwnProperty(k) && (typeof server.requestHandlers[k]) == "function") {
		requestNames.push(k);
	    }
	}

	//assign functions to our client to provide an interface to our server
	requestNames.forEach(function(fname) {

	    //Subscribing to the Response that the server will produce
	    flyer.subscribe({
		channel: "Penpal.Response." + server.serverName,
		topic: fname,
		callback: this.responseCallback.bind(this),
	    });

	    //Assigning the function
	    this[fname] = function() {
		//turn arguments object into an array
		var args = [];
		for (var i = 0; i < arguments.length; i++) {
		    args.push(arguments[i]);
		}

		//Need a way to identify our response, so we can supply a value to our promise
		//The request is placed in the requestListing shortly after
		var requestId = generateRandomId();
		var d = $.Deferred();
		this.requestListing[requestId] = {
		    deferred: d
		};
		
		//Performing the request
		flyer.broadcast({
		    channel: "Penpal.Request." + server.serverName,
		    topic: fname,
		    data: {
			instanceName: instanceName,
			clientName: clientName,
			requestId: requestId,
			args: args,
		    }
		});
		return d.promise();
	    }.bind(this);
	}.bind(this))
    }

    PenpalClient.prototype.responseCallback = function(data) {
	var requestId = data && data.clientRequest && data.clientRequest.requestId;
	if (requestId && this.requestListing.hasOwnProperty(requestId)) {
	    var responseData = data && data.responseData;
	    this.requestListing[requestId].deferred.resolve(responseData);
	    delete this.requestListing[requestId];
	}
    }
    
    context.newServer = function(serverName, requestHandlers) {
	return new PenpalServer(serverName, requestHandlers);
    }
    
    return context;
}(Penpal))

