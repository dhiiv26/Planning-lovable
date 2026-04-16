export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'error' | 'warn';
  message: string;
}

export function getLogs(): LogEntry[] {
  const stored = localStorage.getItem('security_logs');
  return stored ? JSON.parse(stored) : [];
}

export function addLog(level: LogEntry['level'], message: string) {
  const logs = getLogs();
  const entry: LogEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    level,
    message,
  };
  logs.unshift(entry);
  // Keep last 200 logs
  localStorage.setItem('security_logs', JSON.stringify(logs.slice(0, 200)));
}

export function clearLogs() {
  localStorage.setItem('security_logs', JSON.stringify([]));
}
