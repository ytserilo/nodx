let file_waiters = {};
let requestFileSystem = window.webkitRequestFileSystem || window.requestFileSystem;

let self_event_target = {};

function FileInit(file_size){
  return new Promise((resolve, reject) => {
    const requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;

     requestFileSystem(
       window.TEMPORARY,
       file_size,
       function(filesystem){
         resolve(filesystem);
       },
       function(error){
         reject(error);
       },
     );
  });
}

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


self_event_target.message = async function(event){
  const data = event.data;

  if(data["type"] == "file-request"){

    file_waiters[data["operation-id"]] = new FileWaiter(
      data["file-name"], data["file-type"], data["size"]
    );
    file_waiters[data["operation-id"]].file_system = await FileInit(data["size"] + 1);
    file_waiters[data["operation-id"]].file_system.root.getFile(data["operation-id"], {create: true}, function(fileEntry){
      // fileEntry.createWriter(function(fileWriter){
      //   fileWriter.write(new Blob());
      // });
    });

    file_waiters[data["operation-id"]].rtc_id = data["rtc-id"];
    file_waiters[data["operation-id"]].operation_id = data["operation-id"];


    file_waiters[data["operation-id"]].file_name = data["file-name"];
    file_waiters[data["operation-id"]].event_source = event.source;

    event.source.postMessage({
      "type": "connection-complete",
      "operation-id": data["operation-id"],
      "rtc-id": data["rtc-id"],
      "file-name": data["file-name"]
    });

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
};
function uuidv4() {
  const result = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });

  return result;
}


function saveFile(file_id){
  let file_waiter = file_waiters[file_id];
  if(!file_waiter){
    return;
  }

  file_waiter.onclose(function(){
    file_waiter.event_source.postMessage({
      "type": "download-complete",
      "operation-id": file_waiter.operation_id,
      "file-name": file_waiter.file_name
    });

    delete file_waiters[file_waiter.file_name];

    file_waiter.file_system.root.getFile(file_id, {create: false}, function(fileEntry) {
      fileEntry.remove(function(){}, function(e){});
    }, function(e){});
  });

  file_waiter.queue.read().then(async function process_data(e){

    if(e.done == true){
      file_waiter.file_system.root.getFile(file_id, {}, function(fileEntry){

        const a = document.createElement("a");
        a.download = file_waiter.file_name;

        function finish(link) {
          document.body.appendChild(a);
          link.addEventListener('click', () => {
            setTimeout(() => {
              fileEntry.remove(function(e){}, function(e){});
            }, 100);

            link.parentNode.removeChild(a);
          });
          link.click();
        }

        if(!!window.webkitRequestFileSystem){
          a.href = fileEntry.toURL();
          finish(a);
        }
        else{
          fileEntry.file(function(file){
            const URL = window.URL || window.webkitURL;
            a.href = URL.createObjectURL(file);
            finish(a);
          }, function(e){});
        }
      });

      file_waiter.event_source.postMessage({
        "type": "download-complete",
        "operation-id": file_waiter.operation_id,
        "file-name": file_waiter.file_name
      });

      delete file_waiters[file_waiter.file_name];
      return;
    }

    let promise = new Promise((resolve, reject) => {

      file_waiter.file_system.root.getFile(file_id, {create: false}, function(fileEntry){
        fileEntry.createWriter(function(fileWriter){
          let blob = new Blob([e.chunk], {type: file_waiter.type});
          fileWriter.seek(fileWriter.length);

          fileWriter.onwriteend = function(e){

            file_waiter.event_source.postMessage({
              "type": "resume",
              "rtc-id": file_waiter.rtc_id,
              "operation-id": file_waiter.operation_id,
            });
            resolve();
          };

          fileWriter.write(blob);
        }, function(e){});
      }, function(e){});

    });
    await promise;

    return file_waiter.queue.read().then(process_data);
  }).catch(function(err){});
}

export {
  saveFile,
  self_event_target
}
