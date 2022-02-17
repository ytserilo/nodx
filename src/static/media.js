let radius = 180;
let length = 280;
function get_shader(tp, id, gl){
  let shader;
  if(tp == "vertex"){
    shader = gl.createShader(gl.VERTEX_SHADER);
  }
  else{
    shader = gl.createShader(gl.FRAGMENT_SHADER);
  }

  gl.shaderSource(shader, document.querySelector(id).innerText);
  gl.compileShader(shader);

  return shader;
}

function create_program(gl, vertex_shader_id, fragment_shader_id){
  let vertex_shader = get_shader("vertex", vertex_shader_id, gl);
  let fragment_shader = get_shader("fragment", fragment_shader_id, gl);

  let program = gl.createProgram();
  gl.attachShader(program, vertex_shader);
  gl.attachShader(program, fragment_shader);

  gl.linkProgram(program);
  return program;
}

class NodeStore{
  constructor(gl){
    this.gl = gl;
    this.nodes = [];
  }

  get_buffer(){
    let data = [];
    let r = radius / 2;
    for(let i = 0; i < this.nodes.length; i++){
      let coords = [
        this.nodes[i].x - r, this.nodes[i].y - r, 0,
        this.nodes[i].x + r, this.nodes[i].y - r, 0,
        this.nodes[i].x + r, this.nodes[i].y + r, 0,
        this.nodes[i].x - r, this.nodes[i].y + r, 0,
      ];
      data.push(coords);
    }

    return data;
  }

  async add_node(node){
    let background_color = node.color; // use random for colors
    let texture_img = await loadImage("/static/img/users/" + node.image, node.conn_id == "self", background_color);

    let node_texture = createTexture(this.gl, texture_img);
    node.ready_img = texture_img;
    node.texture = node_texture;
    node.back_color = background_color;
    this.nodes.push(node);
  }
}

function createTexture(gl, img){
  let level = 0;
  let internalFormat = gl.RGBA;
  let srcFormat = gl.RGBA;
  let srcType = gl.UNSIGNED_BYTE;

  let texture = gl.createTexture();
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.bindTexture(gl.TEXTURE_2D, texture);


  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

  gl.bindTexture(gl.TEXTURE_2D, null);

  return texture;
}

function draw_label(label){
  let canvas = document.createElement("canvas");
  canvas.width = 1024; canvas.height = 1024;
  let ctx = canvas.getContext("2d");

  let test_char = document.querySelector("#test-char");
  let style = window.getComputedStyle(test_char, null).getPropertyValue('font-size');
  let fontSize = parseFloat(style);

  let rect = test_char.getBoundingClientRect();
  let wx = (rect.width * label.length) / 2;
  let wy = rect.height;

  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, 1024, 1024);

  ctx.font = "{}px monospace".replace("{}", fontSize / (scale_factor / -1280)); // 180
  ctx.fillStyle = "white";

  let nx = 1024 / 2 - wx * 1.5;
  let ny = 1024 - (wy / 2);

  ctx.fillText(label, nx, ny);
  return ctx;
}

async function loadImage(img_src, self_node=false, back_color=[255, 95, 95, 255]){
  let img = new Image();
  img.width = 1024;
  img.height = 1024;


  let label_ctx;
  if(self_node){
    label_ctx = draw_label("YOU");
  }

  let promise = new Promise((resolve, reject) => {
    img.onload = function(){
      let test_canvas = document.createElement("canvas");
      test_canvas.width = 1024; test_canvas.height = 1024;

      let test_ctx = test_canvas.getContext("2d");
      test_ctx.drawImage(img, 0, 0, img.width, img.height);


      let img_data = test_ctx.getImageData(0, 0, test_canvas.width, test_canvas.height);
      img_data = img_data.data;



      let center = {"x": test_canvas.width / 2, "y": test_canvas.height / 2}
      for(let row = 0; row < test_canvas.height; row++){
        let start_index = row * (test_canvas.width * 4);

        for(let i = 0; i < test_canvas.width * 4; i += 4){
          let x = row; let y = i / 4;

          let idx = start_index + i;
          let rgba = img_data.slice(idx, idx + 4);
          if(rgba[0] == 37 && rgba[1] == 180 && rgba[2] == 90){
            img_data[idx] = 0;
            img_data[idx + 1] = 0;
            img_data[idx + 2] = 0;
            img_data[idx + 3] = 0;
          }
          else{
            continue;
          }

          let ln = Math.sqrt((x - center.x)**2 + (y - center.y)**2);
          if(ln < (test_canvas.width / 2)){
              img_data[idx] = back_color[0];
              img_data[idx + 1] = back_color[1];
              img_data[idx + 2] = back_color[2];
              img_data[idx + 3] = back_color[3];
          }
          else{
            img_data[idx] = 0;
            img_data[idx + 1] = 0;
            img_data[idx + 2] = 0;
            img_data[idx + 3] = 0;
          }
        }
      }

      if(self_node){
        let label_data = label_ctx.getImageData(0, 0, 1024, 1024);
        label_data = label_data.data;
        for(let row = 0; row < test_canvas.height; row++){
          let start_index = row * (test_canvas.width * 4);

          for(let i = 0; i < test_canvas.width * 4; i += 4){
            let x = row; let y = i / 4;

            let idx = start_index + i;
            let rgba = label_data.slice(idx, idx + 4);
            if(rgba[0] == 255 && rgba[1] == 255 && rgba[2] == 255){
              img_data[idx] = 255;
              img_data[idx + 1] = 255;
              img_data[idx + 2] = 255;
              img_data[idx + 3] = 255;
            }
            else{
              continue;
            }
          }
        }
      }



      test_ctx.clearRect(0, 0, test_canvas.width, test_canvas.height);

      let image_data = new ImageData(img_data, test_canvas.width, test_canvas.height);
      test_ctx.putImageData(image_data, 0, 0);

      let new_img = new Image();
      new_img.onload = function(){
        resolve(new_img);
      }
      new_img.src = test_canvas.toDataURL();
    }
  });

  img.src = img_src;
  return promise;
}

let proj_matrix;
let view_matrix = mat4.create();

class LineProgram{
  constructor(gl){
    this.gl = gl;
    this.program = create_program(this.gl, "#vertex-shader-lines", "#fragment-shader-lines");
    this.attrs = {};
    this.uniforms = {};

    this.vertices_buffer = this.gl.createBuffer(this.gl.ARRAY_BUFFER);
  }

  init(){
    this.gl.useProgram(this.program);
    this.attrs.aPosition = this.gl.getAttribLocation(this.program, "aPosition");
    this.gl.enableVertexAttribArray(this.attrs.aPosition);

    this.uniforms.VMatrix = gl.getUniformLocation(this.program, "VMatrix");
    this.uniforms.PMatrix = gl.getUniformLocation(this.program, "PMatrix");
    gl.uniformMatrix4fv(this.uniforms.PMatrix, false, proj_matrix);
  }

  draw(lines_data, count_lines){
    this.gl.useProgram(this.program);

    this.gl.uniformMatrix4fv(this.uniforms.VMatrix, false, view_matrix);
    this.gl.uniformMatrix4fv(this.uniforms.PMatrix, false, proj_matrix);

    this.gl.bindBuffer(gl.ARRAY_BUFFER, this.vertices_buffer);
    this.gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(lines_data), gl.STATIC_DRAW);
    this.gl.vertexAttribPointer(this.attrs.aPosition, 3, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.LINES, 0, count_lines * 2);
  }
}

let mouse = {"x": 0, "y": 0};
class PickProgram{
  constructor(gl){
    this.gl = gl;
    this.program = create_program(this.gl, "#pick-vertex-shader", "#pick-fragment-shader");

    this.attrs = {};
    this.uniforms = {};
  }

  createFramebuffer(){
    let fb = this.gl.createFramebuffer();
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, fb);

    let texture = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);

    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D, 0, this.gl.RGBA,
      this.gl.drawingBufferWidth,
      this.gl.drawingBufferHeight, 0,
      this.gl.RGBA, this.gl.UNSIGNED_BYTE, null
    );

    this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, texture, 0);

    this.gl.bindTexture(this.gl.TEXTURE_2D, null);
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);

    return fb;
  }

  init(){
    this.gl.useProgram(this.program);
    this.fb = this.createFramebuffer();

    this.attrs.aPosition = this.gl.getAttribLocation(this.program, "aPosition");
    this.gl.enableVertexAttribArray(this.attrs.aPosition);

    this.uniforms.VMatrix = this.gl.getUniformLocation(this.program, "VMatrix");
    this.uniforms.PMatrix = this.gl.getUniformLocation(this.program, "PMatrix");
    this.gl.uniformMatrix4fv(this.uniforms.PMatrix, false, proj_matrix);

    this.uniforms.pick_color = this.gl.getUniformLocation(this.program, "pick_color");
    this.uniforms.top_left_corner_coords = this.gl.getUniformLocation(this.program, "top_left_corner_coords");
    this.uniforms.radius = this.gl.getUniformLocation(this.program, "radius");

    this.gl.uniform1f(this.uniforms.radius, radius / 2);

    this.vertices_buffer = this.gl.createBuffer(this.gl.ARRAY_BUFFER);
    this.indices_buffer = this.gl.createBuffer(this.gl.ELEMENT_ARRAY_BUFFER);
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indices_buffer);
    this.gl.bufferData(
      this.gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array([0, 1, 2, 2, 3, 0]),
      this.gl.STATIC_DRAW
    );
    this.gl.useProgram(null);
  }

  draw(vertices){

    this.gl.useProgram(this.program);
    this.gl.uniformMatrix4fv(this.uniforms.VMatrix, false, view_matrix);
    this.gl.uniformMatrix4fv(this.uniforms.PMatrix, false, proj_matrix);

    for(let i = 0; i < vertices.length; i++){

      let color_normalize = [
        node_store.nodes[i].unique_id_color[0] / 255,
        node_store.nodes[i].unique_id_color[1] / 255,
        node_store.nodes[i].unique_id_color[2] / 255
      ];

      this.gl.uniform3fv(this.uniforms.pick_color, color_normalize); // in rgba
      this.gl.uniform2fv(this.uniforms.top_left_corner_coords, [vertices[i][0], vertices[i][1]]);

      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertices_buffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(vertices[i]), this.gl.STATIC_DRAW);
      this.gl.vertexAttribPointer(this.attrs.aPosition, 3, gl.FLOAT, false, 0, 0);

      this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indices_buffer);
      this.gl.drawElements(this.gl.TRIANGLES, 6, this.gl.UNSIGNED_SHORT, 0);
    }
    this.gl.useProgram(null);
  }
}

class MainProgram{
  constructor(gl){
    this.gl = gl;
    this.program = create_program(this.gl, "#vertex-shader", "#fragment-shader");

    this.attrs = {};
    this.uniforms = {};
  }

  init(){
    this.gl.useProgram(this.program);

    this.attrs.aPosition = this.gl.getAttribLocation(this.program, "aPosition");
    this.gl.enableVertexAttribArray(this.attrs.aPosition);
    this.attrs.uv_coords = this.gl.getAttribLocation(this.program, "a_texture_coords");
    this.gl.enableVertexAttribArray(this.attrs.uv_coords);

    this.uv_buffer = this.gl.createBuffer(this.gl.ARRAY_BUFFER);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.uv_buffer);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array([0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0]),
      this.gl.STATIC_DRAW
    );
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);

    this.uniforms.VMatrix = gl.getUniformLocation(this.program, "VMatrix");
    this.uniforms.PMatrix = gl.getUniformLocation(this.program, "PMatrix");
    this.gl.uniformMatrix4fv(this.uniforms.PMatrix, false, proj_matrix);

    this.uniforms.sampler = gl.getUniformLocation(this.program, "uSampler");
    gl.uniform1i(this.uniforms.sampler, 0);

    this.vertices_buffer = this.gl.createBuffer(this.gl.ARRAY_BUFFER);

    this.indices_buffer = this.gl.createBuffer(this.gl.ELEMENT_ARRAY_BUFFER);
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indices_buffer);
    this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([
      0, 1, 2, 2, 3, 0
    ]), this.gl.STATIC_DRAW);

    this.gl.useProgram(null);
  }

  draw(vertices){
    this.gl.useProgram(this.program);

    this.gl.uniformMatrix4fv(this.uniforms.VMatrix, false, view_matrix);
    this.gl.uniformMatrix4fv(this.uniforms.PMatrix, false, proj_matrix);

    for(let i = 0; i < vertices.length; i++){
      this.gl.activeTexture(this.gl.TEXTURE0);
      this.gl.bindTexture(this.gl.TEXTURE_2D, node_store.nodes[i].texture);

      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertices_buffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(vertices[i]), this.gl.STATIC_DRAW);
      this.gl.vertexAttribPointer(this.attrs.aPosition, 3, gl.FLOAT, false, 0, 0);

      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.uv_buffer);
      this.gl.vertexAttribPointer(this.attrs.uv_coords, 2, gl.FLOAT, false, 0, 0);

      this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indices_buffer);
      this.gl.drawElements(this.gl.TRIANGLES, 6, this.gl.UNSIGNED_SHORT, 0);
    }
    this.gl.useProgram(null);
  }
}

let scale_factor = -800;
function scene(ctx, gl, node_store, callback){
  proj_matrix = mat4.perspective(40, canvas.width / canvas.height, 0.001, 10000);
  let lines = new LineProgram(gl); lines.init();
  let pick_program = new PickProgram(gl); pick_program.init();
  let main_program = new MainProgram(gl); main_program.init();

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.clearDepth(1.0);


  let devicePixelRatio = window.devicePixelRatio || 1;
  return function(){ // draw function
    //if()
    proj_matrix = mat4.perspective(40, canvas.width / canvas.height, 0.001, 10000);
    mat4.identity(view_matrix);
    mat4.translate(view_matrix, [0, 0, scale_factor]);

    gl.clearColor(1.0, 1.0, 1.0, 0.0);
    gl.clear(gl.COLOR_BUFFER_BIT || gl.DEPTH_BUFFER_BIT);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let vertices = node_store.get_buffer();

    let lines_data = [];
    let count_lines = 0;
    for(let i = 0; i < node_store.nodes.length; i++){
      for(let j = 0; j < node_store.nodes.length; j++){
        if(i == j){
          continue;
        }

        let index = j;
        try{
          let line = [
            node_store.nodes[i].x,
            node_store.nodes[i].y,
            0,
            node_store.nodes[index].x,
            node_store.nodes[index].y,
            0
          ];
          count_lines += 1;
          lines_data.push(...line);
        }
        catch{
          continue;
        }

      }
    }

    lines.draw(lines_data, count_lines);

    //gl.bindFramebuffer(gl.FRAMEBUFFER, pick_program.fb);
    pick_program.draw(vertices);
    var pixel = new Uint8Array(4);

    gl.readPixels(mouse.x, canvas.height - mouse.y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    callback(pixel);

    //gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    main_program.draw(vertices);
  }
}

const canvas = document.querySelector("#canvas");
const text_canvas = document.querySelector("#text-canvas");
let gl;
let ctx;

function change_size(){
  let rect = canvas.getBoundingClientRect();

  //canvas.style.width = rect.width + "px";
  //canvas.style.height = rect.height + "px";

  let devicePixelRatio = window.devicePixelRatio || 1;
  canvas.width = rect.width * devicePixelRatio;
  canvas.height = rect.height * devicePixelRatio;

  text_canvas.width = canvas.width; text_canvas.height = canvas.height;
  //text_canvas.style.width = canvas.style.width; text_canvas.style.height = canvas.style.height;

  gl = canvas.getContext("webgl", {alpha: true});
  ctx = text_canvas.getContext("2d");

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.clearDepth(1.0);
}
change_size();
window.addEventListener("resize", function(){
  change_size();
})
const node_store = new NodeStore(gl);


function round(num, c){
  let arr = String(num).split(".");

  try{
    let num2 = arr[1].slice(0, c);
    return Number(arr[0] + "." + num2);
  }
  catch{
    return num;
  }

}

function verlet(from, to, speed){
  let dx = to.x - from.x;
  let dy = to.y - from.y;
  let ln = Math.sqrt(dx**2 + dy**2);
  dx /= ln; dy /= ln;

  if(from.last_x == undefined){
    from.last_x = from.x;
    from.last_y = from.y;
  }

  let vert_x = (from.x - from.last_x) / 1.5;
  let vert_y = (from.y - from.last_y) / 1.5;

  let next_x = from.x + vert_x + dx * speed;
  let next_y = from.y + vert_y + dy * speed;

  from.last_x = from.x;
  from.last_y = from.y;

  from.x = next_x;
  from.y = next_y;
}

function magnit(from, to){
  let dx = to.x - from.x;
  let dy = to.y - from.y;
  let ln = Math.sqrt(dx**2 + dy**2);
  dx /= ln; dy /= ln;

  dx *= (ln * 0.01);
  dy *= (ln * 0.01);

  from.last_x = from.x;
  from.last_y = from.y;
  if(typeof(dx) != "number" || typeof(dy) != "number"){
    return;
  }
  from.x += dx;
  from.y += dy;

}
let node_index = 0;
let n_index = false;
let stop = false;
let exception_index = undefined;
let touchdown = false;

function use_new_index(){

  if(exception_index == undefined){
     node_index = Math.floor(Math.random() * node_store.nodes.length);
  }
  else{
    node_index = exception_index;
  }

  setTimeout(use_new_index, 1000 + (Math.random() * (1000 * 5)))
}
setTimeout(use_new_index, 0);


function life(){
  let ln = 0;
  if(node_store.nodes.length < 1){
    return;
  }

  let center = {
    "x": 0,
    "y": 0
  };
  if(exception_index == undefined){
    try{
      magnit(node_store.nodes[node_index], center);
    }
    catch{}
  }


  for(let i = 0; i < node_store.nodes.length; i++){
    if(i == node_index){
      continue;
    }
    let index = i;

    //magnit(nodes[index], nodes[node_index]);
    verlet(node_store.nodes[index], node_store.nodes[node_index], 0.5);

    relaxation(node_store.nodes[index], node_store.nodes[node_index]);

    for(let j = 0; j < node_store.nodes.length; j++){
      let idx = j;
      if(idx == node_index || idx == index){continue}

      relaxation(node_store.nodes[idx], node_store.nodes[index]);
      // nodes[idx]
    }


  }

}


function m(){
  if(node_store.nodes.length < 1){
    return;
  }

  for(let i = 0; i < node_store.nodes.length; i++){
    if(node_index == i){
      continue;
    }
    magnit(node_store.nodes[i], node_store.nodes[node_index]);
  }
}

function relaxation(obj1, obj2){
  let dx = obj1.x - obj2.x;
  let dy = obj1.y - obj2.y;
  let ln = Math.sqrt(dx**2 + dy**2);

  if(ln >= length){return}

  let muller = 0.2;
  let diff = (length - ln) / ln;
  let translateX = dx * muller * diff;
  let translateY = dy * muller * diff;

  obj1.x += translateX;
  obj1.y += translateY;
}


function onWheel(e){
  e = e || window.event;
  let delta = e.deltaY || e.detail || e.wheelDelta;

  if(scale_factor - delta > -700){
    scale_factor = -700;
  }
  else if(scale_factor - delta < -4000){
    scale_factor = -4000;
  }
  scale_factor -= delta;
}
if (text_canvas.addEventListener) {
  if ('onwheel' in document) {
    // IE9+, FF17+, Ch31+
    text_canvas.addEventListener("wheel", onWheel);
  } else if ('onmousewheel' in document) {
    // устаревший вариант события
    text_canvas.addEventListener("mousewheel", onWheel);
  } else {
    // Firefox < 17
    text_canvas.addEventListener("MozMousePixelScroll", onWheel);
  }
} else { // IE8-
  text_canvas.attachEvent("onmousewheel", onWheel);
}


let images = [
  "alien.png", "bull.png", "cat.png",  "cat1.png",
  "cat2.png", "deer.png", "deer1.png", "Devil.png", "Devil1.png", "frog.png",
  "frog1.png", "Ghost.png", "Ghost1.png",
  "pig.png", "pumpkin.png", "skull.png", "skull1.png"
];

let unique_colors = [];
function gen_color(){
  const max = 65535;
  let value = Math.floor(Math.random() * 65535);

  let result = new Uint8Array(3);
  result[0] = (value & 0x000000ff);
  result[1] = (value & 0x0000ff00) >> 8;

  for(let i = 0; i < unique_colors.length; i++){
    let dataview = new DataView(unique_colors[i].buffer);

    if(value == dataview.getUint16(0, true)){
      return gen_color();
    }
  }
  unique_colors.push(result);
  return result;
}


text_canvas.addEventListener("contextmenu", function(e){ e.preventDefault() });

function move_event(e){
  let devicePixelRatio = window.devicePixelRatio || 1;

  let current_x = e.offsetX * devicePixelRatio;
  let current_y = e.offsetY * devicePixelRatio;

  mouse.x = current_x;
  mouse.y = current_y;

  mouse.offsetX = e.offsetX;
  mouse.offsetY = e.offsetY;

  if(n_index === false){
    text_canvas.style.cursor = "default";
    return;
  }
  else{
    if(node_store.nodes[n_index].conn_id == "self"){
      text_canvas.style.cursor = "help";
    }
    else{
      text_canvas.style.cursor = "pointer";
    }
  }

  if(touchdown == false){
    return;
  }

  exception_index = n_index;

  let current_height = canvas.height / devicePixelRatio;
  let current_width = canvas.width / devicePixelRatio;

  let pos_x = (e.offsetX - (current_width / 2)) * (scale_factor / -1200);
  let pos_y = ((current_height / 2) - e.offsetY) * (scale_factor / -1200);

  node_store.nodes[n_index].x = pos_x;
  node_store.nodes[n_index].y = pos_y;
}
let scaling = false;

let pinchMove = function(e){}

function pinchStart(e){
  let start_dist = Math.hypot(
    e.touches[0].pageX - e.touches[1].pageY,
    e.touches[0].pageY - e.touches[1].pageY
  );

  return function(e){
    const current_dist = Math.hypot(
      e.touches[0].pageX - e.touches[1].pageY,
      e.touches[0].pageY - e.touches[1].pageY
    );
    let delta = (current_dist - start_dist) * 4;
    start_dist = current_dist;

    if(scale_factor + delta > -700){
      scale_factor = -700;
      return;
    }
    else if(scale_factor + delta < -4000){
      scale_factor = -4000;
      return;
    }
    scale_factor += delta;
  }
}
text_canvas.onmousemove = function(e){
  move_event(e);
}
text_canvas.ontouchmove = function(e){
  if(scaling){
    pinchMove(e);
    return;
  }
  e.offsetX = e.touches[0].pageX;
  e.offsetY = e.touches[0].pageY;

  move_event(e)
}

function touchdown_handler(e, mode="mouse"){
  if(mode == "mouse"){
    let isRightMB;
    e = e || window.event;

    if ("which" in e){
      isRightMB = e.which == 3;
    }
    else if("button" in e){
      isRightMB = e.button == 2;
    }

    if(!isRightMB){
      touchdown = false;
      return;
    }
  }
  touchdown = true;

  if(n_index === false){
    return;
  }

  exception_index = n_index;
  node_index = n_index;

  let devicePixelRatio = window.devicePixelRatio || 1;

  let current_height = canvas.height / devicePixelRatio;
  let current_width = canvas.width / devicePixelRatio;

  function func(){
    let pos_x = (mouse.offsetX - (current_width / 2)) * (scale_factor / -1200);
    let pos_y = ((current_height / 2) - mouse.offsetY) * (scale_factor / -1200);

    node_store.nodes[n_index].x = pos_x;
    node_store.nodes[n_index].y = pos_y;

    for(let i = 0; i < node_store.nodes.length; i++){
      if(n_index == i){ continue }
      let index = i;

      magnit(node_store.nodes[index], node_store.nodes[n_index]);
    }

    if(!stop){
      requestAnimationFrame(func);
    }
  }
  if(mode == "touch"){
    return;
  }
  func();
}
let mouse_mode = true;
text_canvas.ontouchstart = function(e){
  mouse_mode = false;
  if(e.touches.length == 2){
    scaling = true;
    pinchMove = pinchStart(e);
    return;
  }

  e.offsetX = e.touches[0].pageX;
  e.offsetY = e.touches[0].pageY;

  let devicePixelRatio = window.devicePixelRatio || 1;
  let current_x = e.offsetX * devicePixelRatio;
  let current_y = e.offsetY * devicePixelRatio;

  mouse.x = current_x;
  mouse.y = current_y;

  mouse.offsetX = e.offsetX;
  mouse.offsetY = e.offsetY;

  touchdown_handler(e, "touch");
}
text_canvas.onmousedown = function(e){
  if(!("ontouchstart" in window)){
    touchdown_handler(e, "mouse");
  }
}

function open_user_modal(){
  if(n_index !== false){
    if(node_store.nodes[n_index].conn_id == "self"){
      let upload_block_info = document.querySelector(".upload-block-info");
      upload_block_info.style.zIndex = 999;
      upload_block_info.style.opacity = 1;
    }
    else{
      let arr = Array.from(document.querySelectorAll("files-elem"));
      let obj = arr.find((item) => {
        return item.getAttribute("conn-id") == node_store.nodes[n_index].conn_id;
      });

      if(obj){
        obj.setAttribute("style", "opacity: 1; z-index: 1;");
        document.querySelector(".users-files").setAttribute("style", "opacity: 1; z-index: 9999;");
      }
    }
  }
}

text_canvas.onmouseup = function(e){
  if("ontouchstart" in window){
    return;
  }
  let isRightMB;
  e = e || window.event;

  if ("which" in e){
    isRightMB = e.which == 3;
  }
  else if("button" in e){
    isRightMB = e.button == 2;
  }
  if(!isRightMB){
    open_user_modal();
  }
  touchdown = false;
  stop = true;
  n_index = false;
  exception_index = undefined;
}

let mylatesttap;
function doubletap() {
  if(mylatesttap == undefined){
    mylatesttap = new Date().getTime();
    return;
  }
  var now = new Date().getTime();
  var timesince = now - mylatesttap;
  if((timesince < 600) && (timesince > 0)){
    open_user_modal()
  }

  mylatesttap = new Date().getTime();
}

text_canvas.onmouseout = function(){
  if(!("ontouchstart" in window)){
    touchdown = false;
    stop = true;
    n_index = false;
    exception_index = undefined;
  }
}
text_canvas.ontouchcancel = function(e){
  touchdown = false;
  stop = true;
  n_index = false;
  exception_index = undefined;
}
text_canvas.ontouchend = function(e){
  if(scaling){
    scaling = false;
  }
  doubletap();

  touchdown = false;
  stop = true;
  n_index = false;
  exception_index = undefined;
}
// node_store.add_node(node_data);
let draw = scene(ctx, gl, node_store, function(pixel){
  if("ontouchstart" in window){
    let data_view = new DataView(pixel.buffer);

    for(let i = 0; i < node_store.nodes.length; i++){
      let node_color = new DataView(node_store.nodes[i].unique_id_color.buffer);
      if(node_color.getUint16(0, true) == data_view.getUint16(0, true)){
        n_index = i;
        node_index = i;
        stop = false;
        canvas.addEventListener("touchend", function touchend_handler(){
          stop = true;
          canvas.removeEventListener("touchend", touchend_handler);
        });
        return;
      }
    }
  }
  else{
    if(touchdown){return}

    let data_view = new DataView(pixel.buffer);

    for(let i = 0; i < node_store.nodes.length; i++){
      let node_color = new DataView(node_store.nodes[i].unique_id_color.buffer);
      if(node_color.getUint16(0, true) == data_view.getUint16(0, true)){
        n_index = i;
        return;
      }
    }

    n_index = false;
  }

});



let fpsInterval, startTime, now, then, elapsed;

function check_on_normal_num(num){
  if(num == Infinity){ console.log(num); return false }
  else if(typeof(num) != "number"){ console.log(num);return false }

  return true;
}
let tasks = [];
async function animate() {
  requestAnimationFrame(animate);

  now = Date.now();
  elapsed = now - then;

  if(elapsed > fpsInterval){
    then = now - (elapsed % fpsInterval);
    if(tasks.length != 0){
      let t = tasks.splice(0, 1);
      await t[0]();
    }
    try{
      draw();
      life();
      m();
    }catch{}
  }
}

function startAnimating(fps) {
    fpsInterval = 1000 / fps;
    then = Date.now();
    startTime = then;
    animate();
}
startAnimating(60);

export {
  node_store,
  gen_color,
  images,
  loadImage,
  tasks
}
