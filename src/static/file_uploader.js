import { UploadInfoComponent } from "/src/static/components/UploadInfoComponent.js";
import { rtc_connections } from "/src/static/main.js";

customElements.define("uploadinfoblock-elem", UploadInfoComponent);

function uint8_to_array(u8a){
  let CHUNK_SZ = 0x8000;
  let c = [];
  for(let i = 0; i < u8a.length; i += CHUNK_SZ){
    c.push(String.fromCharCode.apply(null, u8a.subarray(i, i + CHUNK_SZ)));
  }
  return btoa(c.join(""));
}

function uuidv4() {
  const result = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });

  return result;
}

class GlobalLock{
  constructor(){
    this.queue = {};
    const self = this;
    let index_db_request = indexedDB.open("lockStore");

    index_db_request.onupgradeneeded = function(){
      self.db = index_db_request.result;
      if(!self.db.objectStoreNames.contains("testStore")){
        let object_store = self.db.createObjectStore("testStore", {keyPath: "id"});
      }
    }
    index_db_request.onsuccess = function(){
      self.db = index_db_request.result;
    }
  }

  async resolve_main_pause(channel_id, id){
    await this.block_operation();

    let found_obj = {"key": null, "obj": null};

    for(let key in this.queue[channel_id]){
      let obj = this.queue[channel_id][key];
      if(obj.id == id && obj.main_pause == true){
        found_obj.key = key;
        found_obj.obj = obj;
        break;
      }
    }

    if(!found_obj.key){ return }

    let count = 0;
    for(let key in this.queue[channel_id]){
      let obj = this.queue[channel_id][key];
      if(obj.main_pause == false && obj.subscriber == null){

        this.queue[channel_id][key].subscriber = found_obj.key;
        this.queue[channel_id][found_obj.key].subscribition = key;

        this.queue[channel_id][found_obj.key].main_pause = false;
        count = 1;
        break;
      }
    }

    if(count == 0){
      this.queue[channel_id][found_obj.key].main_pause = false;
      this.queue[channel_id][found_obj.key].ready = false;
      this.queue[channel_id][found_obj.key].resolve();
    }
  }

  async resolve(channel_id, id){
    await this.block_operation();

    let found_obj = {"key": null, "obj": null};

    for(let key in this.queue[channel_id]){
      let obj = this.queue[channel_id][key];
      if(obj.id == id && obj.ready == false){
        found_obj.key = key;
        found_obj.obj = obj;
        break;
      }
    }

    if(!found_obj.obj){ return;}

    if(this.queue[channel_id][found_obj.obj.subscriber]){
      this.queue[channel_id][found_obj.obj.subscriber].ready = false;
      this.queue[channel_id][found_obj.obj.subscriber].resolve();
    }
    delete this.queue[channel_id][found_obj.key];
  }

  async block_operation(){
    const self = this;
    let promise = new Promise((resolve, reject) => {
      let transaction = self.db.transaction("testStore", "readwrite");
      let test_object_store = transaction.objectStore("testStore");

      let obj = {"id": "test"};

      test_object_store.add(obj);
      test_object_store.delete("test");

      transaction.oncomplete = function(){
        resolve(true);
      }
    });

    return promise;
  }

  async register(channel_id, id, resolve, main_pause){
    let uid = uuidv4();
    await this.block_operation();

    let task = {
      "id": id,
      "resolve": resolve,
      "main_pause": main_pause,
      "ready": true,
      "subscriber": null,
    }

    if(this.queue[channel_id]){
      let count = 0;
      for(let key in this.queue[channel_id]){
        if(this.queue[channel_id][key].main_pause == false){
          count += 1;
          break;
        }
      }

      if(count == 0){
        if(!main_pause){
          task.ready = false;
          resolve(true);
        }

        this.queue[channel_id][uid] = task;
      }
      else{
        this.queue[channel_id][uid] = task;

        if(main_pause){ return }

        for(let key in this.queue[channel_id]){
          let obj = this.queue[channel_id][key];
          if(obj.subscriber == null && obj.main_pause == false){
            this.queue[channel_id][key].subscriber = uid;
            break;
          }
        }
      }
    }
    else{
      this.queue[channel_id] = {};
      if(!main_pause){
        task.ready = false;
        resolve(true);
      }

      this.queue[channel_id][uid] = task;
    }
  }
}

let global_lock = new GlobalLock();


class PauseManager{
  constructor(event_target, id){
    this.id = id;
    this.event_target = event_target;
    this.pause = false;
    this.main_pause = false;

    const self = this;
    this.event_target.addEventListener(this.id, function(e){
      const data = e.detail;

      if(data["type"] == "pause"){
        self.pause = true;
      }
      else if(data["type"] == "main-pause"){
        self.info_block.pause();
        self.main_pause = true;
        self.pause = true;
      }
      else if(data["type"] == "resume"){
        global_lock.resolve(self.channel_id, self.id);
      }
      else if(data["type"] == "main-resume"){
        self.info_block.resume();
        global_lock.resolve_main_pause(self.channel_id, self.id);
        self.main_pause = false;
      }
      else if(data["type"] == "cancel"){

        self.cancel_operation = true;

        if(self.main_pause){
          self.main_pause = false;
          global_lock.resolve_main_pause(self.channel_id, self.id);
        }
        else{
          // global_lock.register(self.channel_id, self.id, resolve, self.main_pause);
          //global_lock.resolve(self.channel_id, self.id);
        }
        self.cancel();
      }
    });
  }

  async resume_promise(){
    const self = this;
    return new Promise((resolve, reject) => {
      global_lock.register(self.channel_id, self.id, resolve, self.main_pause);
      //self.resolve = resolve;
    });
  }

  cancel_hook(func){
    this.cancel = func;
  }
}

let download_status = {};
window.onbeforeunload = function(e){
  let status = 0;
  let count = 0;
  for(let key in download_status){
    status += download_status[key];
    count += 1;
  }
  if(count == 0){
    return;
  }
  status /= count;
  if(status != 100){
    document.querySelector(".upload-block-info").setAttribute("style", "opacity: 1; z-index: 999;");
    e.preventDefault();
    let str = "";
    e.returnValue = str;
    return str;
  }
}

function getReader(file){
  const full_size = file.size;
  const step = 240000;
  let current_pos = 0;

  let fr = new FileReader();

  return {
    read: function(){
      return new Promise(function(resolve, reject){
        let blob = file.slice(current_pos, current_pos + step);

        fr.onload = function(e){
          let chunk = new Uint8Array(e.target.result);

          if(chunk.length == 0){
            resolve({done: true, value: null});
          }
          else{
            resolve({done: false, value: chunk});
          }
        }
        fr.onerror = function(e){}
        fr.readAsArrayBuffer(blob);
        current_pos = current_pos + step;
      });
    },
    cancel: function(){
      current_pos = full_size;
    }
  }
}

class FileUploader{
  async upload_file(connection_id, channel, file, file_id, start_index, hook){

    function close_channel_func(){
      global_lock.resolve(channel.label, hook.id);
      hook.info_block.cancel();
      hook.cancel();
    }
    rtc_connections[connection_id].event_target.addEventListener("close-channel", close_channel_func);

    // let stream = file.stream();
    // const reader = stream.getReader();
    const reader = getReader(file);
    // add send headers
    download_status[hook.id] = 0;

    let info_block = document.createElement("uploadinfoblock-elem");
    info_block.setAttribute("file-name", file_id);
    info_block.setAttribute("conn-id", connection_id);

    hook.info_block = info_block;
    let break_loop = false;
    hook.cancel_hook(function cancel_func(){
      reader.cancel();
      break_loop = true;
    });
    hook.channel_id = channel.label;

    let uploaded = 0;
    reader.read().then(async function process_data({done, value}) {
      // if(hook.pause){
      //   await hook.resume_promise();
      // }

      if(done){
        rtc_connections[connection_id].event_target.removeEventListener("close-channel", close_channel_func);
        try{
          channel.send(JSON.stringify({
            "type": "message",
            "body": {
              "type": "chunk-message",
              "chunk": value,
              "mode": "done",
              "id": hook.id
            }
          }));
        }
        catch{}


        if(hook.cancel_operation){
          hook.info_block.cancel();
        }
        // hook.event_target.removeEventListener(hook.id, hook.pause_handler);
        return;
      }

      for(let i = 0; i < value.length; i += 60000){
        if(break_loop){
          break;
        }
        await hook.resume_promise();
        let slice_value = value.subarray(i, i + 60000);

        uploaded += slice_value.length;
        info_block.setAttribute("uploaded", Math.floor((uploaded / file.size) * 100));

        download_status[hook.id] = Math.floor((uploaded / file.size) * 100);

        let id = new TextEncoder().encode(hook.id + ",");
        channel.send(new Uint8Array([...id, ...slice_value]).buffer);


        hook.pause = true;
      }
      hook.pause = false;

      return reader.read().then(process_data);

    }).catch(function(err){console.log(err)});
  }
}

export {
  FileUploader,
  PauseManager
}
