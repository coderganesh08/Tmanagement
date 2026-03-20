const express = require("express");
const cors    = require("cors");
const bcrypt  = require("bcryptjs");
const jwt     = require("jsonwebtoken");
const low     = require("lowdb");
const FileSync = require("lowdb/adapters/FileSync");
const app = express();
const PORT = 5000;
const JWT_SECRET = "secret123";

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const users = [
  { id: 1, name: "Principal Sir", email: "principal@gmail.com", password: bcrypt.hashSync("admin123", 10), role: "admin", subject: null },
  { id: 2, name: "Rahul Sir", email: "teacher1@gmail.com", password: bcrypt.hashSync("12345", 10), role: "teacher", subject: "Mathematics" }
];

const attendance = {};
const leaves = [];
const announcements = [];
const onDuty = {};

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return res.status(401).json({ error: "No token provided" });
  try { req.user = jwt.verify(authHeader.split(" ")[1], JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: "Invalid token" }); }
}

function adminOnly(req, res, next) {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Admin only" });
  next();
}

// LOGIN
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email);
  if (!user || !(await bcrypt.compare(password, user.password)))
    return res.status(401).json({ error: "Invalid email or password" });
  const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "8h" });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, subject: user.subject } });
});

// TEACHERS
app.get("/teachers", authMiddleware, adminOnly, (req, res) =>
  res.json(users.filter(u => u.role === "teacher").map(({ id, name, email, subject }) => ({ id, name, email, subject }))));

app.post("/teachers", authMiddleware, adminOnly, async (req, res) => {
  const { name, subject, email, password } = req.body;
  if (users.find(u => u.email === email)) return res.status(409).json({ error: "Email already in use" });
  const t = { id: Date.now(), name, subject, email, password: await bcrypt.hash(password, 10), role: "teacher" };
  users.push(t);
  res.status(201).json({ id: t.id, name, subject, email });
});

app.put("/teachers/:id", authMiddleware, adminOnly, (req, res) => {
  const t = users.find(u => u.id === Number(req.params.id));
  if (!t) return res.status(404).json({ error: "Not found" });
  if (req.body.name) t.name = req.body.name;
  if (req.body.subject) t.subject = req.body.subject;
  res.json({ id: t.id, name: t.name, subject: t.subject, email: t.email });
});

app.delete("/teachers/:id", authMiddleware, adminOnly, (req, res) => {
  const i = users.findIndex(u => u.id === Number(req.params.id));
  if (i === -1) return res.status(404).json({ error: "Not found" });
  users.splice(i, 1); res.json({ success: true });
});

// ATTENDANCE
app.get("/attendance/me", authMiddleware, (req, res) => res.json(attendance[req.user.email] || []));
app.get("/attendance", authMiddleware, adminOnly, (req, res) => res.json(attendance));

app.post("/attendance/checkin", authMiddleware, (req, res) => {
  const { photo, location } = req.body;
  const email = req.user.email;
  const today = new Date().toLocaleDateString("en-IN");
  if (!attendance[email]) attendance[email] = [];
  if (attendance[email].find(r => r.date === today)) return res.status(409).json({ error: "Already checked in today" });
  if (!location || !location.lat) return res.status(400).json({ error: "Location required" });
  const record = { date: today, name: req.user.name, checkIn: new Date().toLocaleTimeString("en-IN"), checkOut: null, checkInPhoto: photo || null, checkOutPhoto: null, location };
  attendance[email].push(record);
  res.status(201).json(record);
});

app.post("/attendance/checkout", authMiddleware, (req, res) => {
  const email = req.user.email;
  const today = new Date().toLocaleDateString("en-IN");
  const record = (attendance[email] || []).find(r => r.date === today);
  if (!record) return res.status(400).json({ error: "Not checked in today" });
  if (record.checkOut) return res.status(409).json({ error: "Already checked out" });
  record.checkOut = new Date().toLocaleTimeString("en-IN");
  record.checkOutPhoto = req.body.photo || null;
  res.json(record);
});

// LEAVES
app.post("/leaves", authMiddleware, (req, res) => {
  const { fromDate, toDate, reason, type } = req.body;
  if (!fromDate || !toDate || !reason || !type) return res.status(400).json({ error: "All fields required" });
  if (new Date(fromDate) > new Date(toDate)) return res.status(400).json({ error: "fromDate must be before toDate" });
  const leave = { id: Date.now(), teacherEmail: req.user.email, teacherName: req.user.name, fromDate, toDate, reason, type, status: "pending", appliedOn: new Date().toLocaleDateString("en-IN"), reviewedOn: null, reviewNote: null };
  leaves.push(leave);
  res.status(201).json(leave);
});
app.get("/leaves/me", authMiddleware, (req, res) => res.json(leaves.filter(l => l.teacherEmail === req.user.email)));
app.get("/leaves", authMiddleware, adminOnly, (req, res) => res.json(leaves));
app.put("/leaves/:id", authMiddleware, adminOnly, (req, res) => {
  const leave = leaves.find(l => l.id === Number(req.params.id));
  if (!leave) return res.status(404).json({ error: "Leave not found" });
  if (leave.status !== "pending") return res.status(400).json({ error: "Already reviewed" });
  const { status, reviewNote } = req.body;
  if (!["approved", "rejected"].includes(status)) return res.status(400).json({ error: "Invalid status" });
  leave.status = status; leave.reviewNote = reviewNote || null; leave.reviewedOn = new Date().toLocaleDateString("en-IN");
  res.json(leave);
});
app.delete("/leaves/:id", authMiddleware, adminOnly, (req, res) => {
  const i = leaves.findIndex(l => l.id === Number(req.params.id));
  if (i === -1) return res.status(404).json({ error: "Not found" });
  leaves.splice(i, 1); res.json({ success: true });
});

// ANNOUNCEMENTS
app.get("/announcements", authMiddleware, (req, res) => res.json(announcements));
app.post("/announcements", authMiddleware, adminOnly, (req, res) => {
  const { title, body, priority } = req.body;
  if (!title || !body) return res.status(400).json({ error: "title and body required" });
  const ann = { id: Date.now(), title, body, priority: priority || "normal", postedBy: req.user.name, postedOn: new Date().toLocaleDateString("en-IN"), postedAt: new Date().toLocaleTimeString("en-IN") };
  announcements.unshift(ann);
  res.status(201).json(ann);
});
app.delete("/announcements/:id", authMiddleware, adminOnly, (req, res) => {
  const i = announcements.findIndex(a => a.id === Number(req.params.id));
  if (i === -1) return res.status(404).json({ error: "Not found" });
  announcements.splice(i, 1); res.json({ success: true });
});

// ON DUTY
app.post("/duty/toggle", authMiddleware, (req, res) => {
  const email = req.user.email;
  if (!onDuty[email] || !onDuty[email].active) {
    onDuty[email] = { active: true, since: new Date().toLocaleTimeString("en-IN"), locations: [] };
    return res.json({ active: true, message: "You are now ON duty" });
  } else {
    onDuty[email].active = false;
    return res.json({ active: false, message: "You are now OFF duty" });
  }
});

app.get("/duty/me", authMiddleware, (req, res) => {
  const d = onDuty[req.user.email];
  res.json(d || { active: false, since: null, locations: [] });
});

app.post("/duty/location", authMiddleware, (req, res) => {
  const { lat, lng } = req.body;
  const email = req.user.email;
  if (!onDuty[email] || !onDuty[email].active) return res.status(400).json({ error: "Not on duty" });
  if (!lat || !lng) return res.status(400).json({ error: "lat and lng required" });
  const ping = { time: new Date().toLocaleTimeString("en-IN"), lat, lng };
  onDuty[email].locations.push(ping);
  res.json(ping);
});

app.get("/duty", authMiddleware, adminOnly, (req, res) => res.json(onDuty));

app.get("/duty/:email", authMiddleware, adminOnly, (req, res) => {
  res.json(onDuty[req.params.email] || { active: false, since: null, locations: [] });
});

// HEALTH
app.get("/", (req, res) => res.json({ status: "OK", message: "Teacher Attendance API is running" }));

app.listen(PORT, () => {
  console.log("\n✅ Server running at http://localhost:" + PORT);
  console.log("  Admin   -> principal@gmail.com / admin123");
  console.log("  Teacher -> teacher1@gmail.com  / 12345\n");
});
