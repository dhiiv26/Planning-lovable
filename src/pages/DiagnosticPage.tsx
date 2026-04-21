import React, { useState, useMemo } from 'react';
import AppLayout from '@/components/AppLayout';
import { getLogs, clearLogs, LogEntry } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, RefreshCw, AlertCircle, Info, AlertTriangle } from 'lucide-react';

const levelConfig = {
  info: { icon: Info, class: 'text-primary', bg: 'bg-primary/10' },
  warn: { icon: AlertTriangle, class: 'text-amber-600', bg: 'bg-amber-50' },
  error: { icon: AlertCircle, class: 'text-destructive', bg: 'bg-destructive/10' },
};

const DiagnosticPage = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [filter, setFilter] = useState<'all' | LogEntry['level']>('all');

  const logs = useMemo(() => getLogs(), [refreshKey]);
  const filtered = filter === 'all' ? logs : logs.filter(l => l.level === filter);

  return (
    <AppLayout>
      <div className="space-y-4 max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Diagnostic</h1>
            <p className="text-sm text-muted-foreground">{logs.length} entrées</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setRefreshKey(k => k + 1)}>
              <RefreshCw className="h-4 w-4 mr-1" /> Rafraîchir
            </Button>
            <Button variant="outline" size="sm" onClick={() => { clearLogs(); setRefreshKey(k => k + 1); }} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-1" /> Vider
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          {(['all', 'info', 'warn', 'error'] as const).map(f => (
            <Button key={f} variant={filter === f ? 'default' : 'outline'} size="sm" onClick={() => setFilter(f)} className="capitalize">
              {f === 'all' ? 'Tout' : f} {f !== 'all' && `(${logs.filter(l => l.level === f).length})`}
            </Button>
          ))}
        </div>

        <Card>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <p className="text-muted-foreground text-sm p-6 text-center">Aucun log</p>
            ) : (
              <div className="divide-y max-h-[600px] overflow-y-auto">
                {filtered.map(log => {
                  const config = levelConfig[log.level];
                  const Icon = config.icon;
                  return (
                    <div key={log.id} className="flex items-start gap-3 p-3 text-sm">
                      <div className={`mt-0.5 rounded-full p-1 ${config.bg}`}>
                        <Icon className={`h-3 w-3 ${config.class}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="break-words">{log.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(log.timestamp).toLocaleString('fr-FR')}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default DiagnosticPage;
