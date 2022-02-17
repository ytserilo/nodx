import { RTC } from "/src/static/rtc_lib.js";
import { FileUploader, PauseManager } from "/src/static/file_uploader.js";
import { UserComponent, add_node, remove_node } from "/src/static/components/UserComponent.js";
import { FileUpload } from "/src/static/components/FileUploadComponent.js";
import { images, node_store } from "/src/static/media.js";

customElements.define("file-upload-elem", FileUpload);
document.querySelector(".files-upload").append(document.createElement("file-upload-elem"));
customElements.define("user-elem", UserComponent);

const event_target = new EventTarget();
let self_id = undefined;
let other_id = undefined;
let rtc_connections = {};
let files = {};
let self_files = {};

function uuidv4() {
  const result = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });

  return result;
}

function controll_download(operation_id, rtc, tp){
  rtc.channel.send(JSON.stringify({
    "type": "message",
    "body": {
      "type": tp,
      "id": operation_id
    }
  }));
}

function download(file_name, rtc, id, hook){
  document.addEventListener(`download-complete-${id}`, function(){
    hook();

  });
  let file_obj = files[rtc.connection_id][file_name];

  if(!file_obj){
    return;
  }

  document.worker_bridge.postMessage({
    "type": "file-request",
    "file-name": file_name,
    "file-type": file_obj.type,
    "size": file_obj.size,
    "operation-id": id,
    "rtc-id": rtc.connection_id,
  });

  let a = document.createElement("a");
  a.href = window.location.origin + "/file_id?id={}".replace("{}", id);
  a.target = "_blank";

  a.click();
}

function normalize_name(name){
  let split_name = name.split(".");

  const extension = split_name[split_name.length - 1];
  split_name.pop();
  let file_name = split_name.join(".");
  let fnln = file_name.length;

  let short_name = name.length > 15
    ? file_name.substring(0, 4) + "..." + file_name.substring(fnln - 3, ) + "." + extension
    : name;

  return short_name;
}

let file_uploader = new FileUploader();
let download_status_store = {};

navigator.serviceWorker.register("/static/sw.js", {"scope": "/"}).then(function(registration){
  navigator.serviceWorker.addEventListener("message", function complete_handler(e){
    let data = e.data;
    if(data["type"] == "connection-complete"){
      download_status_store[data["operation-id"]] = {
        "size": files[data["rtc-id"]][data["file-name"]].size,
        "downloaded": 0,
      };

      rtc_connections[data["rtc-id"]].channel.send(JSON.stringify({
        "type": "message",
        "body": {
          "type": "request-to-download",
          "file-name": data["file-name"],
          "operation-id": data["operation-id"],
          "start-index": 0,
        }
      }));
    }
    else if(data["type"] == "resume"){
      controll_download(data["operation-id"], rtc_connections[data["rtc-id"]], "resume");
    }
    else if(data["type"] == "download-complete"){
      delete download_status_store[data["operation-id"]];
      document.dispatchEvent(new Event(`download-complete-${data["operation-id"]}`));
      // navigator.serviceWorker.removeEventListener("message", complete_handler);
    }
  });

  document.worker_bridge = registration.active;

  function uint8_to_array(u8a){
    let CHUNK_SZ = 0x8000;
    let c = [];
    for(let i = 0; i < u8a.length; i += CHUNK_SZ){
      c.push(String.fromCharCode.apply(null, u8a.subarray(i, i + CHUNK_SZ)));
    }
    return btoa(c.join(""));
  }

  const path_arr = window.location.href.replace(
    window.location.origin + window.location.pathname, "").split("?");

  if(path_arr){
    try{
      other_id = path_arr[1].split("=")[1];
    }catch{}
  }

  let protocol = "ws";
  if(window.location.protocol == "https:"){
    protocol = "wss";
  }
  const ws = new WebSocket(protocol + ":" + window.location.hostname + ":" +window.location.port+ "/");
  ws.onclose = function(e){console.log(e);}
  ws.onerror = function(e){console.log(e);}
  function p2p_message_hander(rtc, message){
    if(message["type"] == "request-to-download"){
      if(self_files[message["file-name"]]){
        file_uploader.upload_file(
          rtc.connection_id,
          rtc.channel,
          self_files[message["file-name"]]["file-obj"],
          message["file-name"],
          message["start-index"],
          new PauseManager(event_target, message["operation-id"])
        );
      }
    }
    else if(message["type"] == "user-info"){
      add_node(rtc.connection_id, message["color"], message["image"]); // add color and img name
    }
    else if(["pause", "main-pause", "resume", "main-resume", "cancel"].indexOf(message["type"]) != -1){

      event_target.dispatchEvent(new CustomEvent(message["id"], {
        detail: {
          type: message["type"]
        }
      }));
    }
    else if(message["type"] == "files-data"){
      rtc.user_obj.addFiles(message["files"]);

      files[rtc.connection_id] = message["files"];
    }
    else if(message["type"] == "chunk-message"){
      if(message["mode"] != "done"){
        download_status_store[message.id].downloaded += message.chunk.length;
      }
      const percent = Math.round((download_status_store[message.id].downloaded / download_status_store[message.id].size) * 100);

      let download_objs = Array.from(document.querySelectorAll("download-elem"));
      let found_obj = download_objs.find((item) => {
        if(item.getAttribute("operation_id") == message.id){
          item.setAttribute("downloaded", percent);
          return true;
        }else{ return false }
      });

      if(message.mode == "done"){
        if(percent == 100){
          found_obj.success();
        }
        else{
          found_obj.error();
        }
      }

      document.worker_bridge.postMessage({
        "type": "file-data",
        "chunk": message.chunk,
        "operation-id": message.id,
        "done": message.mode == "done"
      });
    }
    else if(message["type"] == "get-info-about-files"){
      let files_count = 0;
      for(let _ in self_files){files_count += 1}

      if(files_count == 0){
        return;
      }

      for(let conn_id in rtc_connections){
        rtc_connections[conn_id].channel.send(JSON.stringify({
          "type": "message",
          "body": {
            "type": "files-data",
            "files": self_files
          }
        }));
      }
    }

    else if(message["type"] == "map"){
      if(message["map"][message["map"].length - 1] != self_id){
        let index = -1;
        message["map"].find((item, i) => {
          index = i;
          return item == self_id;
        });

        if(index == -1){
          return;
        }
        rtc_connections[message["map"][index + 1]].channel.send(JSON.stringify({
          "type": "message",
          "body": message
        }))
        return;
      }

      event_loop(message["body"], {
        send: function(msg){
          let reverse_map = message["map"].reverse();

          rtc_connections[reverse_map[1]].channel.send(JSON.stringify({
            "type": "message",
            "body": {
              "type": "map",
              "map": reverse_map,
              "body": JSON.parse(msg)
            }
          }));
        }
      });
    }
  }

  async function event_loop(data, channel){
    if(data["type"] == "offer"){
      const rtc_conn = new RTC();

      rtc_conn.addEventListener("open-channel", function(){
        rtc_conn.user_obj = document.createElement("user-elem");
        rtc_conn.user_obj.setAttribute("conn-id", data["sender-id"]);
        document.querySelector(".users-files").append(rtc_conn.user_obj);

        let self_info = node_store.nodes.find((item) => {
          if(item.conn_id == "self"){
            return true;
          }else{ return false }
        });

        rtc_conn.channel.send(JSON.stringify({
          "type": "message",
          "body": {
            "type": "user-info",
            "color": self_info.color,
            "image": self_info.image
          }
        }));

        rtc_conn.addEventListener("message", function(e){
          let data;

          try{
            data = JSON.parse(e.detail.data);
          }catch{
            let message_uint = new Uint8Array(e.detail.data);
            const fin_index = message_uint.indexOf(44);
            if(fin_index == -1){
              return
            }

            const file_id = new TextDecoder().decode(message_uint.slice(0, fin_index));
            if(!download_status_store[file_id]){
              return;
            }

            data = {
              "type": "message",
              "body": {
                "type": "chunk-message",
                "chunk": message_uint.slice(fin_index + 1, ),
                "id": file_id,
                "mode": "load",
              }
            }
          }

          if(data["type"] == "message"){
            p2p_message_hander(rtc_conn, data["body"]);
            return;
          }
          event_loop(data, rtc_conn.channel);
        });
      });

      rtc_conn.addEventListener("close-channel", function(){
        remove_node(data["sender-id"]);
        // send to service worker rtc_conn.no_ready_files
        delete rtc_connections[data["sender-id"]];
        delete files[data["sender-id"]];
        rtc_conn.user_obj.remove();
        document.worker_bridge.postMessage({
          "type": "close-channel",
          "conn-id": data["sender-id"]
        });
        // alert("client unconnect");
      });

      const answer = await rtc_conn.createAnswer(data["offer"]);
      rtc_connections[data["sender-id"]] = rtc_conn;
      rtc_connections[data["sender-id"]].connection_id = data["sender-id"];

      channel.send(JSON.stringify({
        "type": "answer",
        "answer": answer,
        "sender-id": self_id, // data["receiver-id"] == self_id
        "receiver-id": data["sender-id"]
      }));
    }
    else if(data["type"] == "answer"){
      const conn = rtc_connections[data["sender-id"]];
      if(!conn){
        return;
      }

      conn.connection_id = data["sender-id"];
      conn.accept(data["answer"]);
    }
    else if(data["type"] == "create-connect"){
      const rtc_conn = new RTC();
      let other_id = data["sender-id"];

      rtc_conn.addEventListener("open-channel", function(){
        rtc_conn.user_obj = document.createElement("user-elem");
        rtc_conn.user_obj.setAttribute("conn-id", other_id);
        document.querySelector(".users-files").append(rtc_conn.user_obj);

        let self_info = node_store.nodes.find((item) => {
          if(item.conn_id == "self"){
            return true;
          }else{ return false }
        });

        rtc_conn.channel.send(JSON.stringify({
          "type": "message",
          "body": {
            "type": "user-info",
            "color": self_info.color,
            "image": self_info.image
          }
        }));

        rtc_conn.addEventListener("message", function(e){
          let data;

          try{
            data = JSON.parse(e.detail.data);
          }catch{
            let message_uint = new Uint8Array(e.detail.data);

            const fin_index = message_uint.indexOf(44);
            if(fin_index == -1){
              return
            }

            const file_id = new TextDecoder().decode(message_uint.slice(0, fin_index));
            if(!download_status_store[file_id]){
              return;
            }

            data = {
              "type": "message",
              "body": {
                "type": "chunk-message",
                "chunk": message_uint.slice(fin_index + 1, ),
                "id": file_id,
                "mode": "load",
              }
            }
          }

          if(data["type"] == "message"){
            p2p_message_hander(rtc_conn, data["body"]);
            // data["body"]
            return;
          }
          event_loop(data, rtc_conn.channel);
        });

        rtc_conn.channel.send(JSON.stringify({
          "type": "message",
          "body": {
            "type": "get-info-about-files"
          }
        }));
      });
      rtc_conn.addEventListener("close-channel", function(){
        // send to service worker rtc_conn.no_ready_files
        remove_node(other_id);
        delete rtc_connections[other_id];
        delete files[other_id];
        rtc_conn.user_obj.remove();

        document.worker_bridge.postMessage({
          "type": "close-channel",
          "conn-id": other_id
        });
        // alert("client unconnect");
      });
      const offer = await rtc_conn.createOffer(other_id);
      rtc_connections[other_id] = rtc_conn;
      rtc_connections[other_id].connection_id = other_id;

      channel.send(JSON.stringify({
        "type": "offer",
        "offer": offer,
        "sender-id": self_id,
        "receiver-id": other_id
      }));
    }
    else if(data["type"] == "find-nodes"){
      for(let key in rtc_connections){
        if(rtc_connections[key].connection_id == data["sender-id"]){
          continue;
        }

        let map = [data["sender-id"], self_id, rtc_connections[key].connection_id];
        rtc_connections[key].channel.send(JSON.stringify({
          "type": "message",
          "body": {
            "type": "map",
            "map": map,
            "body": {
              "type": "create-connect",
              "sender-id": data["sender-id"],
              "receiver-id": map[2]
            }
          }
        }));
      }

    }
  }

  ws.onmessage = async function(e){
    let data = e.data;
    try{
      data = JSON.parse(data);
    }catch{data};

    if(data["type"] == "connection-error"){
      window.location.href = window.location.origin + window.location.pathname;

    }
    else if(data["type"] == "client-id" && data["receiver-id"] == undefined){
      self_id = data["id"];

      let value = Math.floor(Math.random() * 65535);
      let unique_color = new Uint8Array(4);
      unique_color[0] = (value & 0x000000ff);
      unique_color[1] = (value & 0x0000ff00) >> 8;
      unique_color[2] = (value & 0x00ff0000) >> 16;
      unique_color[3] = 255;

      let img_file_name = images[Math.floor(Math.random() * images.length)];

      await add_node("self", unique_color, img_file_name);
      document.dispatchEvent(new Event("program-ready"));

      if(other_id){
        document.querySelector("#link").innerText = window.location.href;
        const rtc_conn = new RTC();

        rtc_conn.addEventListener("open-channel", function(){
          ws.close();
          rtc_conn.user_obj = document.createElement("user-elem");
          rtc_conn.user_obj.setAttribute("conn-id", other_id);
          document.querySelector(".users-files").append(rtc_conn.user_obj);

          let self_info = node_store.nodes.find((item) => {
            if(item.conn_id == "self"){
              return true;
            }else{ return false }
          });

          rtc_conn.channel.send(JSON.stringify({
            "type": "message",
            "body": {
              "type": "user-info",
              "color": self_info.color,
              "image": self_info.image
            }
          }));

          rtc_conn.channel.send(JSON.stringify({
            "type": "find-nodes",
            "sender-id": self_id,
          }));

          rtc_conn.addEventListener("message", function(e){
            let data;

            try{
              data = JSON.parse(e.detail.data);
            }catch{
              let message_uint = new Uint8Array(e.detail.data);

              const fin_index = message_uint.indexOf(44);
              if(fin_index == -1){
                return
              }

              const file_id = new TextDecoder().decode(message_uint.slice(0, fin_index));
              if(!download_status_store[file_id]){
                return;
              }

              data = {
                "type": "message",
                "body": {
                  "type": "chunk-message",
                  "chunk": message_uint.slice(fin_index + 1, ),
                  "id": file_id,
                  "mode": "load",
                }
              }
            }

            if(data["type"] == "message"){
              p2p_message_hander(rtc_conn, data["body"]);
              // data["body"]
              return;
            }
            event_loop(data, rtc_conn.channel);
          });

          rtc_conn.channel.send(JSON.stringify({
            "type": "message",
            "body": {
              "type": "get-info-about-files"
            }
          }));
        });
        rtc_conn.addEventListener("close-channel", function(){
          // document.querySelector("#link").innerText = window.location.origin + "?id=" + self_id;
          // send to service worker rtc_conn.no_ready_files
          remove_node(other_id);
          delete rtc_connections[other_id];
          delete files[other_id];
          rtc_conn.user_obj.remove();

          document.worker_bridge.postMessage({
            "type": "close-channel",
            "conn-id": other_id
          });
          // alert("client unconnect");
        });
        const offer = await rtc_conn.createOffer(other_id);
        rtc_connections[other_id] = rtc_conn;
        rtc_connections[other_id].connection_id = other_id;

        ws.send(JSON.stringify({
          "type": "offer",
          "offer": offer,
          "sender-id": self_id,
          "receiver-id": other_id
        }));
      }
      else{
        document.querySelector("#link").innerText = window.location.origin + "?id=" + self_id;
      }

      return;
    }

    event_loop(data, ws);
  }

}).catch(function(err){
  console.log(err);
});

export {
  rtc_connections,
  files,
  download,
  controll_download,
  self_files,
  normalize_name
}
