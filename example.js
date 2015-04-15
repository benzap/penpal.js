/*
  Example 1
 */

var Foo = Penpal.newServer("Foo", {
    greeting: function(name) {
	return "Hello " +  name;
    }
});

Foo.start("bar");

var client = Foo.newClient("bar");

var response = client.greeting("ben");

//Promise response
response.then(function(resp) {
    console.log(resp) //Hello ben
});

/* Example 2 */

var PrefixedEchoServer = Penpal.newServer("EchoServer", {
    echo: function(request) {
	var prefix = this.settings.prefix || "Hello ";

	return prefix + request;
    }
});


PrefixedEchoServer.start("mean-server", {prefix: "Shut up "});
PrefixedEchoServer.start("nice-server", {prefix: "Hola "});


var client1 = PrefixedEchoServer.newClient("mean-server");
client1.echo("haha").then(function(resp) {
    console.log(resp); //Shut up haha
});

PrefixedEchoServer.newClient("nice-server").echo("amigo!").then(function(resp) {
    console.log(resp); //Hola amigo!
});

/* Example 3 */

var UnresponsiveServer = Penpal.newServer("DeadServer", {
    hi: function() {
	return Penpal.SERVER_TIMEOUT;
    }
});

UnresponsiveServer.start("main");

var client = UnresponsiveServer.newClient("main");

client.hi();

client.then(function() {
    //this is never called
});

client.fail(function(err) {
    console.error(err); //error object with SERVER_TIMEOUT
});
