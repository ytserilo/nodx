let file_waiters = {};

class Queue extends EventTarget{
  constructor(){
    super();
    const self = this;
    // this.event_source = new EventTarget();
    this.generator_queue = function* (callback, chunks=[], count=0){
      count += 1;
      if(count > 300){
        self.queue = self.generator_queue(function(data){
          // e = {data, done}
          if(data.data != null){
            self.resolve(data.data);
            self.resolve = null;
          }
        });
        self.queue.next();
        return;
      }

      if(self.resolve && chunks.length != 0){
        callback({done: false, data: chunks[0]});
        yield* self.generator_queue(callback, chunks.slice(1, ), count);
        return;
      }

      let data = yield;

      if(data){
        yield* self.generator_queue(callback, chunks.concat(data), count);
      }
      else{
        if(chunks.length == 0){
          callback({done: true, data: null});
        }
        else{
          callback({done: false, data: chunks[0]});
        }

        yield* self.generator_queue(callback, chunks.slice(1, ), count);
      }
      return;
    }

    this.queue = this.generator_queue(function(data){
      // e = {data, done}
      if(data.data != null){
        self.resolve(data.data);
        self.resolve = null;
      }
    });
    this.queue.next();

    this.addEventListener("put", function event_source_handler(e){
      if(e.detail.done == true){
        self.removeEventListener("put", event_source_handler);
      }
      self.queue.next(e.detail);
    });
  }

  read(){
    const self = this;

    const promise = new Promise((resolve, reject) => {
      self.resolve = resolve;
      self.queue.next();
    });

    return promise;
  }
}

class FileWaiter{
  constructor(file_name, type, size){
    this.file_name = file_name;
    this.type = type;
    this.size = size;
    this.queue = new Queue();
  }

  onclose(func){
    this.close = func;
  }
}

function check_load_video(url){
  let url_arr = url.split("?");
  if(url_arr.length < 2){
    return {"res": false};
  }

  let address = url_arr[0];
  let params = url_arr[1];
  if(address != self.location.origin+'/file_id'){
    return false;
  }

  params = params.split("=");
  if(params.length < 2){
    return {"res": false};
  }
  let link = params[1];

  if(file_waiters[link] == undefined){
    return {"res": false};
  }

  return {
    "name": link,
    "res": true
  }
}

self.addEventListener('message', event => {
  const data = event.data;

  if(data["type"] == "file-request"){

    file_waiters[data["operation-id"]] = new FileWaiter(
      data["file-name"], data["file-type"], data["size"]
    );
    file_waiters[data["operation-id"]].rtc_id = data["rtc-id"];
    file_waiters[data["operation-id"]].operation_id = data["operation-id"];

    file_waiters[data["operation-id"]].file_name = data["file-name"];
    file_waiters[data["operation-id"]].event_source = event.source;
  }
  else if(data["type"] == "file-data"){
    file_waiters[data["operation-id"]].queue.dispatchEvent(new CustomEvent("put", {
      detail: {
        chunk: data.chunk, done: data.done
      }
    }));
  }
  else if(data["type"] == "close-channel"){
    for(let key in file_waiters){
      if(file_waiters[key].rtc_id == data["conn-id"]){
        file_waiters[key].close();
      }
    }
  }
});
function uuidv4() {
  const result = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });

  return result;
}
self.addEventListener("fetch", (event) => {
  const file_check = check_load_video(event.request.url);

  if(file_check.res){
    let promise = new Promise((resolve, reject) => {
      let file_waiter = file_waiters[file_check.name];

      file_waiter.event_source.postMessage({
        "type": "connection-complete",
        "file-name": file_waiter.file_name,
        "rtc-id": file_waiter.rtc_id,
        "operation-id": file_waiter.operation_id
      });

      let readable_stream = new ReadableStream({
        start(controller) {
          // The following function handles each data chunk
          file_waiter.onclose(function(){
            try{controller.close()}catch{}
            file_waiter.event_source.postMessage({
              "type": "download-complete",
              "operation-id": file_waiter.operation_id,
              "file-name": file_waiter.file_name
            });

            delete file_waiters[file_waiter.file_name];

            let resp = Response.error();
            resolve(resp);
          });

          file_waiter.queue.read().then(function process_data(e){
            if(e.done == true){
              controller.close();
              file_waiter.event_source.postMessage({
                "type": "download-complete",
                "operation-id": file_waiter.operation_id,
                "file-name": file_waiter.file_name
              });

              delete file_waiters[file_waiter.file_name];
              return;
            }

            controller.enqueue(e.chunk);

            file_waiter.event_source.postMessage({
              "type": "resume",
              "rtc-id": file_waiter.rtc_id,
              "operation-id": file_waiter.operation_id,
            });


            return file_waiter.queue.read().then(process_data);
          }).catch(function(err){});
        }
      });


      let headers = {
        "Content-Length": file_waiter.size,
        "Content-Type": "application/octet-stream",
        "Content-Disposition": "attachment; filename={}".replace("{}", encodeURIComponent(file_waiter.file_name)),
        "Accept-Ranges": "bytes"
      }

      let resp = new Response(readable_stream, {"headers": headers});
      resolve(resp);
    });
    // return promise;
    event.respondWith(promise);
  }
});
