import { rtc_connections, normalize_name } from "/src/static/main.js";

let downloads = {};
let open_download = document.querySelector("#open-download");
open_download = open_download.querySelector("svg");

downloads = new Proxy(downloads, {
  set: function(obj, prop, value){
    obj[prop] = value;

    let avg = 0;
    let count = 0;
    for(let key in obj){
      avg += obj[key];
      count += 1;
    }
    if(count == 0){
      avg = 0;
    }
    else{
      avg /= count;
    }


    if(avg == 100){
      open_download.setAttribute("class", "download-btn");
    }
    else{
      open_download.setAttribute("class", "download-btn-anim");
    }
    return true;
  }
});
window.onbeforeunload = function(e){
  let status = 0;
  let count = 0;

  for(let key in downloads){
    status += downloads[key];
    count += 1;
  }
  if(count == 0){
    return;
  }
  status /= count;
  if(status != 100){
    document.querySelector("#open-download").click()
    e.preventDefault();
    let str = "";
    e.returnValue = str;
    return str;
  }
};

class DownloadComponent extends HTMLElement{
  constructor(){
    super();
    this.load_data = {"operation_id": null, "connection_id": null};
  }

  choose_state(mode){
    if(mode == "pause"){
      this.pause_button.setAttribute("style", "display: none;");
      this.resume_button.setAttribute("style", "display: block;");
    }

    else if(mode == "resume"){
      this.pause_button.setAttribute("style", "display: block;");
      this.resume_button.setAttribute("style", "display: none;");
    }
  }

  init(img_src, file_name, size, controll_download){
    const self = this;
    const id = this.load_data.operation_id;
    const connection_id = this.load_data.connection_id;

    let file_download_obj = document.createElement("div");
    file_download_obj.setAttribute("class", "file-download-obj");

    let file_obj = document.createElement("div"); file_obj.setAttribute("class", "file-obj");
    let img = document.createElement("img"); img.src = img_src;
    let file_description = `
      <span style="margin-bottom: 5px;" title="{full_file_name}">{filename}</span>
      <span>{size}</span>`;

    let short_name = normalize_name(file_name);
    file_description = file_description.replace("{full_file_name}", file_name);
    file_description = file_description.replace("{filename}", short_name);
    file_description = file_description.replace("{size}", size);
    let block = document.createElement("div"); block.setAttribute("class", "file-description");
    block.innerHTML = file_description;
    file_obj.append(img); file_obj.append(block);

    this.pause_button = document.createElement("button");
    this.pause_button.onclick = function(){
      self.choose_state("pause");
      controll_download(id, rtc_connections[connection_id], "main-pause");
    }
    this.pause_button.setAttribute("class", "pause");
    this.pause_button.innerHTML = '<svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="pause" class="svg-inline--fa fa-pause fa-w-14" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="currentColor" d="M144 479H48c-26.5 0-48-21.5-48-48V79c0-26.5 21.5-48 48-48h96c26.5 0 48 21.5 48 48v352c0 26.5-21.5 48-48 48zm304-48V79c0-26.5-21.5-48-48-48h-96c-26.5 0-48 21.5-48 48v352c0 26.5 21.5 48 48 48h96c26.5 0 48-21.5 48-48z"></path></svg>';

    this.cencell_button = document.createElement("button");
    this.cencell_button.onclick = function(){
      self.choose_state("cancel");
      controll_download(id, rtc_connections[connection_id], "cancel");
    }
    this.cencell_button.setAttribute("class", "cencell");
    this.cencell_button.innerHTML = '<svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="ban" class="svg-inline--fa fa-ban fa-w-16" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M256 8C119.034 8 8 119.033 8 256s111.034 248 248 248 248-111.034 248-248S392.967 8 256 8zm130.108 117.892c65.448 65.448 70 165.481 20.677 235.637L150.47 105.216c70.204-49.356 170.226-44.735 235.638 20.676zM125.892 386.108c-65.448-65.448-70-165.481-20.677-235.637L361.53 406.784c-70.203 49.356-170.226 44.736-235.638-20.676z"></path></svg>';

    this.resume_button = document.createElement("button");
    this.resume_button.onclick = function(){
      self.choose_state("resume");
      controll_download(id, rtc_connections[connection_id], "main-resume");
    }
    this.resume_button.setAttribute("class", "resume");
    this.resume_button.innerHTML = '<svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="play" class="svg-inline--fa fa-play fa-w-14" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="currentColor" d="M424.4 214.7L72.4 6.6C43.8-10.3 0 6.1 0 47.9V464c0 37.5 40.7 60.1 72.4 41.3l352-208c31.4-18.5 31.5-64.1 0-82.6z"></path></svg>';

    this.pause_button.setAttribute("style", "display: block;");
    this.cencell_button.setAttribute("style", "display: block;");
    this.resume_button.setAttribute("style", "display: none;");
    file_obj.append(this.pause_button); file_obj.append(this.resume_button); file_obj.append(this.cencell_button);

    let progress_block = document.createElement("div");
    progress_block.setAttribute("class", "progress-block");
    progress_block.innerHTML = '<span class="progress"></span><span class="progress-num" style="position: absolute; right: 20px; line-height: 10px;">0%</span>';

    file_download_obj.append(file_obj);
    file_download_obj.append(progress_block);

    this.close_download_btn = document.createElement("button");
    this.close_download_btn.onclick = function(){
      file_download_obj.style.opacity = 0;
      setTimeout(function(){
        self.remove();
        let objs = document.querySelectorAll("download-elem");
        if(objs.length == 0){
          document.querySelector("#download-info").style.opacity = 1;
        }
      }, 300)
    }
    this.close_download_btn.innerHTML = '<svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="times" class="svg-inline--fa fa-times fa-w-11" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 352 512"><path fill="currentColor" d="M242.72 256l100.07-100.07c12.28-12.28 12.28-32.19 0-44.48l-22.24-22.24c-12.28-12.28-32.19-12.28-44.48 0L176 189.28 75.93 89.21c-12.28-12.28-32.19-12.28-44.48 0L9.21 111.45c-12.28 12.28-12.28 32.19 0 44.48L109.28 256 9.21 356.07c-12.28 12.28-12.28 32.19 0 44.48l22.24 22.24c12.28 12.28 32.2 12.28 44.48 0L176 322.72l100.07 100.07c12.28 12.28 32.2 12.28 44.48 0l22.24-22.24c12.28-12.28 12.28-32.19 0-44.48L242.72 256z"></path></svg>';
    this.close_download_btn.setAttribute("class", "close-download-btn");
    this.close_download_btn.setAttribute("style", "display: none;");
    file_download_obj.append(this.close_download_btn);

    this.html = file_download_obj;
    downloads[id] = 0;
  }

  drop_buttons(){
    this.pause_button.setAttribute("style", "display: none;");
    this.cencell_button.setAttribute("style", "display: none;");
    this.resume_button.setAttribute("style", "display: none;");
  }

  finish(){
    downloads[this.load_data.operation_id] = 100;
    this.close_download_btn.setAttribute("style", "display: block;");
    if(this.querySelector(".progress-num").innerText != "100%"){
      this.error();
    }
    else{
      this.success();
    }
  }

  success(){
    this.drop_buttons();
    // create success modal
  }

  error(){
    this.drop_buttons();
    // create error modal
  }

  connectedCallback(){
    this.append(this.html);
  }

  static get observedAttributes() {
    return ["operation_id", "connection_id", "downloaded"];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if(["operation_id", "connection_id"].indexOf(name) != -1){
      this.load_data[name] = newValue;
    }
    else if(name == "downloaded"){
      downloads[this.load_data.operation_id] = Number(newValue);
      this.querySelector(".progress-num").innerText = String(newValue) + "%";
      this.querySelector(".progress").style.width = String(newValue * 0.75) + "%";
    }

  }
}

export {
  DownloadComponent
}
