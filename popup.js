const controls=document.getElementById("controls");

function send(action,data={},callback){
chrome.tabs.query(
{active:true,currentWindow:true},
tabs=>{
chrome.scripting.executeScript({
target:{tabId:tabs[0].id},
files:["content.js"]
},()=>{
if(chrome.runtime.lastError)return;   // e.g. chrome:// pages
chrome.tabs.sendMessage(
tabs[0].id,
{action,...data},
res=>{
void chrome.runtime.lastError;   // no response expected for most actions
if(callback)callback(res);
}
);
});
});
}


// Show / Hide toggle button
function setToggleLabel(visible){
toggle.textContent=visible?"🙈 Hide Overlay":"👁 Show Overlay";
toggle.className=visible?"secondary":"primary";
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
setToggleLabel(true);
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


toggle.onclick=()=>{
send("toggle",{},res=>{
if(res)setToggleLabel(res.visible);
});
};


resetPosition.onclick=()=>{
send("resetPosition");
};


clear.onclick=()=>{
send("clear");
setToggleLabel(false);
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
// Show the right label when the popup opens
send("status",{},res=>{
if(res)setToggleLabel(res.visible);
});
}
}
);