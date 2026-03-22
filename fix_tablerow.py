#!/usr/bin/env python3
from pathlib import Path

# Read the file
path = Path('pages/index.js')
lines = path.read_text(encoding='utf-8').splitlines()

# Find TableRow marker and Stats View marker
table_row_idx = next(i for i,l in enumerate(lines) if 'TABLE ROW' in l)
stats_view_idx = next(i for i,l in enumerate(lines) if 'STATS VIEW' in l)

# Build the new TableRow function
new_tablerow = [
    '/* ═══════════ TABLE ROW ═══════════ */',
    'function TableRow({ c, onUpdate, onDelete, onMail, onOpenFiche, accent, idx, isDup, columns }) {',
    '  const [h,setH]=useState(false);',
    '  const up=(k,v)=>onUpdate({...c,[k]:v});',
    '  const bg=h?"#F8F0FF":idx%2===0?"#FFFFFF":"#FAFAFA";',
    '  return <tr onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)} style={{background:bg,transition:"background .12s"}}>',
    '    {columns.map(col=>{',
    '      const key = col.key;',
    '      const value = c[key];',
    '      if(key === "avatar") return <td key={key} style={{...td0,width:56,paddingLeft:8}}><AvatarCell value={value||""} onChange={v=>up(key,v)} nom={c.nom} pseudo={c.pseudo}/></td>;',
    '      if(key === "specialisation" || key === "echange" || key === "commentaire") return <td key={key} style={td0}><textarea value={value||""} onChange={e=>up(key,e.target.value)} placeholder={col.label} rows={2} style={{...ci,resize:"vertical",minHeight:32,lineHeight:1.4}} onFocus={focB} onBlur={bluB}/></td>;',
    '      if(key === "score") return <td key={key} style={td0}><StarRating value={value||0} onChange={v=>up(key,v)}/></td>;',
    '      if(key === "site" || key === "youtube" || key === "instagram" || key === "autres") {',
    '        const ph = key === "site" ? "https://site.com" : key === "youtube" ? "https://youtube.com/@..." : key === "instagram" ? "https://instagram.com/..." : "TikTok, LinkedIn...";',
    '        const color = key === "youtube" ? "#FF0000" : key === "instagram" ? "#E1306C" : "#405DE6";',
    '        return <td key={key} style={td0}><LinkCell links={value||[""]} onChange={v=>up(key,v)} ph={ph} accent={color}/></td>;',
    '      }',
    '      if(key === "contacte") return <td key={key} style={{...td0,textAlign:"center"}}><StatusBadge value={value||"Non"} onChange={v=>up(key,v)}/></td>;',
    '      return <td key={key} style={td0}><input value={value||""} onChange={e=>up(key,e.target.value)} placeholder={col.label} style={{...ci,color:key === "mail" ? (value ? "#405DE6" : "#1a1a2e") : "#1a1a2e"}} onFocus={focB} onBlur={bluB}/></td>;',
    '    })}',
    '    <td style={{...td0,textAlign:"center"}}>',
    '      <div style={{display:"flex",gap:2,justifyContent:"center",opacity:h?1:0,transition:"opacity .15s"}}>',
    '        <button onClick={()=>onOpenFiche(c)} title="Fiche détaillée" style={{background:"none",border:"none",cursor:"pointer",fontSize:15,padding:4}}>👤</button>',
    '        <button onClick={()=>onMail(c)} title="Générer un mail IA" style={{background:"none",border:"none",cursor:"pointer",fontSize:15,padding:4}}>✉️</button>',
    '        <button onClick={()=>onDelete(c._id)} title="Supprimer" style={{background:"none",border:"none",cursor:"pointer",color:"#E1306C",fontSize:15,padding:4}}>🗑</button>',
    '      </div>',
    '    </td>',
    '  </tr>;',
    '}',
]

# Reconstruct file
new_lines = lines[:table_row_idx] + new_tablerow + ['', ''] + lines[stats_view_idx:]
path.write_text('\n'.join(new_lines), encoding='utf-8')
print(f'✅ TableRow updated: lines {table_row_idx} to {stats_view_idx} replaced with dynamic version')
