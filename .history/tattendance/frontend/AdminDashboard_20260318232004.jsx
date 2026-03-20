import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "./api";
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
const LS = { pending: { color:"#fcd34d", bg:"#451a03" }, approved: { color:"#86efac", bg:"#14532d" }, rejected: { color:"#fca5a5", bg:"#450a0a" } };
const PS = { urgent: { bg:"#450a0a", color:"#fca5a5", border:"#dc2626" }, normal: { bg:"#1e293b", color:"#e2e8f0", border:"#334155" }, info: { bg:"#0c2340", color:"#93c5fd", border:"#1d4ed8" } };

export default function Dashboard() {
  const navigate = useNavigate();
  const [teachers, setTeachers]       = useState([]);
  const [attendance, setAttendance]   = useState({});
  const [leaves, setLeaves]           = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [dutyMap, setDutyMap]         = useState({});
  const [activePage, setActivePage]   = useState("home");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");
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

  // Announcement form
  const [annTitle, setAnnTitle]       = useState("");
  const [annBody, setAnnBody]         = useState("");
  const [annPriority, setAnnPriority] = useState("normal");

  // Leave review
  const [reviewNote, setReviewNote] = useState("");

  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [t, a, l, ann, d] = await Promise.all([
        api.get("/teachers"),
        api.get("/attendance"),
        api.get("/leaves"),
        api.get("/announcements"),
        api.get("/duty"),
      ]);
      setTeachers(t); setAttendance(a); setLeaves(l); setAnnouncements(ann); setDutyMap(d);
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
  const pendingLeaves = leaves.filter(l => l.status === "pending").length;
  const onDutyCount = Object.values(dutyMap).filter(d => d.active).length;

  const monthStats = teachers.map(t => {
    const recs = getMonthRecords(t.email, selectedMonth, selectedYear);
    const present = recs.length;
    const ontime = recs.filter(r => getStatus(r.checkIn) === "ontime").length;
    const late = recs.filter(r => getStatus(r.checkIn) === "late").length;
    const absent = Math.max(0, workingDays - present);
    const pct = workingDays > 0 ? ((present / workingDays) * 100).toFixed(1) : "0.0";
    return { ...t, recs, present, ontime, late, absent, pct };
  });

  // Teacher CRUD
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

  // Holidays
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

  // Announcements
  const handlePostAnnouncement = async () => {
    if (!annTitle || !annBody) { setError("Title and body required"); return; }
    try { await api.post("/announcements", { title: annTitle, body: annBody, priority: annPriority }); setAnnTitle(""); setAnnBody(""); setAnnPriority("normal"); await fetchAll(); }
    catch (e) { setError(e.message); }
  };
  const handleDeleteAnnouncement = async (id) => {
    try { await api.delete(`/announcements/${id}`); await fetchAll(); } catch (e) { setError(e.message); }
  };

  // Leaves
  const handleReviewLeave = async (id, status) => {
    try { await api.put(`/leaves/${id}`, { status, reviewNote }); setReviewNote(""); await fetchAll(); }
    catch (e) { setError(e.message); }
  };

  const handleLogout = () => { localStorage.removeItem("token"); localStorage.removeItem("user"); navigate("/"); };

  const navItems = [
    { key:"home",          icon:"🏠", label:"Home" },
    { key:"today",         icon:"📋", label:"Today" },
    { key:"attendance",    icon:"📅", label:"Monthly" },
    { key:"duty",          icon:"🟢", label:"On Duty" },
    { key:"leaves",        icon:"📝", label:"Leaves",        badge: pendingLeaves },
    { key:"announcements", icon:"📢", label:"Announcements" },
    { key:"add",           icon:"➕", label:"Add Teacher" },
    { key:"list",          icon:"👩‍🏫", label:"Teachers" },
    { key:"holidays",      icon:"🎉", label:"Holidays" },
  ];

  const card = { background:"#1e293b", borderRadius:"12px", padding:"24px", border:"1px solid #334155", marginBottom:"16px" };
  const inp  = { padding:"10px 14px", borderRadius:"8px", border:"1px solid #334155", background:"#0f172a", color:"#e2e8f0", fontSize:"14px", width:"100%", boxSizing:"border-box" };
  const btn  = (bg,col="#fff") => ({ padding:"8px 16px", borderRadius:"8px", background:bg, color:col, border:"none", cursor:"pointer", fontWeight:600, fontSize:"13px" });
  const th   = { padding:"10px 12px", textAlign:"left", color:"#64748b", fontWeight:500, fontSize:"13px", borderBottom:"1px solid #334155" };
  const td   = { padding:"11px 12px", fontSize:"14px", borderBottom:"1px solid #1e293b" };

  // Detail modal
  const DetailModal = () => {
    if (!detailTeacher) return null;
    const t = detailTeacher;
    const recs = getMonthRecords(t.email, selectedMonth, selectedYear);
    const present = recs.length, ontime = recs.filter(r=>getStatus(r.checkIn)==="ontime").length;
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

      {/* SIDEBAR */}
      <div style={{ width:sidebarOpen?"230px":"60px",minHeight:"100vh",background:"#1e293b",transition:"width 0.25s",overflow:"hidden",flexShrink:0,display:"flex",flexDirection:"column",borderRight:"1px solid #334155" }}>
        <button onClick={()=>setSidebarOpen(!sidebarOpen)}
          style={{ background:"none",border:"none",color:"#94a3b8",fontSize:"18px",padding:"16px",cursor:"pointer",textAlign:sidebarOpen?"right":"center",borderBottom:"1px solid #334155" }}>
          {sidebarOpen?"◀":"▶"}
        </button>
        {navItems.map(item=>(
          <button key={item.key} onClick={()=>{ setActivePage(item.key); setDetailTeacher(null); if(item.key==="add"){setEditId(null);setName("");setSubject("");setEmail("");setPassword("");} }}
            style={{ display:"flex",alignItems:"center",gap:"10px",padding:"12px 16px",background:activePage===item.key?"#0ea5e9":"transparent",border:"none",color:activePage===item.key?"#fff":"#94a3b8",cursor:"pointer",fontSize:"14px",fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",transition:"background 0.2s",position:"relative" }}>
            <span style={{ fontSize:"17px",flexShrink:0 }}>{item.icon}</span>
            {sidebarOpen&&<span>{item.label}</span>}
            {sidebarOpen&&item.badge>0&&<span style={{ marginLeft:"auto",background:"#dc2626",color:"#fff",borderRadius:"99px",fontSize:"10px",fontWeight:700,padding:"1px 6px" }}>{item.badge}</span>}
          </button>
        ))}
        <button onClick={handleLogout} style={{ marginTop:"auto",display:"flex",alignItems:"center",gap:"10px",padding:"12px 16px",background:"none",border:"none",color:"#f87171",cursor:"pointer",fontSize:"14px",whiteSpace:"nowrap",overflow:"hidden" }}>
          <span style={{ fontSize:"17px",flexShrink:0 }}>🚪</span>{sidebarOpen&&<span>Logout</span>}
        </button>
      </div>

      {/* MAIN */}
      <div style={{ flex:1,padding:"28px",color:"#e2e8f0",overflowY:"auto" }}>
        <h1 style={{ margin:"0 0 24px",fontSize:"22px",fontWeight:700,color:"#f1f5f9" }}>
          {navItems.find(n=>n.key===activePage)?.icon} {activePage==="home"?"Dashboard":activePage==="today"?"Today's Attendance":activePage==="attendance"?"Monthly Attendance":activePage==="duty"?"On Duty Status":activePage==="leaves"?"Leave Requests":activePage==="announcements"?"Announcements":activePage==="add"?(editId?"Edit Teacher":"Add Teacher"):activePage==="list"?"Teachers":"Holidays"}
        </h1>

        {error&&<div style={{ color:"#fca5a5",background:"#450a0a",padding:"10px 16px",borderRadius:"8px",marginBottom:"16px" }}>{error}</div>}

        {/* ══ HOME ══ */}
        {activePage==="home"&&(
          <div>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:"14px",marginBottom:"24px" }}>
              {[
                { label:"Total Teachers", value:teachers.length,                    color:"#0ea5e9", icon:"👩‍🏫" },
                { label:"Present Today",  value:todayStats.ontime+todayStats.late,  color:"#22c55e", icon:"✅" },
                { label:"On Time",        value:todayStats.ontime,                  color:"#22c55e", icon:"⏰" },
                { label:"Late",           value:todayStats.late,                    color:"#f59e0b", icon:"🕐" },
                { label:"Absent Today",   value:todayStats.absent,                  color:"#ef4444", icon:"❌" },
                { label:"On Duty Now",    value:onDutyCount,                        color:"#22c55e", icon:"🟢" },
                { label:"Pending Leaves", value:pendingLeaves,                      color:"#f59e0b", icon:"📝" },
                { label:"Announcements",  value:announcements.length,               color:"#a78bfa", icon:"📢" },
              ].map((s,i)=>(
                <div key={i} style={{ background:"#1e293b",borderRadius:"12px",padding:"18px",border:"1px solid #334155" }}>
                  <div style={{ fontSize:"20px",marginBottom:"6px" }}>{s.icon}</div>
                  <div style={{ fontSize:"24px",fontWeight:700,color:s.color }}>{s.value}</div>
                  <div style={{ color:"#64748b",fontSize:"11px",marginTop:"2px" }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Today quick */}
            <div style={card}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"14px" }}>
                <h3 style={{ margin:0,color:"#f1f5f9",fontSize:"15px" }}>📋 Today's Quick View</h3>
                <button onClick={()=>setActivePage("today")} style={btn("#0ea5e9")}>Full View →</button>
              </div>
              <table style={{ width:"100%",borderCollapse:"collapse" }}>
                <thead><tr>{["Teacher","Check In","Duty","Status"].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {teachers.map(t=>{
                    const rec=getTodayRecord(t.email); const st=getStatus(rec?.checkIn);
                    const duty=dutyMap[t.email];
                    return(<tr key={t.id}>
                      <td style={{...td,fontWeight:500}}>{t.name}</td>
                      <td style={td}>{rec?.checkIn||"—"}</td>
                      <td style={td}><span style={{ background:duty?.active?"#14532d":"#1e293b",color:duty?.active?"#22c55e":"#64748b",padding:"2px 8px",borderRadius:"99px",fontSize:"12px" }}>{duty?.active?"🟢 On":"⚫ Off"}</span></td>
                      <td style={td}><span style={{ background:SC[st].bg,color:SC[st].color,padding:"3px 10px",borderRadius:"99px",fontSize:"12px",fontWeight:600 }}>{SC[st].label}</span></td>
                    </tr>);
                  })}
                </tbody>
              </table>
            </div>

            {/* Latest announcement */}
            {announcements[0]&&(
              <div style={{ ...card,background:PS[announcements[0].priority||"normal"].bg,borderColor:PS[announcements[0].priority||"normal"].border }}>
                <div style={{ fontSize:"11px",color:"#64748b",marginBottom:"4px" }}>📢 Latest Announcement</div>
                <div style={{ fontWeight:600,color:"#f1f5f9" }}>{announcements[0].title}</div>
                <div style={{ fontSize:"13px",color:"#94a3b8",marginTop:"4px" }}>{announcements[0].body}</div>
              </div>
            )}
          </div>
        )}

        {/* ══ TODAY ══ */}
        {activePage==="today"&&(
          <div>
            <div style={{ display:"flex",gap:"12px",marginBottom:"20px",flexWrap:"wrap" }}>
              {[{label:"On Time",value:todayStats.ontime,color:"#22c55e",bg:"#14532d"},{label:"Late",value:todayStats.late,color:"#f59e0b",bg:"#451a03"},{label:"Absent",value:todayStats.absent,color:"#ef4444",bg:"#450a0a"},{label:"On Duty",value:onDutyCount,color:"#22c55e",bg:"#14532d"}].map(s=>(
                <div key={s.label} style={{ background:s.bg,borderRadius:"10px",padding:"14px 22px",display:"flex",alignItems:"center",gap:"10px" }}>
                  <span style={{ fontSize:"22px",fontWeight:700,color:s.color }}>{s.value}</span>
                  <span style={{ color:s.color,fontSize:"13px" }}>{s.label}</span>
                </div>
              ))}
            </div>
            <div style={card}>
              <table style={{ width:"100%",borderCollapse:"collapse" }}>
                <thead><tr>{["Teacher","Subject","Check In","Check Out","Duration","Duty","Status"].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {teachers.map(t=>{
                    const rec=getTodayRecord(t.email); const st=getStatus(rec?.checkIn);
                    const im=parseTime(rec?.checkIn); const om=parseTime(rec?.checkOut);
                    const dur=im!==null&&om!==null?`${Math.floor((om-im)/60)}h ${(om-im)%60}m`:"—";
                    const duty=dutyMap[t.email];
                    return(<tr key={t.id}>
                      <td style={{...td,fontWeight:500}}>{t.name}</td>
                      <td style={{...td,color:"#64748b"}}>{t.subject}</td>
                      <td style={td}>{rec?.checkIn||"—"}</td>
                      <td style={td}>{rec?.checkOut||"—"}</td>
                      <td style={{...td,color:"#94a3b8"}}>{dur}</td>
                      <td style={td}><span style={{ background:duty?.active?"#14532d":"transparent",color:duty?.active?"#22c55e":"#64748b",padding:"2px 8px",borderRadius:"99px",fontSize:"12px",border:"1px solid",borderColor:duty?.active?"#22c55e":"#334155" }}>{duty?.active?`🟢 Since ${duty.since}`:"⚫ Off"}</span></td>
                      <td style={td}><span style={{ background:SC[st].bg,color:SC[st].color,padding:"3px 10px",borderRadius:"99px",fontSize:"12px",fontWeight:600 }}>{SC[st].label}</span></td>
                    </tr>);
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══ MONTHLY ══ */}
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
            {/* Month summary */}
            <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:"12px",marginBottom:"20px" }}>
              {(()=>{
                const tp=monthStats.reduce((s,t)=>s+t.present,0);
                const to=monthStats.reduce((s,t)=>s+t.ontime,0);
                const tl=monthStats.reduce((s,t)=>s+t.late,0);
                const ta=monthStats.reduce((s,t)=>s+t.absent,0);
                const avg=monthStats.length>0?(monthStats.reduce((s,t)=>s+parseFloat(t.pct),0)/monthStats.length).toFixed(1):"0.0";
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
                  {monthStats.map(t=>{
                    const pc=parseFloat(t.pct)>=75?"#22c55e":parseFloat(t.pct)>=50?"#f59e0b":"#ef4444";
                    return(<tr key={t.id}>
                      <td style={{...td,fontWeight:500}}>{t.name}</td>
                      <td style={{...td,color:"#64748b"}}>{t.subject}</td>
                      <td style={{...td,color:"#22c55e"}}>{t.present}</td>
                      <td style={{...td,color:"#22c55e"}}>{t.ontime}</td>
                      <td style={{...td,color:"#f59e0b"}}>{t.late}</td>
                      <td style={{...td,color:"#ef4444"}}>{t.absent}</td>
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

        {/* ══ ON DUTY ══ */}
        {activePage==="duty"&&(
          <div style={card}>
            <h3 style={{ margin:"0 0 16px",color:"#f1f5f9",fontSize:"15px" }}>🟢 Teachers Currently On Duty</h3>
            <table style={{ width:"100%",borderCollapse:"collapse" }}>
              <thead><tr>{["Teacher","Subject","Status","On Duty Since","Location Pings"].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {teachers.map(t=>{
                  const d=dutyMap[t.email];
                  return(<tr key={t.id}>
                    <td style={{...td,fontWeight:500}}>{t.name}</td>
                    <td style={{...td,color:"#64748b"}}>{t.subject}</td>
                    <td style={td}><span style={{ background:d?.active?"#14532d":"#1e293b",color:d?.active?"#22c55e":"#64748b",padding:"3px 10px",borderRadius:"99px",fontSize:"12px",fontWeight:600 }}>{d?.active?"🟢 On Duty":"⚫ Off Duty"}</span></td>
                    <td style={td}>{d?.active?d.since:"—"}</td>
                    <td style={{...td,color:"#a78bfa"}}>{d?.locations?.length||0} pings</td>
                  </tr>);
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ══ LEAVES ══ */}
        {activePage==="leaves"&&(
          <div>
            <div style={{ display:"flex",gap:"12px",marginBottom:"20px",flexWrap:"wrap" }}>
              {[{l:"Pending",v:leaves.filter(l=>l.status==="pending").length,c:"#fcd34d",bg:"#451a03"},{l:"Approved",v:leaves.filter(l=>l.status==="approved").length,c:"#86efac",bg:"#14532d"},{l:"Rejected",v:leaves.filter(l=>l.status==="rejected").length,c:"#fca5a5",bg:"#450a0a"}].map(s=>(
                <div key={s.l} style={{ background:s.bg,borderRadius:"10px",padding:"14px 22px",display:"flex",alignItems:"center",gap:"10px" }}>
                  <span style={{ fontSize:"22px",fontWeight:700,color:s.c }}>{s.v}</span>
                  <span style={{ color:s.c,fontSize:"13px" }}>{s.l}</span>
                </div>
              ))}
            </div>
            {leaves.length===0?<div style={card}><p style={{ color:"#64748b" }}>No leave requests.</p></div>:leaves.map(l=>(
              <div key={l.id} style={{ ...card,borderColor:LS[l.status].bg }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:"8px",marginBottom:"10px" }}>
                  <div>
                    <div style={{ fontWeight:600,color:"#f1f5f9",marginBottom:"4px" }}>{l.teacherName} — {l.type.charAt(0).toUpperCase()+l.type.slice(1)} Leave</div>
                    <div style={{ fontSize:"13px",color:"#64748b" }}>{l.fromDate} → {l.toDate}</div>
                    <div style={{ fontSize:"13px",color:"#94a3b8",marginTop:"6px" }}>{l.reason}</div>
                  </div>
                  <span style={{ background:LS[l.status].bg,color:LS[l.status].color,padding:"4px 12px",borderRadius:"99px",fontSize:"12px",fontWeight:600 }}>{l.status.toUpperCase()}</span>
                </div>
                {l.status==="pending"&&(
                  <div style={{ display:"flex",gap:"8px",alignItems:"center",flexWrap:"wrap",marginTop:"10px",paddingTop:"10px",borderTop:"1px solid #334155" }}>
                    <input placeholder="Optional note to teacher..." value={reviewNote} onChange={e=>setReviewNote(e.target.value)}
                      style={{...inp,width:"280px",fontSize:"13px",padding:"7px 12px"}}/>
                    <button onClick={()=>handleReviewLeave(l.id,"approved")} style={btn("#22c55e")}>✅ Approve</button>
                    <button onClick={()=>handleReviewLeave(l.id,"rejected")} style={btn("#dc2626")}>❌ Reject</button>
                  </div>
                )}
                {l.reviewNote&&<div style={{ fontSize:"12px",color:"#f59e0b",marginTop:"8px" }}>Note: {l.reviewNote}</div>}
                <div style={{ fontSize:"11px",color:"#475569",marginTop:"8px" }}>Applied {l.appliedOn}{l.reviewedOn?` · Reviewed ${l.reviewedOn}`:""}</div>
              </div>
            ))}
          </div>
        )}

        {/* ══ ANNOUNCEMENTS ══ */}
        {activePage==="announcements"&&(
          <div>
            {/* Post form */}
            <div style={{ ...card,maxWidth:"540px" }}>
              <h3 style={{ margin:"0 0 16px",color:"#f1f5f9",fontSize:"15px" }}>Post New Announcement</h3>
              <div style={{ display:"flex",flexDirection:"column",gap:"10px" }}>
                <input type="text" placeholder="Title" value={annTitle} onChange={e=>setAnnTitle(e.target.value)} style={inp}/>
                <textarea rows={4} placeholder="Announcement body..." value={annBody} onChange={e=>setAnnBody(e.target.value)} style={{...inp,resize:"vertical"}}/>
                <select value={annPriority} onChange={e=>setAnnPriority(e.target.value)} style={inp}>
                  <option value="normal">Normal</option>
                  <option value="info">Info</option>
                  <option value="urgent">Urgent</option>
                </select>
                <button onClick={handlePostAnnouncement} style={btn("#0ea5e9")}>📢 Post Announcement</button>
              </div>
            </div>
            {/* List */}
            {announcements.length===0?<div style={card}><p style={{ color:"#64748b" }}>No announcements yet.</p></div>:announcements.map(a=>{
              const ps=PS[a.priority||"normal"];
              return(
                <div key={a.id} style={{ ...card,background:ps.bg,borderColor:ps.border }}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
                    <div style={{ fontWeight:600,color:ps.color,fontSize:"15px",marginBottom:"6px" }}>{a.title}</div>
                    <div style={{ display:"flex",gap:"8px",alignItems:"center" }}>
                      {a.priority==="urgent"&&<span style={{ background:"#dc2626",color:"#fff",padding:"2px 8px",borderRadius:"99px",fontSize:"11px",fontWeight:700 }}>URGENT</span>}
                      {a.priority==="info"&&<span style={{ background:"#1d4ed8",color:"#bfdbfe",padding:"2px 8px",borderRadius:"99px",fontSize:"11px",fontWeight:700 }}>INFO</span>}
                      <button onClick={()=>handleDeleteAnnouncement(a.id)} style={btn("#dc2626")}>Delete</button>
                    </div>
                  </div>
                  <div style={{ color:"#94a3b8",fontSize:"14px",lineHeight:1.6 }}>{a.body}</div>
                  <div style={{ fontSize:"11px",color:"#475569",marginTop:"10px" }}>By {a.postedBy} · {a.postedOn} {a.postedAt}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* ══ ADD/EDIT ══ */}
        {activePage==="add"&&(
          <div style={{...card,maxWidth:"480px"}}>
            <div style={{ display:"flex",flexDirection:"column",gap:"12px" }}>
              {[{ph:"Teacher Name",v:name,s:setName,t:"text"},{ph:"Subject",v:subject,s:setSubject,t:"text"},...(!editId?[{ph:"Email",v:email,s:setEmail,t:"email"},{ph:"Password",v:password,s:setPassword,t:"password"}]:[])].map((f,i)=>(
                <input key={i} type={f.t} placeholder={f.ph} value={f.v} onChange={e=>f.s(e.target.value)} style={inp}/>
              ))}
              <button onClick={handleSubmit} disabled={loading} style={btn("#0ea5e9")}>
                {loading?"Saving...":editId?"Update Teacher":"Add Teacher"}
              </button>
            </div>
          </div>
        )}

        {/* ══ LIST ══ */}
        {activePage==="list"&&(
          <div style={card}>
            {loading?<p>Loading...</p>:teachers.length===0?<p style={{ color:"#64748b" }}>No teachers.</p>:(
              <table style={{ width:"100%",borderCollapse:"collapse" }}>
                <thead><tr>{["Name","Subject","Email","Actions"].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {teachers.map(t=>(
                    <tr key={t.id}>
                      <td style={{...td,fontWeight:500}}>{t.name}</td>
                      <td style={{...td,color:"#64748b"}}>{t.subject}</td>
                      <td style={{...td,color:"#64748b"}}>{t.email}</td>
                      <td style={td}>
                        <div style={{ display:"flex",gap:"8px",flexWrap:"wrap" }}>
                          <button onClick={()=>handleEdit(t)} style={btn("#0ea5e9")}>Edit</button>
                          <button onClick={()=>handleDelete(t.id)} style={btn("#dc2626")}>Delete</button>
                          <button onClick={()=>{ setDetailTeacher(t); setActivePage("attendance"); }} style={btn("#1d4ed8")}>Attendance</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ══ HOLIDAYS ══ */}
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