import { useState, useEffect, useRef, useCallback } from "react";
import Head from "next/head";
import { useSharedStorage } from "../lib/useSharedStorage";

/* ═══════════ CONFIG ═══════════ */
const DEFAULT_SECTIONS = [
  { id: "portage", label: "Portage", icon: "🎯", accent: "#C13584" },
  { id: "apporteur", label: "Apporteur d'affaire", icon: "🤝", accent: "#F56040" },
  { id: "agency", label: "Creatly Agency", icon: "🏢", accent: "#833AB4" },
  { id: "school", label: "Creatly School", icon: "🎓", accent: "#405DE6" },
  { id: "closer", label: "Closer", icon: "🔥", accent: "#E1306C" },
];
const DEFAULT_THEMES = {
  portage: [
    { id: "ai", label: "Intelligence Artificielle", icon: "🤖", accent: "#833AB4" },
    { id: "bureau", label: "Bureautique", icon: "💼", accent: "#405DE6" },
    { id: "beaute", label: "Beauté", icon: "💄", accent: "#C13584" },
    { id: "business", label: "Business", icon: "📊", accent: "#E1306C" },
    { id: "tech", label: "Tech & Gaming", icon: "🎮", accent: "#F56040" },
    { id: "lifestyle", label: "Lifestyle", icon: "✨", accent: "#FCAF45" },
    { id: "sante", label: "Santé & Bien-être", icon: "🧘", accent: "#C13584" },
    { id: "finance", label: "Finance", icon: "💰", accent: "#833AB4" },
  ],
  apporteur: [{ id: "ap_gen", label: "Général", icon: "📋", accent: "#F56040" }],
  agency: [{ id: "ag_gen", label: "Général", icon: "📋", accent: "#833AB4" }],
  school: [{ id: "sc_gen", label: "Général", icon: "📋", accent: "#405DE6" }],
  closer: [{ id: "cl_gen", label: "Général", icon: "📋", accent: "#E1306C" }],
};
const DEFAULT_SECTION_TEMPLATES = {
  portage: `Bonjour {nom},\n\nJe m'appelle [VOTRE NOM] et je travaille chez [VOTRE ENTREPRISE]. J'ai découvert votre profil et votre travail dans le domaine de {thematique} m'a particulièrement interpellé.\n\nNous accompagnons des créateurs de contenu comme vous dans le développement de leur activité via le portage salarial.\n\nSeriez-vous disponible pour un échange de 15 minutes cette semaine ?\n\nBien cordialement,\n[VOTRE NOM]`,
  apporteur: "Bonjour {nom},\n\nJe vous contacte car je pense que nous pourrions collaborer ensemble.\n\n[Personnalisez ce template]",
  agency: "Bonjour {nom},\n\nJe vous contacte de la part de Creatly Agency.\n\n[Personnalisez ce template]",
  school: "Bonjour {nom},\n\nJe vous contacte de la part de Creatly School.\n\n[Personnalisez ce template]",
  closer: "Bonjour {nom},\n\nJe vous contacte pour une opportunité.\n\n[Personnalisez ce template]",
};

const IG_GRADIENT = "linear-gradient(135deg,#405DE6 0%,#833AB4 25%,#C13584 50%,#E1306C 70%,#F56040 85%,#FCAF45 100%)";
const IG_GRADIENT_SOFT = "linear-gradient(135deg,#405DE608 0%,#833AB408 25%,#C1358408 50%,#E1306C08 70%,#F5604008 85%,#FCAF4508 100%)";

const ACCENT_PALETTE = ["#833AB4","#C13584","#E1306C","#F56040","#FCAF45","#405DE6","#5851DB","#FF6B6B","#1DD1A1","#54A0FF","#FDA7DF","#C44569","#3DC1D3","#E77F67","#778BEB","#F8B500"];
const ICON_PALETTE = ["📌","🎯","📣","🎤","🖥️","📱","🛍️","🏠","🍔","🎵","📚","🏋️","🌍","🚀","💡","🎨","🔬","⚡","🧩","💎"];
const STATUTS = ["Non","Oui","En attente","Relancé"];
const SS = {
  Non: { bg:"#FFF0F0", fg:"#C0392B", dot:"#E74C3C", border:"#FADADD" },
  Oui: { bg:"#F0FFF4", fg:"#1A7A4A", dot:"#27AE60", border:"#C3E6CB" },
  "En attente": { bg:"#FFFBF0", fg:"#B7770D", dot:"#F39C12", border:"#FDEBD0" },
  Relancé: { bg:"#F5F0FF", fg:"#6C3483", dot:"#8E44AD", border:"#D7BDE2" },
};
const SCORE_LABELS = ["","Faible","Correct","Bon","Très bon","Excellent"];
const SCORE_COLORS = ["","#E74C3C","#F39C12","#405DE6","#833AB4","#27AE60"];

/* ═══════════ UTILS ═══════════ */
function makeRow() {
  return {
    _id: "r"+Date.now().toString(36)+Math.random().toString(36).slice(2,7),
    nom:"", pseudo:"", site:[""], youtube:[""], instagram:[""], autres:[""],
    mail:"", numero:"", contacte:"Non", echange:"", commentaire:"",
    specialisation:"", score:0, avatar:"",
    history:[], // [{date, action, note}]
  };
}
function resolveTheme(themes, section, tab) {
  const l = themes[section]||[];
  return l.find(t=>t.id===tab)||l[0]||null;
}
function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit",year:"numeric"})+" "+d.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});
}
function isDuplicate(rows, row, allRows) {
  const norm = s => (s||"").toLowerCase().trim();
  const others = allRows.filter(r=>r._id!==row._id);
  return others.some(r =>
    (norm(r.nom)&&norm(r.nom)===norm(row.nom)) ||
    (norm(r.pseudo)&&norm(r.pseudo)===norm(row.pseudo)) ||
    (norm(r.mail)&&norm(r.mail)===norm(row.mail))
  );
}

/* ═══════════ EXPORT CSV ═══════════ */
function exportToCSV(rows, themeLabel, sectionLabel) {
  const headers = ["Nom Prénom","Nom Réseaux","Spécialisation","Site Web","YouTube","Instagram","Autres Réseaux","E-mail","Numéro","Score","Contacté","Échange","Commentaire"];
  const csvRows = [headers];
  for (const r of rows) {
    csvRows.push([
      r.nom||"", r.pseudo||"", r.specialisation||"",
      (r.site||[]).filter(Boolean).join(" | "),
      (r.youtube||[]).filter(Boolean).join(" | "),
      (r.instagram||[]).filter(Boolean).join(" | "),
      (r.autres||[]).filter(Boolean).join(" | "),
      r.mail||"", r.numero||"", r.score||0,
      r.contacte||"Non", r.echange||"", r.commentaire||"",
    ]);
  }
  const content = csvRows.map(row=>row.map(cell=>`"${String(cell).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF"+content],{type:"text/csv;charset=utf-8;"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href=url; a.download=`${sectionLabel}_${themeLabel}_${new Date().toISOString().slice(0,10)}.csv`; a.click();
  URL.revokeObjectURL(url);
}

/* ═══════════ RAPPORT PDF ═══════════ */
function generatePDFReport(allRows, themes, sections, objectives) {
  const now = new Date();
  const weekAgo = new Date(now-7*24*3600*1000);
  let html = `<html><head><meta charset="utf-8"><title>Rapport Prospect. – Semaine du ${weekAgo.toLocaleDateString("fr-FR")}</title>
  <style>
    body{font-family:Arial,sans-serif;color:#1a1a2e;padding:40px;max-width:900px;margin:0 auto}
    h1{background:linear-gradient(135deg,#405DE6,#C13584,#F56040);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-size:28px;margin-bottom:4px}
    h2{color:#833AB4;font-size:16px;margin:24px 0 8px;border-bottom:2px solid #F0F0F8;padding-bottom:6px}
    h3{color:#C13584;font-size:14px;margin:16px 0 4px}
    .sub{color:#888;font-size:13px;margin-bottom:24px}
    .stats{display:flex;gap:16px;flex-wrap:wrap;margin:16px 0}
    .stat{background:#F8F0FF;border-radius:10px;padding:12px 20px;text-align:center}
    .stat-n{font-size:28px;font-weight:900;color:#833AB4}
    .stat-l{font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px}
    table{width:100%;border-collapse:collapse;font-size:12px;margin:8px 0}
    th{background:#F8F0FF;color:#833AB4;padding:8px;text-align:left;font-size:11px;text-transform:uppercase}
    td{padding:7px 8px;border-bottom:1px solid #F0F0F8}
    .badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600}
    .obj-bar{background:#F0F0F8;border-radius:4px;height:8px;margin-top:4px;overflow:hidden}
    .obj-fill{height:8px;border-radius:4px;background:linear-gradient(90deg,#833AB4,#C13584)}
    @media print{body{padding:20px}}
  </style></head><body>`;

  html += `<h1>Prospect.</h1><div class="sub">Rapport hebdomadaire — Semaine du ${weekAgo.toLocaleDateString("fr-FR")} au ${now.toLocaleDateString("fr-FR")}</div>`;

  // Stats globales
  const flatRows = Object.values(allRows).flat();
  const total = flatRows.length;
  const oui = flatRows.filter(r=>r.contacte==="Oui").length;
  const attente = flatRows.filter(r=>r.contacte==="En attente").length;
  const relance = flatRows.filter(r=>r.contacte==="Relancé").length;
  const avgScore = flatRows.filter(r=>r.score>0).length ? (flatRows.filter(r=>r.score>0).reduce((a,r)=>a+r.score,0)/flatRows.filter(r=>r.score>0).length).toFixed(1) : "—";

  html += `<h2>Vue d'ensemble</h2><div class="stats">
    <div class="stat"><div class="stat-n">${total}</div><div class="stat-l">Total influenceurs</div></div>
    <div class="stat"><div class="stat-n" style="color:#27AE60">${oui}</div><div class="stat-l">Contactés</div></div>
    <div class="stat"><div class="stat-n" style="color:#B7770D">${attente}</div><div class="stat-l">En attente</div></div>
    <div class="stat"><div class="stat-n" style="color:#6C3483">${relance}</div><div class="stat-l">Relancés</div></div>
    <div class="stat"><div class="stat-n">${total>0?(oui/total*100).toFixed(0):0}%</div><div class="stat-l">Taux contact</div></div>
    <div class="stat"><div class="stat-n">${avgScore}⭐</div><div class="stat-l">Score moyen</div></div>
  </div>`;

  // Objectifs
  if (objectives && objectives.length > 0) {
    html += `<h2>Objectifs</h2>`;
    for (const obj of objectives) {
      const progress = Math.min(100, Math.round((obj.current / obj.target) * 100));
      html += `<div style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;font-size:13px"><span><b>${obj.label}</b></span><span style="color:#833AB4">${obj.current}/${obj.target}</span></div>
        <div class="obj-bar"><div class="obj-fill" style="width:${progress}%"></div></div>
      </div>`;
    }
  }

  // Par section
  for (const sec of sections) {
    const secThemes = themes[sec.id]||[];
    const secRows = secThemes.flatMap(t=>allRows[t.id]||[]);
    if (secRows.length === 0) continue;
    html += `<h2>${sec.icon} ${sec.label} — ${secRows.length} influenceur${secRows.length>1?"s":""}</h2>`;
    for (const t of secThemes) {
      const tRows = allRows[t.id]||[];
      if (tRows.length === 0) continue;
      html += `<h3>${t.icon} ${t.label} (${tRows.length})</h3>
      <table><thead><tr><th>Nom</th><th>Pseudo</th><th>Score</th><th>Statut</th><th>Spécialisation</th><th>Commentaire</th></tr></thead><tbody>`;
      for (const r of tRows) {
        const stars = r.score>0?"⭐".repeat(r.score):"—";
        html += `<tr><td>${r.nom||"—"}</td><td>${r.pseudo||"—"}</td><td>${stars}</td><td><span class="badge" style="background:${SS[r.contacte]?.bg||"#f5f5f5"};color:${SS[r.contacte]?.fg||"#888"}">${r.contacte}</span></td><td>${r.specialisation||"—"}</td><td>${r.commentaire||"—"}</td></tr>`;
      }
      html += `</tbody></table>`;
    }
  }
  html += `<div style="margin-top:32px;font-size:11px;color:#aaa;text-align:center">Généré par Prospect. le ${now.toLocaleString("fr-FR")}</div></body></html>`;

  const w = window.open("","_blank");
  w.document.write(html);
  w.document.close();
  setTimeout(()=>w.print(),500);
}

/* ═══════════ IMPORT CSV ═══════════ */
function parseCSV(text) {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const sep = lines[0].includes(";") ? ";" : ",";
  const parseRow = (line) => {
    const result=[]; let cur=""; let inQ=false;
    for (let i=0;i<line.length;i++) {
      const ch=line[i];
      if (ch==='"'){if(inQ&&line[i+1]==='"'){cur+='"';i++;}else inQ=!inQ;}
      else if(ch===sep&&!inQ){result.push(cur.trim());cur="";}
      else cur+=ch;
    }
    result.push(cur.trim()); return result;
  };
  const header = parseRow(lines[0]).map(h=>h.toLowerCase().replace(/['"]/g,"").trim());
  const colMap = {
    nom:["nom","nom prénom","name","nom prenom"],
    pseudo:["pseudo","nom réseaux","handle","username"],
    specialisation:["sous-thématique","sous thematique","sous-theme","categorie","catégorie"],
    site:["site","site web","website","url"],
    youtube:["youtube","yt"],
    instagram:["instagram","ig","insta"],
    autres:["autres","autres réseaux","tiktok","linkedin","other"],
    mail:["mail","email","e-mail","courriel"],
    numero:["numero","numéro","phone","tel"],
    score:["score","note","notation"],
    contacte:["contacte","contacté","statut","status"],
    echange:["echange","échange","notes","note"],
    commentaire:["commentaire","comment"],
  };
  const idxMap={};
  for (const [field,aliases] of Object.entries(colMap)) {
    for (let i=0;i<header.length;i++) {
      if(aliases.some(a=>header[i].includes(a))){idxMap[field]=i;break;}
    }
  }
  const rows=[];
  for (let li=1;li<lines.length;li++) {
    const cols=parseRow(lines[li]);
    if(cols.every(c=>!c)) continue;
    const get=(f)=>cols[idxMap[f]]||"";
    const linkField=(f)=>{const v=get(f);return v?v.split("|").map(s=>s.trim()).filter(Boolean):[""];};
    const row=makeRow();
    row.nom=get("nom"); row.pseudo=get("pseudo"); row.specialisation=get("specialisation");
    row.site=linkField("site"); row.youtube=linkField("youtube");
    row.instagram=linkField("instagram"); row.autres=linkField("autres");
    row.mail=get("mail"); row.numero=get("numero");
    const sc=parseInt(get("score")); row.score=(!isNaN(sc)&&sc>=1&&sc<=5)?sc:0;
    const st=get("contacte"); row.contacte=STATUTS.includes(st)?st:"Non";
    row.echange=get("echange"); row.commentaire=get("commentaire");
    if(row.nom||row.pseudo||row.mail) rows.push(row);
  }
  return rows;
}

/* ═══════════ STYLES ═══════════ */
const ci = { background:"#fff", border:"1px solid #E8E8F0", borderRadius:5, padding:"5px 8px", fontSize:13, color:"#1a1a2e", outline:"none", width:"100%", fontFamily:"inherit", transition:"border .15s" };
const td0 = { padding:"8px 6px", borderBottom:"1px solid #F0F0F5", verticalAlign:"top", fontSize:13 };
const focB = e=>{ e.target.style.borderColor="#D0AEFF"; e.target.style.background="#FAFAFF"; };
const bluB = e=>{ e.target.style.borderColor="#E8E8F0"; e.target.style.background="#fff"; e.target.style.color="#1a1a2e"; };

/* ═══════════ SCORE STARS ═══════════ */
function StarRating({ value, onChange, size=14 }) {
  const [hover, setHover] = useState(0);
  return <div style={{display:"flex",gap:2,alignItems:"center"}}>
    {[1,2,3,4,5].map(n=>(
      <button key={n} onClick={()=>onChange(value===n?0:n)} onMouseEnter={()=>setHover(n)} onMouseLeave={()=>setHover(0)}
        style={{background:"none",border:"none",cursor:"pointer",padding:1,fontSize:size,lineHeight:1,color:(hover||value)>=n?"#FCAF45":"#DDD",transition:"color .1s"}}>★</button>
    ))}
    {value>0&&<span style={{fontSize:10,color:SCORE_COLORS[value],fontWeight:700,marginLeft:2}}>{SCORE_LABELS[value]}</span>}
  </div>;
}

/* ═══════════ STATUS BADGE ═══════════ */
function StatusBadge({ value, onChange }) {
  const s=SS[value]||SS.Non; const [open,setOpen]=useState(false); const ref=useRef();
  useEffect(()=>{
    if(!open)return;
    const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};
    document.addEventListener("mousedown",h); return()=>document.removeEventListener("mousedown",h);
  },[open]);
  return <div ref={ref} style={{position:"relative"}}>
    <button onClick={()=>setOpen(o=>!o)} style={{display:"inline-flex",alignItems:"center",gap:6,background:s.bg,color:s.fg,border:`1px solid ${s.border}`,cursor:"pointer",padding:"4px 10px",borderRadius:20,fontSize:12,fontWeight:600,fontFamily:"inherit",whiteSpace:"nowrap"}}>
      <span style={{width:7,height:7,borderRadius:"50%",background:s.dot,flexShrink:0}}/>{value}<span style={{fontSize:9,opacity:.5}}>▼</span>
    </button>
    {open&&<div style={{position:"absolute",top:"110%",left:0,zIndex:200,background:"#fff",border:"1px solid #E8E8F0",borderRadius:10,padding:4,boxShadow:"0 8px 32px rgba(131,58,180,.15)",minWidth:130}}>
      {STATUTS.map(st=>{const ss=SS[st];return<button key={st} onClick={()=>{onChange(st);setOpen(false);}} style={{display:"flex",alignItems:"center",gap:8,width:"100%",background:value===st?ss.bg:"transparent",color:ss.fg,border:"none",padding:"7px 12px",borderRadius:7,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}><span style={{width:7,height:7,borderRadius:"50%",background:ss.dot}}/>{st}</button>;})}
    </div>}
  </div>;
}

/* ═══════════ LINK CELL ═══════════ */
function LinkCell({ links, onChange, ph, accent }) {
  const arr=Array.isArray(links)&&links.length>0?links:[""];
  const set=(i,v)=>{const n=[...arr];n[i]=v;onChange(n);};
  const add=()=>onChange([...arr,""]);
  const rm=i=>{const n=arr.filter((_,j)=>j!==i);onChange(n.length?n:[""]);}; 
  const [addHover,setAddHover]=useState(false);
  return <div style={{display:"flex",flexDirection:"column",gap:3}}>
    {arr.map((l,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:4}}>
      <input value={l||""} onChange={e=>set(i,e.target.value)} placeholder={i===0?ph:"Autre lien..."} style={{...ci,flex:1,color:l?.startsWith("http")?accent:"#1a1a2e",textDecoration:l?.startsWith("http")?"underline":"none"}} onFocus={focB} onBlur={bluB}/>
      {l?.startsWith("http")&&<a href={l} target="_blank" rel="noreferrer" style={{fontSize:13,color:accent,textDecoration:"none",opacity:.7,flexShrink:0}}>↗</a>}
      {arr.length>1&&<button onClick={()=>rm(i)} style={{background:"none",border:"none",color:"#E1306C",cursor:"pointer",fontSize:14,padding:0,opacity:.5,flexShrink:0}}>×</button>}
    </div>)}
    <button onClick={add} onMouseEnter={()=>setAddHover(true)} onMouseLeave={()=>setAddHover(false)} style={{background:addHover?`${accent}15`:"transparent",border:`1px solid ${addHover?accent:`${accent}40`}`,color:accent,cursor:"pointer",fontSize:12,fontWeight:700,padding:"6px 10px",textAlign:"left",fontFamily:"inherit",borderRadius:6,transition:"all .15s"}}>+ Ajouter un lien</button>
  </div>;
}

/* ═══════════ AVATAR CELL ═══════════ */
function AvatarCell({ value, onChange, nom, pseudo }) {
  const ref = useRef();
  const initials = ((nom||pseudo||"?")[0]||"?").toUpperCase();
  const handleFile = (file) => {
    if (!file) return;
    if (file.size > 2*1024*1024) { alert("Image trop lourde (max 2 Mo)"); return; }
    const reader = new FileReader();
    reader.onload = (e) => onChange(e.target.result);
    reader.readAsDataURL(file);
  };
  return <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5,width:52}}>
    <div onClick={()=>ref.current?.click()} title="Cliquer pour changer la photo"
      style={{width:44,height:44,borderRadius:"50%",overflow:"hidden",cursor:"pointer",flexShrink:0,border:"2px solid #E8E8F0",background:"#F5F0FF",display:"flex",alignItems:"center",justifyContent:"center",position:"relative"}}>
      {value
        ? <img src={value} alt="avatar" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
        : <span style={{fontSize:16,fontWeight:800,color:"#833AB4"}}>{initials}</span>}
      <div style={{position:"absolute",inset:0,background:"rgba(131,58,180,.0)",display:"flex",alignItems:"center",justifyContent:"center",opacity:0,transition:"opacity .15s"}}
        onMouseEnter={e=>e.currentTarget.style.opacity=1} onMouseLeave={e=>e.currentTarget.style.opacity=0}>
        <span style={{fontSize:14,background:"rgba(0,0,0,.45)",borderRadius:"50%",padding:4,color:"#fff"}}>📷</span>
      </div>
    </div>
    {value && <button onClick={()=>onChange("")} title="Supprimer la photo" style={{background:"none",border:"none",color:"#E1306C",fontSize:10,cursor:"pointer",padding:0,opacity:.6}}>✕</button>}
    <input ref={ref} type="file" accept="image/*" style={{display:"none"}} onChange={e=>handleFile(e.target.files[0])}/>
  </div>;
}

/* ═══════════ DUPLICATE BADGE ═══════════ */
function DupBadge() {
  return <span title="Doublon potentiel détecté" style={{display:"inline-flex",alignItems:"center",gap:3,background:"#FFF3CD",color:"#856404",border:"1px solid #FFE69C",borderRadius:10,padding:"2px 7px",fontSize:10,fontWeight:700,flexShrink:0}}>⚠ Doublon</span>;
}

/* ═══════════ TABLE ROW ═══════════ */
function TableRow({ c, onUpdate, onDelete, onMail, onOpenFiche, accent, idx, isDup }) {
  const [h,setH]=useState(false);
  const up=(k,v)=>onUpdate({...c,[k]:v});
  const bg=h?"#F8F0FF":idx%2===0?"#FFFFFF":"#FAFAFA";
  return <tr onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)} style={{background:bg,transition:"background .12s"}}>
    <td style={{...td0,width:56,paddingLeft:8}}>
      <AvatarCell value={c.avatar||""} onChange={v=>up("avatar",v)} nom={c.nom} pseudo={c.pseudo}/>
    </td>
    <td style={td0}>
      <div style={{display:"flex",flexDirection:"column",gap:4}}>
        <input value={c.nom||""} onChange={e=>up("nom",e.target.value)} placeholder="Nom Prénom" style={{...ci,fontSize:13}} onFocus={focB} onBlur={bluB}/>
        {isDup&&<DupBadge/>}
      </div>
    </td>
    <td style={td0}><input value={c.pseudo||""} onChange={e=>up("pseudo",e.target.value)} placeholder="@pseudo" style={ci} onFocus={focB} onBlur={bluB}/></td>
    <td style={td0}><textarea value={c.specialisation||""} onChange={e=>up("specialisation",e.target.value)} placeholder="Spécialisation..." rows={2} style={{...ci,resize:"vertical",minHeight:32,lineHeight:1.4,color:"#1a1a2e",background:"#fff",border:"1px solid #E8E8F0"}} onFocus={focB} onBlur={bluB}/></td>
    <td style={td0}><StarRating value={c.score||0} onChange={v=>up("score",v)}/></td>
    <td style={td0}><LinkCell links={c.site} onChange={v=>up("site",v)} ph="https://site.com" accent={accent}/></td>
    <td style={td0}><LinkCell links={c.youtube} onChange={v=>up("youtube",v)} ph="https://youtube.com/@..." accent="#FF0000"/></td>
    <td style={td0}><LinkCell links={c.instagram} onChange={v=>up("instagram",v)} ph="https://instagram.com/..." accent="#E1306C"/></td>
    <td style={td0}><LinkCell links={c.autres} onChange={v=>up("autres",v)} ph="TikTok, LinkedIn..." accent="#405DE6"/></td>
    <td style={td0}><input value={c.mail||""} onChange={e=>up("mail",e.target.value)} placeholder="email@..." style={{...ci,color:c.mail?"#405DE6":"#1a1a2e"}} onFocus={focB} onBlur={bluB}/></td>
    <td style={td0}><input value={c.numero||""} onChange={e=>up("numero",e.target.value)} placeholder="+33..." style={ci} onFocus={focB} onBlur={bluB}/></td>
    <td style={{...td0,textAlign:"center"}}><StatusBadge value={c.contacte||"Non"} onChange={v=>up("contacte",v)}/></td>
    <td style={td0}><textarea value={c.echange||""} onChange={e=>up("echange",e.target.value)} placeholder="Notes..." rows={2} style={{...ci,resize:"vertical",minHeight:32,lineHeight:1.4}} onFocus={focB} onBlur={bluB}/></td>
    <td style={td0}><textarea value={c.commentaire||""} onChange={e=>up("commentaire",e.target.value)} placeholder="Commentaire..." rows={2} style={{...ci,resize:"vertical",minHeight:32,lineHeight:1.4}} onFocus={focB} onBlur={bluB}/></td>
    <td style={{...td0,textAlign:"center"}}>
      <div style={{display:"flex",gap:2,justifyContent:"center",opacity:h?1:0,transition:"opacity .15s"}}>
        <button onClick={()=>onOpenFiche(c)} title="Fiche détaillée" style={{background:"none",border:"none",cursor:"pointer",fontSize:15,padding:4}}>👤</button>
        <button onClick={()=>onMail(c)} title="Générer un mail IA" style={{background:"none",border:"none",cursor:"pointer",fontSize:15,padding:4}}>✉️</button>
        <button onClick={()=>onDelete(c._id)} title="Supprimer" style={{background:"none",border:"none",cursor:"pointer",color:"#E1306C",fontSize:15,padding:4}}>🗑</button>
      </div>
    </td>
  </tr>;
}



/* ═══════════ STATS VIEW ═══════════ */
function StatsView({ rows, accent, objectifs, onUpdateObjectifs }) {
  const total=rows.length;
  const byStatus=STATUTS.reduce((a,s)=>{a[s]=rows.filter(r=>r.contacte===s).length;return a;},{});
  const tauxContact=total>0?Math.round(byStatus.Oui/total*100):0;
  const scored=rows.filter(r=>r.score>0);
  const avgScore=scored.length?(scored.reduce((a,r)=>a+r.score,0)/scored.length).toFixed(1):"—";
  const byScore=[1,2,3,4,5].map(n=>rows.filter(r=>r.score===n).length);
  const maxBar=Math.max(...byScore,1);

  // Spécialisations
  const subMap={};
  for(const r of rows){if(r.specialisation){subMap[r.specialisation]=(subMap[r.specialisation]||0)+1;}}
  const subEntries=Object.entries(subMap).sort((a,b)=>b[1]-a[1]).slice(0,8);

  const statColors=["#E74C3C","#27AE60","#F39C12","#8E44AD"];

  return <div style={{padding:"20px",overflowY:"auto",height:"100%"}}>
    {/* KPIs */}
    <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:20}}>
      {[
        {l:"Total",v:total,c:"#1a1a2e",bg:"#F0F0FA"},
        {l:"Contactés",v:byStatus.Oui,c:"#27AE60",bg:"#F0FFF4"},
        {l:"En attente",v:byStatus["En attente"],c:"#B7770D",bg:"#FFFBF0"},
        {l:"Relancés",v:byStatus.Relancé,c:"#6C3483",bg:"#F5F0FF"},
        {l:"Taux contact",v:tauxContact+"%",c:"#C13584",bg:"#FFF0F8"},
        {l:"Score moyen",v:avgScore+(avgScore!=="—"?"★":""),c:"#F56040",bg:"#FFF5F0"},
      ].map(s=>(
        <div key={s.l} style={{background:s.bg,border:"1px solid #EEEEF8",borderRadius:12,padding:"12px 20px",display:"flex",flexDirection:"column",gap:4,minWidth:120}}>
          <span style={{fontSize:10,color:"#aaa",fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>{s.l}</span>
          <span style={{fontSize:24,fontWeight:800,color:s.c}}>{s.v}</span>
        </div>
      ))}
    </div>

    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
      {/* Répartition statuts */}
      <div style={{background:"#fff",border:"1px solid #EEEEF8",borderRadius:12,padding:"16px"}}>
        <div style={{fontSize:13,fontWeight:700,color:"#1a1a2e",marginBottom:12}}>Répartition par statut</div>
        {STATUTS.map((s,i)=>{
          const v=byStatus[s]||0; const pct=total>0?Math.round(v/total*100):0;
          return <div key={s} style={{marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}>
              <span style={{color:SS[s].fg,fontWeight:600}}>{s}</span>
              <span style={{color:"#888"}}>{v} ({pct}%)</span>
            </div>
            <div style={{background:"#F0F0F8",borderRadius:4,height:8,overflow:"hidden"}}>
              <div style={{height:8,borderRadius:4,background:statColors[i],width:`${pct}%`,transition:"width .4s"}}/>
            </div>
          </div>;
        })}
      </div>

      {/* Distribution scores */}
      <div style={{background:"#fff",border:"1px solid #EEEEF8",borderRadius:12,padding:"16px"}}>
        <div style={{fontSize:13,fontWeight:700,color:"#1a1a2e",marginBottom:12}}>Distribution des scores</div>
        <div style={{display:"flex",alignItems:"flex-end",gap:8,height:80}}>
          {byScore.map((v,i)=>(
            <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
              <span style={{fontSize:10,color:"#888",fontWeight:700}}>{v}</span>
              <div style={{width:"100%",background:`${accent}20`,borderRadius:"4px 4px 0 0",height:`${Math.round((v/maxBar)*60)+4}px`,transition:"height .4s"}}/>
              <span style={{fontSize:12}}>{"★".repeat(i+1)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* Spécialisations */}
    {subEntries.length>0&&<div style={{background:"#fff",border:"1px solid #EEEEF8",borderRadius:12,padding:"16px",marginBottom:20}}>
      <div style={{fontSize:13,fontWeight:700,color:"#1a1a2e",marginBottom:12}}>Top spécialisations</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
        {subEntries.map(([k,v])=>(
          <div key={k} style={{background:`${accent}12`,border:`1px solid ${accent}25`,borderRadius:20,padding:"5px 14px",display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:13,fontWeight:600,color:accent}}>{k}</span>
            <span style={{fontSize:11,color:"#888"}}>{v}</span>
          </div>
        ))}
      </div>
    </div>}

    {/* Objectifs */}
    <div style={{background:"#fff",border:"1px solid #EEEEF8",borderRadius:12,padding:"16px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{fontSize:13,fontWeight:700,color:"#1a1a2e"}}>Objectifs</div>
        <button onClick={()=>{
          const label=prompt("Nom de l'objectif :");
          if(!label) return;
          const target=parseInt(prompt("Objectif (nombre) :"));
          if(isNaN(target)) return;
          onUpdateObjectifs([...(objectifs||[]),{id:"obj"+Date.now(),label,target,current:0}]);
        }} style={{background:IG_GRADIENT,border:"none",borderRadius:8,color:"#fff",padding:"5px 12px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Objectif</button>
      </div>
      {(!objectifs||objectifs.length===0)&&<div style={{color:"#aaa",fontSize:13,textAlign:"center",padding:"16px 0"}}>Aucun objectif défini. Cliquez sur "+ Objectif" pour en créer un.</div>}
      {(objectifs||[]).map(obj=>{
        const pct=Math.min(100,Math.round((obj.current/obj.target)*100));
        return <div key={obj.id} style={{marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
            <span style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>{obj.label}</span>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <span style={{fontSize:12,color:"#833AB4",fontWeight:700}}>{obj.current}/{obj.target}</span>
              <button onClick={()=>{const n=prompt("Valeur actuelle :",obj.current);if(n!==null&&!isNaN(parseInt(n)))onUpdateObjectifs((objectifs||[]).map(o=>o.id===obj.id?{...o,current:parseInt(n)}:o));}} style={{background:"none",border:"1px solid #E8E8F0",borderRadius:6,padding:"2px 8px",fontSize:11,cursor:"pointer",color:"#888"}}>Modifier</button>
              <button onClick={()=>onUpdateObjectifs((objectifs||[]).filter(o=>o.id!==obj.id))} style={{background:"none",border:"none",cursor:"pointer",color:"#E1306C",fontSize:14,padding:0}}>×</button>
            </div>
          </div>
          <div style={{background:"#F0F0F8",borderRadius:6,height:10,overflow:"hidden"}}>
            <div style={{height:10,borderRadius:6,background:IG_GRADIENT,width:`${pct}%`,transition:"width .5s"}}/>
          </div>
          <div style={{fontSize:10,color:"#888",marginTop:2,textAlign:"right"}}>{pct}%</div>
        </div>;
      })}
    </div>
  </div>;
}

/* ═══════════ FICHE INFLUENCEUR ═══════════ */
function FichePanel({ contact, themeLabel, sectionLabel, accent, onClose, onUpdate, onMail }) {
  const [newNote,setNewNote]=useState("");
  const addHistory=(action,note="")=>{
    const entry={date:new Date().toISOString(),action,note};
    onUpdate({...contact,history:[...(contact.history||[]),entry]});
  };
  const allLinks=[...(contact.site||[]),...(contact.youtube||[]),...(contact.instagram||[]),...(contact.autres||[])].filter(l=>l&&l.startsWith("http"));

  return <div style={{position:"fixed",top:0,right:0,bottom:0,width:"min(480px,100vw)",zIndex:900,background:"#fff",borderLeft:"1px solid #E8E8F0",display:"flex",flexDirection:"column",boxShadow:"-8px 0 40px rgba(131,58,180,.15)"}}>
    {/* Header */}
    <div style={{padding:"14px 20px",borderBottom:"1px solid #F0F0F8",flexShrink:0,background:IG_GRADIENT_SOFT}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div style={{display:"flex",gap:12,alignItems:"center"}}>
          <div style={{width:52,height:52,borderRadius:"50%",overflow:"hidden",border:"3px solid #fff",boxShadow:"0 2px 8px rgba(131,58,180,.2)",flexShrink:0,background:"#F5F0FF",display:"flex",alignItems:"center",justifyContent:"center"}}>
            {contact.avatar
              ? <img src={contact.avatar} alt="avatar" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
              : <span style={{fontSize:20,fontWeight:800,color:"#833AB4",background:IG_GRADIENT,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{(contact.nom||contact.pseudo||"?")[0].toUpperCase()}</span>}
          </div>
          <div>
            <div style={{fontSize:16,fontWeight:800,color:"#1a1a2e"}}>{contact.nom||"—"}</div>
            <div style={{fontSize:13,color:"#888"}}>{contact.pseudo?`@${contact.pseudo}`:""}</div>
          </div>
        </div>
        <button onClick={onClose} style={{background:"none",border:"none",color:"#aaa",fontSize:22,cursor:"pointer",lineHeight:1}}>×</button>
      </div>
      {/* Badges */}
      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:10}}>
        <span style={{background:`${accent}15`,color:accent,padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:600}}>{themeLabel}</span>
        {contact.specialisation&&<span style={{background:`${accent}10`,color:accent,padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:600}}>{contact.specialisation}</span>}
        <span style={{background:SS[contact.contacte]?.bg,color:SS[contact.contacte]?.fg,border:`1px solid ${SS[contact.contacte]?.border}`,padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:600}}>{contact.contacte}</span>
      </div>
    </div>

    <div style={{flex:1,overflowY:"auto",padding:"16px 20px",display:"flex",flexDirection:"column",gap:16}}>
      {/* Score */}
      <div style={{background:"#FAFAFF",border:"1px solid #E8E8F0",borderRadius:10,padding:"12px 16px"}}>
        <div style={{fontSize:11,fontWeight:700,color:"#888",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Score</div>
        <StarRating value={contact.score||0} onChange={v=>onUpdate({...contact,score:v})} size={18}/>
      </div>

      {/* Liens */}
      {allLinks.length>0&&<div style={{background:"#FAFAFF",border:"1px solid #E8E8F0",borderRadius:10,padding:"12px 16px"}}>
        <div style={{fontSize:11,fontWeight:700,color:"#888",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Liens</div>
        <div style={{display:"flex",flexDirection:"column",gap:5}}>
          {allLinks.map((l,i)=><a key={i} href={l} target="_blank" rel="noreferrer" style={{fontSize:12,color:"#405DE6",textDecoration:"none",display:"flex",alignItems:"center",gap:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>↗ {l.replace(/https?:\/\/(www\.)?/,"").slice(0,50)}</a>)}
        </div>
      </div>}

      {/* Contact */}
      <div style={{background:"#FAFAFF",border:"1px solid #E8E8F0",borderRadius:10,padding:"12px 16px"}}>
        <div style={{fontSize:11,fontWeight:700,color:"#888",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Contact</div>
        {contact.mail&&<div style={{fontSize:13,color:"#405DE6",marginBottom:4}}>{contact.mail}</div>}
        {contact.numero&&<div style={{fontSize:13,color:"#555"}}>{contact.numero}</div>}
        {!contact.mail&&!contact.numero&&<div style={{fontSize:12,color:"#ccc"}}>Aucune info de contact</div>}
      </div>

      {/* Notes */}
      {contact.echange&&<div style={{background:"#FAFAFF",border:"1px solid #E8E8F0",borderRadius:10,padding:"12px 16px"}}>
        <div style={{fontSize:11,fontWeight:700,color:"#888",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Notes</div>
        <div style={{fontSize:13,color:"#555",lineHeight:1.6,whiteSpace:"pre-wrap"}}>{contact.echange}</div>
      </div>}

      {/* Historique échanges */}
      <div style={{background:"#FAFAFF",border:"1px solid #E8E8F0",borderRadius:10,padding:"12px 16px"}}>
        <div style={{fontSize:11,fontWeight:700,color:"#888",textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>Historique des échanges</div>
        {(contact.history||[]).length===0&&<div style={{fontSize:12,color:"#ccc",marginBottom:8}}>Aucun échange enregistré.</div>}
        <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:10}}>
          {[...(contact.history||[])].reverse().map((h,i)=>(
            <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start"}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:accent,flexShrink:0,marginTop:4}}/>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:600,color:"#1a1a2e"}}>{h.action}</div>
                {h.note&&<div style={{fontSize:11,color:"#888",marginTop:2}}>{h.note}</div>}
                <div style={{fontSize:10,color:"#bbb",marginTop:2}}>{fmtDate(h.date)}</div>
              </div>
            </div>
          ))}
        </div>
        {/* Ajouter note */}
        <div style={{display:"flex",gap:6}}>
          <input value={newNote} onChange={e=>setNewNote(e.target.value)} placeholder="Ajouter une note..." style={{flex:1,background:"#fff",border:"1px solid #E0D0FF",borderRadius:8,padding:"7px 10px",fontSize:12,outline:"none",fontFamily:"inherit"}} onKeyDown={e=>{if(e.key==="Enter"&&newNote.trim()){addHistory("Note ajoutée",newNote.trim());setNewNote("");}}}/>
          <button onClick={()=>{if(newNote.trim()){addHistory("Note ajoutée",newNote.trim());setNewNote("");}}} style={{background:IG_GRADIENT,border:"none",borderRadius:8,color:"#fff",padding:"7px 12px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+</button>
        </div>
      </div>
    </div>

    {/* Actions bas */}
    <div style={{padding:"12px 20px",borderTop:"1px solid #F0F0F8",display:"flex",gap:8,flexShrink:0}}>
      <button onClick={()=>{onMail(contact);onClose();}} style={{flex:1,padding:"9px",borderRadius:8,border:"none",background:IG_GRADIENT,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>✉️ Générer un mail IA</button>
    </div>
  </div>;
}

/* ═══════════ TEMPLATE MODAL ═══════════ */
function TemplateModal({ open, onClose, title, subtitle, value, onChange, accent, isOverride, onClearOverride }) {
  const [draft,setDraft]=useState(value||"");
  useEffect(()=>{if(open)setDraft(value||"");},[open,value]);
  if(!open) return null;
  return <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,.3)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center"}}>
    <div onClick={e=>e.stopPropagation()} style={{background:"#fff",border:"1px solid #E8E8F0",borderRadius:18,width:"min(600px,94vw)",maxHeight:"85vh",display:"flex",flexDirection:"column",boxShadow:"0 24px 80px rgba(131,58,180,.2)",overflow:"hidden"}}>
      <div style={{padding:"20px 24px 14px",borderBottom:"1px solid #F0F0F8",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0,background:IG_GRADIENT_SOFT}}>
        <div><div style={{fontSize:17,fontWeight:800,color:"#1a1a2e"}}>{title}</div><div style={{fontSize:12,color:"#888",marginTop:2}}>{subtitle}</div></div>
        <button onClick={onClose} style={{background:"none",border:"none",color:"#999",fontSize:22,cursor:"pointer",lineHeight:1}}>×</button>
      </div>
      <div style={{padding:"16px 24px 8px",flexShrink:0}}>
        <div style={{fontSize:11,color:"#888",marginBottom:8}}>Variables : <code style={{background:"#F5F0FF",padding:"2px 6px",borderRadius:4,color:accent}}>{"{nom}"}</code> <code style={{background:"#F5F0FF",padding:"2px 6px",borderRadius:4,color:accent}}>{"{pseudo}"}</code> <code style={{background:"#F5F0FF",padding:"2px 6px",borderRadius:4,color:accent}}>{"{thematique}"}</code> <code style={{background:"#F5F0FF",padding:"2px 6px",borderRadius:4,color:accent}}>{"{section}"}</code></div>
      </div>
      <div style={{flex:1,padding:"0 24px 16px",overflow:"auto"}}>
        <textarea value={draft} onChange={e=>setDraft(e.target.value)} rows={14} style={{width:"100%",background:"#FAFAFF",border:"1px solid #E0D0FF",borderRadius:10,padding:"14px 16px",fontSize:13,color:"#1a1a2e",outline:"none",fontFamily:"inherit",lineHeight:1.7,resize:"vertical",minHeight:200}} placeholder="Votre template de mail..."/>
      </div>
      <div style={{padding:"14px 24px 20px",borderTop:"1px solid #F0F0F8",display:"flex",justifyContent:"space-between",flexShrink:0}}>
        <div>{isOverride&&onClearOverride&&<button onClick={()=>{onClearOverride();onClose();}} style={{padding:"8px 16px",borderRadius:8,border:"1px solid #E1306C40",background:"transparent",color:"#E1306C",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Utiliser le template de la section</button>}</div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={onClose} style={{padding:"9px 20px",borderRadius:8,border:"1px solid #E0D0FF",background:"transparent",color:"#888",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Annuler</button>
          <button onClick={()=>{onChange(draft);onClose();}} style={{padding:"9px 24px",borderRadius:8,border:"none",background:accent,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Enregistrer</button>
        </div>
      </div>
    </div>
  </div>;
}

/* ═══════════ MAIL PANEL ═══════════ */
function MailPanel({ contact, themeLabel, sectionLabel, accent, template, onClose, onUpdateContact }) {
  const [subject,setSubject]=useState(""); const [body,setBody]=useState("");
  const [loading,setLoading]=useState(false); const [error,setError]=useState("");
  const [copied,setCopied]=useState(false); const [sent,setSent]=useState(false);
  const links=[...(contact.site||[]),...(contact.youtube||[]),...(contact.instagram||[]),...(contact.autres||[])].filter(l=>l&&l.startsWith("http"));

  const generateMail=async()=>{
    setLoading(true); setError(""); setBody(""); setSubject("");
    try {
      const templateInfo=template?`\n\nTemplate de mail à suivre comme base :\n---\n${template}\n---`:"";
      const prompt=`Tu es un expert en prospection. Rédige un mail personnalisé pour cet influenceur :
- Nom : ${contact.nom||"Non renseigné"}
- Pseudo : ${contact.pseudo||"Non renseigné"}
- Thématique : ${themeLabel}
- Sous-thématique : ${contact.specialisation||"Non renseignée"}
- Section : ${sectionLabel}
- Site web : ${(contact.site||[]).filter(Boolean).join(", ")||"Non renseigné"}
- YouTube : ${(contact.youtube||[]).filter(Boolean).join(", ")||"Non renseigné"}
- Instagram : ${(contact.instagram||[]).filter(Boolean).join(", ")||"Non renseigné"}
- Autres : ${(contact.autres||[]).filter(Boolean).join(", ")||"Non renseigné"}
- Notes : ${contact.echange||"Aucune"}
- Commentaire : ${contact.commentaire||"Aucun"}
${templateInfo}
Personnalise le mail. Remplace {nom}, {pseudo}, {thematique}, {section} et les [PLACEHOLDERS]. Concis, pro, chaleureux.
Réponds UNIQUEMENT en JSON sans backticks : {"subject": "objet", "body": "corps"}`;
      const res=await fetch("/api/generate-mail",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt})});
      const data=await res.json();
      if(!res.ok) throw new Error(data.error);
      setSubject(data.subject||""); setBody(data.body||"");
    } catch(err){setError("Erreur : "+(err.message||"Réessayez."));}
    setLoading(false);
  };
  const copyAll=()=>{navigator.clipboard.writeText(`Objet : ${subject}\n\n${body}`);setCopied(true);setTimeout(()=>setCopied(false),2000);};
  const [sending,setSending]=useState(false);
  const openInMail=async()=>{
    if(!contact.mail){setError("Pas d'adresse email renseignée.");return;}
    setSending(true);
    try {
      const res=await fetch("/api/send-mail",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({to:contact.mail,subject,body})});
      const data=await res.json();
      if(!res.ok) throw new Error(data.error);
      setSent(true);
      if(onUpdateContact)onUpdateContact({...contact,contacte:"Oui",history:[...(contact.history||[]),{date:new Date().toISOString(),action:"Mail envoyé via Resend",note:`Objet : ${subject}\nDestinataire : ${contact.mail}`}]});
    } catch(err){
      setError("Erreur d'envoi : "+(err.message||"Réessayez"));
    }
    setSending(false);
  };

  return <div style={{position:"fixed",top:0,right:0,bottom:0,width:"min(520px,100vw)",zIndex:910,background:"#fff",borderLeft:"1px solid #E8E8F0",display:"flex",flexDirection:"column",boxShadow:"-8px 0 40px rgba(131,58,180,.15)"}}>
    <div style={{padding:"16px 20px",borderBottom:"1px solid #F0F0F8",display:"flex",justifyContent:"space-between",flexShrink:0,background:IG_GRADIENT_SOFT}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:20}}>✉️</span>
        <div><div style={{fontSize:15,fontWeight:700,color:"#1a1a2e"}}>Mail IA</div><div style={{fontSize:12,color:"#888"}}>pour {contact.nom||contact.pseudo||"cet influenceur"}</div></div>
      </div>
      <button onClick={onClose} style={{background:"none",border:"none",color:"#aaa",fontSize:22,cursor:"pointer"}}>×</button>
    </div>
    <div style={{padding:"14px 20px",borderBottom:"1px solid #F0F0F8",flexShrink:0}}>
      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
        {contact.nom&&<span style={{background:"#F5F5FA",padding:"3px 10px",borderRadius:6,fontSize:12,color:"#555"}}>👤 {contact.nom}</span>}
        <span style={{background:`${accent}15`,padding:"3px 10px",borderRadius:6,fontSize:12,color:accent}}>{themeLabel}</span>
        {links.slice(0,3).map((l,i)=><a key={i} href={l} target="_blank" rel="noreferrer" style={{background:"#F0F0FA",padding:"3px 10px",borderRadius:6,fontSize:11,color:"#405DE6",textDecoration:"none"}}>{l.replace(/https?:\/\/(www\.)?/,"").slice(0,30)}</a>)}
      </div>
    </div>
    <div style={{padding:"14px 20px",flexShrink:0}}>
      <button onClick={generateMail} disabled={loading} style={{width:"100%",padding:"12px",borderRadius:10,border:"none",background:loading?"#ddd":IG_GRADIENT,color:"#fff",fontSize:14,fontWeight:700,cursor:loading?"default":"pointer",fontFamily:"inherit"}}>
        {loading?"Génération en cours...":"🤖 Générer le mail avec l'IA"}
      </button>
      {error&&<div style={{marginTop:8,fontSize:12,color:"#E1306C"}}>{error}</div>}
    </div>
    <div style={{flex:1,padding:"0 20px 14px",overflowY:"auto",display:"flex",flexDirection:"column",gap:12}}>
      {(subject||body)?<>
        <div><label style={{fontSize:11,fontWeight:700,color:"#888",textTransform:"uppercase",display:"block",marginBottom:5}}>Objet</label>
          <input value={subject} onChange={e=>setSubject(e.target.value)} style={{width:"100%",background:"#FAFAFF",border:"1px solid #E0D0FF",borderRadius:8,padding:"10px 14px",fontSize:14,color:"#1a1a2e",outline:"none",fontFamily:"inherit"}}/></div>
        <div style={{flex:1,display:"flex",flexDirection:"column"}}><label style={{fontSize:11,fontWeight:700,color:"#888",textTransform:"uppercase",display:"block",marginBottom:5}}>Corps</label>
          <textarea value={body} onChange={e=>setBody(e.target.value)} style={{flex:1,minHeight:200,background:"#FAFAFF",border:"1px solid #E0D0FF",borderRadius:8,padding:"12px 14px",fontSize:13,color:"#1a1a2e",outline:"none",fontFamily:"inherit",lineHeight:1.6,resize:"none"}}/></div>
      </>:!loading&&<div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",color:"#ccc"}}><span style={{fontSize:40}}>🤖</span><span style={{fontSize:13}}>Cliquez pour générer</span></div>}
    </div>
    {(subject||body)&&<div style={{padding:"14px 20px",borderTop:"1px solid #F0F0F8",display:"flex",gap:8,flexShrink:0}}>
      <button onClick={copyAll} style={{flex:1,padding:"10px",borderRadius:8,border:"1px solid #E0D0FF",background:"#FAFAFF",color:copied?"#27AE60":"#555",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{copied?"✓ Copié":"📋 Copier"}</button>
      <button onClick={generateMail} style={{padding:"10px 16px",borderRadius:8,border:"1px solid #E0D0FF",background:"#FAFAFF",color:"#555",fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>🔄</button>
      <button onClick={openInMail} disabled={sending} style={{flex:1,padding:"10px",borderRadius:8,border:"none",background:sent?"#27AE60":sending?"#ddd":IG_GRADIENT,color:"#fff",fontSize:13,fontWeight:700,cursor:sending?"default":"pointer",fontFamily:"inherit"}}>{sent?"✓ Envoyé":sending?"Envoi en cours...":"📧 Envoyer"}</button>
    </div>}
  </div>;
}

/* ═══════════ ADD THEME MODAL ═══════════ */
function AddThemeModal({ open, onClose, onAdd, defaultAccent }) {
  const [label,setLabel]=useState(""); const [icon,setIcon]=useState("📌");
  const [showIcon,setShowIcon]=useState(false); const [accent,setAccent]=useState(defaultAccent||"#833AB4");
  useEffect(()=>{if(open){setLabel("");setIcon("📌");setShowIcon(false);setAccent(defaultAccent||"#833AB4");}},[open,defaultAccent]);
  if(!open) return null;
  const submit=()=>{
    if(!label.trim()) return;
    onAdd({id:"t_"+Date.now().toString(36),label:label.trim(),icon:showIcon?icon:"📋",accent});
    onClose();
  };
  return <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,.3)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center"}}>
    <div onClick={e=>e.stopPropagation()} style={{background:"#fff",border:"1px solid #E8E8F0",borderRadius:18,width:"min(460px,92vw)",overflow:"hidden",boxShadow:"0 24px 80px rgba(131,58,180,.2)"}}>
      <div style={{padding:"20px 24px 14px",borderBottom:"1px solid #F0F0F8",display:"flex",justifyContent:"space-between",background:IG_GRADIENT_SOFT}}>
        <span style={{fontSize:17,fontWeight:800,color:"#1a1a2e"}}>Nouvelle thématique</span>
        <button onClick={onClose} style={{background:"none",border:"none",color:"#aaa",fontSize:22,cursor:"pointer"}}>×</button>
      </div>
      <div style={{padding:"18px 24px 8px",display:"flex",flexDirection:"column",gap:14}}>
        <label style={{display:"flex",flexDirection:"column",gap:5}}>
          <span style={{fontSize:11,fontWeight:700,color:"#888",textTransform:"uppercase"}}>Nom</span>
          <input value={label} onChange={e=>setLabel(e.target.value)} placeholder="Ex: Mode, Voyage..." autoFocus style={{background:"#FAFAFF",border:"1px solid #E0D0FF",borderRadius:8,padding:"10px 14px",fontSize:14,color:"#1a1a2e",outline:"none",fontFamily:"inherit"}} onKeyDown={e=>e.key==="Enter"&&submit()}/>
        </label>

        {/* Toggle emoji */}
        <div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:showIcon?10:0}}>
            <span style={{fontSize:11,fontWeight:700,color:"#888",textTransform:"uppercase"}}>Icône (optionnelle)</span>
            <button onClick={()=>setShowIcon(p=>!p)} style={{background:showIcon?IG_GRADIENT:"#F5F5FA",border:"none",borderRadius:20,padding:"4px 14px",fontSize:12,fontWeight:700,color:showIcon?"#fff":"#888",cursor:"pointer",fontFamily:"inherit",transition:"all .15s"}}>
              {showIcon?"✓ Activée":"Ajouter un emoji"}
            </button>
          </div>
          {showIcon&&<div style={{display:"flex",flexWrap:"wrap",gap:4}}>
            {ICON_PALETTE.map(ic=><button key={ic} onClick={()=>setIcon(ic)} style={{width:36,height:36,borderRadius:8,border:icon===ic?`2px solid ${accent}`:"2px solid transparent",background:icon===ic?`${accent}20`:"#F5F5FA",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>{ic}</button>)}
          </div>}
        </div>
        {/* Couleur */}
        <div>
          <span style={{fontSize:11,fontWeight:700,color:"#888",textTransform:"uppercase",display:"block",marginBottom:8}}>Couleur</span>
          <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
            {ACCENT_PALETTE.map(c=><button key={c} onClick={()=>setAccent(c)} style={{width:28,height:28,borderRadius:"50%",border:accent===c?"3px solid #1a1a2e":"3px solid transparent",background:c,cursor:"pointer"}}/>)}
          </div>
        </div>
      </div>
      <div style={{padding:"16px 24px 20px",display:"flex",justifyContent:"flex-end",gap:10}}>
        <button onClick={onClose} style={{padding:"9px 20px",borderRadius:8,border:"1px solid #E0D0FF",background:"transparent",color:"#888",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Annuler</button>
        <button onClick={submit} disabled={!label.trim()} style={{padding:"9px 24px",borderRadius:8,border:"none",background:label.trim()?IG_GRADIENT:"#ddd",color:"#fff",fontSize:13,fontWeight:700,cursor:label.trim()?"pointer":"default",fontFamily:"inherit",opacity:label.trim()?1:.5}}>Créer</button>
      </div>
    </div>
  </div>;
}

/* ═══════════ EDIT THEME MODAL ═══════════ */
function EditSectionModal({ open, onClose, onSave, section, defaultAccent }) {
  const [label,setLabel]=useState("");
  const [icon,setIcon]=useState("");
  const [showIcon,setShowIcon]=useState(false);
  const [accent,setAccent]=useState(defaultAccent||"#833AB4");
  useEffect(()=>{if(open&&section){setLabel(section.label);setIcon(section.icon||"");setShowIcon(!!section.icon);setAccent(section.accent||defaultAccent||"#833AB4");}},[open,section,defaultAccent]);
  if(!open) return null;
  const submit=()=>{
    if(!label.trim()) return;
    onSave({...section,label:label.trim(),icon:showIcon?icon:"",accent});
    onClose();
  };
  return <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,.3)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center"}}>
    <div onClick={e=>e.stopPropagation()} style={{background:"#fff",border:"1px solid #E8E8F0",borderRadius:18,width:"min(460px,92vw)",overflow:"hidden",boxShadow:"0 24px 80px rgba(131,58,180,.2)"}}>
      <div style={{padding:"20px 24px 14px",borderBottom:"1px solid #F0F0F8",display:"flex",justifyContent:"space-between",background:IG_GRADIENT_SOFT}}>
        <span style={{fontSize:17,fontWeight:800,color:"#1a1a2e"}}>Modifier la section</span>
        <button onClick={onClose} style={{background:"none",border:"none",color:"#aaa",fontSize:22,cursor:"pointer"}}>×</button>
      </div>
      <div style={{padding:"18px 24px 8px",display:"flex",flexDirection:"column",gap:14}}>
        <label style={{display:"flex",flexDirection:"column",gap:5}}>
          <span style={{fontSize:11,fontWeight:700,color:"#888",textTransform:"uppercase"}}>Nom</span>
          <input value={label} onChange={e=>setLabel(e.target.value)} autoFocus style={{background:"#FAFAFF",border:"1px solid #E0D0FF",borderRadius:8,padding:"10px 14px",fontSize:14,color:"#1a1a2e",outline:"none",fontFamily:"inherit"}} onKeyDown={e=>e.key==="Enter"&&submit()}/>
        </label>

        {/* Toggle emoji - optionnel */}
        <div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:showIcon?10:0}}>
            <span style={{fontSize:11,fontWeight:700,color:"#888",textTransform:"uppercase"}}>Icône (optionnel)</span>
            <button onClick={()=>setShowIcon(p=>!p)} style={{background:showIcon?IG_GRADIENT:"#F5F5FA",border:"none",borderRadius:20,padding:"4px 14px",fontSize:12,fontWeight:700,color:showIcon?"#fff":"#888",cursor:"pointer",fontFamily:"inherit",transition:"all .15s"}}>
              {showIcon?"✓ Activée":"Ajouter un emoji"}
            </button>
          </div>
          {showIcon&&<div style={{display:"flex",flexWrap:"wrap",gap:4}}>
            {ICON_PALETTE.map(ic=><button key={ic} onClick={()=>setIcon(ic)} style={{width:36,height:36,borderRadius:8,border:icon===ic?`2px solid ${accent}`:"2px solid transparent",background:icon===ic?`${accent}20`:"#F5F5FA",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>{ic}</button>)}
          </div>}
        </div>
        {/* Couleur */}
        <div>
          <span style={{fontSize:11,fontWeight:700,color:"#888",textTransform:"uppercase",display:"block",marginBottom:8}}>Couleur</span>
          <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
            {ACCENT_PALETTE.map(c=><button key={c} onClick={()=>setAccent(c)} style={{width:28,height:28,borderRadius:"50%",border:accent===c?"3px solid #1a1a2e":"3px solid transparent",background:c,cursor:"pointer"}}/>)}
          </div>
        </div>
      </div>
      <div style={{padding:"16px 24px 20px",display:"flex",justifyContent:"flex-end",gap:10}}>
        <button onClick={onClose} style={{padding:"9px 20px",borderRadius:8,border:"1px solid #E0D0FF",background:"transparent",color:"#888",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Annuler</button>
        <button onClick={submit} disabled={!label.trim()} style={{padding:"9px 24px",borderRadius:8,border:"none",background:label.trim()?IG_GRADIENT:"#ddd",color:"#fff",fontSize:13,fontWeight:700,cursor:label.trim()?"pointer":"default",fontFamily:"inherit",opacity:label.trim()?1:.5}}>Enregistrer</button>
      </div>
    </div>
  </div>;
}

function EditThemeModal({ open, onClose, onSave, onDelete, theme, defaultAccent }) {
  const [label,setLabel]=useState("");
  const [icon,setIcon]=useState("");
  const [showIcon,setShowIcon]=useState(false);
  const [accent,setAccent]=useState(defaultAccent||"#833AB4");
  useEffect(()=>{if(open&&theme){setLabel(theme.label);setIcon(theme.icon||"");setShowIcon(!!theme.icon);setAccent(theme.accent||defaultAccent||"#833AB4");}},[open,theme,defaultAccent]);
  if(!open) return null;
  const submit=()=>{
    if(!label.trim()) return;
    onSave({...theme,label:label.trim(),icon:showIcon?icon:"",accent});
    onClose();
  };
  return <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,.3)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center"}}>
    <div onClick={e=>e.stopPropagation()} style={{background:"#fff",border:"1px solid #E8E8F0",borderRadius:18,width:"min(460px,92vw)",overflow:"hidden",boxShadow:"0 24px 80px rgba(131,58,180,.2)"}}>
      <div style={{padding:"20px 24px 14px",borderBottom:"1px solid #F0F0F8",display:"flex",justifyContent:"space-between",background:IG_GRADIENT_SOFT}}>
        <span style={{fontSize:17,fontWeight:800,color:"#1a1a2e"}}>Modifier la thématique</span>
        <button onClick={onClose} style={{background:"none",border:"none",color:"#aaa",fontSize:22,cursor:"pointer"}}>×</button>
      </div>
      <div style={{padding:"18px 24px 8px",display:"flex",flexDirection:"column",gap:14}}>
        <label style={{display:"flex",flexDirection:"column",gap:5}}>
          <span style={{fontSize:11,fontWeight:700,color:"#888",textTransform:"uppercase"}}>Nom</span>
          <input value={label} onChange={e=>setLabel(e.target.value)} autoFocus style={{background:"#FAFAFF",border:"1px solid #E0D0FF",borderRadius:8,padding:"10px 14px",fontSize:14,color:"#1a1a2e",outline:"none",fontFamily:"inherit"}} onKeyDown={e=>e.key==="Enter"&&submit()}/>
        </label>

        {/* Toggle emoji - optionnel */}
        <div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:showIcon?10:0}}>
            <span style={{fontSize:11,fontWeight:700,color:"#888",textTransform:"uppercase"}}>Icône (optionnel)</span>
            <button onClick={()=>setShowIcon(p=>!p)} style={{background:showIcon?IG_GRADIENT:"#F5F5FA",border:"none",borderRadius:20,padding:"4px 14px",fontSize:12,fontWeight:700,color:showIcon?"#fff":"#888",cursor:"pointer",fontFamily:"inherit",transition:"all .15s"}}>
              {showIcon?"✓ Activée":"Ajouter un emoji"}
            </button>
          </div>
          {showIcon&&<div style={{display:"flex",flexWrap:"wrap",gap:4}}>
            {ICON_PALETTE.map(ic=><button key={ic} onClick={()=>setIcon(ic)} style={{width:36,height:36,borderRadius:8,border:icon===ic?`2px solid ${accent}`:"2px solid transparent",background:icon===ic?`${accent}20`:"#F5F5FA",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>{ic}</button>)}
          </div>}
        </div>
        {/* Couleur */}
        <div>
          <span style={{fontSize:11,fontWeight:700,color:"#888",textTransform:"uppercase",display:"block",marginBottom:8}}>Couleur</span>
          <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
            {ACCENT_PALETTE.map(c=><button key={c} onClick={()=>setAccent(c)} style={{width:28,height:28,borderRadius:"50%",border:accent===c?"3px solid #1a1a2e":"3px solid transparent",background:c,cursor:"pointer"}}/>)}
          </div>
        </div>
      </div>
      <div style={{padding:"16px 24px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
        <button onClick={()=>{if(onDelete){if(confirm("Êtes-vous sûr de vouloir supprimer cette thématique ? Les prospects y seront conservés mais l'onglet sera supprimé.")){onDelete();onClose();}}}} style={{padding:"9px 16px",borderRadius:8,border:"1px solid #E74C3C",background:"transparent",color:"#E74C3C",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>🗑️ Supprimer</button>
        <div style={{display:"flex",gap:10}}>
          <button onClick={onClose} style={{padding:"9px 20px",borderRadius:8,border:"1px solid #E0D0FF",background:"transparent",color:"#888",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Annuler</button>
          <button onClick={submit} disabled={!label.trim()} style={{padding:"9px 24px",borderRadius:8,border:"none",background:label.trim()?IG_GRADIENT:"#ddd",color:"#fff",fontSize:13,fontWeight:700,cursor:label.trim()?"pointer":"default",fontFamily:"inherit",opacity:label.trim()?1:.5}}>Enregistrer</button>
        </div>
      </div>
    </div>
  </div>;
}

/* ═══════════ CONFIRM MODAL ═══════════ */
function ConfirmModal({ open, msg, onOk, onNo }) {
  if(!open) return null;
  return <div onClick={onNo} style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,.3)",display:"flex",alignItems:"center",justifyContent:"center"}}>
    <div onClick={e=>e.stopPropagation()} style={{background:"#fff",border:"1px solid #E8E8F0",borderRadius:16,padding:"24px 28px",width:"min(380px,90vw)",boxShadow:"0 24px 80px rgba(131,58,180,.2)"}}>
      <p style={{fontSize:14,color:"#555",marginBottom:20,lineHeight:1.5}}>{msg}</p>
      <div style={{display:"flex",justifyContent:"flex-end",gap:10}}>
        <button onClick={onNo} style={{padding:"8px 18px",borderRadius:8,border:"1px solid #E0D0FF",background:"transparent",color:"#888",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Annuler</button>
        <button onClick={onOk} style={{padding:"8px 18px",borderRadius:8,border:"none",background:"#E1306C",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Supprimer</button>
      </div>
    </div>
  </div>;
}

/* ═══════════ IMPORT MODAL ═══════════ */
function ImportModal({ open, onClose, onImport, accent }) {
  const [preview,setPreview]=useState(null); const [error,setError]=useState(""); const [mode,setMode]=useState("replace");
  const fileRef=useRef();
  const handleFile=(file)=>{
    if(!file) return;
    const reader=new FileReader();
    reader.onload=(e)=>{
      try { const rows=parseCSV(e.target.result); if(rows.length===0){setError("Aucune ligne valide.");setPreview(null);return;} setPreview(rows); setError(""); }
      catch(err){setError("Erreur : "+err.message);setPreview(null);}
    };
    reader.readAsText(file,"UTF-8");
  };
  useEffect(()=>{if(!open){setPreview(null);setError("");}},[open]);
  if(!open) return null;
  return <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,.3)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center"}}>
    <div onClick={e=>e.stopPropagation()} style={{background:"#fff",border:"1px solid #E8E8F0",borderRadius:18,width:"min(560px,94vw)",maxHeight:"85vh",display:"flex",flexDirection:"column",boxShadow:"0 24px 80px rgba(131,58,180,.2)",overflow:"hidden"}}>
      <div style={{padding:"20px 24px 14px",borderBottom:"1px solid #F0F0F8",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0,background:IG_GRADIENT_SOFT}}>
        <div><div style={{fontSize:17,fontWeight:800,color:"#1a1a2e"}}>📥 Import CSV</div><div style={{fontSize:12,color:"#888",marginTop:2}}>Importer des influenceurs en masse</div></div>
        <button onClick={onClose} style={{background:"none",border:"none",color:"#aaa",fontSize:22,cursor:"pointer"}}>×</button>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"20px 24px"}}>
        <div onDrop={e=>{e.preventDefault();handleFile(e.dataTransfer.files[0]);}} onDragOver={e=>e.preventDefault()} onClick={()=>fileRef.current?.click()} style={{border:`2px dashed ${accent}60`,borderRadius:12,padding:"28px 20px",textAlign:"center",cursor:"pointer",background:`${accent}05`,marginBottom:14}}>
          <div style={{fontSize:28,marginBottom:6}}>📁</div>
          <div style={{fontSize:13,fontWeight:600,color:"#555"}}>Glissez un fichier CSV ou cliquez</div>
          <div style={{fontSize:11,color:"#aaa",marginTop:3}}>Séparateur , ou ; — UTF-8</div>
          <input ref={fileRef} type="file" accept=".csv,text/csv" style={{display:"none"}} onChange={e=>handleFile(e.target.files[0])}/>
        </div>
        {error&&<div style={{background:"#FFF0F0",border:"1px solid #FADADD",borderRadius:8,padding:"10px 14px",fontSize:13,color:"#C0392B",marginBottom:10}}>{error}</div>}
        {preview&&<div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div style={{fontSize:13,fontWeight:700,color:"#27AE60"}}>✓ {preview.length} ligne{preview.length>1?"s":""} détectée{preview.length>1?"s":""}</div>
            <div style={{display:"flex",gap:6}}>
              {["replace","append"].map(m=><button key={m} onClick={()=>setMode(m)} style={{padding:"4px 12px",borderRadius:20,border:`1px solid ${mode===m?accent:"#E0D0FF"}`,background:mode===m?`${accent}15`:"transparent",color:mode===m?accent:"#888",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{m==="replace"?"Remplacer":"Ajouter"}</button>)}
            </div>
          </div>
          <div style={{border:"1px solid #F0F0F8",borderRadius:8,overflow:"hidden",maxHeight:180,overflowY:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead><tr style={{background:"#F8F8FF"}}>{["Nom","Pseudo","Mail","Score","Statut"].map(h=><th key={h} style={{padding:"7px 10px",textAlign:"left",color:"#888",fontWeight:700,borderBottom:"1px solid #F0F0F8"}}>{h}</th>)}</tr></thead>
              <tbody>{preview.slice(0,8).map((r,i)=><tr key={i} style={{background:i%2===0?"#fff":"#FAFAFF"}}>
                <td style={{padding:"5px 10px",borderBottom:"1px solid #F5F5F8",color:"#333"}}>{r.nom||"—"}</td>
                <td style={{padding:"5px 10px",borderBottom:"1px solid #F5F5F8",color:"#666"}}>{r.pseudo||"—"}</td>
                <td style={{padding:"5px 10px",borderBottom:"1px solid #F5F5F8",color:"#405DE6"}}>{r.mail||"—"}</td>
                <td style={{padding:"5px 10px",borderBottom:"1px solid #F5F5F8"}}>{r.score>0?"★".repeat(r.score):"—"}</td>
                <td style={{padding:"5px 10px",borderBottom:"1px solid #F5F5F8"}}><span style={{background:SS[r.contacte]?.bg,color:SS[r.contacte]?.fg,padding:"2px 7px",borderRadius:10,fontSize:10,fontWeight:600}}>{r.contacte}</span></td>
              </tr>)}
              {preview.length>8&&<tr><td colSpan={5} style={{padding:"5px 10px",color:"#aaa",fontSize:11}}>... et {preview.length-8} autres</td></tr>}
              </tbody>
            </table>
          </div>
        </div>}
      </div>
      <div style={{padding:"14px 24px 20px",borderTop:"1px solid #F0F0F8",display:"flex",justifyContent:"flex-end",gap:10,flexShrink:0}}>
        <button onClick={onClose} style={{padding:"9px 20px",borderRadius:8,border:"1px solid #E0D0FF",background:"transparent",color:"#888",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Annuler</button>
        <button onClick={()=>{if(preview){onImport(preview,mode);onClose();}}} disabled={!preview} style={{padding:"9px 24px",borderRadius:8,border:"none",background:preview?IG_GRADIENT:"#ddd",color:"#fff",fontSize:13,fontWeight:700,cursor:preview?"pointer":"default",fontFamily:"inherit"}}>
          {preview?`Importer ${preview.length} ligne${preview.length>1?"s":""}`:"Choisir un fichier"}
        </button>
      </div>
    </div>
  </div>;
}

/* ═══════════ SAVED FILTERS ═══════════ */
function SavedFiltersPanel({ open, onClose, filters, onSave, onLoad, onDelete, currentSearch, currentStatus }) {
  const [name,setName]=useState("");
  if(!open) return null;
  return <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,.2)",display:"flex",alignItems:"flex-start",justifyContent:"flex-end",paddingTop:60,paddingRight:16}}>
    <div onClick={e=>e.stopPropagation()} style={{background:"#fff",border:"1px solid #E8E8F0",borderRadius:14,width:"min(300px,90vw)",boxShadow:"0 12px 40px rgba(131,58,180,.18)",overflow:"hidden"}}>
      <div style={{padding:"14px 18px 10px",borderBottom:"1px solid #F0F0F8",display:"flex",justifyContent:"space-between",alignItems:"center",background:IG_GRADIENT_SOFT}}>
        <span style={{fontSize:14,fontWeight:800,color:"#1a1a2e"}}>Filtres sauvegardés</span>
        <button onClick={onClose} style={{background:"none",border:"none",color:"#aaa",fontSize:20,cursor:"pointer"}}>×</button>
      </div>
      <div style={{padding:"12px 18px"}}>
        {/* Sauvegarder filtre actuel */}
        <div style={{display:"flex",gap:6,marginBottom:12}}>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="Nom du filtre..." style={{flex:1,border:"1px solid #E0D0FF",borderRadius:8,padding:"7px 10px",fontSize:12,outline:"none",fontFamily:"inherit"}} onKeyDown={e=>{if(e.key==="Enter"&&name.trim()){onSave({name:name.trim(),search:currentSearch,status:currentStatus});setName("");}}}/>
          <button onClick={()=>{if(name.trim()){onSave({name:name.trim(),search:currentSearch,status:currentStatus});setName("");}}} style={{background:IG_GRADIENT,border:"none",borderRadius:8,color:"#fff",padding:"7px 12px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Sauver</button>
        </div>
        {filters.length===0&&<div style={{fontSize:12,color:"#bbb",textAlign:"center",padding:"10px 0"}}>Aucun filtre sauvegardé</div>}
        <div style={{display:"flex",flexDirection:"column",gap:5}}>
          {filters.map((f,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 10px",borderRadius:8,background:"#F8F8FF",border:"1px solid #EEEEF8"}}>
              <button onClick={()=>{onLoad(f);onClose();}} style={{flex:1,background:"none",border:"none",cursor:"pointer",textAlign:"left",fontFamily:"inherit"}}>
                <div style={{fontSize:12,fontWeight:600,color:"#1a1a2e"}}>{f.name}</div>
                <div style={{fontSize:10,color:"#aaa"}}>{f.status!=="Tous"?f.status:"Tous statuts"}{f.search?` · "${f.search}"`:""}</div>
              </button>
              <button onClick={()=>onDelete(i)} style={{background:"none",border:"none",cursor:"pointer",color:"#E1306C",fontSize:14,padding:"2px 4px",opacity:.6}}>×</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>;
}

/* ═══════════ MAIN APP ═══════════ */
export default function Home() {
  const store = useSharedStorage("dashboard_main", {
    sections: DEFAULT_SECTIONS,
    themes: DEFAULT_THEMES,
    rows: {},
    sectionTemplates: DEFAULT_SECTION_TEMPLATES,
    themeTemplates: {},
    objectives: [],
    savedFilters: [],
    activityLog: [],
  });

  const sections = store.data?.sections || DEFAULT_SECTIONS;
  const themes = store.data?.themes || DEFAULT_THEMES;
  const rows = store.data?.rows || {};
  const sectionTemplates = store.data?.sectionTemplates || DEFAULT_SECTION_TEMPLATES;
  const themeTemplates = store.data?.themeTemplates || {};
  const objectives = store.data?.objectives || [];
  const savedFilters = store.data?.savedFilters || [];

  const [section, setSection] = useState("portage");
  const [tab, setTab] = useState("ai");
  const [search, setSearch] = useState(""); const [filterStatus, setFilterStatus] = useState("Tous");
  const [showAdd, setShowAdd] = useState(null); const [confirmDel, setConfirmDel] = useState(null);
  const [editTheme, setEditTheme] = useState(null);
  const [editSection, setEditSection] = useState(null);
  const [collapsed, setCollapsed] = useState({}); const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mailContact, setMailContact] = useState(null);
  const [ficheContact, setFicheContact] = useState(null);
  const [editTemplate, setEditTemplate] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState("table"); // "table" | "stats"
  const tableRef = useRef();

  useEffect(() => {
    if (!store.loaded) return;
    const next = { ...rows }; let ch = false;
    for (const s of Object.keys(themes)) { const a = themes[s]; if (!Array.isArray(a)) continue; for (const t of a) { if (!next[t.id]) { next[t.id] = []; ch = true; } } }
    if (ch) {
      const newData = {
        ...store.data,
        rows: next
      };
      store.save(newData);
    }
  }, [themes, store.loaded]);

  const curTheme = resolveTheme(themes, section, tab);
  const activeId = curTheme ? curTheme.id : "";
  
  useEffect(() => { if (curTheme && curTheme.id !== tab) setTab(curTheme.id); }, [curTheme, tab]);

  const curRows = activeId ? (rows[activeId] || []) : [];
  const secObj = sections.find(s => s.id === section);
  const activeTemplate = themeTemplates[activeId] || sectionTemplates[section] || "";

  // Détection doublons (dans toutes les lignes de la thématique active)
  const isDupFn = useCallback((row) => isDuplicate(curRows, row, curRows), [curRows]);

  const filtered = curRows.filter(c => {
    const q = search.toLowerCase();
    const vals = [c.nom, c.pseudo, c.mail, c.numero, c.echange, c.commentaire, c.specialisation, ...(Array.isArray(c.site)?c.site:[]), ...(Array.isArray(c.youtube)?c.youtube:[]), ...(Array.isArray(c.instagram)?c.instagram:[]), ...(Array.isArray(c.autres)?c.autres:[])];
    return (!q || vals.some(v => v && typeof v==="string" && v.toLowerCase().includes(q))) &&
      (filterStatus==="Tous" || c.contacte===filterStatus);
  });

  const dupCount = curRows.filter(r => isDupFn(r)).length;

  const addRow = () => {
    if (!activeId) {
      alert("Sélectionnez une thématique");
      return;
    }
    // Get current rows for this theme
    const currentRows = store.data?.rows?.[activeId] || [];
    // Create new row
    const newRow = makeRow();
    // Add to list
    const updatedRows = [...currentRows, newRow];
    // Save everything
    const newData = {
      ...store.data,
      rows: {
        ...store.data?.rows,
        [activeId]: updatedRows
      }
    };
    store.save(newData);
  };
  
  const updateRow = (u) => {
    if (!activeId) return;
    const currentRows = store.data?.rows?.[activeId] || [];
    const updated = currentRows.map(c => c._id===u._id ? u : c);
    const newData = {
      ...store.data,
      rows: {
        ...store.data?.rows,
        [activeId]: updated
      }
    };
    store.save(newData);
    if (ficheContact && ficheContact._id === u._id) setFicheContact(u);
  };
  
  const deleteRow = (id) => {
    if (!activeId) return;
    const currentRows = store.data?.rows?.[activeId] || [];
    const filtered = currentRows.filter(c => c._id!==id);
    const newData = {
      ...store.data,
      rows: {
        ...store.data?.rows,
        [activeId]: filtered
      }
    };
    store.save(newData);
  };
  const updateSection = (updated) => {
    const cs = store.data?.sections || sections;
    const updated_sections = cs.map(s => s.id === updated.id ? updated : s);
    store.save({ ...store.data, sections: updated_sections });
  };
  const addTheme = (secId, t) => {
    const ct = store.data?.themes || DEFAULT_THEMES;
    store.save({ ...store.data, themes: { ...ct, [secId]: [...(ct[secId]||[]), t] } });
    setSection(secId); setTab(t.id);
  };
  const updateTheme = (secId, themeId, updated) => {
    const ct = store.data?.themes || DEFAULT_THEMES;
    const updated_themes = {
      ...ct,
      [secId]: (ct[secId]||[]).map(t => t.id === themeId ? updated : t)
    };
    store.save({ ...store.data, themes: updated_themes });
  };
  const removeTheme = (id, secId) => {
    const ct = store.data?.themes || DEFAULT_THEMES;
    const cr = store.data?.rows || {};
    const ctt = store.data?.themeTemplates || {};
    const sectionId = secId || section;
    const rem = (ct[sectionId]||[]).filter(t=>t.id!==id);
    const nr={...cr}; delete nr[id];
    const nt={...ctt}; delete nt[id];
    store.save({ ...store.data, themes:{...ct,[sectionId]:rem}, rows:nr, themeTemplates:nt });
    if(tab===id&&rem.length>0)setTab(rem[0].id); setConfirmDel(null);
  };
  const selectTheme = (sid, tid) => { setSection(sid); setTab(tid); setSearch(""); setFilterStatus("Tous"); };

  const handleImport = (newRows, mode) => {
    if (!activeId) return;
    const existing = rows[activeId] || [];
    const merged = mode==="replace" ? newRows : [...existing, ...newRows];
    const newData = {
      ...store.data,
      rows: {
        ...store.data?.rows,
        [activeId]: merged
      }
    };
    store.save(newData);
  };

  const stTotal=curRows.length; const stOui=curRows.filter(c=>c.contacte==="Oui").length;
  const stWait=curRows.filter(c=>c.contacte==="En attente").length; const stRel=curRows.filter(c=>c.contacte==="Relancé").length;

  if (!store.loaded) return <div style={{height:"100vh",background:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"sans-serif"}}>
    <div style={{textAlign:"center"}}>
      <div style={{width:40,height:40,borderRadius:"50%",background:IG_GRADIENT,margin:"0 auto 16px"}}/>
      <span style={{color:"#888",fontSize:14}}>Chargement...</span>
    </div>
  </div>;

  const COLUMNS_DEF = [
    { key:"avatar", label:"Photo", w:60 }, { key:"nom", label:"Nom Prénom", w:155 }, { key:"pseudo", label:"Nom Réseaux", w:130 },
    { key:"specialisation", label:"Spécialisation", w:160 }, { key:"score", label:"Score", w:140 },
    { key:"site", label:"Site Web", w:190 }, { key:"youtube", label:"YouTube", w:190 },
    { key:"instagram", label:"Instagram", w:180 }, { key:"autres", label:"Autres Réseaux", w:190 },
    { key:"mail", label:"E-mail", w:185 }, { key:"numero", label:"Numéro", w:130 },
    { key:"contacte", label:"Contacté", w:128 }, { key:"echange", label:"Échange", w:220 },
    { key:"commentaire", label:"Commentaire", w:230 },
  ];

  return <>
    <Head>
      <title>Prospect. — Dashboard Influenceurs</title>
      <link rel="preconnect" href="https://api.fontshare.com"/>
      <link href="https://api.fontshare.com/v2/css?f[]=satoshi@500,700,900&f[]=general-sans@400,500,600&display=swap" rel="stylesheet"/>
    </Head>
    <style jsx global>{`
      *{box-sizing:border-box;margin:0;padding:0}
      body{background:#FAFAFA;overflow:hidden}
      ::-webkit-scrollbar{width:5px;height:5px}
      ::-webkit-scrollbar-track{background:transparent}
      ::-webkit-scrollbar-thumb{background:#E0D0FF;border-radius:10px}
      table{border-collapse:collapse;width:max-content;min-width:100%}
      input,textarea,select{color:#1a1a2e !important;background:#fff !important;-webkit-text-fill-color:#1a1a2e !important}
      input:-webkit-autofill,input:-webkit-autofill:hover,input:-webkit-autofill:focus,textarea:-webkit-autofill{-webkit-box-shadow:0 0 0 1000px #fff inset !important;-webkit-text-fill-color:#1a1a2e !important;background:#fff !important}
      input::placeholder,textarea::placeholder{color:#C8C8D8 !important;-webkit-text-fill-color:#C8C8D8 !important}
      input:focus,textarea:focus{border-color:#D0AEFF !important;background:#FAFAFF !important;color:#1a1a2e !important;-webkit-text-fill-color:#1a1a2e !important}
    `}</style>
    <div style={{height:"100vh",background:"#FAFAFA",color:"#1a1a2e",fontFamily:"'Satoshi','General Sans',-apple-system,sans-serif",display:"flex",overflow:"hidden"}}>

      {/* SIDEBAR */}
      <aside style={{width:sidebarOpen?260:56,flexShrink:0,background:"#fff",borderRight:"1px solid #EEEEF8",display:"flex",flexDirection:"column",transition:"width .2s ease",overflow:"hidden"}}>
        <div style={{padding:sidebarOpen?"14px 18px":"14px 10px",borderBottom:"1px solid #EEEEF8",display:"flex",alignItems:"center",justifyContent:"space-between",height:52,flexShrink:0}}>
          {sidebarOpen&&<h1 style={{fontSize:20,fontWeight:900,letterSpacing:-.6}}>
            <span style={{background:IG_GRADIENT,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Prospect.</span>
          </h1>}
          <button onClick={()=>setSidebarOpen(p=>!p)} style={{background:"none",border:"none",color:"#333",cursor:"pointer",fontSize:14,padding:"4px 6px",borderRadius:6}}>{sidebarOpen?"◀":"▶"}</button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"6px 0"}}>
          {sections.map(sec=>{
            const isCol=collapsed[sec.id]; const st=themes[sec.id]||[]; const isAct=section===sec.id;
            return <div key={sec.id} style={{marginBottom:1}}>
              <div style={{display:"flex",alignItems:"center"}}>
                <button onClick={()=>{if(!sidebarOpen){setSidebarOpen(true);return;}setCollapsed(p=>({...p,[sec.id]:!p[sec.id]}));}}
                  style={{display:"flex",alignItems:"center",gap:8,flex:1,padding:sidebarOpen?"8px 14px":"8px 0",justifyContent:sidebarOpen?"flex-start":"center",border:"none",cursor:"pointer",fontFamily:"inherit",background:isAct?`${sec.accent}08`:"transparent",color:isAct?sec.accent:"#222",fontSize:11,fontWeight:800,textTransform:"uppercase",letterSpacing:1,borderLeft:isAct?`3px solid ${sec.accent}`:"3px solid transparent"}}>
                  <span style={{fontSize:15}}>{sec.icon}</span>
                  {sidebarOpen&&<><span style={{flex:1,textAlign:"left"}}>{sec.label}</span><span style={{fontSize:9,opacity:.5,transform:isCol?"rotate(-90deg)":"rotate(0)",transition:"transform .15s"}}>▼</span></>}
                </button>
                {sidebarOpen&&isAct&&<><button onClick={()=>setEditTemplate({type:"section",id:sec.id,label:sec.label,accent:sec.accent})} title="Template mail" style={{background:"none",border:"none",cursor:"pointer",fontSize:12,padding:"4px 6px",opacity:.4,color:sec.accent}}>📝</button><button onClick={()=>setEditSection(sec)} title="Modifier section" style={{background:"none",border:"none",cursor:"pointer",fontSize:10,padding:"2px 4px",opacity:.35,color:sec.accent}}>✏️</button></>}
              </div>
              {sidebarOpen&&!isCol&&<div style={{padding:"2px 0 4px 20px"}}>
                {st.map(t=>{const active=sec.id===section&&activeId===t.id;const count=(rows[t.id]||[]).length;const hasOv=!!themeTemplates[t.id];return<div key={t.id} style={{display:"flex",alignItems:"center"}}>
                  <button onClick={()=>selectTheme(sec.id,t.id)} style={{display:"flex",alignItems:"center",gap:7,flex:1,padding:"6px 10px",borderRadius:7,border:"none",cursor:"pointer",background:active?`${t.accent}10`:"transparent",color:active?t.accent:"#333",fontSize:12,fontWeight:active?700:500,fontFamily:"inherit",textAlign:"left"}}>
                    <span style={{fontSize:13}}>{t.icon}</span>
                    <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.label}</span>
                    {hasOv&&<span style={{fontSize:9}}>📝</span>}
                    {count>0&&<span style={{fontSize:10,fontWeight:700,padding:"1px 5px",borderRadius:10,background:active?`${t.accent}18`:"#F5F5FA",color:active?t.accent:"#444"}}>{count}</span>}
                  </button>
                  {active&&<button onClick={()=>setEditTemplate({type:"theme",id:t.id,label:t.label,accent:t.accent})} style={{background:"none",border:"none",cursor:"pointer",fontSize:10,padding:"2px 4px",opacity:.35,color:t.accent}}>📝</button>}
                  {active&&<button onClick={()=>setEditTheme({section:sec.id,...t})} style={{background:"none",border:"none",cursor:"pointer",fontSize:10,padding:"2px 4px",opacity:.35,color:t.accent}}>✏️</button>}
                  {t.id.startsWith("t_")&&active&&<button onClick={()=>setConfirmDel(t)} style={{background:"none",border:"none",color:"#E1306C",cursor:"pointer",fontSize:12,padding:"2px 4px",opacity:.35}}>×</button>}
                </div>;})}
                <button onClick={()=>setShowAdd(sec.id)} style={{display:"flex",alignItems:"center",gap:5,width:"100%",padding:"5px 10px",borderRadius:7,border:"none",cursor:"pointer",background:"transparent",color:"#444",fontSize:11,fontWeight:600,fontFamily:"inherit"}} onMouseEnter={e=>e.currentTarget.style.color=sec.accent} onMouseLeave={e=>e.currentTarget.style.color="#444"}><span>+</span> Thématique</button>
              </div>}
            </div>;
          })}
        </div>
        {/* Vue switcher bas sidebar */}
        {sidebarOpen&&<div style={{padding:"8px 12px",borderTop:"1px solid #EEEEF8",display:"flex",gap:4}}>
          {[{id:"table",label:"☰ Table"},{id:"stats",label:"📊 Stats"}].map(v=>(
            <button key={v.id} onClick={()=>setViewMode(v.id)} style={{flex:1,padding:"5px 0",borderRadius:6,border:"none",background:viewMode===v.id?IG_GRADIENT:"#F5F5FA",color:viewMode===v.id?"#fff":"#888",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
              {v.label}
            </button>
          ))}
        </div>}
      </aside>

      {/* MAIN */}
      <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0}}>
        {/* TOPBAR */}
        <div style={{padding:"8px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap",borderBottom:"1px solid #EEEEF8",background:"#fff",flexShrink:0,minHeight:52}}>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <div style={{padding:"3px 9px",borderRadius:6,background:`${secObj?.accent||"#666"}10`,fontSize:9,fontWeight:700,color:secObj?.accent||"#888",textTransform:"uppercase",letterSpacing:1}}>{secObj?.label}</div>
            <span style={{color:"#ddd",fontSize:12}}>›</span>
            <span style={{fontSize:16}}>{curTheme?.icon}</span>
            <span style={{fontSize:14,fontWeight:700,color:"#1a1a2e"}}>{curTheme?.label||"—"}</span>
            <span style={{fontSize:11,color:"#aaa"}}>— {curRows.length} ligne{curRows.length!==1?"s":""}</span>
            {dupCount>0&&<span style={{background:"#FFF3CD",color:"#856404",border:"1px solid #FFE69C",borderRadius:10,padding:"2px 8px",fontSize:10,fontWeight:700}}>⚠ {dupCount} doublon{dupCount>1?"s":""}</span>}
            <div style={{width:1,height:16,background:"#EEEEF8"}}/>
            <div style={{position:"relative"}}>
              <span style={{position:"absolute",left:8,top:"50%",transform:"translateY(-50%)",color:"#ccc",fontSize:12}}>⌕</span>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher..." style={{background:"#FAFAFF",border:"1px solid #E8E8F8",borderRadius:8,padding:"6px 10px 6px 24px",fontSize:12,color:"#1a1a2e",outline:"none",width:160,fontFamily:"inherit"}}/>
            </div>
            <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{background:"#FAFAFF",border:"1px solid #E8E8F8",borderRadius:8,padding:"6px 10px",fontSize:12,color:"#555",outline:"none",fontFamily:"inherit"}}>
              <option value="Tous">Tous statuts</option>{STATUTS.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <button onClick={()=>setShowFilters(true)} title="Filtres sauvegardés" style={{padding:"6px 12px",borderRadius:8,border:"1px solid #E8E8F8",background:"#fff",color:"#666",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>🔖 Filtres</button>
            <button onClick={()=>setShowImport(true)} style={{padding:"6px 12px",borderRadius:8,border:"1px solid #E8E8F8",background:"#fff",color:"#666",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>📥 Import</button>
            <button onClick={()=>exportToCSV(curRows,curTheme?.label||"export",secObj?.label||"section")} style={{padding:"6px 12px",borderRadius:8,border:"1px solid #E8E8F8",background:"#fff",color:"#666",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>📤 Export</button>
            <button onClick={()=>generatePDFReport(rows,themes,sections,objectives)} style={{padding:"6px 12px",borderRadius:8,border:"1px solid #E8E8F8",background:"#fff",color:"#666",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>📄 PDF</button>
            <button onClick={addRow} style={{display:"flex",alignItems:"center",gap:5,padding:"7px 16px",borderRadius:8,border:"none",background:IG_GRADIENT,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
              <span style={{fontSize:16}}>+</span> Nouvelle ligne
            </button>
          </div>
        </div>

        {/* STATS BAR */}
        {viewMode==="table"&&<div style={{padding:"8px 16px",display:"flex",gap:8,flexWrap:"wrap",borderBottom:"1px solid #EEEEF8",background:"#FAFAFF",flexShrink:0}}>
          {[
            {l:"Total",v:stTotal,c:"#1a1a2e",bg:"#F0F0FA"},
            {l:"Contactés",v:stOui,c:"#27AE60",bg:"#F0FFF4"},
            {l:"En attente",v:stWait,c:"#B7770D",bg:"#FFFBF0"},
            {l:"Relancés",v:stRel,c:"#6C3483",bg:"#F5F0FF"},
          ].map(s=>(
            <div key={s.l} style={{background:s.bg,border:"1px solid #EEEEF8",borderRadius:10,padding:"7px 14px",display:"flex",alignItems:"center",gap:8,minWidth:110}}>
              <span style={{fontSize:10,color:"#aaa",fontWeight:600}}>{s.l}</span>
              <span style={{fontSize:18,fontWeight:800,color:s.c}}>{s.v}</span>
            </div>
          ))}
          {dupCount>0&&<div style={{background:"#FFFBF0",border:"1px solid #FFE69C",borderRadius:10,padding:"7px 14px",display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:10,color:"#856404",fontWeight:600}}>Doublons</span>
            <span style={{fontSize:18,fontWeight:800,color:"#856404"}}>{dupCount}</span>
          </div>}
        </div>}

        {/* CONTENT */}
        {viewMode==="table"&&<div ref={tableRef} style={{flex:1,overflow:"auto"}}>
          {!curTheme
            ?<div style={{padding:"80px 20px",textAlign:"center"}}><span style={{fontSize:52}}>📂</span><p style={{color:"#555",fontWeight:700,marginTop:12}}>Sélectionnez une thématique</p></div>
            :filtered.length===0&&curRows.length===0
              ?<div style={{padding:"80px 20px",textAlign:"center"}}>
                <div style={{fontSize:52,marginBottom:12}}>{curTheme.icon}</div>
                <p style={{color:"#555",fontWeight:700,marginBottom:4}}>Aucune entrée</p>
                <p style={{color:"#aaa",fontSize:13}}>Cliquez « + Nouvelle ligne » ou importez un CSV</p>
              </div>
              :filtered.length===0
                ?<div style={{padding:"60px 20px",textAlign:"center",color:"#aaa"}}>Aucun résultat</div>
                :<table>
                  <thead><tr>
                    {COLUMNS_DEF.map(col=><th key={col.key} style={{position:"sticky",top:0,zIndex:10,padding:"8px 7px",fontSize:9,fontWeight:700,color:"#aaa",textTransform:"uppercase",letterSpacing:1,textAlign:"left",background:"#F8F8FF",borderBottom:"2px solid #EEEEF8",minWidth:col.w,whiteSpace:"nowrap"}}>{col.label}</th>)}
                    <th style={{position:"sticky",top:0,zIndex:10,padding:"8px 7px",background:"#F8F8FF",borderBottom:"2px solid #EEEEF8",width:80,textAlign:"center",fontSize:9,fontWeight:700,color:"#aaa"}}>Actions</th>
                  </tr></thead>
                  <tbody>
                    {filtered.map((c,i)=><TableRow key={c._id} c={c} onUpdate={updateRow} onDelete={deleteRow} onMail={setMailContact} onOpenFiche={setFicheContact} accent={curTheme?.accent||"#833AB4"} idx={i} isDup={isDupFn(c)}/>)}
                  </tbody>
                </table>
          }
        </div>}

        {viewMode==="stats"&&<div style={{flex:1,overflow:"auto"}}>
          <StatsView rows={curRows} accent={curTheme?.accent||"#833AB4"} objectifs={objectives} onUpdateObjectifs={objs=>update({objectives:objs})}/>
        </div>}

        {/* FOOTER */}
        <footer style={{padding:"5px 16px",borderTop:"1px solid #EEEEF8",display:"flex",justifyContent:"space-between",fontSize:11,color:"#bbb",background:"#fff",flexShrink:0}}>
          <span>{filtered.length} ligne{filtered.length!==1?"s":""}{filtered.length!==curRows.length?` / ${curRows.length} total`:""}</span>
          <span style={{opacity:.5}}>Données partagées en temps réel</span>
        </footer>
      </div>

      {/* PANELS & MODALS */}
      {ficheContact&&<FichePanel contact={ficheContact} themeLabel={curTheme?.label||""} sectionLabel={secObj?.label||""} accent={curTheme?.accent||"#833AB4"} onClose={()=>setFicheContact(null)} onUpdate={updateRow} onMail={setMailContact}/>}

      {mailContact&&<MailPanel contact={mailContact} themeLabel={curTheme?.label||""} sectionLabel={secObj?.label||""} accent={curTheme?.accent||"#833AB4"} template={activeTemplate} onClose={()=>setMailContact(null)} onUpdateContact={updateRow}/>}

      <TemplateModal open={!!editTemplate} onClose={()=>setEditTemplate(null)}
        title={editTemplate?`Template — ${editTemplate.label}`:""}
        subtitle={editTemplate?.type==="section"?"Template par défaut de la section":"Surcharge pour cette thématique"}
        value={editTemplate?(editTemplate.type==="section"?(sectionTemplates[editTemplate.id]||""):(themeTemplates[editTemplate.id]||sectionTemplates[section]||"")):""  }
        onChange={val=>{if(!editTemplate)return;if(editTemplate.type==="section")update({sectionTemplates:{...sectionTemplates,[editTemplate.id]:val}});else update({themeTemplates:{...themeTemplates,[editTemplate.id]:val}});}}
        accent={editTemplate?.accent||"#833AB4"}
        isOverride={editTemplate?.type==="theme"&&!!themeTemplates[editTemplate?.id]}
        onClearOverride={()=>{if(editTemplate){const n={...themeTemplates};delete n[editTemplate.id];update({themeTemplates:n});}}}/>

      <AddThemeModal open={!!showAdd} onClose={()=>setShowAdd(null)} onAdd={t=>addTheme(showAdd,t)} defaultAccent={sections.find(s=>s.id===showAdd)?.accent}/>

      <EditSectionModal open={!!editSection} onClose={()=>setEditSection(null)} onSave={s=>{ updateSection(s); setEditSection(null); }} section={editSection} defaultAccent={editSection?.accent}/>

      <EditThemeModal open={!!editTheme} onClose={()=>setEditTheme(null)} onSave={t=>{ if(editTheme.section){updateTheme(editTheme.section,editTheme.id,t);setEditTheme(null);} }} onDelete={()=>{if(editTheme?.id&&editTheme?.section){removeTheme(editTheme.id,editTheme.section);}}} theme={editTheme} defaultAccent={editTheme?.accent}/>

      <ImportModal open={showImport} onClose={()=>setShowImport(false)} onImport={handleImport} accent={curTheme?.accent||"#833AB4"}/>

      <SavedFiltersPanel open={showFilters} onClose={()=>setShowFilters(false)}
        filters={savedFilters}
        currentSearch={search} currentStatus={filterStatus}
        onSave={f=>update({savedFilters:[...(savedFilters||[]),{...f,id:"f"+Date.now()}]})}
        onLoad={f=>{setSearch(f.search||"");setFilterStatus(f.status||"Tous");}}
        onDelete={i=>update({savedFilters:(savedFilters||[]).filter((_,j)=>j!==i)})}/>

      <ConfirmModal open={!!confirmDel} msg={`Supprimer « ${confirmDel?.label} » ?`} onOk={()=>removeTheme(confirmDel.id)} onNo={()=>setConfirmDel(null)}/>
    </div>
  </>;
}
