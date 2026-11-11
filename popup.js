const controls=document.getElementById("controls");

function send(action,data={}){
chrome.tabs.query(
{active:true,currentWindow:true},
tabs=>{
chrome.scripting.executeScript({
target:{tabId:tabs[0].id},
files:["content.js"]
},()=>{
chrome.tabs.sendMessage(
tabs[0].id,
{action,...data}
);
});
});
}


manual.onclick=()=>{
send("manual");
controls.classList.add("hidden");
};


auto.onclick=()=>{
send("auto");
controls.classList.remove("hidden");
};


fullpage.onclick=()=>{
send("fullpage");
controls.classList.remove("hidden");
};


// Load a full design image (exported or copied from Figma) as the trace
function saveImageFile(blob){
if(!blob || !blob.type.startsWith("image/"))return;
const reader=new FileReader();
reader.onload=()=>{
chrome.storage.local.set(
{image:reader.result,fullPage:true},
()=>{
controls.classList.remove("hidden");
send("show");
}
);
};
reader.readAsDataURL(blob);
}


upload.onclick=()=>file.click();

file.onchange=()=>{
saveImageFile(file.files[0]);
file.value="";
};

document.addEventListener("paste",e=>{
const item=[...e.clipboardData.items].find(i=>i.type.startsWith("image/"));
if(item){
e.preventDefault();
saveImageFile(item.getAsFile());
}
});


show.onclick=()=>{
send("show");
};


hide.onclick=()=>{
send("hide");
};


clear.onclick=()=>{
send("clear");
controls.classList.add("hidden");
};


opacity.oninput=e=>{
send(
"opacity",
{
value:e.target.value/100
}
);
};


chrome.storage.local.get(
["image"],
data=>{
if(data.image){
controls.classList.remove("hidden");
}
}
);