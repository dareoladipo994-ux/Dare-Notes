/* Dare Notes — Deluxe+ Deep Blue (static, no-build) */

const DB_NAME = 'dare-notes-db-final', STORE = 'notes_v1'
function openDB(){
  return new Promise((res, rej)=>{
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = ()=> {
      const db = req.result
      if(!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, {keyPath:'id'})
    }
    req.onsuccess = ()=> res(req.result)
    req.onerror = ()=> rej(req.error)
  })
}
async function dbGetAll(){
  const db = await openDB()
  return new Promise((res,rej)=>{
    const tx = db.transaction(STORE,'readonly'), store = tx.objectStore(STORE)
    const items = []
    const req = store.openCursor()
    req.onsuccess = ()=> {
      const cur = req.result
      if(cur){ items.push(cur.value); cur.continue() } else res(items)
    }
    req.onerror = ()=> rej(req.error)
  })
}
async function dbPut(note){
  const db = await openDB()
  return new Promise((res,rej)=>{
    const tx = db.transaction(STORE,'readwrite'), store = tx.objectStore(STORE)
    const req = store.put(note)
    req.onsuccess = ()=> res(req.result)
    req.onerror = ()=> rej(req.error)
  })
}
async function dbDelete(id){
  const db = await openDB()
  return new Promise((res,rej)=>{
    const tx = db.transaction(STORE,'readwrite'), store = tx.objectStore(STORE)
    const req = store.delete(id)
    req.onsuccess = ()=> res() 
    req.onerror = ()=> rej(req.error)
  })
}
async function dbBulkPut(notes){
  for(const n of notes) await dbPut(n)
}

function uid(){ return 'n_' + Math.random().toString(36).slice(2,10) }

async function hashPIN(pin){
  const enc = new TextEncoder().encode(pin)
  const buf = await crypto.subtle.digest('SHA-256', enc)
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('')
}

// UI refs
const notesList = document.getElementById('notesList')
const titleEl = document.getElementById('title')
const bodyEl = document.getElementById('body')
const tagsEl = document.getElementById('tags')
const newBtn = document.getElementById('newBtn')
const saveNow = document.getElementById('saveNow')
const searchEl = document.getElementById('search')
const exportBtn = document.getElementById('exportBtn')
const importBtn = document.getElementById('importBtn')
const importFile = document.getElementById('importFile')
const settingsBtn = document.getElementById('settingsBtn')
const settingsPanel = document.getElementById('settingsPanel')
const closeSettings = document.getElementById('closeSettings')
const themeSelect = document.getElementById('themeSelect')
const changePin = document.getElementById('changePin')
const changePinBtn = document.getElementById('changePinBtn')
const exportBtn2 = document.getElementById('exportBtn2')
const importBtn2 = document.getElementById('importBtn2')
const resetBtn2 = document.getElementById('resetBtn2')

const statusEl = document.getElementById('status')
const lockOverlay = document.getElementById('lockOverlay')
const pinInput = document.getElementById('pinInput')
const pinSubmit = document.getElementById('pinSubmit')
const pinReset = document.getElementById('pinReset')
const lockTitle = document.getElementById('lockTitle')
const installHint = document.getElementById('installHint')
const installBtn = document.getElementById('installBtn')
const dismissInstall = document.getElementById('dismissInstall')

let notes = []
let current = null
let autosaveTimer = null
const PIN_KEY = 'dare_pin_hash_final'
const THEME_KEY = 'dare_theme_final'

// --- ADDED: Definition for the status() function ---
function status(msg) {
  statusEl.textContent = msg;
}
// --- END ADD ---

// Load theme
function applyTheme(t){
  if(t === 'light') {
    document.documentElement.style.setProperty('--bg','#f5f7fa')
    document.documentElement.style.setProperty('--panel','#ffffff')
    document.documentElement.style.setProperty('--accent','#0077ff')
    document.documentElement.style.setProperty('--light-text','#071029')
    document.documentElement.style.color = '#071029'
  } else {
    document.documentElement.style.setProperty('--bg','#040712')
    document.documentElement.style.setProperty('--panel','#071029')
    document.documentElement.style.setProperty('--accent','#0077ff')
    document.documentElement.style.setProperty('--light-text','#071029')
    document.documentElement.style.color = '#e6eef6'
  }
}
applyTheme(localStorage.getItem(THEME_KEY) || 'dark')
if(localStorage.getItem(THEME_KEY)) themeSelect.value = localStorage.getItem(THEME_KEY)

themeSelect.addEventListener('change', ()=>{
  const v = themeSelect.value
  localStorage.setItem(THEME_KEY, v)
  applyTheme(v)
})

// Load notes and render
async function loadNotes(){
  notes = await dbGetAll()
  notes.sort((a,b)=> (b.lastModified||0) - (a.lastModified||0))
  renderList(notes)

  // --- THIS BLOCK WAS THE BUG ---
  // It reloaded the editor, fighting with user input.
  /*
  if(current && current.id){
    const updated = notes.find(n=>n.id===current.id)
    if(updated) loadIntoEditor(updated)
  }
  */
  // --- END FIX ---
}

function renderList(list){
  notesList.innerHTML = ''
  for(const n of list){
    const el = document.createElement('div'); el.className = 'note-item'
    const meta = document.createElement('div'); meta.className='note-meta'
    const t = document.createElement('div'); t.className='title'; t.textContent = n.title || 'Untitled'
    const ex = document.createElement('div'); ex.className='excerpt'; ex.textContent = (n.body||'').slice(0,80)
    const tagsWrap = document.createElement('div'); tagsWrap.className='tags'
    ;(n.tags||[]).slice(0,4).forEach(tag=>{ const s=document.createElement('span'); s.className='tag'; s.textContent=tag; tagsWrap.appendChild(s)})
    meta.appendChild(t); meta.appendChild(ex); meta.appendChild(tagsWrap)
    el.appendChild(meta)
    
    // --- UPDATED: Used 'danger' class for better styling ---
    const del = document.createElement('button'); del.textContent='Delete'; del.className = 'danger';
    del.style.marginLeft='8px'
    // --- END UPDATE ---
    
    del.onclick = async (e)=>{ e.stopPropagation(); if(confirm('Delete note?')){ await dbDelete(n.id); if(current && current.id===n.id) clearEditor(); loadNotes() } }
    el.appendChild(del)
    el.onclick = ()=>{ current = n; loadIntoEditor(n) }
    notesList.appendChild(el)
  }
}

function loadIntoEditor(n){
  titleEl.value = n.title || ''
  bodyEl.value = n.body || ''
  tagsEl.value = (n.tags||[]).join(', ')
  current = n
  document.querySelector('.editor').classList.remove('empty')
  status('Loaded')
}

function clearEditor(){
  current = null
  titleEl.value = ''; bodyEl.value=''; tagsEl.value=''; document.querySelector('.editor').classList.add('empty')
  status('Idle')
}

async function saveDraft(force=false){
  try{
    if(!current && !titleEl.value && !bodyEl.value) return
    const now = Date.now()
    const note = {
      id: current && current.id ? current.id : uid(),
      title: titleEl.value.trim() || 'Untitled',
      body: bodyEl.value,
      tags: tagsEl.value.split(',').map(s=>s.trim()).filter(Boolean),
      lastModified: now
    }
    await dbPut(note)
    current = note // Important: update the 'current' object
    status('Saved ' + new Date(now).toLocaleTimeString())
    
    // This call is now safe, because loadNotes() no longer reloads the editor
    await loadNotes() 
    
    if(force) alert('Saved')
  }catch(e){
    console.error('save failed', e); status('Save failed')
  }
}

function setupAutosave(){
  [titleEl, bodyEl, tagsEl].forEach(el=>{
    el.addEventListener('input', ()=>{
      status('Typing...')
      if(autosaveTimer) clearTimeout(autosaveTimer)
      autosaveTimer = setTimeout(()=> saveDraft(), 2500)
    })
  })
}

// Search
searchEl.addEventListener('input', ()=>{
  const q = searchEl.value.trim().toLowerCase()
  if(!q) return renderList(notes)
  const filtered = notes.filter(n=> (n.title||'').toLowerCase().includes(q) || (n.body||'').toLowerCase().includes(q) || (n.tags||[]).some(t=>t.toLowerCase().includes(q)) )
  renderList(filtered)
})

// Buttons
newBtn.addEventListener('click', ()=>{ clearEditor(); current = null })
saveNow.addEventListener('click', ()=> saveDraft(true))
exportBtn.addEventListener('click', async ()=>{
  const all = await dbGetAll()
  const blob = new Blob([JSON.stringify(all, null, 2)], {type:'application/json'})
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download='dare-notes-backup.json'; a.click(); URL.revokeObjectURL(url)
})
importBtn.addEventListener('click', ()=> importFile.click())
importFile.addEventListener('change', async (e)=>{
  const f = e.target.files[0]; if(!f) return
  const txt = await f.text()
  try{ const arr = JSON.parse(txt); await dbBulkPut(arr); alert('Import complete'); loadNotes() }catch(err){ alert('Invalid file') }
})

// Settings panel
settingsBtn.addEventListener('click', ()=>{ settingsPanel.classList.remove('hidden') })
closeSettings.addEventListener('click', ()=>{ settingsPanel.classList.add('hidden') })
exportBtn2.addEventListener('click', ()=> exportBtn.click())
importBtn2.addEventListener('click', ()=> importBtn.click())
resetBtn2.addEventListener('click', async ()=>{
  if(!confirm('Reset will erase ALL notes and PIN. Continue?')) return
  const req = indexedDB.deleteDatabase(DB_NAME)
  req.onsuccess = ()=> { localStorage.removeItem(PIN_KEY); localStorage.removeItem(THEME_KEY); alert('Reset complete'); location.reload() }
})

// Change PIN flow
changePinBtn.addEventListener('click', async ()=>{
  const v = changePin.value.trim()
  if(!v || v.length<4){ alert('Enter a PIN of 4-6 digits'); return }
  const h = await hashPIN(v)
  localStorage.setItem(PIN_KEY, h)
  changePin.value=''
  alert('PIN changed')
})

// Install prompt handling (web app install)
let deferredPrompt = null
window.addEventListener('beforeinstallprompt', (e)=>{
  e.preventDefault(); deferredPrompt = e; showInstallHint()
})
installBtn.addEventListener('click', async ()=>{
  if(!deferredPrompt) return
  deferredPrompt.prompt()
  const choice = await deferredPrompt.userChoice
  deferredPrompt = null
  hideInstallHint()
})
dismissInstall.addEventListener('click', ()=>{ localStorage.setItem('dare_install_dismissed','1'); hideInstallHint() })

function showInstallHint(){ if(localStorage.getItem('dare_install_dismissed')) return; installHint.classList.remove('hidden') }
function hideInstallHint(){ installHint.classList.add('hidden') }

// PIN flow
async function showLock(){
  lockOverlay.style.display = 'flex'; pinInput.value=''; pinInput.focus(); document.body.style.overflow='hidden'
  if(!localStorage.getItem(PIN_KEY)) lockTitle.textContent = 'Set a new PIN'; else lockTitle.textContent = 'Enter PIN'
}
async function hideLock(){ lockOverlay.style.display = 'none'; document.body.style.overflow='' }

pinSubmit.addEventListener('click', async ()=>{
  const v = pinInput.value.trim()
  if(!v || v.length <4){ alert('PIN must be at least 4 digits'); return }
  const hash = await hashPIN(v)
  const stored = localStorage.getItem(PIN_KEY)
  if(!stored){
    localStorage.setItem(PIN_KEY, hash); hideLock(); await loadNotes(); setupAutosave()
  } else {
    if(stored === hash){ hideLock(); await loadNotes(); setupAutosave() }
    else { alert('Incorrect PIN') }
  }
})
pinInput.addEventListener('keydown', (e)=>{ if(e.key === 'Enter') pinSubmit.click() })

pinReset.addEventListener('click', async ()=>{
  if(!confirm('This will erase all notes and the PIN. Proceed?')) return
  const req = indexedDB.deleteDatabase(DB_NAME)
  req.onsuccess = ()=> { localStorage.removeItem(PIN_KEY); localStorage.removeItem(THEME_KEY); alert('Reset complete'); location.reload() }
})

// initial load
window.addEventListener('load', ()=>{
  showLock()
  // show install hint on supported platforms
  setTimeout(()=> showInstallHint(), 1500)
})

