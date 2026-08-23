const $=selector=>document.querySelector(selector);
const loginCard=$('#loginCard'),sessionButton=$('#sessionButton'),loginForm=$('#loginForm');
const yearSelect=$('#yearSelect'),loadButton=$('#loadButton'),gallery=$('#gallery');
const statusText=$('#statusText'),emptyState=$('#emptyState'),viewer=$('#viewer');
let connected=false;

for(let year=new Date().getFullYear();year>=2022;year--){
  const option=document.createElement('option');option.value=year;option.textContent=`${year}년`;yearSelect.append(option);
}

function setStatus(text,error=false){statusText.textContent=text;statusText.style.color=error?'#b3443c':'';}
function setConnected(value){connected=value;sessionButton.textContent=value?'계정 변경':'로그인';loginCard.hidden=value;}

async function checkSession(){
  try{const response=await fetch('/api/kidsnote/session',{cache:'no-store'});const data=await response.json();setConnected(Boolean(data.connected));if(data.connected)setStatus('연도를 선택해 사진을 불러오세요.');}
  catch{setConnected(false);setStatus('서버 연결을 확인하지 못했습니다.',true);}
}

sessionButton.addEventListener('click',async()=>{
  if(connected){await fetch('/api/kidsnote/session',{method:'DELETE'});setConnected(false);gallery.replaceChildren();emptyState.hidden=false;}
  else loginCard.hidden=!loginCard.hidden;
});

loginForm.addEventListener('submit',async event=>{
  event.preventDefault();const button=loginForm.querySelector('button');button.disabled=true;button.textContent='연결 중…';
  try{
    const response=await fetch('/api/kidsnote/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:$('#username').value,password:$('#password').value})});
    const data=await response.json();if(!response.ok)throw new Error(data.error||'로그인에 실패했습니다.');
    $('#password').value='';setConnected(true);setStatus('연결되었습니다. 사진을 불러와 보세요.');
  }catch(error){setStatus(error.message,true);}finally{button.disabled=false;button.textContent='계정 연결하기';}
});

loadButton.addEventListener('click',async()=>{
  if(!connected){loginCard.hidden=false;loginCard.scrollIntoView({behavior:'smooth'});return;}
  loadButton.disabled=true;loadButton.textContent='불러오는 중…';setStatus(`${yearSelect.value}년 사진을 확인하는 중`);
  try{
    const response=await fetch(`/api/kidsnote/gallery?year=${encodeURIComponent(yearSelect.value)}`,{cache:'no-store'});
    const data=await response.json();if(!response.ok)throw new Error(data.error||'사진을 불러오지 못했습니다.');
    renderPhotos(data.photos||[]);setStatus(data.count?`${data.count}장의 사진 · 눌러서 크게 보기`:'해당 연도의 사진이 없습니다.');
  }catch(error){setStatus(error.message,true);}finally{loadButton.disabled=false;loadButton.textContent='사진 불러오기';}
});

function renderPhotos(photos){
  gallery.replaceChildren();emptyState.hidden=photos.length>0;
  for(const photo of photos){
    const button=document.createElement('button');button.className='photo';button.type='button';
    const image=document.createElement('img');image.loading='lazy';image.src=photo.url;image.alt=`${photo.date||''} 키즈노트 사진`;
    const date=document.createElement('time');date.textContent=photo.date||'';button.append(image,date);
    button.addEventListener('click',()=>{ $('#viewerImage').src=photo.url;$('#viewerDate').textContent=photo.date||'';$('#saveOriginal').href=photo.url;viewer.showModal(); });
    gallery.append(button);
  }
}

$('#closeViewer').addEventListener('click',()=>viewer.close());
viewer.addEventListener('click',event=>{if(event.target===viewer)viewer.close();});
checkSession();
