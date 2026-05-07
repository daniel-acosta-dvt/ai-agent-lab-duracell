import React, { useEffect, useMemo, useState } from 'react';
import { Client, ProcessedRecord } from '../types';
import { LOGO_URL } from '../constants';
import { LogOut, Loader2, RefreshCw, FileText, AlertTriangle, FilePlus2 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, AreaChart, Area,
} from 'recharts';

interface SubmissionDoc {
  id: string;
  submittedAt: string | null;
  client: { name: string; email: string; company: string; companyCode: string } | null;
  records: ProcessedRecord[];
}

interface ReportProps {
  client: Client;
  onLogout: () => void;
  onNavigate: (view: 'submit' | 'report') => void;
}

const KPI: React.FC<{ label: string; value: string; accent?: boolean }> = ({ label, value, accent }) => (
  <div className={`bg-duracell-white border rounded p-3 ${accent ? 'border-duracell-copper' : 'border-duracell-mediumGray'}`}>
    <div className="text-[10px] font-bold uppercase tracking-wider text-duracell-darkGray">{label}</div>
    <div className={`text-lg font-bold mt-1 ${accent ? 'text-duracell-copper' : 'text-duracell-black'}`}>{value}</div>
  </div>
);

const ChartCard: React.FC<{ title: string; hint?: string; children: React.ReactNode }> = ({ title, hint, children }) => (
  <div className="bg-duracell-white border border-duracell-mediumGray rounded p-3">
    <div className="flex items-baseline justify-between mb-2">
      <h3 className="text-[12px] font-bold text-duracell-black uppercase tracking-wide">{title}</h3>
      {hint && <span className="text-[10px] text-duracell-darkGray">{hint}</span>}
    </div>
    {children}
  </div>
);

const formatTimestamp = (iso: string | null): string => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

const Report: React.FC<ReportProps> = ({ client, onLogout, onNavigate }) => {
  const [submissions, setSubmissions] = useState<SubmissionDoc[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/submissions');
      if (!res.ok) throw new Error(`Backend ${res.status}: ${await res.text()}`);
      const data = (await res.json()) as SubmissionDoc[];
      setSubmissions(data);
    } catch (err) {
      console.error('Failed to load submissions:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const totalRecords = (submissions || []).reduce((sum, s) => sum + s.records.length, 0);

  const eurFmt = useMemo(
    () => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }),
    []
  );

  const { dailyFlow, topMaterials, totalValue, avgValue } = useMemo(() => {
    const all = (submissions || []).flatMap((s) =>
      s.records.map((r) => ({ ...r, submittedAt: s.submittedAt }))
    );

    const byDay = new Map<string, number>();
    for (const r of all) {
      const day = r.submittedAt ? r.submittedAt.slice(0, 10) : 'unknown';
      const v = Number.isFinite(r.newPrice) ? Number(r.newPrice) : 0;
      byDay.set(day, (byDay.get(day) ?? 0) + v);
    }
    const dailyFlow = Array.from(byDay.entries())
      .filter(([d]) => d !== 'unknown')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({
        date: date.slice(5), // MM-DD
        fullDate: date,
        value: Math.round(value),
      }));

    const byMaterial = new Map<string, number>();
    for (const r of all) {
      const key = r.shortText || r.brandDescription || '(unknown)';
      const v = Number.isFinite(r.newPrice) ? Number(r.newPrice) : 0;
      byMaterial.set(key, (byMaterial.get(key) ?? 0) + v);
    }
    const topMaterials = Array.from(byMaterial.entries())
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    const totalValue = all.reduce((s, r) => s + (Number.isFinite(r.newPrice) ? Number(r.newPrice) : 0), 0);
    const avgValue = all.length ? totalValue / all.length : 0;

    return { dailyFlow, topMaterials, totalValue, avgValue };
  }, [submissions]);

  return (
    <div className="h-screen bg-duracell-lightGray flex flex-col font-sans overflow-hidden">
      <header className="bg-duracell-black shadow-md z-10 border-b-4 border-duracell-copper flex-shrink-0">
        <div className="px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center">
            <img src={LOGO_URL} alt="Duracell" className="h-10 object-contain mr-4" />
            <h1 className="text-lg font-bold text-duracell-white hidden sm:block tracking-wide">Duracell AI Agent</h1>
          </div>
          <nav className="flex items-center space-x-2">
            <button
              onClick={() => onNavigate('submit')}
              className="flex items-center px-3 py-1.5 text-[12px] font-semibold text-duracell-white hover:bg-duracell-darkGray rounded transition-colors"
            >
              <FilePlus2 className="w-4 h-4 mr-2" /> New Request
            </button>
            <button
              onClick={() => onNavigate('report')}
              className="flex items-center px-3 py-1.5 text-[12px] font-bold text-duracell-white bg-duracell-copper rounded"
            >
              <FileText className="w-4 h-4 mr-2" /> Report
            </button>
          </nav>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-duracell-white text-right hidden md:block">
              <p className="font-semibold">{client.name}</p>
              <p className="text-duracell-mediumGray text-xs">{client.company} (Code: {client.companyCode})</p>
            </div>
            <button onClick={onLogout} className="p-2 text-duracell-mediumGray hover:text-duracell-white hover:bg-duracell-darkGray rounded transition-colors">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col p-4 sm:p-6 overflow-hidden min-h-0">
        <div className="flex-1 flex flex-col bg-duracell-white rounded-lg shadow-lg border border-duracell-mediumGray overflow-hidden min-h-0">
          <div className="p-4 border-b border-duracell-mediumGray bg-duracell-lightGray flex items-center justify-between flex-shrink-0">
            <h2 className="text-[15px] font-bold text-duracell-black uppercase tracking-wide">Submitted Price Change Requests</h2>
            <div className="flex items-center space-x-3">
              {submissions && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[10px] font-bold bg-duracell-white border border-duracell-mediumGray text-duracell-darkGray">
                  {submissions.length} submission{submissions.length === 1 ? '' : 's'} • {totalRecords} record{totalRecords === 1 ? '' : 's'}
                </span>
              )}
              <button
                onClick={load}
                disabled={loading}
                className="flex items-center px-3 py-1.5 text-[12px] font-bold text-duracell-darkGray bg-duracell-white border border-duracell-darkGray rounded hover:bg-[#E0E0E0] transition-colors disabled:opacity-60"
              >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Refresh
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            {submissions && submissions.length > 0 && (
              <div className="p-4 border-b border-duracell-mediumGray bg-duracell-lightGray space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <KPI label="Submissions" value={String(submissions.length)} />
                  <KPI label="Records" value={String(totalRecords)} />
                  <KPI label="Total value" value={eurFmt.format(totalValue)} accent />
                  <KPI label="Avg per record" value={eurFmt.format(avgValue)} />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <ChartCard title="Money flow over time" hint="Sum of new prices by submission day">
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={dailyFlow} margin={{ top: 5, right: 12, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="copperFlow" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#B87333" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="#B87333" stopOpacity={0.05} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#333' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#333' }} tickFormatter={(v) => eurFmt.format(Number(v))} width={70} />
                        <Tooltip
                          formatter={(v: number) => [eurFmt.format(v), 'Total']}
                          labelFormatter={(label, payload) => {
                            const p = payload && payload[0];
                            return p?.payload?.fullDate || label;
                          }}
                          contentStyle={{ fontSize: 12 }}
                        />
                        <Area type="monotone" dataKey="value" stroke="#B87333" strokeWidth={2} fill="url(#copperFlow)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </ChartCard>
                  <ChartCard title="Top materials by value" hint="Sum of new prices per material (top 8)">
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={topMaterials} layout="vertical" margin={{ top: 5, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
                        <XAxis type="number" tick={{ fontSize: 11, fill: '#333' }} tickFormatter={(v) => eurFmt.format(Number(v))} />
                        <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#333' }} width={130} />
                        <Tooltip formatter={(v: number) => [eurFmt.format(v), 'Total']} contentStyle={{ fontSize: 12 }} />
                        <Bar dataKey="value" fill="#228B22" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </div>
              </div>
            )}
            {loading && submissions === null && (
              <div className="h-full flex flex-col items-center justify-center text-duracell-mediumGray p-10">
                <Loader2 className="w-10 h-10 mb-3 animate-spin text-duracell-copper" />
                <p className="text-[12px] font-semibold">Loading submissions…</p>
              </div>
            )}
            {error && (
              <div className="m-4 p-4 rounded border border-duracell-error bg-red-50 text-duracell-error text-[12px] flex items-start">
                <AlertTriangle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-bold mb-1">Failed to load submissions</div>
                  <div className="font-mono break-all">{error}</div>
                </div>
              </div>
            )}
            {!loading && !error && submissions && submissions.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-duracell-mediumGray p-10">
                <FileText className="w-16 h-16 mb-4 opacity-50" />
                <p className="text-[12px] font-semibold">No submissions yet.</p>
                <button
                  onClick={() => onNavigate('submit')}
                  className="mt-4 inline-flex items-center px-4 py-2 text-[12px] font-bold text-duracell-white bg-duracell-copper rounded hover:bg-[#904B0B] transition-colors shadow-sm"
                >
                  <FilePlus2 className="w-4 h-4 mr-2" /> Create the first one
                </button>
              </div>
            )}
            {submissions && submissions.length > 0 && (
              <table className="min-w-max w-full border-collapse text-[11px]">
                <thead className="sticky top-0 z-10 bg-[#D49A7A] text-duracell-white">
                  <tr>
                    <th className="px-3 py-2 text-left font-bold border border-duracell-white">Submitted</th>
                    <th className="px-3 py-2 text-left font-bold border border-duracell-white">Submission</th>
                    <th className="px-3 py-2 text-left font-bold border border-duracell-white">Submitted By</th>
                    <th className="px-3 py-2 text-left font-bold border border-duracell-white">Vendor</th>
                    <th className="px-3 py-2 text-left font-bold border border-duracell-white">Material</th>
                    <th className="px-3 py-2 text-left font-bold border border-duracell-white">Brand Code</th>
                    <th className="px-3 py-2 text-right font-bold border border-duracell-white">New Price</th>
                    <th className="px-3 py-2 text-center font-bold border border-duracell-white">Per</th>
                    <th className="px-3 py-2 text-center font-bold border border-duracell-white">UOM</th>
                    <th className="px-3 py-2 text-left font-bold border border-duracell-white">Validity</th>
                    <th className="px-3 py-2 text-left font-bold border border-duracell-white">Buyer</th>
                    <th className="px-3 py-2 text-left font-bold border border-duracell-white">Comments</th>
                  </tr>
                </thead>
                <tbody className="bg-duracell-white">
                  {submissions.flatMap((sub) =>
                    sub.records.map((r, idx) => (
                      <tr
                        key={`${sub.id}-${r.id || idx}`}
                        className="hover:bg-duracell-lightGray transition-colors"
                      >
                        <td className="px-3 py-2 border border-duracell-mediumGray whitespace-nowrap text-duracell-darkGray">
                          {formatTimestamp(sub.submittedAt)}
                        </td>
                        <td className="px-3 py-2 border border-duracell-mediumGray font-mono text-[10px] text-duracell-darkGray" title={sub.id}>
                          {sub.id.slice(0, 8)}…
                        </td>
                        <td className="px-3 py-2 border border-duracell-mediumGray">
                          <div className="font-semibold">{sub.client?.name || '—'}</div>
                          <div className="text-[10px] text-duracell-darkGray">{sub.client?.email || ''}</div>
                        </td>
                        <td className="px-3 py-2 border border-duracell-mediumGray">
                          <div>{r.vendorName || sub.client?.company || '—'}</div>
                          {r.vendorCode && <div className="text-[10px] text-duracell-darkGray font-mono">{r.vendorCode}</div>}
                        </td>
                        <td className="px-3 py-2 border border-duracell-mediumGray">
                          <div>{r.shortText || r.brandDescription || '—'}</div>
                          {r.brandDescription && r.shortText && r.brandDescription !== r.shortText && (
                            <div className="text-[10px] text-duracell-darkGray">{r.brandDescription}</div>
                          )}
                        </td>
                        <td className="px-3 py-2 border border-duracell-mediumGray font-mono">{r.brandCode || '—'}</td>
                        <td className="px-3 py-2 border border-duracell-mediumGray text-right font-bold text-duracell-success">
                          {Number.isFinite(r.newPrice) ? `${r.newPrice} ${r.currency || ''}`.trim() : '—'}
                        </td>
                        <td className="px-3 py-2 border border-duracell-mediumGray text-center">{r.per || '—'}</td>
                        <td className="px-3 py-2 border border-duracell-mediumGray text-center">{r.uom || '—'}</td>
                        <td className="px-3 py-2 border border-duracell-mediumGray whitespace-nowrap">
                          {r.validityStartDate || '—'}
                          {r.validityEndDate && ` → ${r.validityEndDate}`}
                        </td>
                        <td className="px-3 py-2 border border-duracell-mediumGray">{r.buyerCode || '—'}</td>
                        <td className="px-3 py-2 border border-duracell-mediumGray italic text-duracell-darkGray">{r.comments || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Report;
