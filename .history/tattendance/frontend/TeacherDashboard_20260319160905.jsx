import { useNavigate } from "react-router-dom";
import { useRef, useState, useEffect } from "react";
import Webcam from "react-webcam";
import { api } from "../src/assets/api";

function TeacherDashboard() {
  const navigate = useNavigate();
  const webcamRef = useRef(null);
  const [showCamera, setShowCamera] = useState(false);
  const [image, setImage]           = useState(null);
  const [mode, setMode]             = useState("");
  const [location, setLocation]     = useState(null);
  const [records, setRecords]       = useState([]);
  const [feedbackMsg, setFeedbackMsg]   = useState("");
  const [feedbackType, setFeedbackType] = useState("success");
  const [saving, setSaving]         = useState(false);

  const user = JSON.parse(localStorage.getItem("user"));

  const showFeedback = (msg, type = "error") => {
    setFeedbackMsg(msg); setFeedbackType(type);
    setTimeout(() => setFeedbackMsg(""), 3500);
  };

  const fetchRecords = async () => {
    try { const data = await api.get("/attendance/me"); setRecords(data); }
    catch { showFeedback("Could not load records"); }
  };

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      pos => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      ()   => showFeedback("Location permission required")
    );
  }, []);

  useEffect(() => { if (user?.email) fetchRecords(); }, []);

  if (!user) return <h2>Please login first</h2>;

  const month = new Date().getMonth();
  const attendanceCount = records.filter(r => {
    const p = r.date.split("/");
    return p.length === 3 && parseInt(p[1]) - 1 === month;
  }).length;
  const progress  = Math.min((attendanceCount / 26) * 100, 100);
  const todayStr  = new Date().toLocaleDateString("en-IN");
  const todayRecord = records.find(r => r.date === todayStr);

  const handleCheckIn  = () => { if (!location) { showFeedback("Location not available"); return; } setMode("checkin");  setImage(null); setShowCamera(true); };
  const handleCheckOut = () => { if (!location) { showFeedback("Location not available"); return; } setMode("checkout"); setImage(null); setShowCamera(true); };
  const capture = () => setImage(webcamRef.current.getScreenshot());

  const saveAttendance = async () => {
    setSaving(true);
    try {
      if (mode === "checkin") { await api.post("/attendance/checkin",  { photo: image, location }); showFeedback("Checked in!", "success"); }
      else                    { await api.post("/attendance/checkout", { photo: image });            showFeedback("Checked out!", "success"); }
      setShowCamera(false); setImage(null); await fetchRecords();
    } catch (e) { showFeedback(e.message); }
    finally { setSaving(false); }
  };

  const handleLogout = () => { localStorage.removeItem("token"); localStorage.removeItem("user"); navigate("/"); };

  const card = { background:"#1e293b", borderRadius:"12px", padding:"20px", border:"1px solid #334155", marginBottom:"16px" };
  const btn  = (bg, col="#fff") => ({ padding:"10px 18px", borderRadius:"8px", background:bg, color:col, border:"none", cursor:"pointer", fontWeight:600, fontSize:"14px" });

  return (
    <div style={{ minHeight:"100vh", background:"#0f172a", fontFamily:"sans-serif", padding:"28px", color:"#e2e8f0" }}>
      <div style={{ maxWidth:"700px", margin:"0 auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"24px" }}>
          <h1 style={{ margin:0, color:"#f1f5f9", fontSize:"22px" }}>Welcome, {user.name} 👋</h1>
          <button style={btn("#dc2626")} onClick={handleLogout}>Logout</button>
        </div>

        {feedbackMsg && (
          <div style={{ padding:"10px 16px", borderRadius:"8px", marginBottom:"16px", fontWeight:500, background:feedbackType==="success"?"#14532d":"#450a0a", color:feedbackType==="success"?"#86efac":"#fca5a5" }}>
            {feedbackMsg}
          </div>
        )}

        {/* Stat cards */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:"14px", marginBottom:"20px" }}>
          {[
            { label:"Present This Month", value:attendanceCount,              color:"#22c55e", icon:"✅" },
            { label:"Today Check In",     value:todayRecord?.checkIn || "—",  color:"#0ea5e9", icon:"⏰" },
            { label:"Today Check Out",    value:todayRecord?.checkOut || "—", color:"#a78bfa", icon:"🏁" },
          ].map((s,i) => (
            <div key={i} style={{ background:"#1e293b", borderRadius:"12px", padding:"16px", border:"1px solid #334155" }}>
              <div style={{ fontSize:"18px", marginBottom:"4px" }}>{s.icon}</div>
              <div style={{ fontSize:"20px", fontWeight:700, color:s.color }}>{s.value}</div>
              <div style={{ color:"#64748b", fontSize:"11px", marginTop:"2px" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Progress */}
        <div style={card}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"8px" }}>
            <span style={{ fontSize:"14px", color:"#94a3b8" }}>Monthly Attendance</span>
            <span style={{ fontWeight:700, color:progress>=75?"#22c55e":"#f59e0b" }}>{progress.toFixed(0)}%</span>
          </div>
          <div style={{ background:"#0f172a", borderRadius:"99px", height:"10px", overflow:"hidden" }}>
            <div style={{ width:`${progress}%`, background:progress>=75?"#22c55e":"#f59e0b", height:"100%", borderRadius:"99px", transition:"width 0.4s" }}/>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display:"flex", gap:"12px", flexWrap:"wrap", marginBottom:"20px" }}>
          <button style={btn("#22c55e")} onClick={handleCheckIn}  disabled={!!todayRecord?.checkIn}>
            {todayRecord?.checkIn ? "✅ Checked In" : "Check In"}
          </button>
          <button style={btn("#0ea5e9")} onClick={handleCheckOut} disabled={!todayRecord?.checkIn || !!todayRecord?.checkOut}>
            {todayRecord?.checkOut ? "✅ Checked Out" : "Check Out"}
          </button>
        </div>

        {location && <p style={{ color:"#64748b", fontSize:"12px", marginBottom:"20px" }}>📍 {location.lat.toFixed(4)}, {location.lng.toFixed(4)}</p>}

        {/* Attendance history */}
        {records.length > 0 && (
          <div style={card}>
            <h3 style={{ margin:"0 0 14px", color:"#f1f5f9", fontSize:"15px" }}>My Attendance</h3>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead><tr>
                {["Date","Check In","Check Out"].map(h=>(
                  <th key={h} style={{ padding:"10px", textAlign:"left", color:"#64748b", fontSize:"13px", borderBottom:"1px solid #334155" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {records.slice().reverse().map((r,i)=>(
                  <tr key={i} style={{ borderBottom:"1px solid #1e293b" }}>
                    <td style={{ padding:"12px 10px" }}>{r.date}</td>
                    <td style={{ padding:"12px 10px" }}>{r.checkIn||"—"}</td>
                    <td style={{ padding:"12px 10px" }}>{r.checkOut||"—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Camera modal */}
        {showCamera && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div style={{ background:"#1e293b", borderRadius:"16px", padding:"24px", border:"1px solid #334155", textAlign:"center" }}>
              <h3 style={{ color:"#f1f5f9", marginTop:0 }}>{mode==="checkin"?"Check In Photo":"Check Out Photo"}</h3>
              <Webcam ref={webcamRef} screenshotFormat="image/jpeg" width={280} style={{ borderRadius:"8px" }}/>
              <div style={{ display:"flex", gap:"10px", justifyContent:"center", marginTop:"12px" }}>
                <button style={btn("#0ea5e9")} onClick={capture}>📸 Capture</button>
                <button style={btn("#475569")} onClick={()=>{ setShowCamera(false); setImage(null); }}>Cancel</button>
              </div>
              {image && (
                <div style={{ marginTop:"12px" }}>
                  <img src={image} width="140" style={{ borderRadius:"8px", border:"2px solid #334155" }} alt="preview"/>
                  <div style={{ marginTop:"10px" }}>
                    <button style={btn("#22c55e")} onClick={saveAttendance} disabled={saving}>
                      {saving?"Saving...":"✅ Save"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TeacherDashboard;