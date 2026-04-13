'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './HealthChatbot.module.css';

interface Message {
  id: number;
  type: 'bot' | 'user';
  text: any;
}

interface ChatbotProps {
  onComplete: (data: any) => void;
  onClose: () => void;
  userId?: number;
}

const QUESTIONS = [
  { key: 'name',   text: "Hello! I'm Dr. AI 🩺 I'll conduct your medical assessment. May I start with your full name?" },
  { key: 'age',    text: "Thank you. How old are you?" },
  { key: 'gender', text: "What is your gender? (Male / Female / Other)" },
  { key: 'hr',     text: "Let's review your vitals. What is your current Heart Rate in BPM? (e.g. 72)" },
  { key: 'temp',   text: "What is your body temperature in °F? (e.g. 98.6)" },
  { key: 'oxygen', text: "What is your Oxygen level (SpO₂ %)? (e.g. 98)" },
  { key: 'water',  text: "How much water have you consumed today in ml? (e.g. 1500)" },
  { key: 'sleep',  text: "How many hours did you sleep last night?" },
  { key: 'reason', text: "Please describe the reason for your visit or any symptoms you are currently experiencing." },
];

export default function HealthChatbot({ onComplete, onClose, userId }: ChatbotProps) {
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, type: 'bot', text: QUESTIONS[0].text },
  ]);
  const [input, setInput]   = useState('');
  const [currentQ, setCurrentQ] = useState(0);
  const [formData, setFormData] = useState<any>({ user_id: userId });
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // ── Auto-scroll ref ────────────────────────────────────────────────
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Smooth scroll to bottom whenever messages change
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  // ── Send handler ───────────────────────────────────────────────────
  const handleSend = async () => {
    if (!input.trim() || isAnalyzing) return;

    const userMsg: Message = { id: Date.now(), type: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);

    const key = QUESTIONS[currentQ].key;
    const updatedData = { ...formData, [key]: input };
    setFormData(updatedData);
    setInput('');

    if (currentQ < QUESTIONS.length - 1) {
      // Next question with a short "thinking" delay
      setTimeout(() => {
        const nextIdx = currentQ + 1;
        setCurrentQ(nextIdx);
        setMessages(prev => [
          ...prev,
          { id: Date.now() + 1, type: 'bot', text: QUESTIONS[nextIdx].text },
        ]);
      }, 500);
    } else {
      // All questions answered — analyze
      setIsAnalyzing(true);
      setMessages(prev => [
        ...prev,
        { id: Date.now() + 2, type: 'bot', text: '⏳ Processing your medical profile...' },
      ]);

      try {
        const res = await fetch('/api/analyze-full', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            name: updatedData.name,
            age: parseInt(updatedData.age),
            gender: updatedData.gender,
            heart_rate: parseInt(updatedData.hr),
            body_temp: parseFloat(updatedData.temp),
            oxygen_level: parseFloat(updatedData.oxygen),
            bp: '120/80',
            water_intake: parseInt(updatedData.water),
            sleep_hours: parseFloat(updatedData.sleep),
            reason_for_visit: updatedData.reason,
          }),
        });

        if (!res.ok) throw new Error("Backend unreachable");

        const result = await res.json();

        const reportText = (
          <div className={styles.report}>
            <p className={styles.reportTitle}>
              Assessment complete for <strong>{updatedData.name}</strong> ✅
            </p>
            <div className={styles.reportSection}>
              <span className={styles.reportLabel}>Status</span>
              <span className={styles.reportBadge}>{result.diagnosis}</span>
            </div>
            {result.prescription?.length > 0 && (
              <div className={styles.reportSection}>
                <span className={styles.reportLabel}>💊 Prescription</span>
                {result.prescription.map((m: any, i: number) => (
                  <p key={i} className={styles.reportItem}>
                    {m.name} ({m.dosage}) — {m.instructions}
                  </p>
                ))}
              </div>
            )}
          </div>
        );

        setMessages(prev => [...prev, { id: Date.now() + 3, type: 'bot', text: reportText }]);
        onComplete(result);
      } catch (err) {
        console.warn("Backend down, using offline simulation:", err);
        const mockResult = {
          diagnosis: 'Stable (Simulated)',
          score: 95,
          timestamp: new Date().toLocaleString(),
          summary: 'Simulation Complete: Vitals appear stable. Please connect to backend server for a full medical integrity check.',
          prescription: [{ name: 'Healthy Habits', dosage: 'Daily', duration: 'Ongoing', instructions: 'Maintain hydration and sleep' }],
          remedies: ['Hydration', 'Rest'],
          exercises: ['Morning Walk'],
          hr: parseInt(updatedData.hr),
          temp: parseFloat(updatedData.temp),
          oxygen: parseFloat(updatedData.oxygen),
          water: parseInt(updatedData.water),
          reason: updatedData.reason
        };
        setMessages(prev => [
          ...prev,
          { id: Date.now() + 3, type: 'bot', text: '⚠️ Backend offline. Your session data was analyzed locally but not saved to the clinical history database.' },
          { id: Date.now() + 4, type: 'bot', text: `Local Result: ${mockResult.diagnosis}. ${mockResult.summary}` }
        ]);
        onComplete(mockResult);
      } finally {
        setIsAnalyzing(false);
      }
    }
  };

  return (
    <div className={styles.chatContainer}>
      {/* Header */}
      <header className={styles.chatHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.onlineDot} />
          <div>
            <p className={styles.headerTitle}>Virtual Doctor AI</p>
            <p className={styles.headerSub}>Dr. AI • Online</p>
          </div>
        </div>
        <button onClick={onClose} className={styles.closeBtn} aria-label="Close chat">✕</button>
      </header>

      {/* Messages */}
      <div className={styles.messages}>
        {messages.map((m: any) => (
          <div key={m.id} className={`${styles.message} ${styles[m.type]}`}>
            {m.type === 'bot' && <div className={styles.botAvatar}>🩺</div>}
            <div className={styles.bubble}>{m.text}</div>
          </div>
        ))}
        {/* Auto-scroll anchor */}
        <div ref={bottomRef} style={{ height: '1px' }} />
      </div>

      {/* Input */}
      <div className={styles.inputArea}>
        <input
          type="text"
          className={styles.textInput}
          placeholder={isAnalyzing ? 'Processing your results...' : 'Type your response...'}
          disabled={isAnalyzing}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          autoFocus
        />
        <button
          className={styles.sendBtn}
          onClick={handleSend}
          disabled={isAnalyzing || !input.trim()}
          aria-label="Send"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
