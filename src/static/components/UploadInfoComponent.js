import { node_store, loadImage } from "/src/static/media.js";
import { self_files, files, normalize_name } from "/src/static/main.js";

let active_users = {};
const archive_formats = [
  "rar", "7z", "arj", "bz2",
  "cab", "gz", "jar", "lz",
  "lzh", "tar", "uue", "xz",
  "z", "zipx", "001"
];

class UploadInfoComponent extends HTMLElement{
  constructor(){
    super();
    this.uploaded = 0;
  }

  async load_img(file_name){
    let type_img = file_name.split("."); type_img = type_img[type_img.length - 1];
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

  cancel(){
    this.setAttribute("uploaded", 100);
    this.change_upload_info_func(100);
    this.pause_block.style.opacity = 0;
    this.cancel_block.style.opacity = 1;
    this.success_block.style.opacity = 0;

    this.uploaded_div.style.opacity = 0;
  }

  pause(){
    this.pause_block.style.opacity = 1;
    this.uploaded_div.style.opacity = 0;
  }

  resume(){
    this.pause_block.style.opacity = 0;
    this.cancel_block.style.opacity = 0;
    this.success_block.style.opacity = 0;
    this.uploaded_div.style.opacity = 1;
  }

  async connectedCallback(){
    await this.init();
    this.append(this.html);
  }

  async init(){
    let file_obj = document.createElement("div");
    file_obj.setAttribute("class", "upload-file-obj");

    let img = document.createElement("img");
    img.src = await this.load_img(this.file_name);

    let p_file_name = document.createElement("span");
    p_file_name.innerText = normalize_name(this.file_name);


    let p_size = document.createElement("span");
    p_size.innerText = this.formatBytes(self_files[this.file_name].size);
    this.full_size = self_files[this.file_name].size;

    this.uploaded_div = document.createElement("div");
    this.uploaded_div.setAttribute("class", "progress-background");
    this.uploaded_div.style.width = "0%";

    this.uploaded_num = document.createElement("div");
    this.uploaded_num.setAttribute("class", "gray-background");
    this.uploaded_num.innerText = "0%";

    this.pause_block = document.createElement("div"); this.pause_block.setAttribute("class", "pause");
    this.pause_block.innerHTML = '<svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="pause" class="svg-inline--fa fa-pause fa-w-14" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="currentColor" d="M144 479H48c-26.5 0-48-21.5-48-48V79c0-26.5 21.5-48 48-48h96c26.5 0 48 21.5 48 48v352c0 26.5-21.5 48-48 48zm304-48V79c0-26.5-21.5-48-48-48h-96c-26.5 0-48 21.5-48 48v352c0 26.5 21.5 48 48 48h96c26.5 0 48-21.5 48-48z"></path></svg>';

    this.cancel_block = document.createElement("div"); this.cancel_block.setAttribute("class", "cancel");
    this.cancel_block.innerHTML = '<svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="ban" class="svg-inline--fa fa-ban fa-w-16" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M256 8C119.034 8 8 119.033 8 256s111.034 248 248 248 248-111.034 248-248S392.967 8 256 8zm130.108 117.892c65.448 65.448 70 165.481 20.677 235.637L150.47 105.216c70.204-49.356 170.226-44.735 235.638 20.676zM125.892 386.108c-65.448-65.448-70-165.481-20.677-235.637L361.53 406.784c-70.203 49.356-170.226 44.736-235.638-20.676z"></path></svg>';

    this.success_block = document.createElement("div"); this.success_block.setAttribute("class", "success");
    this.success_block.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" data-prefix="far" data-icon="check-circle" class="svg-inline--fa fa-check-circle fa-w-16" role="img" viewBox="0 0 512 512"><path fill="currentColor" d="M256 8C119.033 8 8 119.033 8 256s111.033 248 248 248 248-111.033 248-248S392.967 8 256 8zm0 48c110.532 0 200 89.451 200 200 0 110.532-89.451 200-200 200-110.532 0-200-89.451-200-200 0-110.532 89.451-200 200-200m140.204 130.267l-22.536-22.718c-4.667-4.705-12.265-4.736-16.97-.068L215.346 303.697l-59.792-60.277c-4.667-4.705-12.265-4.736-16.97-.069l-22.719 22.536c-4.705 4.667-4.736 12.265-.068 16.971l90.781 91.516c4.667 4.705 12.265 4.736 16.97.068l172.589-171.204c4.704-4.668 4.734-12.266.067-16.971z"/></svg>';

    file_obj.append(img); file_obj.append(p_file_name); file_obj.append(p_size);
    file_obj.append(this.uploaded_div);
    file_obj.append(this.uploaded_num);
    file_obj.append(this.pause_block); file_obj.append(this.cancel_block); file_obj.append(this.success_block);

    this.html = file_obj;
    active_users[this.conn_id].addDownloadObj(this);
  }

  listen(func){
    this.change_upload_info_func = func;
  }

  static get observedAttributes() {
    return ["conn-id", "file-name", "uploaded"];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if(name == "conn-id"){
      this.conn_id = newValue;

      if(!active_users[this.conn_id]){
        let u_obj = document.createElement("uploadinfouser-elem");
        u_obj.setAttribute("conn-id", this.conn_id);
        active_users[this.conn_id] = u_obj;
        document.querySelector("#upload-info").style.opacity = 0;
        document.querySelector("#back-upload-block-btn").style.opacity = 1;
        document.querySelector(".upload-block-info .users").style.opacity = 1;
        document.querySelector(".upload-block-info .users").append(u_obj);
      }

      active_users[this.conn_id].container.append(this);
    }
    else if(name == "file-name"){ this.file_name = newValue; }

    if(name == "uploaded"){
      if(newValue == 100){
        this.success_block.style.opacity = 1;
        this.uploaded_div.style.opacity = 0;
      }
      this.uploaded = newValue;
      this.change_upload_info_func(newValue);
      this.uploaded_div.style.width = String(newValue) + "%";
      this.uploaded_num.innerText = String(newValue) + "%";
    }
  }
}

class UploadInfoUser extends HTMLElement{
  constructor(){
    super();
    this.download_objs = [];
    this.full_size = 0;
  }

  connectedCallback(){
    this.append(this.html);
  }

  init(){
    const self = this;
    let div = document.createElement("div"); div.setAttribute("class", "user-obj");
    let users = document.querySelector(".upload-block-info .users");
    div.onclick = function(){
      if(window.innerWidth <= 560){
        users.setAttribute("style", "transform: translateX(-100%); opacity: 1;");
      }
      let objs = document.querySelectorAll(".upload-files .files-info-container");
      for(let i = 0; i < objs.length; i++){
        objs[i].style.display = "none";
      }
      self.container.style.display = "grid";
    }

    this.uploaded_div = document.createElement("div"); this.uploaded_div.setAttribute("class", "uploaded");
    this.uploaded_div.style.width = "0%";

    this.uploaded_num = document.createElement("span"); this.uploaded_num.setAttribute("class", "uploaded-num");
    this.uploaded_num.innerText = "0%";

    div.append(this.node_obj.ready_img);
    div.append(this.uploaded_div);
    div.append(this.uploaded_num);

    this.container = document.createElement("div"); this.container.setAttribute("class", "files-info-container");
    document.querySelector(".upload-block-info .upload-files").append(this.container);

    this.html = div;
  }

  addDownloadObj(obj){
    const self = this;

    obj.listen(function(uploaded){
      let upload_size = 0;
      for(let i = 0; i < self.download_objs.length; i++){
        let percent = Number(self.download_objs[i].uploaded) / 100;
        upload_size += (percent * self_files[self.download_objs[i].file_name].size);
      }

      upload_size = Math.round((upload_size / self.full_size) * 100);

      self.uploaded_div.style.width = String(upload_size) + "%";
      self.uploaded_num.innerText = String(upload_size) + "%";
    });

    this.full_size += self_files[obj.file_name].size;
    this.download_objs.push(obj);
  }

  static get observedAttributes(){
    return ["conn-id"];
  }

  attributeChangedCallback(name, oldValue, newValue){
    if(name == "conn-id"){
      let found_obj = node_store.nodes.find((item) => {
        return item.conn_id == newValue;
      });
      if(!found_obj){
        // this.error();
        return;
      }

      this.node_obj = found_obj;
      this.init();
    }
  }
}

customElements.define("uploadinfouser-elem", UploadInfoUser);

export {
  UploadInfoComponent
}
// <svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" data-prefix="far" data-icon="check-circle" class="svg-inline--fa fa-check-circle fa-w-16" role="img" viewBox="0 0 512 512"><path fill="currentColor" d="M256 8C119.033 8 8 119.033 8 256s111.033 248 248 248 248-111.033 248-248S392.967 8 256 8zm0 48c110.532 0 200 89.451 200 200 0 110.532-89.451 200-200 200-110.532 0-200-89.451-200-200 0-110.532 89.451-200 200-200m140.204 130.267l-22.536-22.718c-4.667-4.705-12.265-4.736-16.97-.068L215.346 303.697l-59.792-60.277c-4.667-4.705-12.265-4.736-16.97-.069l-22.719 22.536c-4.705 4.667-4.736 12.265-.068 16.971l90.781 91.516c4.667 4.705 12.265 4.736 16.97.068l172.589-171.204c4.704-4.668 4.734-12.266.067-16.971z"/></svg>
