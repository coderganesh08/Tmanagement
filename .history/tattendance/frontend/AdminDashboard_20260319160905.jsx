import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../src/assets/api";
import "../App.css";

const OFFICE_START = "09:00";
function parseTime(t) {
  if (!t) return null;
  const [time, p] = t.split(" ");
  let [h, m] = time.split(":").map(Number);
  if (p === "PM" && h !== 12) h += 12;
  if (p === "AM" && h === 12) h = 0;
  return h * 60 + m;
}
function getStatus(ci) {
  if (!ci) return "absent";
  const min = parseTime(ci);
  const [oh, om] = OFFICE_START.split(":").map(Number);
  return min !== null && min <= oh * 60 + om ? "ontime" : "late";
}
const SC = { ontime: { color:"#22c55e", bg:"#14532d", label:"On Time" }, late: { color:"#f59e0b", bg:"#451a03", label:"Late" }, absent: { color:"#ef4444", bg:"#450a0a", label:"Absent" } };

export default function Dashboard() {
  const navigate = useNavigate();
  const [teachers, setTeachers]     = useState([]);
  const [attendance, setAttendance] = useState({});
  const [activePage, setActivePage] = useState("home");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [detailTeacher, setDetailTeacher] = useState(null);

  const [name, setName]         = useState("");
  const [subject, setSubject]   = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [editId, setEditId]     = useState(null);

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear]   = useState(new Date().getFullYear());
  const [holidays, setHolidays]           = useState(() => JSON.parse(localStorage.getItem("holidays") || "[]"));
  const [holidayDate, setHolidayDate]     = useState("");
  const [holidayName, setHolidayName]     = useState("");

  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [t, a] = await Promise.all([api.get("/teachers"), api.get("/attendance")]);
      setTeachers(t); setAttendance(a);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchAll(); }, []);

  const getWorkingDays = (month, year) => {
    const days = new Date(year, month + 1, 0).getDate();
    let count = 0;
    for (let d = 1; d <= days; d++) {
      const date = new Date(year, month, d);
      const ds = date.toLocaleDateString("en-IN");
      if (date.getDay() !== 0 && date.getDay() !== 6 && !holidays.some(h => h.date === ds)) count++;
    }
    return count;
  };
  const getMonthRecords = (em, month, year) =>
    (attendance[em] || []).filter(r => { const p = r.date.split("/"); return p.length===3 && parseInt(p[1])-1===month && parseInt(p[2])===year; });
  const getTodayRecord = (em) => (attendance[em] || []).find(r => r.date === new Date().toLocaleDateString("en-IN"));

  const workingDays = getWorkingDays(selectedMonth, selectedYear);
  const todayStats = teachers.reduce((acc, t) => { const s = getStatus(getTodayRecord(t.email)?.checkIn); acc[s]=(acc[s]||0)+1; return acc; }, { ontime:0, late:0, absent:0 });

  const monthStats = teachers.map(t => {
    const recs = getMonthRecords(t.email, selectedMonth, selectedYear);
    const present = recs.length;
    const ontime = recs.filter(r => getStatus(r.checkIn) === "ontime").length;
    const late = recs.filter(r => getStatus(r.checkIn) === "late").length;
    const absent = Math.max(0, workingDays - present);
    const pct = workingDays > 0 ? ((present / workingDays) * 100).toFixed(1) : "0.0";
    return { ...t, recs, present, ontime, late, absent, pct };
  });

  const handleSubmit = async () => {
    if (!name || !subject) { setError("Fill all fields"); return; }
    setLoading(true); setError("");
    try {
      if (editId) { await api.put(`/teachers/${editId}`, { name, subject }); setEditId(null); }
      else { if (!email || !password) { setError("Email and password required"); return; } await api.post("/teachers", { name, subject, email, password }); }
      setName(""); setSubject(""); setEmail(""); setPassword("");
      await fetchAll(); setActivePage("list");
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };
  const handleEdit = (t) => { setName(t.name); setSubject(t.subject); setEmail(t.email); setPassword(""); setEditId(t.id); setActivePage("add"); };
  const handleDelete = async (id) => {
    if (!window.confirm("Delete?")) return;
    try { await api.delete(`/teachers/${id}`); await fetchAll(); } catch (e) { setError(e.message); }
  };
  const handleAddHoliday = () => {
    if (!holidayDate || !holidayName) return;
    const updated = [...holidays, { date: new Date(holidayDate).toLocaleDateString("en-IN"), name: holidayName }];
    setHolidays(updated); localStorage.setItem("holidays", JSON.stringify(updated));
    setHolidayDate(""); setHolidayName("");
  };
  const handleDeleteHoliday = (i) => {
    const updated = holidays.filter((_, idx) => idx !== i);
    setHolidays(updated); localStorage.setItem("holidays", JSON.stringify(updated));
  };
  const handleLogout = () => { localStorage.removeItem("token"); localStorage.removeItem("user"); navigate("/"); };

  const navItems = [
    { key:"home",       icon:"🏠", label:"Home" },
    { key:"today",      icon:"📋", label:"Today" },
    { key:"attendance", icon:"📅", label:"Monthly" },
    { key:"add",        icon:"➕", label:"Add Teacher" },
    { key:"list",       icon:"👩‍🏫", label:"Teachers" },
    { key:"holidays",   icon:"🎉", label:"Holidays" },
  ];

  const card = { background:"#1e293b", borderRadius:"12px", padding:"24px", border:"1px solid #334155", marginBottom:"16px" };
  const inp  = { padding:"10px 14px", borderRadius:"8px", border:"1px solid #334155", background:"#0f172a", color:"#e2e8f0", fontSize:"14px", width:"100%", boxSizing:"border-box" };
  const btn  = (bg,col="#fff") => ({ padding:"8px 16px", borderRadius:"8px", background:bg, color:col, border:"none", cursor:"pointer", fontWeight:600, fontSize:"13px" });
  const th   = { padding:"10px 12px", textAlign:"left", color:"#64748b", fontWeight:500, fontSize:"13px", borderBottom:"1px solid #334155" };
  const td   = { padding:"11px 12px", fontSize:"14px", borderBottom:"1px solid #1e293b" };

  const DetailModal = () => {
    if (!detailTeacher) return null;
    const t = detailTeacher;
    const recs = getMonthRecords(t.email, selectedMonth, selectedYear);
    const present = recs.length;
    const ontime = recs.filter(r=>getStatus(r.checkIn)==="ontime").length;
    const late = recs.filter(r=>getStatus(r.checkIn)==="late").length;
    const absent = Math.max(0, workingDays - present);
    const pct = workingDays > 0 ? ((present/workingDays)*100).toFixed(1) : "0.0";
    const pc = parseFloat(pct)>=75?"#22c55e":parseFloat(pct)>=50?"#f59e0b":"#ef4444";
    return (
      <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center" }} onClick={()=>setDetailTeacher(null)}>
        <div style={{ background:"#1e293b",borderRadius:"16px",padding:"28px",width:"min(680px,95vw)",maxHeight:"85vh",overflowY:"auto",border:"1px solid #334155" }} onClick={e=>e.stopPropagation()}>
          <div style={{ display:"flex",justifyContent:"space-between",marginBottom:"20px" }}>
            <div><h2 style={{ margin:0,color:"#f1f5f9" }}>{t.name}</h2><p style={{ margin:"4px 0 0",color:"#64748b",fontSize:"13px" }}>{t.subject} · {months[selectedMonth]} {selectedYear}</p></div>
            <button onClick={()=>setDetailTeacher(null)} style={btn("#334155")}>✕ Close</button>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:"10px",marginBottom:"20px" }}>
            {[{l:"Present",v:present,c:"#22c55e"},{l:"On Time",v:ontime,c:"#22c55e"},{l:"Late",v:late,c:"#f59e0b"},{l:"Absent",v:absent,c:"#ef4444"},{l:"Rate",v:pct+"%",c:pc}].map(s=>(
              <div key={s.l} style={{ background:"#0f172a",borderRadius:"10px",padding:"12px",textAlign:"center" }}>
                <div style={{ fontSize:"20px",fontWeight:700,color:s.c }}>{s.v}</div>
                <div style={{ color:"#64748b",fontSize:"11px",marginTop:"2px" }}>{s.l}</div>
              </div>
            ))}
          </div>
          <div style={{ background:"#0f172a",borderRadius:"99px",height:"8px",overflow:"hidden",marginBottom:"20px" }}>
            <div style={{ width:`${pct}%`,background:pc,height:"100%",borderRadius:"99px" }} />
          </div>
          <table style={{ width:"100%",borderCollapse:"collapse" }}>
            <thead><tr>{["Date","Check In","Check Out","Duration","Status"].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {recs.length===0?<tr><td colSpan={5} style={{ padding:"20px",textAlign:"center",color:"#64748b" }}>No records.</td></tr>:
              recs.sort((a,b)=>a.date.localeCompare(b.date)).map((r,i)=>{
                const st=getStatus(r.checkIn); const im=parseTime(r.checkIn); const om=parseTime(r.checkOut);
                const dur=im!==null&&om!==null?`${Math.floor((om-im)/60)}h ${(om-im)%60}m`:"—";
                return (<tr key={i}><td style={td}>{r.date}</td><td style={td}>{r.checkIn||"—"}</td><td style={td}>{r.checkOut||"—"}</td><td style={{...td,color:"#94a3b8"}}>{dur}</td>
                  <td style={td}><span style={{ background:SC[st].bg,color:SC[st].color,padding:"3px 10px",borderRadius:"99px",fontSize:"12px",fontWeight:600 }}>{SC[st].label}</span></td></tr>);
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display:"flex",minHeight:"100vh",background:"#0f172a",fontFamily:"sans-serif" }}>
      <div style={{ width:sidebarOpen?"220px":"60px",minHeight:"100vh",background:"#1e293b",transition:"width 0.25s",overflow:"hidden",flexShrink:0,display:"flex",flexDirection:"column",borderRight:"1px solid #334155" }}>
        <button onClick={()=>setSidebarOpen(!sidebarOpen)} style={{ background:"none",border:"none",color:"#94a3b8",fontSize:"18px",padding:"16px",cursor:"pointer",textAlign:sidebarOpen?"right":"center",borderBottom:"1px solid #334155" }}>
          {sidebarOpen?"◀":"▶"}
        </button>
        {navItems.map(item=>(
          <button key={item.key} onClick={()=>{ setActivePage(item.key); setDetailTeacher(null); if(item.key==="add"){setEditId(null);setName("");setSubject("");setEmail("");setPassword("");} }}
            style={{ display:"flex",alignItems:"center",gap:"10px",padding:"12px 16px",background:activePage===item.key?"#0ea5e9":"transparent",border:"none",color:activePage===item.key?"#fff":"#94a3b8",cursor:"pointer",fontSize:"14px",fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",transition:"background 0.2s" }}>
            <span style={{ fontSize:"17px",flexShrink:0 }}>{item.icon}</span>
            {sidebarOpen&&<span>{item.label}</span>}
          </button>
        ))}
        <button onClick={handleLogout} style={{ marginTop:"auto",display:"flex",alignItems:"center",gap:"10px",padding:"12px 16px",background:"none",border:"none",color:"#f87171",cursor:"pointer",fontSize:"14px",whiteSpace:"nowrap",overflow:"hidden" }}>
          <span style={{ fontSize:"17px",flexShrink:0 }}>🚪</span>{sidebarOpen&&<span>Logout</span>}
        </button>
      </div>

      <div style={{ flex:1,padding:"28px",color:"#e2e8f0",overflowY:"auto" }}>
        <h1 style={{ margin:"0 0 24px",fontSize:"22px",fontWeight:700,color:"#f1f5f9" }}>
          {navItems.find(n=>n.key===activePage)?.icon} {activePage==="home"?"Dashboard":activePage==="today"?"Today":activePage==="attendance"?"Monthly Attendance":activePage==="add"?(editId?"Edit Teacher":"Add Teacher"):activePage==="list"?"Teachers":"Holidays"}
        </h1>

        {error&&<div style={{ color:"#fca5a5",background:"#450a0a",padding:"10px 16px",borderRadius:"8px",marginBottom:"16px" }}>{error}</div>}

        {activePage==="home"&&(
          <div>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:"14px",marginBottom:"24px" }}>
              {[
                { label:"Total Teachers", value:teachers.length,                   color:"#0ea5e9", icon:"👩‍🏫" },
                { label:"Present Today",  value:todayStats.ontime+todayStats.late, color:"#22c55e", icon:"✅" },
                { label:"On Time",        value:todayStats.ontime,                 color:"#22c55e", icon:"⏰" },
                { label:"Late",           value:todayStats.late,                   color:"#f59e0b", icon:"🕐" },
                { label:"Absent Today",   value:todayStats.absent,                 color:"#ef4444", icon:"❌" },
                { label:"Working Days",   value:getWorkingDays(new Date().getMonth(),new Date().getFullYear()), color:"#a78bfa", icon:"📆" },
                { label:"Holidays",       value:holidays.length,                   color:"#f59e0b", icon:"🎉" },
              ].map((s,i)=>(
                <div key={i} style={{ background:"#1e293b",borderRadius:"12px",padding:"18px",border:"1px solid #334155" }}>
                  <div style={{ fontSize:"20px",marginBottom:"6px" }}>{s.icon}</div>
                  <div style={{ fontSize:"24px",fontWeight:700,color:s.color }}>{s.value}</div>
                  <div style={{ color:"#64748b",fontSize:"11px",marginTop:"2px" }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={card}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"14px" }}>
                <h3 style={{ margin:0,color:"#f1f5f9",fontSize:"15px" }}>📋 Today's Quick View</h3>
                <button onClick={()=>setActivePage("today")} style={btn("#0ea5e9")}>Full View →</button>
              </div>
              <table style={{ width:"100%",borderCollapse:"collapse" }}>
                <thead><tr>{["Teacher","Check In","Status"].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {teachers.map(t=>{ const rec=getTodayRecord(t.email); const st=getStatus(rec?.checkIn);
                    return(<tr key={t.id}><td style={{...td,fontWeight:500}}>{t.name}</td><td style={td}>{rec?.checkIn||"—"}</td>
                      <td style={td}><span style={{ background:SC[st].bg,color:SC[st].color,padding:"3px 10px",borderRadius:"99px",fontSize:"12px",fontWeight:600 }}>{SC[st].label}</span></td></tr>);
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activePage==="today"&&(
          <div>
            <div style={{ display:"flex",gap:"12px",marginBottom:"20px",flexWrap:"wrap" }}>
              {[{label:"On Time",value:todayStats.ontime,color:"#22c55e",bg:"#14532d"},{label:"Late",value:todayStats.late,color:"#f59e0b",bg:"#451a03"},{label:"Absent",value:todayStats.absent,color:"#ef4444",bg:"#450a0a"}].map(s=>(
                <div key={s.label} style={{ background:s.bg,borderRadius:"10px",padding:"14px 22px",display:"flex",alignItems:"center",gap:"10px" }}>
                  <span style={{ fontSize:"22px",fontWeight:700,color:s.color }}>{s.value}</span>
                  <span style={{ color:s.color,fontSize:"13px" }}>{s.label}</span>
                </div>
              ))}
            </div>
            <div style={card}>
              <table style={{ width:"100%",borderCollapse:"collapse" }}>
                <thead><tr>{["Teacher","Subject","Check In","Check Out","Duration","Status"].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {teachers.map(t=>{ const rec=getTodayRecord(t.email); const st=getStatus(rec?.checkIn);
                    const im=parseTime(rec?.checkIn); const om=parseTime(rec?.checkOut);
                    const dur=im!==null&&om!==null?`${Math.floor((om-im)/60)}h ${(om-im)%60}m`:"—";
                    return(<tr key={t.id}>
                      <td style={{...td,fontWeight:500}}>{t.name}</td><td style={{...td,color:"#64748b"}}>{t.subject}</td>
                      <td style={td}>{rec?.checkIn||"—"}</td><td style={td}>{rec?.checkOut||"—"}</td>
                      <td style={{...td,color:"#94a3b8"}}>{dur}</td>
                      <td style={td}><span style={{ background:SC[st].bg,color:SC[st].color,padding:"3px 10px",borderRadius:"99px",fontSize:"12px",fontWeight:600 }}>{SC[st].label}</span></td>
                    </tr>);
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activePage==="attendance"&&(
          <div>
            <div style={{ display:"flex",gap:"12px",marginBottom:"20px",alignItems:"center",flexWrap:"wrap" }}>
              <select value={selectedMonth} onChange={e=>setSelectedMonth(Number(e.target.value))} style={{...inp,width:"auto"}}>
                {months.map((m,i)=><option key={i} value={i}>{m}</option>)}
              </select>
              <select value={selectedYear} onChange={e=>setSelectedYear(Number(e.target.value))} style={{...inp,width:"auto"}}>
                {[2024,2025,2026].map(y=><option key={y} value={y}>{y}</option>)}
              </select>
              <span style={{ color:"#64748b",fontSize:"13px" }}>Working days: <strong style={{ color:"#e2e8f0" }}>{workingDays}</strong></span>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:"12px",marginBottom:"20px" }}>
              {(()=>{ const tp=monthStats.reduce((s,t)=>s+t.present,0); const to=monthStats.reduce((s,t)=>s+t.ontime,0); const tl=monthStats.reduce((s,t)=>s+t.late,0); const ta=monthStats.reduce((s,t)=>s+t.absent,0); const avg=monthStats.length>0?(monthStats.reduce((s,t)=>s+parseFloat(t.pct),0)/monthStats.length).toFixed(1):"0.0";
                return[{l:"Total Present",v:tp,c:"#22c55e",i:"✅"},{l:"On Time",v:to,c:"#22c55e",i:"⏰"},{l:"Late",v:tl,c:"#f59e0b",i:"🕐"},{l:"Absent",v:ta,c:"#ef4444",i:"❌"},{l:"Avg Rate",v:avg+"%",c:"#a78bfa",i:"📊"}].map((s,i)=>(
                  <div key={i} style={{ background:"#1e293b",borderRadius:"12px",padding:"16px",border:"1px solid #334155" }}>
                    <div style={{ fontSize:"18px",marginBottom:"4px" }}>{s.i}</div>
                    <div style={{ fontSize:"20px",fontWeight:700,color:s.c }}>{s.v}</div>
                    <div style={{ color:"#64748b",fontSize:"11px",marginTop:"2px" }}>{s.l}</div>
                  </div>
                ));
              })()}
            </div>
            <div style={card}>
              <table style={{ width:"100%",borderCollapse:"collapse" }}>
                <thead><tr>{["Teacher","Subject","Present","On Time","Late","Absent","Rate","Details"].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {monthStats.map(t=>{ const pc=parseFloat(t.pct)>=75?"#22c55e":parseFloat(t.pct)>=50?"#f59e0b":"#ef4444";
                    return(<tr key={t.id}>
                      <td style={{...td,fontWeight:500}}>{t.name}</td><td style={{...td,color:"#64748b"}}>{t.subject}</td>
                      <td style={{...td,color:"#22c55e"}}>{t.present}</td><td style={{...td,color:"#22c55e"}}>{t.ontime}</td>
                      <td style={{...td,color:"#f59e0b"}}>{t.late}</td><td style={{...td,color:"#ef4444"}}>{t.absent}</td>
                      <td style={{...td,minWidth:"140px"}}>
                        <div style={{ display:"flex",alignItems:"center",gap:"8px" }}>
                          <div style={{ flex:1,background:"#0f172a",borderRadius:"99px",height:"7px",overflow:"hidden" }}>
                            <div style={{ width:`${t.pct}%`,background:pc,height:"100%",borderRadius:"99px" }}/>
                          </div>
                          <span style={{ color:pc,fontWeight:600,fontSize:"13px",minWidth:"40px" }}>{t.pct}%</span>
                        </div>
                      </td>
                      <td style={td}><button onClick={()=>setDetailTeacher(t)} style={btn("#1d4ed8")}>View →</button></td>
                    </tr>);
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activePage==="add"&&(
          <div style={{...card,maxWidth:"480px"}}>
            <div style={{ display:"flex",flexDirection:"column",gap:"12px" }}>
              {[{ph:"Teacher Name",v:name,s:setName,t:"text"},{ph:"Subject",v:subject,s:setSubject,t:"text"},...(!editId?[{ph:"Email",v:email,s:setEmail,t:"email"},{ph:"Password",v:password,s:setPassword,t:"password"}]:[])].map((f,i)=>(
                <input key={i} type={f.t} placeholder={f.ph} value={f.v} onChange={e=>f.s(e.target.value)} style={inp}/>
              ))}
              <button onClick={handleSubmit} disabled={loading} style={btn("#0ea5e9")}>{loading?"Saving...":editId?"Update Teacher":"Add Teacher"}</button>
            </div>
          </div>
        )}

        {activePage==="list"&&(
          <div style={card}>
            {loading?<p>Loading...</p>:teachers.length===0?<p style={{ color:"#64748b" }}>No teachers.</p>:(
              <table style={{ width:"100%",borderCollapse:"collapse" }}>
                <thead><tr>{["Name","Subject","Email","Actions"].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {teachers.map(t=>(
                    <tr key={t.id}>
                      <td style={{...td,fontWeight:500}}>{t.name}</td><td style={{...td,color:"#64748b"}}>{t.subject}</td><td style={{...td,color:"#64748b"}}>{t.email}</td>
                      <td style={td}><div style={{ display:"flex",gap:"8px" }}>
                        <button onClick={()=>handleEdit(t)} style={btn("#0ea5e9")}>Edit</button>
                        <button onClick={()=>handleDelete(t.id)} style={btn("#dc2626")}>Delete</button>
                        <button onClick={()=>{ setDetailTeacher(t); setActivePage("attendance"); }} style={btn("#1d4ed8")}>Attendance</button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activePage==="holidays"&&(
          <div>
            <div style={{...card,maxWidth:"480px"}}>
              <h3 style={{ margin:"0 0 16px",color:"#f1f5f9",fontSize:"15px" }}>Add Holiday</h3>
              <div style={{ display:"flex",flexDirection:"column",gap:"10px" }}>
                <input type="date" value={holidayDate} onChange={e=>setHolidayDate(e.target.value)} style={inp}/>
                <input type="text" placeholder="Holiday Name" value={holidayName} onChange={e=>setHolidayName(e.target.value)} style={inp}/>
                <button onClick={handleAddHoliday} style={btn("#f59e0b","#000")}>Add Holiday</button>
              </div>
            </div>
            <div style={card}>
              <h3 style={{ margin:"0 0 16px",color:"#f1f5f9",fontSize:"15px" }}>Marked Holidays ({holidays.length})</h3>
              {holidays.length===0?<p style={{ color:"#64748b" }}>No holidays yet.</p>:holidays.map((h,i)=>(
                <div key={i} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",background:"#0f172a",borderRadius:"8px",marginBottom:"8px" }}>
                  <div><span style={{ fontWeight:600 }}>{h.name}</span><span style={{ color:"#64748b",marginLeft:"12px",fontSize:"13px" }}>{h.date}</span></div>
                  <button onClick={()=>handleDeleteHoliday(i)} style={btn("#dc2626")}>Remove</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <DetailModal/>
    </div>
  );
}