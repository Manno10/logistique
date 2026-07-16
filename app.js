const DB_NAME='elms_offline_v1', DB_VERSION=1, CENTRES_STORE='centres', SCANS_STORE='scans';
const GPS_DEFAULT_RADIUS=300, GPS_WARN_FACTOR=2;
let db, scanner=null, currentCentre=null, currentQr='', currentGps=null, deferredPrompt=null;

const $=id=>document.getElementById(id);
document.addEventListener('DOMContentLoaded', init);

async function init(){
  try{
    db=await openDb();
    bindEvents();
    updateNetwork();

    const total=await loadReference();
    $('kTotal').textContent=total;

    await refreshDashboard();
    await refreshRecent();
    getGps();

    if('serviceWorker' in navigator){
      try{
        await navigator.serviceWorker.register('./service-worker.js?v=1.1');
      }catch(e){
        console.warn('Service worker non enregistré :',e);
      }
    }

    window.addEventListener('online',updateNetwork);
    window.addEventListener('offline',updateNetwork);

    window.addEventListener('beforeinstallprompt',e=>{
      e.preventDefault();
      deferredPrompt=e;
      $('installBtn').classList.remove('hidden');
    });

    $('networkText').textContent=
      navigator.onLine
        ? 'En ligne — référentiel chargé'
        : 'Hors ligne — référentiel local chargé';

  }catch(e){
    console.error(e);
    $('networkText').textContent='Erreur de chargement';
    showMessage(
      'Impossible de charger le référentiel des centres : '+(e.message||e),
      'bad'
    );
  }
}
function bindEvents(){
  $('startScanBtn').onclick=startScanner;$('stopScanBtn').onclick=stopScanner;
  $('lookupBtn').onclick=()=>processQr($('manualQr').value.trim());
  $('refreshGpsBtn').onclick=getGps;$('saveBtn').onclick=saveScan;$('resetBtn').onclick=resetForm;
  $('exportCsvBtn').onclick=exportCsv;$('exportJsonBtn').onclick=exportJson;$('clearBtn').onclick=clearScans;
  $('installBtn').onclick=installApp;
}
async function installApp(){if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('installBtn').classList.add('hidden')}
function updateNetwork(){const online=navigator.onLine;$('networkBar').classList.toggle('online',online);$('networkText').textContent=online?'En ligne — application prête':'Hors ligne — les données restent sur ce téléphone';updateQueue()}
async function updateQueue(){const scans=await getAll(SCANS_STORE);const pending=scans.filter(s=>!s.synced).length;$('queueBadge').textContent=`${pending} en attente`}
function openDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);r.onupgradeneeded=e=>{const d=e.target.result;if(!d.objectStoreNames.contains(CENTRES_STORE))d.createObjectStore(CENTRES_STORE,{keyPath:'cleCentre'});if(!d.objectStoreNames.contains(SCANS_STORE))d.createObjectStore(SCANS_STORE,{keyPath:'localId',autoIncrement:true})};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
function tx(store,mode='readonly'){return db.transaction(store,mode).objectStore(store)}
function getAll(store){return new Promise((res,rej)=>{const r=tx(store).getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error)})}
function putMany(store,items){return new Promise((res,rej)=>{const t=db.transaction(store,'readwrite'),s=t.objectStore(store);items.forEach(x=>s.put(x));t.oncomplete=()=>res();t.onerror=()=>rej(t.error)})}
function add(store,item){return new Promise((res,rej)=>{const r=tx(store,'readwrite').add(item);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
function clearStore(store){return new Promise((res,rej)=>{const r=tx(store,'readwrite').clear();r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
async function loadReference(){
  let local=[];

  try{
    local=await getAll(CENTRES_STORE);
  }catch(e){
    console.warn('Lecture IndexedDB impossible :',e);
  }

  try{
    const url='./centres.json?v=2026.1';
    const response=await fetch(url,{cache:'no-store'});

    if(!response.ok){
      throw new Error(
        'centres.json introuvable — HTTP '+response.status
      );
    }

    const texte=await response.text();
    let data;

    try{
      data=JSON.parse(texte);
    }catch(e){
      throw new Error(
        'centres.json n’est pas un JSON valide'
      );
    }

    if(
      !data ||
      !Array.isArray(data.centres)
    ){
      throw new Error(
        'Structure centres.json invalide'
      );
    }

    await clearStore(CENTRES_STORE);
    await putMany(CENTRES_STORE,data.centres);
    local=data.centres;

  }catch(e){
    console.warn(
      'Chargement réseau impossible, utilisation du cache local :',
      e
    );

    if(!local.length){
      throw e;
    }
  }

  if(!local.length){
    throw new Error(
      'Aucun centre n’est disponible dans le référentiel.'
    );
  }

  return local.length;
}
async function startScanner(){
  hideMessage();
  if(scanner)return;
  if(typeof Html5Qrcode==='undefined'){showMessage('Le module caméra n’est pas disponible. Ouvre une première fois l’application avec Internet.','bad');return}
  scanner=new Html5Qrcode('reader');
  try{
    await scanner.start({facingMode:'environment'},{fps:10,qrbox:{width:250,height:250}},async text=>{await stopScanner();$('manualQr').value=text;processQr(text)},()=>{});
    $('startScanBtn').classList.add('hidden');$('stopScanBtn').classList.remove('hidden');
  }catch(e){scanner=null;showMessage('Impossible d’ouvrir la caméra : '+e,'bad')}
}
async function stopScanner(){
  if(scanner){try{await scanner.stop();await scanner.clear()}catch(e){}scanner=null}
  $('startScanBtn').classList.remove('hidden');$('stopScanBtn').classList.add('hidden');
}
function normalize(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’‘`´]/g,"'").replace(/[^A-Za-z0-9]+/g,' ').trim().toLowerCase()}
function parseQr(qr){
  const prefix='ELECTIONS2026|';if(!qr.startsWith(prefix))return{ok:false,message:'QR code non reconnu.'};
  const values={};qr.substring(prefix.length).split('|').forEach(p=>{const i=p.indexOf('=');if(i<1)return;const k=p.slice(0,i).toUpperCase();let v=p.slice(i+1);try{v=decodeURIComponent(v)}catch(e){}values[k]=v.trim()});
  if(!values.CENTRE||!values.DEP||!values.COM||!values.SEC)return{ok:false,message:'Le QR ne contient pas toutes les informations du centre.'};
  return{ok:true,nomCentre:values.CENTRE,departement:values.DEP,commune:values.COM,section:values.SEC,cleCentre:[values.CENTRE,values.DEP,values.COM,values.SEC].map(normalize).join('|')}
}
async function processQr(qr){
  hideMessage();const parsed=parseQr(qr);if(!parsed.ok){showMessage(parsed.message,'bad');return}
  const centres=await getAll(CENTRES_STORE);const centre=centres.find(c=>c.cleCentre===parsed.cleCentre);
  if(!centre){showMessage('Centre absent du référentiel local. Vérifie le QR ou recharge le référentiel.','bad');return}
  currentCentre=centre;currentQr=qr;renderCentre();$('centreCard').classList.remove('hidden');$('centreCard').scrollIntoView({behavior:'smooth'});await getGps()
}
function renderCentre(){
  const c=currentCentre;$('centreName').textContent=c.nomCentre;
  $('centreAdmin').innerHTML=[
    ['Département',c.departement],['Commune',c.commune],['Section',c.section],['Statut GPS officiel',(c.latitude!=null&&c.longitude!=null)?'Disponible':'Non disponible']
  ].map(x=>`<div class="meta-item"><strong>${escapeHtml(x[0])}</strong>${escapeHtml(x[1])}</div>`).join('');
  $('refLat').textContent=formatCoord(c.latitude);$('refLon').textContent=formatCoord(c.longitude);renderGps()
}
async function getGps(){
  currentGps=null;$('gpsResult').className='gps-result neutral';$('gpsResult').textContent='Acquisition de la position GPS…';
  if(!navigator.geolocation){$('gpsResult').textContent='GPS non pris en charge.';return}
  navigator.geolocation.getCurrentPosition(p=>{currentGps={latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:Math.round(p.coords.accuracy),timestamp:new Date().toISOString()};renderGps()},e=>{currentGps=null;renderGps();showMessage('GPS indisponible : '+e.message,'warn')},{enableHighAccuracy:true,timeout:20000,maximumAge:0})
}
function renderGps(){
  $('scanLat').textContent=currentGps?formatCoord(currentGps.latitude):'—';$('scanLon').textContent=currentGps?formatCoord(currentGps.longitude):'—';$('scanAccuracy').textContent=currentGps?`${currentGps.accuracy} m`:'—';
  const r=calculateGpsStatus();const el=$('gpsResult');el.className='gps-result '+r.css;el.innerHTML=r.html
}
function calculateGpsStatus(){
  if(!currentCentre)return{status:'NON_CALCULE',distance:null,css:'neutral',html:'Centre non identifié.'};
  if(currentCentre.latitude==null||currentCentre.longitude==null)return{status:'GPS_REFERENCE_MANQUANT',distance:null,css:'warn',html:'Coordonnées officielles absentes : la comparaison GPS ne peut pas être effectuée.'};
  if(!currentGps)return{status:'GPS_SCAN_MANQUANT',distance:null,css:'warn',html:'Coordonnées du téléphone indisponibles.'};
  const d=Math.round(haversine(currentGps.latitude,currentGps.longitude,currentCentre.latitude,currentCentre.longitude));
  if(d<=GPS_DEFAULT_RADIUS)return{status:'CONFORME',distance:d,css:'ok',html:`Distance : <strong>${d} m</strong><br>Résultat : <strong>conforme</strong>`};
  if(d<=GPS_DEFAULT_RADIUS*GPS_WARN_FACTOR)return{status:'A_VERIFIER',distance:d,css:'warn',html:`Distance : <strong>${d} m</strong><br>Résultat : <strong>à vérifier</strong>`};
  return{status:'IRREGULARITE_POSSIBLE',distance:d,css:'bad',html:`Distance : <strong>${d} m</strong><br>Résultat : <strong>irrégularité possible</strong>`}
function haversine(a,b,c,d){const R=6371000,x=Math.PI/180,da=(c-a)*x,do_=(d-b)*x;const q=Math.sin(da/2)**2+Math.cos(a*x)*Math.cos(c*x)*Math.sin(do_/2)**2;return 2*R*Math.asin(Math.sqrt(q))}
async function saveScan(){
  if(!currentCentre){showMessage('Aucun centre identifié.','bad');return}
  const gps=calculateGpsStatus();
  const record={scanId:crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random(),timestamp:new Date().toISOString(),qrValue:currentQr,centreUid:currentCentre.uid,cleCentre:currentCentre.cleCentre,nomCentre:currentCentre.nomCentre,departement:currentCentre.departement,commune:currentCentre.commune,section:currentCentre.section,latitudeReference:currentCentre.latitude,longitudeReference:currentCentre.longitude,latitudeScan:currentGps?.latitude??null,longitudeScan:currentGps?.longitude??null,precisionGps_m:currentGps?.accuracy??null,distanceCentre_m:gps.distance,verificationGps:gps.status,typeOperation:$('operationType').value,livraisonComplete:$('deliveryComplete').checked?'OUI':'NON',nomReceptionnaire:$('recipientName').value.trim(),telephoneReceptionnaire:$('recipientPhone').value.trim(),observation:$('observation').value.trim(),appareil:navigator.userAgent,synced:false};
  await add(SCANS_STORE,record);showMessage('Scan enregistré sur le téléphone.','ok');await refreshDashboard();await refreshRecent();updateQueue();setTimeout(resetForm,1800)
}
async function refreshDashboard(){
  const scans=await getAll(SCANS_STORE),unique=new Set(scans.map(s=>s.cleCentre));$('kScannes').textContent=unique.size;
  $('kConformes').textContent=scans.filter(s=>s.verificationGps==='CONFORME').length;
  $('kAnomalies').textContent=scans.filter(s=>['A_VERIFIER','IRREGULARITE_POSSIBLE'].includes(s.verificationGps)).length
}
async function refreshRecent(){
  const scans=(await getAll(SCANS_STORE)).sort((a,b)=>b.timestamp.localeCompare(a.timestamp)).slice(0,8);
  $('recentScans').innerHTML=scans.length?scans.map(s=>`<div class="scan-row"><strong>${escapeHtml(s.nomCentre)}</strong>${escapeHtml(s.commune)} — ${new Date(s.timestamp).toLocaleString()}<br><span class="tag ${tagClass(s.verificationGps)}">${escapeHtml(s.verificationGps)}</span></div>`).join(''):'<p class="muted">Aucun scan enregistré.</p>'
}
function tagClass(s){return s==='CONFORME'?'ok':s==='IRREGULARITE_POSSIBLE'?'bad':'warn'}
function resetForm(){currentCentre=null;currentQr='';$('manualQr').value='';$('centreCard').classList.add('hidden');$('recipientName').value='';$('recipientPhone').value='';$('observation').value='';$('deliveryComplete').checked=true;window.scrollTo({top:0,behavior:'smooth'})}
async function exportCsv(){
  const scans=await getAll(SCANS_STORE);if(!scans.length){showMessage('Aucun scan à exporter.','warn');return}
  const cols=Object.keys(scans[0]).filter(c=>c!=='localId');const rows=[cols.join(';'),...scans.map(s=>cols.map(c=>csv(s[c])).join(';'))];download('ELMS_scans_offline.csv','text/csv;charset=utf-8-sig','\ufeff'+rows.join('\n'))
}
async function exportJson(){const scans=await getAll(SCANS_STORE);download('ELMS_scans_offline.json','application/json',JSON.stringify(scans,null,2))}
async function clearScans(){if(!confirm('Effacer tous les scans enregistrés sur ce téléphone ?'))return;await clearStore(SCANS_STORE);await refreshDashboard();await refreshRecent();updateQueue();showMessage('Scans locaux effacés.','ok')}
function csv(v){const s=v==null?'':String(v);return /[;"\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s}
function download(name,type,data){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function formatCoord(v){return v==null||v===''?'Non disponible':Number(v).toFixed(6)}
function showMessage(t,type='ok'){const e=$('message');e.textContent=t;e.className='message '+type}
function hideMessage(){$('message').className='message hidden'}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
