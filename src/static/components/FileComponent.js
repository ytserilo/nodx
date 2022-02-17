import { rtc_connections, download, controll_download, normalize_name } from "/src/static/main.js";
import { DownloadComponent } from "/src/static/components/DownloadComponent.js";

customElements.define("download-elem", DownloadComponent);

function uuidv4() {
  const result = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });

  return result;
}

class Files extends HTMLElement{
  constructor(){
    super();
    this.state = {"files": []}
    this.addFiles = function(files){
      this.state.files = files;
      this.render();
    }
  }

  connectedCallback(){
    const self = this;
    this.container = document.createElement("div");
    this.container.setAttribute("class", "files");

    this.empty_space = document.createElement("div");
    let img = document.createElement("img"); img.src = "/static/img/users/nothing_here.jpg";
    this.empty_space.setAttribute("class", "empty-space");
    this.empty_space.append(img);
    let span = document.createElement("span"); span.innerText = window.langObj.node_offers;
    this.empty_space.append(span);

    this.container.append(this.empty_space);

    this.append(this.container);
    let close_btn = document.createElement("button");
    close_btn.setAttribute("class", "files-close-btn");
    close_btn.innerHTML = '<svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="times" class="svg-inline--fa fa-times fa-w-11" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 352 512"><path fill="currentColor" d="M242.72 256l100.07-100.07c12.28-12.28 12.28-32.19 0-44.48l-22.24-22.24c-12.28-12.28-32.19-12.28-44.48 0L176 189.28 75.93 89.21c-12.28-12.28-32.19-12.28-44.48 0L9.21 111.45c-12.28 12.28-12.28 32.19 0 44.48L109.28 256 9.21 356.07c-12.28 12.28-12.28 32.19 0 44.48l22.24 22.24c12.28 12.28 32.2 12.28 44.48 0L176 322.72l100.07 100.07c12.28 12.28 32.2 12.28 44.48 0l22.24-22.24c12.28-12.28 12.28-32.19 0-44.48L242.72 256z"></path></svg>';
    close_btn.onclick = function(){
      self.setAttribute("style", "z-index: -1; opacity: 0;");
      document.querySelector(".users-files").setAttribute("style", "z-index: -1;opacity: 0;");
    }
    this.append(close_btn);

  }

  render(){
    let childs = this.container.querySelectorAll("file-elem");
    const ln = childs.length;

    for(let i = 0; i < ln; i++){
      childs[i].remove();
    }

    if(this.state.files.length == 0){
      this.empty_space.style.opacity = 1;
    }
    else{
      this.empty_space.style.opacity = 0;
      for(let i = 0; i < this.state.files.length; i++){
        this.container.append(this.state.files[i]);
      }
    }

  }
}

const archive_formats = [
  "rar", "7z", "arj", "bz2",
  "cab", "gz", "jar", "lz",
  "lzh", "tar", "uue", "xz",
  "z", "zipx", "001"
];

class FileComponent extends HTMLElement{
  constructor() {
    super();
    this.state = {"download": null};
    this.file_name = null;
    this.conn_id = null;
  }

  async load_img(){
    let type_img = this.file_name.split("."); type_img = type_img[type_img.length - 1];
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

    return promise;
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

    this.download_button = document.createElement("button");
    this.download_button.setAttribute("title", this.file_name);
    this.download_button.innerHTML = '<svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="arrow-down" class="svg-inline--fa fa-arrow-down fa-w-14" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="currentColor" d="M413.1 222.5l22.2 22.2c9.4 9.4 9.4 24.6 0 33.9L241 473c-9.4 9.4-24.6 9.4-33.9 0L12.7 278.6c-9.4-9.4-9.4-24.6 0-33.9l22.2-22.2c9.5-9.5 25-9.3 34.3.4L184 343.4V56c0-13.3 10.7-24 24-24h32c13.3 0 24 10.7 24 24v287.4l114.8-120.5c9.3-9.8 24.8-10 34.3-.4z"></path></svg>';
    this.download_button.onclick = function(){

      self.id = uuidv4();

      let download_elem = document.createElement("download-elem");
      download_elem.setAttribute("operation_id", self.id);
      download_elem.setAttribute("connection_id", self.conn_id);
      download_elem.init(
        file_type_img,
        self.file_name,
        self.formatBytes(self.size),
        controll_download
      );

      document.querySelector("#download-info").style.opacity = 0;
      document.querySelector(".download-info-block").append(download_elem);

      download(
        self.file_name,
        rtc_connections[self.conn_id],
        self.id,
        function(){
          download_elem.setAttribute("style", "opacity: 0;");
          setTimeout(function(){
            download_elem.finish();
          }, 300);
        }
      );
    }


    this.container = document.createElement("div"); this.container.setAttribute("class", "file-container");
    let containerHTML = `
        <div class="file-bio">
          <img src="{file_type_img}" alt="" />
          <span title="{file_name_title}">{file_name}</span>
          <span>{file_size}</span>
        </div>
    `;
    let file_type_img = await this.load_img();
    let short_name = normalize_name(this.file_name);
    containerHTML = containerHTML.replace("{file_name}", short_name);
    containerHTML = containerHTML.replace("{file_name_title}", this.file_name);
    containerHTML = containerHTML.replace("{file_type_img}", file_type_img);
    containerHTML = containerHTML.replace("{file_size}", this.formatBytes(this.size));
    this.container.innerHTML = containerHTML;

    this.container.append(this.download_button);
  }

  connectedCallback(){
    this.append(this.container);
  }

  static get observedAttributes() {
    return ["file-name", "conn-id", "size"];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if(name == "file-name"){ this.file_name = newValue; }
    else if(name == "conn-id"){ this.conn_id = newValue; }
    else if(name == "size"){ this.size = Number(newValue); }

    if(this.conn_id != null && this.file_name != null && this.size != null){ this.init(); }
  }
}

export {
  Files,
  FileComponent
}
