function open_modal(){
  let cookie;
  try{
    cookie = document.cookie.split("; ").find((item) => {return item.startsWith("info_modal=")}).split("=")[1];
  }
  catch{
    cookie = "false";
  }

  if(cookie != "true"){
    document.querySelector("#checkbox-input").checked = false;
    document.querySelector(".block-instructions").style.opacity = 1;
    document.querySelector(".block-instructions").style.zIndex = 999;
  }
  else{
    document.querySelector("#checkbox-input").checked = true;
  }
}
open_modal();

document.querySelector("#checkbox-block").onmouseover = function(){
  document.querySelector(".controll-block .tooltip").style.opacity = 1;
}

document.querySelector("#checkbox-block").onmouseout = function(){
  document.querySelector(".controll-block .tooltip").style.opacity = 0;
}
let checkbox_input = document.querySelector("#checkbox-input");
checkbox_input.onchange = function(){
  document.cookie = "info_modal={}; path=/;".replace("{}", checkbox_input.checked);
}

function close_func(){
  document.querySelector(".block-instructions").style.opacity = 0;
  setTimeout(function(){
    document.querySelector(".block-instructions").style.zIndex = -1;
  }, 500);

}
function back_func(num){
  let block = document.querySelector(".block-instructions");

  block.children[num].style.opacity = 1;
  block.children[num + 1].style.opacity = 0;
  setTimeout(function(){
    block.children[num + 1].style.zIndex = -1;
    block.children[num].style.zIndex = 1;
  }, 500);

}
function next_func(num){
  let block = document.querySelector(".block-instructions");

  block.children[num].style.opacity = 1;
  block.children[num - 1].style.opacity = 0;

  setTimeout(function(){
    block.children[num - 1].style.zIndex = -1;
    block.children[num].style.zIndex = 1;
  }, 500);

  if(num == 3){
    document.querySelector("#preview-video").play();
  }
}
