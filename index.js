const http = require("http");
const lang = require("./langs.js");
const express = require("express");
const WebSocket = require('ws');

const app = express();
const jsonParser = express.json();
app.set("view engine", "ejs");
const server = http.createServer(app)

function uuidv4() {
 return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
   var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
   return v.toString(16);
 });
}

let serve_static = express.static(__dirname + "/view/static");
app.use("/static", function(req, res, next){
  if(req.url == "/sw.js"){
    res.setHeader("Service-Worker-Allowed", "/");
  }
  serve_static(req, res, next);
});


app.get("/load_local", function(request, response){
  if(lang[request.query.lang]){
    response.json({"type": "success"});
  }
  else{
    response.json({"type": "error"});
  }
});
app.get("/robots.txt", function(request, response){
  if(request.method != "GET"){
    return;
  }
  response.sendFile(__dirname + "/view/robots.txt");
});

app.get("/sitemap.xml", function(request, response){
  if(request.method != "GET"){
    return;
  }
  response.sendFile(__dirname + "/view/sitemap.xml");
});
app.get("/404/", function(request, response){
  response.sendFile(__dirname + "/view/404.html");
});

app.get("/:lang", function(request, response){
  let lang_mode = request.params["lang"];

  if(lang[lang_mode]){
    response.render(__dirname + "/view/index.ejs", {
      "langObj": lang[lang_mode],
      "type": lang_mode
    })
  }
  else{
    response.redirect("/en/");
  }

});

app.get("/", function(request, response){
  let lang_cookie;
  if(request.headers.cookie){
    lang_cookie = request.headers.cookie.split("; ").find((item) => {return item.startsWith("lang=")});
  }
  if(lang_cookie == undefined){
    lang_cookie = "en";
  }
  else{
    lang_cookie = lang_cookie.split("=")[1];
  }

  let redirect_link = "";
  if(lang[lang_cookie]){
    redirect_link = "/{}/".replace("{}", lang_cookie)
    if(request.query.id != undefined){
      redirect_link = redirect_link + "?id=" + request.query.id;
    }
    response.redirect(redirect_link);
  }
  else{
    response.render(__dirname + "/view/index.ejs", {
      "langObj": lang["en"],
      "type": "en"
    });
  }
});

app.all('*', function(request, response){
  response.redirect("/404/");
})

const wsServer = new WebSocket.Server({ server });
const ws_users_store = {};

function count_dct(dct){
  let c = 0;
  for(let key in dct){
    c += 1;
  }
  return c;
}

function onConnect(wsClient){
  const uid = uuidv4();
  ws_users_store[uid] = wsClient;

  wsClient.send(JSON.stringify({
    "type": "client-id",
    "id": uid
  }));


  wsClient.on("message", function(message){
    let data;
    try{
      data = JSON.parse(message.toString());
    }catch{
      return;
    }
    const conn = ws_users_store[data["receiver-id"]];

    if(conn){
      conn.send(JSON.stringify(data));
    }
    else{
      ws_users_store[data["sender-id"]].send(JSON.stringify({
        "type": "connection-error",
        "description": "Not found id for this conn"
      }));
    }
  });
  wsClient.on("close", function(){
    delete ws_users_store[uid];
  });
}
wsServer.on("connection", onConnect);

let port = 3000;
server.listen(port);
