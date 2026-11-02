"use strict";
const form=document.getElementById("nav");
const address=document.getElementById("address");
const frame=document.getElementById("view");
const welcome=document.getElementById("welcome");
const state=document.getElementById("state");
const tabsNode=document.getElementById("tabs");
const connection=new BareMux.BareMuxConnection("/baremux/worker.js");
const searchTemplate="https://www.google.com/search?q=%s";
let tabs=[{title:"New tab",url:"",history:[],position:-1}];
let active=0;
function current(){return tabs[active]}
function setStatus(message){state.textContent=message}
function resolve(input){
  const value=input.trim();
  if(!value) return "";
  try { const u=new URL(value); if(["http:","https:"].includes(u.protocol)) return u.href; } catch {}
  try { const u=new URL("https://"+value); if(u.hostname.includes(".")) return u.href; } catch {}
  return searchTemplate.replace("%s",encodeURIComponent(value));
}
async function navigate(value,add=true){
  const url=resolve(value);
  if(!url) return;
  setStatus("Connecting…");
  try{
    await navigator.serviceWorker.register("/uv/sw.js");
    const wisp=(location.protocol==="https:"?"wss:":"ws:")+"//"+location.host+"/wisp/";
    if((await connection.getTransport())!=="/epoxy/index.mjs") await connection.setTransport("/epoxy/index.mjs",[{wisp}]);
    const tab=current();
    if(add){tab.history=tab.history.slice(0,tab.position+1);tab.history.push(url);tab.position++;}
    tab.url=url;
    address.value=url;
    welcome.classList.add("hidden");
    frame.style.display="block";
    frame.src=__uv$config.prefix+__uv$config.encodeUrl(url);
    tab.title=new URL(url).hostname;
    renderTabs();
    setStatus("Loading "+new URL(url).hostname);
  }catch(error){setStatus("Could not start browser: "+error.message);}
}
function renderTabs(){
  tabsNode.innerHTML="";
  tabs.forEach((tab,index)=>{
    const b=document.createElement("button");
    b.className="tab"+(index===active?" active":"");
    b.textContent=tab.title;
    b.onclick=()=>{active=index;address.value=current().url;renderTabs();if(current().url){welcome.classList.add("hidden");frame.style.display="block";frame.src=__uv$config.prefix+__uv$config.encodeUrl(current().url);}else{frame.style.display="none";welcome.classList.remove("hidden");}};
    tabsNode.appendChild(b);
  });
}
form.addEventListener("submit",event=>{event.preventDefault();navigate(address.value);});
document.getElementById("newtab").onclick=()=>{tabs.push({title:"New tab",url:"",history:[],position:-1});active=tabs.length-1;address.value="";frame.style.display="none";welcome.classList.remove("hidden");renderTabs();};
document.getElementById("back").onclick=()=>{const t=current();if(t.position>0){t.position--;navigate(t.history[t.position],false);}};
document.getElementById("forward").onclick=()=>{const t=current();if(t.position<t.history.length-1){t.position++;navigate(t.history[t.position],false);}};
document.getElementById("reload").onclick=()=>{if(current().url)frame.src=__uv$config.prefix+__uv$config.encodeUrl(current().url);};
document.getElementById("logout").onclick=async()=>{await fetch("/api/logout",{method:"POST"});location.replace("/login");};
frame.addEventListener("load",()=>setStatus(current().url?"Loaded "+new URL(current().url).hostname:"Ready"));
document.querySelectorAll("[data-url]").forEach(button=>button.addEventListener("click",()=>navigate(button.dataset.url)));
renderTabs();
