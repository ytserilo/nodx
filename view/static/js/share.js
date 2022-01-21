let input_block = document.querySelector("#join-link");

function oninput_handler(e){
  let url;
  try{
    url = new URL(input_block.value);
  }
  catch{
    document.querySelector(".join-block .error").style.display = "block";
    return;
  }

  let id_value = url.searchParams.get("id");
  if(id_value == null){
    document.querySelector(".join-block .error").style.display = "block";
    return;
  }
  document.querySelector(".join-block .error").style.display = "none";
}
document.querySelector("#join-btn").onclick = function(){
  let url;
  try{
    url = new URL(input_block.value);
  }
  catch{
    input_block.oninput = oninput_handler;
    document.querySelector(".join-block .error").style.display = "block";
    return;
  }

  let id_value = url.searchParams.get("id");

  if(id_value == null){
    input_block.oninput = oninput_handler;
    document.querySelector(".join-block .error").style.display = "block";
    return;
  }
  document.querySelector(".join-block .error").style.display = "none";
  document.location.href = url;
}
document.querySelector("#copy-to-clipboard").onclick = function(){
  let p_link = document.querySelector("#link");
  let copyTextarea = document.querySelector("#t-link");

  copyTextarea.value = p_link.innerText;
  copyTextarea.focus();
  copyTextarea.select();

  try {
    let successful = document.execCommand('copy');

    document.querySelector(".info-block").setAttribute("style", "opacity: 1; z-index: 2;");
    setTimeout(function(){
      document.querySelector(".info-block").setAttribute("style", "opacity: 0; z-index: -1;");
    }, 1000)

  } catch (err) {
    console.log("error");
  }
}
function share_modal_close(){
  document.querySelector(".share-modal").setAttribute("style", "opacity: 0; z-index: -1;")
}
