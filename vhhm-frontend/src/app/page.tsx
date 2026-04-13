'use client';

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./dashboard.module.css";
import HealthChatbot from "@/components/HealthChatbot";
import AuthPage from "@/components/AuthPage";
import { useTheme } from "@/components/ThemeProvider";
import { Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

const INITIAL_TREND = [
  { name: '10am', hr: 72, temp: 98.6, spO2: 98 },
  { name: '11am', hr: 75, temp: 98.7, spO2: 97 },
  { name: '12pm', hr: 70, temp: 98.6, spO2: 98 },
  { name: '01pm', hr: 74, temp: 98.8, spO2: 98 },
  { name: '02pm', hr: 75, temp: 98.7, spO2: 97 },
];

function HomeContent() {
  const searchParams = useSearchParams();
  const verifyToken = searchParams.get('verify');
  const resetToken = searchParams.get('reset');

  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [healthData, setHealthData] = useState({
    hr: 72, temp: 98.6, oxygen: 98, bp: "120/80", steps: 0, water: 0
  });
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [backendStatus, setBackendStatus] = useState<'online' | 'offline' | 'checking'>('checking');

  useEffect(() => {
    checkBackend();
  }, []);

  const checkBackend = async () => {
    try {
      const resp = await fetch('/api/admin/patients');
      if (resp.ok) setBackendStatus('online');
      else setBackendStatus('offline');
    } catch {
      setBackendStatus('offline');
    }
  };

  useEffect(() => {
    setMounted(true);
    // Don't auto-login if there's a verify/reset token in URL
    if (verifyToken || resetToken) return;
    const savedUser = localStorage.getItem("vhhm_user");
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      setUser(parsed);
      if (parsed.role === 'admin') {
        if (backendStatus !== 'offline') fetchPatients();
      } else {
        if (backendStatus !== 'offline') fetchHistory(parsed.id);
      }
    }
    const savedPatients = localStorage.getItem("vhhm_local_patients");
    if (savedPatients) setPatients(JSON.parse(savedPatients));
  }, [verifyToken, resetToken]);

  const fetchHistory = async (id: number) => {
    if (!id) return;
    setLoadingHistory(true);
    try {
      const resp = await fetch(`/api/patient/history/${id}`);
      if (resp.ok) {
        const data = await resp.json();
        setHistory(data);
        setBackendStatus('online');
        if (data.length > 0) {
          // Set latest as current if no analysis has been done this session
          setAnalysisResult(data[0]);
          setHealthData({
            hr: data[0].hr,
            temp: data[0].temp || 98.6,
            oxygen: data[0].oxygen,
            bp: data[0].bp,
            steps: 0,
            water: data[0].water
          });
        }
      } else {
        console.error("History fetch failed with status:", resp.status);
      }
    } catch (e) {
      console.error("Error fetching history:", e);
      setBackendStatus('offline');
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin' && selectedPatient) {
      fetchHistory(selectedPatient.id);
    }
  }, [selectedPatient, user]);

  const fetchPatients = async () => {
    try {
      const resp = await fetch('/api/admin/patients');
      if (resp.ok) {
        const data = await resp.json();
        setPatients(data);
        localStorage.setItem("vhhm_local_patients", JSON.stringify(data));
      }
    } catch (e) {
      console.log("Backend not reachable, using local storage list.");
    }
  };

  const handleUserLogin = (userData: any) => {
    setUser(userData);
    if (userData.role === 'admin') fetchPatients();
    else fetchHistory(userData.id);
    const savedPatients = localStorage.getItem("vhhm_local_patients");
    if (savedPatients) setPatients(JSON.parse(savedPatients));
  };

  const logout = () => {
    setUser(null);
    setSelectedPatient(null);
    localStorage.removeItem("vhhm_user");
  };

  if (!mounted) return null;

  const getGenderIcon = (gender: string) => {
    const g = gender?.toLowerCase();
    if (g === 'male' || g === 'boy') return "👦";
    if (g === 'female' || g === 'girl') return "👧";
    return "👤";
  };

  // --- AUTH PAGE (Login / Signup / Verify / Reset) ---
  if (!user) {
    return (
      <AuthPage
        onLogin={handleUserLogin}
        initialVerifyToken={verifyToken}
        initialResetToken={resetToken}
      />
    );
  }

  const renderHealthProfile = (data: any, results: any) => (
    <div className={styles.mainLayout} style={{ gridTemplateColumns: '1fr 400px' }}>
      <section className={styles.dashboardGrid}>
        <MetricCard title="Cardiac Rhythm" value={data.hr} unit="BPM" chartKey="hr" />
        <MetricCard title="Thermal Index" value={data.temp} unit="°F" chartKey="temp" />
        <MetricCard title="Hemoglobin Oxygen" value={data.oxygen} unit="%" chartKey="spO2" />
        <MetricCard title="Hydration Log" value={data.water} unit="ml" chartKey="water" />

        <div className="glass-card animate-fade-in" style={{ gridColumn: 'span 2', padding: '2.5rem', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.6rem', fontWeight: 700 }}>AI Diagnostic Integrity</h3>
            <span style={{ padding: '0.5rem 1.5rem', borderRadius: '100px', fontSize: '0.9rem' }} className={results?.diagnosis === 'Stable' ? styles.statusNormal : styles.statusAlert}>
              {results?.diagnosis || "System Calibrating"}
            </span>
          </div>
          <p style={{ lineHeight: '1.8', fontSize: '1.1rem', color: 'var(--foreground-muted)' }}>{results?.summary || "Initiate medical interrogation via Dr. AI for a real-time health summary."}</p>

          {results && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', marginTop: '3rem' }}>
              <div>
                <h4 style={{ color: 'var(--primary)', marginBottom: '1rem', letterSpacing: '1px', textTransform: 'uppercase', fontSize: '0.8rem' }}>Prescribed Protocol</h4>
                {results.prescription?.map((m: any, i: number) => (
                  <div key={i} style={{ padding: '1rem', background: 'rgba(0, 98, 255, 0.05)', borderRadius: '12px', marginBottom: '0.75rem' }}>
                    <p style={{ fontWeight: 600 }}>{m.name} ({m.dosage})</p>
                    <p style={{ fontSize: '0.85rem', opacity: 0.7 }}>{m.instructions}</p>
                  </div>
                )) || <p>Stability observed. No pharmacological intervention.</p>}
              </div>
              <div>
                <h4 style={{ color: 'var(--primary)', marginBottom: '1rem', letterSpacing: '1px', textTransform: 'uppercase', fontSize: '0.8rem' }}>Lifestyle Optimization</h4>
                <div style={{ padding: '1rem', background: 'rgba(0, 230, 118, 0.05)', borderRadius: '12px' }}>
                  <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>🏃 Exercises</p>
                  <p style={{ fontSize: '0.9rem' }}>{results.exercises?.join(", ") || "Maintain balanced movement."}</p>
                </div>
                <div style={{ padding: '1rem', background: 'rgba(0, 230, 118, 0.05)', borderRadius: '12px', marginTop: '1rem' }}>
                  <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>🏠 Home Remedies</p>
                  <p style={{ fontSize: '0.9rem' }}>{results.remedies?.join(", ") || "Stay hydrated and rest."}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* --- CLINICAL HISTORY TABLE --- */}
        <div className="glass-card animate-fade-in" style={{ gridColumn: 'span 2', padding: '2.5rem', border: '1px solid var(--border)', marginTop: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Clinical Longitudinal Data</h3>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              {backendStatus === 'offline' && <span style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 600 }}>⚠️ Backend Offline</span>}
              <button 
                onClick={() => user.role === 'admin' ? fetchHistory(selectedPatient?.id) : fetchHistory(user.id)}
                disabled={loadingHistory}
                style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }}
              >
                {loadingHistory ? 'Syncing...' : '↻ Refresh History'}
              </button>
            </div>
          </div>
          <div className={styles.tableWrapper} style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <table className={styles.patientTable} style={{ margin: 0, width: '100%', fontSize: '0.95rem' }}>
              <thead>
                <tr style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
                  <th>Timestamp</th>
                  <th>Vitals (HR/Temp/O₂)</th>
                  <th>Observation</th>
                  <th>Diagnosis</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {history.length > 0 ? history.map((h, i) => (
                  <tr key={i} className={styles.patientRow} style={{ cursor: 'pointer' }} onClick={() => {
                    setAnalysisResult(h);
                    setHealthData({
                      hr: h.hr,
                      temp: h.temp,
                      oxygen: h.oxygen,
                      bp: h.bp,
                      steps: 0,
                      water: h.water
                    });
                  }}>
                    <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{h.timestamp}</td>
                    <td>{h.hr}/{h.temp}/{h.oxygen}</td>
                    <td style={{ opacity: 0.7, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.reason}</td>
                    <td>
                      <span style={{ padding: '0.3rem 0.8rem', borderRadius: '100px', fontSize: '0.75rem', fontWeight: 600 }} className={h.diagnosis === 'Stable' ? styles.statusNormal : styles.statusAlert}>
                        {h.diagnosis}
                      </span>
                    </td>
                    <td>
                      <button style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>
                        View Detail
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '3rem' }}>
                      <div style={{ opacity: 0.5, marginBottom: '1rem' }}>No historical records available.</div>
                      {backendStatus === 'online' ? (
                        <p style={{ fontSize: '0.9rem', color: 'var(--primary)' }}>💡 Completing a health assessment via Dr. AI will record your first entry.</p>
                      ) : (
                        <p style={{ fontSize: '0.9rem', color: '#ef4444' }}>❌ Backend server is not running. History cannot be retrieved.</p>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <aside className={styles.twinSection} style={{ gap: '2rem' }}>
        <div className={`${styles.twinPreview} glass-card`} style={{ padding: '3rem', background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '10rem', filter: 'drop-shadow(0 20px 30px rgba(0,0,0,0.1))' }}>{getGenderIcon(selectedPatient?.gender || user.gender)}</div>
          <div style={{ textAlign: 'center', marginTop: '2rem' }}>
            <p style={{ letterSpacing: '3px', fontSize: '0.75rem', fontWeight: 700, opacity: 0.4 }}>VIRTUAL TWIN VIABILITY</p>
            <h2 style={{ fontSize: '5rem', fontWeight: 900, color: 'var(--primary)' }}>{results?.score || 94}</h2>
          </div>
        </div>
      </aside>
    </div>
  );

  // --- ADMIN VIEW ---
  if (user.role === 'admin') {
    return (
      <main className={styles.container}>
        <header className={styles.header}>
          <div className={styles.titleSection}>
            <p style={{ opacity: 0.5 }}>{selectedPatient ? "Deep Analysis" : "Clinical Grid"}</p>
            <h1 style={{ fontWeight: 800 }}>{selectedPatient ? `Patient: ${selectedPatient.name}` : "Doctor's Administration Portal"}</h1>
          </div>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            {selectedPatient && <button onClick={() => { setSelectedPatient(null); setHistory([]); setAnalysisResult(null); }} style={{ padding: '0.6rem 1.5rem', borderRadius: '100px', border: '2px solid var(--primary)', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', background: 'none' }}>Return to Registry</button>}
            <ThemeToggle />
            <div className={styles.userProfile}>
              <span style={{ fontSize: '1.5rem' }}>👨‍⚕️</span>
              <p style={{ fontWeight: 700 }}>Dr. {user.name.split(' ')[0]}</p>
              <button onClick={logout} style={{ padding: '0.4rem 1.25rem', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '8px', cursor: 'pointer', marginLeft: '1rem' }}>Exit</button>
            </div>
          </div>
        </header>

        <section style={{ padding: '3rem', maxWidth: '1440px', margin: '0 auto', width: '100%' }}>
          {selectedPatient ? (
            renderHealthProfile(healthData, analysisResult)
          ) : (
            <div className="glass-card animate-fade-in" style={{ padding: '2.5rem', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2.5rem' }}>
                <h2 style={{ fontWeight: 800 }}>Patient Integrity Registry</h2>
                <button onClick={fetchPatients} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer' }}>Refresh Registry</button>
              </div>
              <table className={styles.patientTable}>
                <thead><tr><th>Full Identity</th><th>Clinical Data</th><th>Last Sync</th><th>Health Status</th><th>Analytics</th></tr></thead>
                <tbody>
                  {patients.length > 0 ? patients.map(p => (
                    <tr key={p.id} className={styles.patientRow}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <span style={{ fontSize: '1.5rem' }}>{getGenderIcon(p.gender)}</span>
                          <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{p.name}</span>
                        </div>
                      </td>
                      <td>{p.age}yrs / {p.gender}</td>
                      <td style={{ opacity: 0.6 }}>{p.last_visit || 'Real-time Monitoring'}</td>
                      <td>
                        <span style={{ padding: '0.4rem 1.25rem', borderRadius: '100px', fontSize: '0.85rem', fontWeight: 600 }} className={p.status === 'Stable' ? styles.statusNormal : styles.statusAlert}>
                          {p.status || 'Verified'}
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={() => setSelectedPatient(p)}
                          style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '10px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(0, 98, 255, 0.2)' }}
                        >
                          Launch Profile
                        </button>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: '5rem', opacity: 0.4 }}>Grid is empty. Awaiting new patient telemetry...</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    );
  }

  // --- PATIENT VIEW ---
  return (
    <main className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleSection}>
          <p style={{ opacity: 0.5 }}>Biometric Synchronization</p>
          <h1 style={{ fontWeight: 800 }}>VHHM: My Health Profile</h1>
        </div>
        <div className={styles.userProfile}>
          <span style={{ fontSize: '1.8rem', marginRight: '0.5rem' }}>{getGenderIcon(user.gender)}</span>
          <div style={{ textAlign: 'right', marginRight: '0.5rem' }}>
            <p style={{ fontWeight: 800, fontSize: '1.1rem' }}>{user.name}</p>
            <p style={{ fontSize: '0.75rem', opacity: 0.4 }}>Patient Identity Verified</p>
          </div>
          <ThemeToggle />
          <button onClick={logout} style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '0.5rem 1.25rem', color: '#991b1b', borderRadius: '10px', cursor: 'pointer', fontWeight: 600 }}>Exit Portal</button>
        </div>
      </header>

      <section style={{ padding: '3rem', maxWidth: '1440px', margin: '0 auto', width: '100%' }}>
        {renderHealthProfile(healthData, analysisResult)}
      </section>

      <button className={styles.chatbotTrigger} onClick={() => setIsChatOpen(true)} style={{ scale: '1.1' }}>
        <div className={styles.pulse}></div>
        <div style={{ fontSize: '1.8rem' }}>🩺</div>
      </button>

      {isChatOpen && (
        <HealthChatbot
          userId={user.id}
          onClose={() => setIsChatOpen(false)}
          onComplete={(res: any) => {
            setAnalysisResult(res);
            const newData = {
              ...healthData,
              hr: res.hr || healthData.hr,
              temp: res.temp || healthData.temp,
              oxygen: res.oxygen || healthData.oxygen,
              water: res.water || healthData.water,
              steps: res.steps || healthData.steps
            };
            setHealthData(newData);
            
            // Handle offline case: Add simulation to local history list
            if (backendStatus === 'offline' || !res.id) {
              const simulatedEntry = {
                timestamp: res.timestamp || new Date().toLocaleString(),
                hr: res.hr,
                temp: res.temp,
                oxygen: res.oxygen,
                reason: res.reason || 'Simulation Assessment',
                diagnosis: res.diagnosis,
                prescription: res.prescription || [],
                remedies: res.remedies || [],
                exercises: res.exercises || []
              };
              setHistory(prev => [simulatedEntry, ...prev]);
            }

            const localList = JSON.parse(localStorage.getItem("vhhm_local_patients") || "[]");
            const idx = localList.findIndex((p: any) => p.email === user.email);
            if (idx !== -1) {
              localList[idx].healthData = newData;
              localList[idx].results = res;
              localList[idx].status = res.diagnosis;
              localStorage.setItem("vhhm_local_patients", JSON.stringify(localList));
            }
            // Refresh history after new assessment
            if (backendStatus === 'online') fetchHistory(user.id);
          }}
        />
      )}
    </main>
  );
}

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label="Toggle dark mode"
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  );
}

function MetricCard({ title, value, unit, chartKey }: any) {
  return (
    <div className={`${styles.metricCard} glass-card animate-fade-in`} style={{ padding: '2rem', border: '1px solid var(--border)', background: 'var(--surface)' }}>
      <div className={styles.metricHeader} style={{ marginBottom: '1.5rem' }}>
        <span style={{ fontWeight: 700, color: 'var(--foreground-muted)', fontSize: '0.9rem', letterSpacing: '0.5px' }}>{title.toUpperCase()}</span>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--secondary)', boxShadow: '0 0 10px var(--secondary)' }}></div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div className={styles.metricValue} style={{ fontSize: '3.2rem', fontWeight: 900 }}>
          {value}<span className={styles.metricUnit} style={{ fontSize: '1.1rem', fontWeight: 600 }}>{unit}</span>
        </div>
        <div style={{ width: '150px', height: '60px', opacity: 0.6 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={INITIAL_TREND}>
              <Tooltip content={() => null} />
              <Line type="step" dataKey={chartKey} stroke="var(--primary)" strokeWidth={3} dot={false} animationDuration={2000} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
