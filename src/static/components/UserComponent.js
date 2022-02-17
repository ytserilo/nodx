import { Files, FileComponent } from "/src/static/components/FileComponent.js";
import { node_store, images, gen_color, tasks } from "/src/static/media.js";

let canvas = document.querySelector("#canvas");

function remove_node(conn_id){
  tasks.push(function(){
    let index = -1;
    for(let i = 0; i < node_store.nodes.length; i++){
      if(node_store.nodes[i].conn_id == conn_id){
        index = i;
      }
    }
    if(index == -1){ return }

    node_store.nodes.splice(index, 1);
  });
}

async function add_node(conn_id, color, img_file_name){
  tasks.push(async function(){
    const ln = node_store.nodes.length;
    let promise = new Promise(async function(resolve, reject){
      await node_store.add_node({
        "x": (Math.random() * 0.5 - 0.25) * (canvas.width / 2),
        "y": (Math.random() * 0.5 - 0.25) * (canvas.height / 2),
        "image": img_file_name,
        "conn_id": conn_id,
        "color": color,
        "unique_id_color": gen_color()
      }).then(function(){
        resolve(true);
      });
    });

    return promise;
  });

}


customElements.define("files-elem", Files);
customElements.define("file-elem", FileComponent);

class UserComponent extends HTMLElement{
  constructor(){
    super();
  }

  connectedCallback(){
    this.addFiles = function(files){
      let arr = [];
      for(let key in files){
        let f = document.createElement("file-elem");
        f.setAttribute("file-name", key);
        f.setAttribute("conn-id", this.conn_id);
        f.setAttribute("size", files[key].size);

        arr.push(f);
      }

      this.files.addFiles(arr);
    }

    this.files = document.createElement("files-elem");
    this.files.setAttribute("conn-id", this.conn_id);
    this.files.setAttribute("style", "display: none;");
    document.querySelector(".users-files").append(this.files);
  }

  static get observedAttributes() {
    return ["conn-id"];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if(name == "conn-id"){ this.conn_id = newValue; }
  }

  disconnectedCallback() {
   this.files.remove();
  }
}

export {
  UserComponent,
  add_node,
  remove_node
}
