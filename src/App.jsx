import { useState, useEffect, useRef, useCallback } from "react";

// ─── Fonts ────────────────────────────────────────────────────────────────────
const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Share+Tech+Mono&display=swap');`;

// ─── Constants ────────────────────────────────────────────────────────────────
const COLORS = ["#f2c94c","#56ccf2","#6fcf97","#bb6bd9","#f2994a","#eb5757","#2f80ed","#ff6b9d"];
const ROOM_COLORS = ["#2f80ed","#6fcf97","#f2c94c","#bb6bd9"];
const gid = () => Math.random().toString(36).slice(2,9);

const makeScreen = (name, url="", ci=0) => ({ id:gid(), name, url, color:COLORS[ci%COLORS.length] });
const makeTV = (name) => ({ id:gid(), name, interval:30, rotating:true,
  screens:[makeScreen("Power BI","",0), makeScreen("Olos","",1), makeScreen("Call Flex","",2)] });
const makeRoom = (name, ri) => ({ id:gid(), name, color:ROOM_COLORS[ri%4],
  tvs:[makeTV("TV 1")] });

const DEFAULT_ROOMS = [
  makeRoom("Salão 1", 0),
  makeRoom("Salão 2", 1),
  makeRoom("Salão 3", 2),
  makeRoom("Salão 4", 3),
];

// ─── Global CSS ───────────────────────────────────────────────────────────────
const CSS = `
  ${FONTS}
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:#080b12;font-family:'Rajdhani',sans-serif;color:#dde4f0;}
  ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#0d1220}
  ::-webkit-scrollbar-thumb{background:#222b3d;border-radius:2px}
  input{outline:none;}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
  @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
  @keyframes cdBar{from{width:100%}to{width:0%}}
  @keyframes spinIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
`;

// ─── Shared Styles ────────────────────────────────────────────────────────────
const S = {
  input: { background:"#0d1220", border:"1px solid #1e2c42", borderRadius:6,
    color:"#dde4f0", padding:"7px 12px", fontFamily:"'Rajdhani'", fontSize:14, width:"100%" },
  btn: (bg="#1e2c42", color="#dde4f0") => ({
    padding:"7px 16px", background:bg, border:"none", borderRadius:6,
    color, fontFamily:"'Rajdhani'", fontWeight:700, fontSize:13, cursor:"pointer",
    letterSpacing:.5, transition:"opacity .15s" }),
  mono: { fontFamily:"'Share Tech Mono'" },
  label: { fontFamily:"'Share Tech Mono'", fontSize:10, letterSpacing:3,
    color:"#3d5070", textTransform:"uppercase", display:"block", marginBottom:6 },
  tag: (color) => ({ display:"inline-block", padding:"2px 8px", borderRadius:4,
    background:color+"22", color, fontFamily:"'Share Tech Mono'", fontSize:10, letterSpacing:1 }),
};

const Mono = ({children, style={}}) => <span style={{...S.mono,...style}}>{children}</span>;
const Label = ({children}) => <span style={S.label}>{children}</span>;

function IconBtn({onClick, children, color="#3d5070", hoverColor="#dde4f0", style={}}) {
  const [hov,setHov]=useState(false);
  return <button onClick={onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
    style={{background:"none",border:"none",cursor:"pointer",color:hov?hoverColor:color,
      fontSize:14,padding:"4px 6px",transition:"color .15s",...style}}>{children}</button>;
}

// ─── Persistência ─────────────────────────────────────────────────────────────
const API = "/api/config";
const LS_CFG = "tvdash:config", LS_KEY = "tvdash:adminKey";
const POLL_MS = 60000; // TVs checam alterações a cada 60s
const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k,v) => { try { v==null ? localStorage.removeItem(k) : localStorage.setItem(k,v); } catch {} };

async function loadConfig() {
  try {
    const r = await fetch(API, { cache:"no-store" });
    if (r.ok && (r.headers.get("content-type")||"").includes("json")) {
      const d = await r.json();
      if (d) lsSet(LS_CFG, JSON.stringify(d)); // cache p/ TV funcionar se a rede cair
      return { data:d, remote:true };
    }
  } catch {}
  const c = lsGet(LS_CFG);                     // fallback: dev local sem API / offline
  return { data: c ? JSON.parse(c) : null, remote:false };
}

async function saveConfig(rooms, key) {
  lsSet(LS_CFG, JSON.stringify({ rooms, updatedAt:Date.now() }));
  const r = await fetch(API, { method:"PUT", headers:{ "Content-Type":"application/json", "x-admin-key":key||"" },
    body: JSON.stringify({ rooms }) });
  if (r.status===401) throw Object.assign(new Error("Senha inválida"), { auth:true });
  if (!r.ok) throw new Error("Falha ao salvar");
}

const params = new URLSearchParams(window.location.search);
const TV_PARAMS = params.get("room") && params.get("tv") ? { roomId:params.get("room"), tvId:params.get("tv") } : null;

export default function App() {
  return TV_PARAMS ? <TVMode {...TV_PARAMS} /> : <Admin />;
}

// ─── Modo TV (URL ?room=&tv=) ─────────────────────────────────────────────────
function TVMode({roomId, tvId}) {
  const [cfg, setCfg] = useState(undefined);
  useEffect(()=>{
    let stamp = null, alive = true;
    const tick = async () => {
      const { data } = await loadConfig();
      if (alive && data && data.updatedAt !== stamp) { stamp = data.updatedAt; setCfg(data); }
      else if (alive && !data) setCfg(c => c===undefined ? null : c);
    };
    tick(); const i = setInterval(tick, POLL_MS);
    return () => { alive=false; clearInterval(i); };
  },[]);

  const room = cfg?.rooms?.find(r=>r.id===roomId);
  const tv = room?.tvs.find(t=>t.id===tvId);
  if (cfg===undefined) return <TVMsg css={CSS} text="Carregando…" />;
  if (!tv) return <TVMsg css={CSS} text="TV não encontrada — verifique a URL no Admin" />;
  return <KioskView tv={tv} room={room} css={CSS} />;
}

function TVMsg({text,css}) {
  return <div style={{position:"fixed",inset:0,background:"#000",display:"flex",alignItems:"center",justifyContent:"center"}}>
    <style>{css}</style><Mono style={{fontSize:14,color:"#566"}}>{text}</Mono></div>;
}

// ─── Admin ────────────────────────────────────────────────────────────────────
function Admin() {
  const [rooms, setRooms] = useState(null);
  const [kiosk, setKiosk] = useState(null);      // {roomId, tvId}
  const [editing, setEditing] = useState(null);  // {roomId, tvId}
  const baseUrl = window.location.origin;
  const [adminKey, setAdminKey] = useState(lsGet(LS_KEY) || "");
  const [status, setStatus] = useState("");      // salvando | salvo | erro | local
  const loaded = useRef(false), remoteRef = useRef(true);

  useEffect(()=>{ loadConfig().then(({data,remote})=>{
    if(!data?.rooms) loaded.current=true; // 1º acesso: grava defaults p/ fixar IDs
    setRooms(data?.rooms || DEFAULT_ROOMS);
    remoteRef.current = remote;
    if(!remote) setStatus("local");
    else if(!lsGet(LS_KEY)) setTimeout(askKey,300);
  }); },[]);

  // autosave (debounce 800ms)
  useEffect(()=>{
    if(!rooms) return;
    if(!loaded.current){ loaded.current=true; return; }
    if(!remoteRef.current){ lsSet(LS_CFG,JSON.stringify({rooms,updatedAt:Date.now()})); return; }
    setStatus("salvando");
    const t=setTimeout(()=>saveConfig(rooms,adminKey)
      .then(()=>setStatus("salvo"))
      .catch(e=>{ setStatus(e.auth?"senha":"erro"); }),800);
    return ()=>clearTimeout(t);
  },[rooms,adminKey]);

  const askKey = () => {
    const k = window.prompt("Senha do Admin (ADMIN_PASSWORD):", adminKey);
    if (k!=null) { lsSet(LS_KEY,k); setAdminKey(k); }
  };

  if(!rooms) return <TVMsg css={CSS} text="Carregando…" />;

  const updateRooms = fn => setRooms(rs => fn(rs));
  const getRoom = id => rooms.find(r=>r.id===id);
  const getTV = (rId, tId) => getRoom(rId)?.tvs.find(t=>t.id===tId);

  const updateTV = (rId, tId, fn) => updateRooms(rs =>
    rs.map(r => r.id!==rId ? r : {...r, tvs:r.tvs.map(t => t.id!==tId ? t : fn(t))}));

  const updateScreen = (rId, tId, sid, field, val) =>
    updateTV(rId, tId, tv => ({...tv, screens:tv.screens.map(s=>s.id!==sid?s:{...s,[field]:val})}));

  const addTV = (rId) => updateRooms(rs => rs.map(r => {
    if(r.id!==rId || r.tvs.length>=4) return r;
    return {...r, tvs:[...r.tvs, makeTV(`TV ${r.tvs.length+1}`)]};
  }));

  const removeTV = (rId, tId) => {
    if(editing?.tvId===tId) setEditing(null);
    updateRooms(rs=>rs.map(r=>r.id!==rId?r:{...r,tvs:r.tvs.filter(t=>t.id!==tId)}));
  };

  const addScreen = (rId, tId) => updateTV(rId, tId, tv => ({
    ...tv, screens:[...tv.screens, makeScreen("Nova Tela","",tv.screens.length)]
  }));

  const removeScreen = (rId, tId, sid) => updateTV(rId, tId, tv => ({
    ...tv, screens:tv.screens.filter(s=>s.id!==sid)
  }));

  const kioskUrl = (rId, tId) => `${baseUrl}?room=${rId}&tv=${tId}`;

  const editRoom = editing ? getRoom(editing.roomId) : null;
  const editTV   = editing ? getTV(editing.roomId, editing.tvId) : null;
  const kioskRoom = kiosk ? getRoom(kiosk.roomId) : null;
  const kioskTV   = kiosk ? getTV(kiosk.roomId, kiosk.tvId) : null;

  if(kiosk && kioskTV && kioskRoom) return (
    <KioskView tv={kioskTV} room={kioskRoom} onExit={()=>setKiosk(null)} css={CSS} />
  );

  const totalTVs = rooms.reduce((a,r)=>a+r.tvs.length,0);
  const totalUrls = rooms.reduce((a,r)=>a+r.tvs.reduce((b,t)=>b+t.screens.filter(s=>s.url).length,0),0);

  return (
    <div style={{minHeight:"100vh",background:"#080b12",display:"flex",flexDirection:"column"}}>
      <style>{CSS}</style>

      {/* Header */}
      <header style={{borderBottom:"1px solid #111b2b",padding:"14px 28px",
        display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <div>
          <Mono style={{fontSize:10,color:"#2f80ed",letterSpacing:3,display:"block",marginBottom:3}}>
            ◈ DASHBOARD TV MANAGER
          </Mono>
          <h1 style={{fontSize:22,fontWeight:700,letterSpacing:.5}}>Central de Controle</h1>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{display:"flex",gap:20}}>
            {[["Salões","4"],["TVs",totalTVs],["URLs",totalUrls]].map(([l,v])=>(
              <div key={l} style={{textAlign:"center"}}>
                <div style={{fontSize:22,fontWeight:700,color:"#2f80ed",...S.mono}}>{v}</div>
                <Mono style={{fontSize:9,color:"#3d5070",letterSpacing:2}}>{l}</Mono>
              </div>
            ))}
          </div>
          <div style={{width:1,height:36,background:"#111b2b"}}/>
          <div style={{textAlign:"right"}}>
            <Label>Status</Label>
            {(()=>{const m={salvando:["● Salvando…","#f2c94c"],salvo:["● Salvo na nuvem","#6fcf97"],
              erro:["● Erro ao salvar","#eb5757"],senha:["● Senha inválida — clique","#eb5757"],
              local:["● Sem API (só local)","#f2994a"],"":["● Pronto","#3d5070"]}[status];
              return <button onClick={askKey} title="Definir senha do Admin"
                style={{...S.btn("transparent",m[1]),padding:0,fontSize:12,...S.mono}}>{m[0]}</button>;})()}
          </div>
        </div>
      </header>

      <div style={{display:"flex",flex:1,overflow:"hidden"}}>

        {/* Room Grid */}
        <main style={{flex:1,padding:24,overflow:"auto"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:18}}>
            {rooms.map((room) => (
              <RoomCard key={room.id} room={room}
                onAddTV={()=>addTV(room.id)}
                onRemoveTV={(tId)=>removeTV(room.id,tId)}
                onEditTV={(tId)=>setEditing({roomId:room.id,tvId:tId})}
                onPreviewTV={(tId)=>setKiosk({roomId:room.id,tvId:tId})}
                onRenameRoom={(name)=>updateRooms(rs=>rs.map(r=>r.id===room.id?{...r,name}:r))}
                isEditing={(tId)=>editing?.roomId===room.id&&editing?.tvId===tId}
              />
            ))}
          </div>
        </main>

        {/* Edit Drawer */}
        {editing && editTV && editRoom && (
          <EditDrawer
            room={editRoom} tv={editTV}
            onClose={()=>setEditing(null)}
            onUpdateTV={(fn)=>updateTV(editing.roomId,editing.tvId,fn)}
            onAddScreen={()=>addScreen(editing.roomId,editing.tvId)}
            onRemoveScreen={(sid)=>removeScreen(editing.roomId,editing.tvId,sid)}
            onUpdateScreen={(sid,f,v)=>updateScreen(editing.roomId,editing.tvId,sid,f,v)}
            onPreview={()=>setKiosk(editing)}
            kioskUrl={kioskUrl(editing.roomId,editing.tvId)}
          />
        )}
      </div>
    </div>
  );
}

// ─── Room Card ────────────────────────────────────────────────────────────────
function RoomCard({room,onAddTV,onRemoveTV,onEditTV,onPreviewTV,onRenameRoom,isEditing}) {
  const [renaming,setRenaming]=useState(false);
  const [draft,setDraft]=useState(room.name);
  const slots = [...room.tvs, ...Array(Math.max(0,4-room.tvs.length)).fill(null)];
  const configuredTVs = room.tvs.filter(t=>t.screens.some(s=>s.url)).length;

  return (
    <div style={{background:"#0d1220",border:"1px solid #111b2b",
      borderTop:`2px solid ${room.color}`,borderRadius:12,padding:"18px 20px",
      animation:"fadeUp .2s ease"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:room.color,
            boxShadow:`0 0 8px ${room.color}80`}} />
          {renaming ? (
            <input autoFocus value={draft} onChange={e=>setDraft(e.target.value)}
              onBlur={()=>{onRenameRoom(draft);setRenaming(false);}}
              onKeyDown={e=>{if(e.key==="Enter"){onRenameRoom(draft);setRenaming(false);}}}
              style={{...S.input,width:130,fontSize:15,fontWeight:700,padding:"2px 8px"}} />
          ) : (
            <h2 style={{fontSize:16,fontWeight:700,cursor:"pointer",letterSpacing:.3}}
              onClick={()=>{setDraft(room.name);setRenaming(true);}}>{room.name}</h2>
          )}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {configuredTVs>0&&<span style={S.tag("#6fcf97")}>{configuredTVs} TV{configuredTVs>1?"s":""} ativas</span>}
          <Mono style={{fontSize:9,color:"#3d5070"}}>{room.tvs.length}/4</Mono>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        {slots.map((tv,si) => tv ? (
          <TVSlot key={tv.id} tv={tv} roomColor={room.color}
            active={isEditing(tv.id)}
            onEdit={()=>onEditTV(tv.id)}
            onPreview={()=>onPreviewTV(tv.id)}
            onRemove={()=>onRemoveTV(tv.id)} />
        ) : (
          <EmptySlot key={`e${si}`} canAdd={room.tvs.length<4} color={room.color} onAdd={onAddTV} />
        ))}
      </div>
    </div>
  );
}

function TVSlot({tv,roomColor,active,onEdit,onPreview,onRemove}) {
  const [hov,setHov]=useState(false);
  const valid = tv.screens.filter(s=>s.url).length;
  return (
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} onClick={onEdit}
      style={{height:88,borderRadius:8,border:`1px solid ${active?"#2f80ed":"#111b2b"}`,
        background:active?"#0a1628":"#080b12",cursor:"pointer",padding:"10px 12px",
        display:"flex",flexDirection:"column",justifyContent:"space-between",transition:"all .2s",
        position:"relative",overflow:"hidden"}}>
      {active&&<div style={{position:"absolute",inset:0,background:"#2f80ed08",pointerEvents:"none"}}/>}
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
        <div>
          <div style={{fontSize:13,fontWeight:700}}>{tv.name}</div>
          <div style={{marginTop:5,display:"flex",gap:4}}>
            {tv.screens.slice(0,4).map(s=>(
              <div key={s.id} style={{width:5,height:5,borderRadius:"50%",
                background:s.url?s.color:"#1e2c42"}} title={s.name}/>
            ))}
            {tv.screens.length>4&&<Mono style={{fontSize:8,color:"#3d5070"}}>+{tv.screens.length-4}</Mono>}
          </div>
        </div>
        {(hov||active)&&(
          <div style={{display:"flex",gap:0}} onClick={e=>e.stopPropagation()}>
            <IconBtn onClick={onPreview} color="#3d5070" hoverColor="#6fcf97" style={{fontSize:10}}>▶</IconBtn>
            <IconBtn onClick={onRemove} color="#3d5070" hoverColor="#eb5757" style={{fontSize:10}}>✕</IconBtn>
          </div>
        )}
      </div>
      <span style={S.tag(valid>0?"#6fcf97":"#3d5070")}>
        {valid>0?`${valid} URL${valid>1?"s":""}` :"sem URL"}
      </span>
    </div>
  );
}

function EmptySlot({canAdd,color,onAdd}) {
  const [hov,setHov]=useState(false);
  return (
    <div onClick={canAdd?onAdd:undefined}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{height:88,borderRadius:8,border:`2px dashed ${hov&&canAdd?color+"66":"#111b2b"}`,
        display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,
        cursor:canAdd?"pointer":"default",transition:"all .2s"}}>
      {canAdd&&<>
        <span style={{fontSize:18,color:hov?color+"99":"#1e2c42",transition:"color .2s"}}>+</span>
        <Mono style={{fontSize:8,letterSpacing:2,color:hov?color+"99":"#1e2c42",transition:"color .2s"}}>ADICIONAR TV</Mono>
      </>}
    </div>
  );
}

// ─── Edit Drawer ──────────────────────────────────────────────────────────────
function EditDrawer({room,tv,onClose,onUpdateTV,onAddScreen,onRemoveScreen,onUpdateScreen,onPreview,kioskUrl}) {
  const [copied,setCopied]=useState(false);
  const copy=()=>{navigator.clipboard.writeText(kioskUrl).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);});};

  return (
    <aside style={{width:370,borderLeft:"1px solid #111b2b",background:"#0a0e1a",
      display:"flex",flexDirection:"column",overflow:"hidden",animation:"spinIn .2s ease",flexShrink:0}}>
      {/* Header */}
      <div style={{padding:"14px 18px",borderBottom:"1px solid #111b2b",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:room.color}}/>
            <Mono style={{fontSize:9,color:"#3d5070",letterSpacing:2}}>{room.name}</Mono>
          </div>
          <IconBtn onClick={onClose}>✕</IconBtn>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <input value={tv.name}
            onChange={e=>onUpdateTV(t=>({...t,name:e.target.value}))}
            style={{...S.input,fontSize:17,fontWeight:700,flex:1,background:"transparent",
              border:"none",borderBottom:"1px solid #111b2b",borderRadius:0,padding:"4px 0"}} />
          <button onClick={onPreview}
            style={{...S.btn("#6fcf9722","#6fcf97"),padding:"6px 14px",fontSize:12,flexShrink:0}}>
            ▶ Preview
          </button>
        </div>
      </div>

      {/* Rotation */}
      <div style={{padding:"12px 18px",borderBottom:"1px solid #111b2b",flexShrink:0}}>
        <Label>Rotação</Label>
        <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
          <button onClick={()=>onUpdateTV(t=>({...t,rotating:!t.rotating}))}
            style={{...S.btn(tv.rotating?"#6fcf9711":"transparent","#6fcf97"),
              border:`1px solid ${tv.rotating?"#6fcf9744":"#1e2c42"}`,fontSize:12,padding:"5px 12px"}}>
            {tv.rotating?"● Ativa":"○ Pausada"}
          </button>
          <div style={{flex:1}}/>
          {[15,30,60,120].map(v=>(
            <button key={v} onClick={()=>onUpdateTV(t=>({...t,interval:v}))}
              style={{...S.btn(tv.interval===v?"#2f80ed22":"transparent",tv.interval===v?"#2f80ed":"#3d5070"),
                border:`1px solid ${tv.interval===v?"#2f80ed44":"#111b2b"}`,
                padding:"4px 8px",fontSize:10,...S.mono}}>
              {v}s
            </button>
          ))}
        </div>
      </div>

      {/* Screens */}
      <div style={{flex:1,overflowY:"auto",padding:"14px 18px"}}>
        <Label>Telas ({tv.screens.length})</Label>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {tv.screens.map((sc,si)=>(
            <ScreenRow key={sc.id} sc={sc} si={si}
              onChange={(f,v)=>onUpdateScreen(sc.id,f,v)}
              onRemove={()=>onRemoveScreen(sc.id)} />
          ))}
          <button onClick={onAddScreen}
            style={{...S.btn("transparent","#3d5070"),border:"2px dashed #111b2b",
              borderRadius:8,padding:10,width:"100%",fontSize:13,letterSpacing:1}}
            onMouseEnter={e=>{e.target.style.borderColor="#2f80ed66";e.target.style.color="#2f80ed";}}
            onMouseLeave={e=>{e.target.style.borderColor="#111b2b";e.target.style.color="#3d5070";}}>
            + NOVA TELA
          </button>
        </div>
      </div>

      {/* Kiosk URL */}
      <div style={{padding:"12px 18px",borderTop:"1px solid #111b2b",flexShrink:0}}>
        <Label>URL para a Intelbras</Label>
        <div style={{display:"flex",gap:6}}>
          <div style={{...S.input,flex:1,overflow:"hidden",textOverflow:"ellipsis",
            whiteSpace:"nowrap",...S.mono,fontSize:9,color:"#566",padding:"8px 10px",userSelect:"all"}}>
            {kioskUrl}
          </div>
          <button onClick={copy}
            style={{...S.btn(copied?"#6fcf9722":"#1e2c42",copied?"#6fcf97":"#dde4f0"),
              flexShrink:0,fontSize:12,padding:"6px 12px"}}>
            {copied?"✓":"Copiar"}
          </button>
        </div>
      </div>
    </aside>
  );
}

// ─── Screen Row ───────────────────────────────────────────────────────────────
function ScreenRow({sc,si,onChange,onRemove}) {
  const [exp,setExp]=useState(!sc.url);
  return (
    <div style={{background:"#080b12",border:`1px solid ${sc.url?sc.color+"33":"#111b2b"}`,
      borderLeft:`3px solid ${sc.color}`,borderRadius:8,overflow:"hidden"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",cursor:"pointer"}}
        onClick={()=>setExp(e=>!e)}>
        <Mono style={{fontSize:9,color:"#3d5070",minWidth:14}}>#{si+1}</Mono>
        <span style={{flex:1,fontSize:13,fontWeight:700}}>{sc.name}</span>
        {sc.url?<span style={S.tag("#6fcf97")}>✓</span>:<span style={S.tag("#eb5757")}>!</span>}
        <IconBtn onClick={e=>{e.stopPropagation();onRemove();}} color="#3d5070" hoverColor="#eb5757" style={{fontSize:10}}>✕</IconBtn>
        <span style={{color:"#3d5070",fontSize:10}}>{exp?"▲":"▼"}</span>
      </div>
      {exp&&(
        <div style={{padding:"0 12px 12px",display:"flex",flexDirection:"column",gap:6}}>
          <input value={sc.name} onChange={e=>onChange("name",e.target.value)}
            style={{...S.input,fontSize:13}} placeholder="Nome da tela" />
          <input value={sc.url} onChange={e=>onChange("url",e.target.value)}
            style={{...S.input,fontSize:10,...S.mono}} placeholder="https://..." />
          <div style={{display:"flex",gap:5,alignItems:"center",flexWrap:"wrap"}}>
            <Mono style={{fontSize:8,color:"#3d5070",letterSpacing:2}}>COR:</Mono>
            {COLORS.map(c=>(
              <div key={c} onClick={()=>onChange("color",c)}
                style={{width:14,height:14,borderRadius:"50%",background:c,cursor:"pointer",
                  border:`2px solid ${sc.color===c?"#fff":"transparent"}`,flexShrink:0}} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Kiosk View ───────────────────────────────────────────────────────────────
function KioskView({tv,room,onExit,css}) {
  const valid = tv.screens.filter(s=>s.url);
  const [idx,setIdx]=useState(0);
  const [timeLeft,setTimeLeft]=useState(tv.interval);
  const [rotating,setRotating]=useState(tv.rotating);
  useEffect(()=>setRotating(tv.rotating),[tv.rotating]); // sincroniza mudança remota
  const [iframeErr,setIframeErr]=useState(false);
  const [showBar,setShowBar]=useState(false);
  const intRef=useRef(),cdRef=useRef(),tidRef=useRef();

  const goTo = useCallback((i)=>{
    setIdx(i); setTimeLeft(tv.interval); setIframeErr(false);
  },[tv.interval]);

  const goNext=useCallback(()=>{ if(valid.length) goTo(i=>(i+1)%valid.length); },[valid.length,goTo]);
  const goPrev=()=>{ if(valid.length) goTo(i=>(i-1+valid.length)%valid.length); };

  useEffect(()=>{
    clearInterval(intRef.current); clearInterval(cdRef.current);
    if(!rotating||valid.length<2) return;
    intRef.current=setInterval(goNext,tv.interval*1000);
    cdRef.current=setInterval(()=>setTimeLeft(t=>t>0?t-1:tv.interval),1000);
    return()=>{clearInterval(intRef.current);clearInterval(cdRef.current);};
  },[rotating,tv.interval,valid.length,goNext]);

  useEffect(()=>{
    const show=()=>{
      setShowBar(true);
      clearTimeout(tidRef.current);
      tidRef.current=setTimeout(()=>setShowBar(false),3000);
    };
    window.addEventListener("mousemove",show);
    window.addEventListener("keydown",show);
    return()=>{window.removeEventListener("mousemove",show);window.removeEventListener("keydown",show);};
  },[]);

  const cur = valid[idx%Math.max(1,valid.length)]||null;

  return (
    <div style={{position:"fixed",inset:0,background:"#000",display:"flex",flexDirection:"column"}}>
      <style>{css}</style>

      {/* Hover bar */}
      <div style={{position:"absolute",top:0,left:0,right:0,zIndex:20,
        background:"linear-gradient(to bottom,rgba(8,11,18,.96),transparent)",
        padding:"10px 16px 28px",display:"flex",alignItems:"center",justifyContent:"space-between",
        transition:"opacity .4s",opacity:showBar?1:0,pointerEvents:showBar?"auto":"none"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:6,height:6,borderRadius:"50%",background:room.color}}/>
          <Mono style={{fontSize:9,color:room.color,letterSpacing:3}}>{room.name}</Mono>
          <Mono style={{fontSize:9,color:"#3d5070"}}>·</Mono>
          <Mono style={{fontSize:9,color:"#566"}}>{tv.name}</Mono>
          {valid.length>0&&<div style={{width:1,height:14,background:"#111b2b",margin:"0 2px"}}/>}
          {valid.map((sc,i)=>(
            <button key={sc.id} onClick={()=>goTo(i)}
              style={{padding:"3px 10px",borderRadius:4,border:"none",cursor:"pointer",
                fontFamily:"'Rajdhani'",fontWeight:700,fontSize:12,letterSpacing:.5,transition:"all .15s",
                background:i===idx?sc.color:"transparent",color:i===idx?"#000":"#566"}}>
              {sc.name}
            </button>
          ))}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          {valid.length>1&&<>
            <IconBtn onClick={goPrev} color="#566" hoverColor="#dde4f0">◀</IconBtn>
            <Mono style={{fontSize:10,color:rotating?"#6fcf97":"#3d5070",minWidth:28,textAlign:"center"}}>
              {rotating?`${timeLeft}s`:"—"}
            </Mono>
            <IconBtn onClick={goNext} color="#566" hoverColor="#dde4f0">▶</IconBtn>
            <button onClick={()=>setRotating(r=>!r)}
              style={{...S.btn("transparent",rotating?"#6fcf97":"#566"),
                border:`1px solid ${rotating?"#6fcf9733":"#111b2b"}`,padding:"3px 10px",fontSize:11}}>
              {rotating?"⏸":"▶"}
            </button>
          </>}
          {onExit&&<button onClick={onExit}
            style={{...S.btn("#f2c94c22","#f2c94c"),padding:"4px 12px",fontSize:11,
              border:"1px solid #f2c94c33"}}>
            ⚙ Admin
          </button>}
        </div>
      </div>

      {/* Progress bar */}
      {rotating&&valid.length>1&&(
        <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"#0d1220",zIndex:10}}>
          <div key={`${idx}-${tv.interval}`}
            style={{height:"100%",background:cur?.color||"#2f80ed",animation:`cdBar ${tv.interval}s linear forwards`}}/>
        </div>
      )}

      {/* Main */}
      <div style={{flex:1,position:"relative"}}>
        {!cur ? (
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",
            justifyContent:"center",height:"100%",gap:14}}>
            <span style={{fontSize:48}}>📺</span>
            <Mono style={{fontSize:12,color:"#566"}}>Nenhuma URL configurada</Mono>
            {onExit&&<button onClick={onExit} style={{...S.btn("#2f80ed","#fff"),padding:"10px 24px",fontSize:15}}>
              Configurar
            </button>}
          </div>
        ) : iframeErr ? (
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",
            justifyContent:"center",height:"100%",gap:12}}>
            <span style={{fontSize:36}}>🔒</span>
            <Mono style={{fontSize:12,color:"#eb5757"}}>IFRAME BLOQUEADO</Mono>
            <p style={{fontSize:14,color:"#566",textAlign:"center",maxWidth:380,lineHeight:1.7}}>
              Este sistema bloqueou exibição externa.<br/>
              Peça ao suporte para liberar <Mono style={{color:"#f2c94c"}}>X-Frame-Options</Mono>.
            </p>
            <a href={cur.url} target="_blank" rel="noreferrer"
              style={{...S.btn("#2f80ed22","#2f80ed"),textDecoration:"none",
                border:"1px solid #2f80ed44",padding:"8px 20px",fontSize:14}}>
              Abrir em nova aba ↗
            </a>
          </div>
        ) : (
          <iframe key={cur.url} src={cur.url} title={cur.name}
            style={{width:"100%",height:"100%",border:"none",display:"block"}}
            onError={()=>setIframeErr(true)} allow="fullscreen" />
        )}
      </div>

      {/* Dots */}
      {valid.length>1&&(
        <div style={{position:"absolute",bottom:10,left:0,right:0,
          display:"flex",justifyContent:"center",gap:6,zIndex:10,
          opacity:showBar?1:0.25,transition:"opacity .4s"}}>
          {valid.map((sc,i)=>(
            <div key={sc.id} onClick={()=>goTo(i)}
              style={{height:4,width:i===idx?22:6,borderRadius:2,
                background:i===idx?sc.color:"#1e2c42",cursor:"pointer",transition:"all .3s"}}/>
          ))}
        </div>
      )}
    </div>
  );
}
