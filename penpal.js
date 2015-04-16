/*
  Penpal is a library for performing a request on a javascript server,
  which uses the Request-Response style of messaging.

  These messages can span frames, iframes, and external windows.

  Dependencies:

  - flyer.js
  - jquery
*/

var Penpal = Penpal || {};
(function(context) {

    //Provided Response Code
    context.ResponseCode = {
	//returned as a response to trigger a promise rejection on the client side
	INVALID: "invalid",
	//returned on the clientside when a request times out
	TIMEOUT: "timeout"
    };
    
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

    /* The Penpal Server Class.

       This is the heart of server responses. This conveniently wraps
       around the flyer.js library to provide an easier interface for
       performing request/response messages.

       Keyword Arguments:

       serverName -- A unique name used to identify the server. If no
       name is provided, a name will be generated for the server. This
       is not recommended.

       requestHandlers -- an object containing functions resembling
       requests. Any number of parameters for each request is allowed.

       Optional Arguments:

       /none so far/

       Remarks:

       - If no serverName is provided, the generated serverName will
         limit the scope of the server to the current frame, and will
         be inaccessible from other frames, iframes, or external
         windows.

       - Usual restrictions apply to external windows, where removing
         the parent.opener will prevent two sibling external windows
         from communicating with eachother.

     */
    var PenpalServer = function(serverName, requestHandlers, options) {
	this.serverName = serverName || generateRandomId();
	this.serverInstances = {};
	this.requestHandlers = requestHandlers || {};

	//subscribe each of our request handlers
	for (var handlerKey in this.requestHandlers) {
	    if (this.requestHandlers.hasOwnProperty(handlerKey)) {
		var handler = this.requestHandlers[handlerKey];

		if (typeof handler == "function") {
		    var requestName = handlerKey;
		    flyer.subscribe({
			channel: "Penpal.Request." + this.serverName,
			topic: requestName,
			callback: function(data) {
			    if (!this.serverInstances.hasOwnProperty(data.instanceName)) {
				return;
			    }
			    
			    //apply the settings
			    var serverInstance = this.serverInstances[data.instanceName] || {};
			    var responseData = handler.apply(serverInstance, data.args);
			    			    
			    flyer.broadcast({
				channel: "Penpal.Response." + this.serverName,
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

    /* Add a request handler to the server
       
       Keyword Arguments:

       name -- The name of the request handler

       f -- the function to handle the request

       Remarks:

       - The only way other frames, iframes, and external windows can
         be aware of new request handlers is if they have access to
         the same set of javascript files. To ensure this works
         correctly, it should be shared amongs frames you are
         instantiating.
     */
    PenpalServer.prototype.addRequestHandler = function(name, f) {
	this.requestHandlers[name] = f;
    }

    /* Start a Server Instantiation
       
       A server is 'Instantiated' by starting it. This also allows us
       to provide a serverObject as a requestHandler context, which
       can be any object containing settings, functions,
       configurations, etc. This gives you the freedom to provide your
       server as an interface, and implement server functionality into
       any area of your code.

       the serverObject appears as the 'context' for the server instances set of requestHandlers

       Keyword Arguments:
       
       instanceName -- The unique name assigned to this server instance

       serverObject -- An object containing information for the
       requestHandlers. The serverObject appears as the context for
       any requestHandlers called.

       Remarks:

       -- Having more than one server with the same instance name can lead to
          unexpected behaviour.

     */
    PenpalServer.prototype.start = function(instanceName, serverObject) {
	var serverObject = serverObject || {};
	this.serverInstances[instanceName] = serverObject;
    }

    /* Stop a Server Instantiation 
       
       This stops a server instantiation by a given name

       Keyword Arguments:

       instanceName -- Name of the server instance you are stopping

     */
    PenpalServer.prototype.stop = function(instanceName) {
	delete this.serverInstances[instanceName];
    }

    /* Create a new server Client for a server with the given instanceName
       
       Keyword Arguments:

       instanceName -- An instance name for a given serverInstance

       Optional Arguments:

       clientName -- A name to give to the client. If none is
       provided, a unique id is generated for the client.

       timeout -- Amount of time in milliseconds after a request is
       made before the response promise is rejected [default: 5000]

     */
    PenpalServer.prototype.newClient = function(instanceName, options) {
	var options = options || {};
	var client = new PenpalClient(this, instanceName, options);
	return client;
    }
    
    var PenpalClient = function(server, instanceName, options) {
	this.server = server;
	this.instanceName = instanceName;
	this.clientName = options.clientName || generateRandomId();
	this.timeout = options.timeout || 5000;
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
		var timeoutId = setTimeout(this.generateResponseTimeout(requestId).bind(this), this.timeout);
		this.requestListing[requestId] = {
		    deferred: d,
		    timeoutId: timeoutId,
		};
		
		//Performing the request
		flyer.broadcast({
		    channel: "Penpal.Request." + server.serverName,
		    topic: fname,
		    data: {
			instanceName: this.instanceName,
			clientName: this.clientName,
			requestId: requestId,
			args: args,
		    }
		});
		return d.promise();
	    }.bind(this);
	}.bind(this))
    }

    /* Returns a function that rejects the deferred object with a
     * timeout response
     */
    PenpalClient.prototype.generateResponseTimeout = function(requestId) {
	return function() {
	    if (requestId && this.requestListing.hasOwnProperty(requestId)) {
		var deferredObject = this.requestListing[requestId].deferred;
		deferredObject.reject(context.ResponseCode.TIMEOUT);
		delete this.requestListing[requestId];
	    }
	}
    }
    
    /* The client response callback function on a flyer.js subscription

     */
    PenpalClient.prototype.responseCallback = function(data) {

	//Make sure we have the requestId
	var requestId = data && data.clientRequest && data.clientRequest.requestId;
	if (requestId && this.requestListing.hasOwnProperty(requestId)) {

	    //return the responseData
	    var responseData = data && data.responseData;

	    var deferredObject = this.requestListing[requestId].deferred;
	    //clear the request timeout
	    clearTimeout(this.requestListing[requestId].timeoutId);
	    
	    if (responseData == context.ResponseCode.INVALID) {
		deferredObject.reject(responseData);
	    }
	    else {
		deferredObject.resolve(responseData);
	    }
	    delete this.requestListing[requestId];
	}
    }

    /* For creating new Penpal Servers with a given set of requestHandlers

       Keyword Arguments:

       serverName -- A unique name used to identify the server. If no
       name is provided, a name will be generated for the server. This
       is not recommended.

       requestHandlers -- an object containing functions resembling
       requests. Any number of parameters for each request is allowed.

       Optional Arguments:

       /none so far/

       Remarks:

       - If no serverName is provided, the generated serverName will
         limit the scope of the server to the current frame, and will
         be inaccessible from other frames, iframes, or external
         windows.

       - Usual restrictions apply to external windows, where removing
         the parent.opener will prevent two sibling external windows
         from communicating with eachother.

     */
    context.newServer = function(serverName, requestHandlers, options) {
	return new PenpalServer(serverName, requestHandlers);
    }
    
    return context;
}(Penpal))

