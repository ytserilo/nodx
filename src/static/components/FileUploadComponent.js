import { self_files, rtc_connections, normalize_name } from "/src/static/main.js";

function rus_to_latin(str){
  let ru = {
      'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd',
      'е': 'e', 'ё': 'e', 'ж': 'j', 'з': 'z', 'и': 'i',
      'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
      'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
      'ф': 'f', 'х': 'h', 'ц': 'c', 'ч': 'ch', 'ш': 'sh',
      'щ': 'shch', 'ы': 'y', 'э': 'e', 'ю': 'u', 'я': 'ya'
  }, n_str = [];

  str = str.replace(/[ъь]+/g, '').replace(/й/g, 'i');

  for (let i = 0; i < str.length; ++i) {
     n_str.push(
            ru[ str[i] ]
         || ru[ str[i].toLowerCase() ] == undefined && str[i]
         || ru[ str[i].toLowerCase() ].toUpperCase()
     );
  }

  n_str = n_str.join('');
  n_str = n_str.replaceAll(" ", "_");
  return n_str;
}

function send_files_info(){
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

const archive_formats = [
  "rar", "7z", "arj", "bz2",
  "cab", "gz", "jar", "lz",
  "lzh", "tar", "uue", "xz",
  "z", "zipx", "001"
];

class InputFileObject extends HTMLElement{
  constructor(){
    super();
    this.name = null;
    this.type = null;
    this.size = null;
  }

  formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  async init(){
    const self = this;
    let type_img = this.name.split("."); type_img = type_img[type_img.length - 1];
    let promise = new Promise((resolve, reject) => {
      let img = new Image();
      img.onload = function(){
        resolve("/static/img/file_types/{}.png".replace("{}", type_img));
      }
      img.onerror = function(){
        if(archive_formats.indexOf(type_img) != -1){
          resolve("/static/img/file_types/archive.png");
        }
        else{
          resolve("/static/img/file_types/nfo.png");
        }
      }
      img.src = "/static/img/file_types/{}.png".replace("{}", type_img);
    });
    type_img = await promise;


    let block = document.createElement("div"); block.setAttribute("class", "file");

    let img = document.createElement("img"); img.setAttribute("src", type_img);

    let short_name = normalize_name(this.name);
    let p = document.createElement("span"); p.innerText = short_name; p.title = this.name;
    let span = document.createElement("span"); span.innerText = this.formatBytes(this.size);
    block.append(img); block.append(p); block.append(span);

    let remove_btn = document.createElement("button"); remove_btn.innerText = "Delete";
    remove_btn.setAttribute("title", this.name);
    remove_btn.setAttribute("class", "delete-btn");
    remove_btn.onclick = function(){
      delete self_files[self.name];
      send_files_info();
      self.remove_file();
    }
    block.append(remove_btn);

    this.block = block;
    this.append(this.block);
  }


  static get observedAttributes() {
    return ["name", "size", "type"];
  }

  async attributeChangedCallback(name, oldValue, newValue) {
    if(name == "name"){ this.name = newValue; }
    else if(name == "size"){ this.size = newValue; }
    else if(name == "type"){ this.type = newValue }


    if(this.name != null && this.size != null && this.type != null){ this.init(); }
  }
}
customElements.define("input-file", InputFileObject);

class FileUpload extends HTMLElement{
  constructor(){
    super();
    this.file_upload_elem = document.createElement("input");
    this.file_upload_elem.setAttribute("type", "file");
    this.file_upload_elem.setAttribute("multiple", true);

    this.input_files = [];

    const self = this;
    this.file_upload_elem.addEventListener("change", function(){
      for(let key in self_files){ delete self_files[key]; }
      let files = self.file_upload_elem.files;

      self.input_files = [];
      for(let i = 0; i < files.length; i++){
        const f_obj = files[i];
        const file_name = rus_to_latin(f_obj.name);
        self_files[file_name] = {
          "name": file_name,
          "size": f_obj.size,
          "type": f_obj.type,
          "file-obj": f_obj
        }

        let file_dom_obj = document.createElement("input-file");
        file_dom_obj.setAttribute("name", file_name);
        file_dom_obj.setAttribute("size", f_obj.size);
        file_dom_obj.setAttribute("type", f_obj.type);
        file_dom_obj.remove_file = function(){
          self.input_files = self.input_files.filter((item) => {
            return !(item.getAttribute("name") == file_dom_obj.getAttribute("name"));
          });

          let file = file_dom_obj.querySelector(".file");
          file.setAttribute("style", "animation: file_anim_remove 0.7s forwards;");
          setTimeout(function(){
            file_dom_obj.remove();
            if(self.input_files.length == 0){
              const files_container = document.querySelector(".uploaded-files");
              files_container.setAttribute("class", "uploaded-files");
              self.render();
            }
          }, 600);

        }
        self.input_files.push(file_dom_obj);
      }

      self.render();
      send_files_info();
    });
  }

  connectedCallback(){
    document.querySelector("#add-files").onclick = () => {
      this.file_upload_elem.click();
    }
    document.querySelector(".upload-info-block").onclick = () => {
      this.file_upload_elem.click();
    }
  }

  render(){
    const files_container = document.querySelector(".uploaded-files");
    let childs = files_container.children;
    const ln = childs.length;

    let step = 0;
    for(let i = 0; i < ln; i++){
      if(childs[step].getAttribute("class") == "upload-info-block"){
        step += 1;
        continue;
      }
      childs[step].remove();
    }

    if(this.input_files.length == 0){
      files_container.setAttribute("style", "width: calc(100% - 30px); height: calc(100% - 30%);");
      files_container.setAttribute("class", "uploaded-files");
    }
    else{
      files_container.setAttribute("style", "");
      files_container.setAttribute("class", "uploaded-files files-availabe");

      for(let i = 0; i < this.input_files.length; i++){
        files_container.append(this.input_files[i]);
      }
    }
  }
}

export {
  FileUpload
}
