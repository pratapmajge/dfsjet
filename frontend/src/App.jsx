import React, { useEffect, useMemo, useState } from 'react';

import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Wind, Activity, Gauge, TrendingUp, RefreshCw, Download, Zap, CalendarDays, AlertTriangle, CheckCircle2 } from 'lucide-react';

const fmt = n => n == null || !Number.isFinite(Number(n)) ? '—' : Number(n).toLocaleString('en-GB', { maximumFractionDigits: 1 });
const short = n => n == null ? '—' : `${(Number(n) / 1000).toFixed(1)}k`;
const day = s => new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
const time = s => new Date(s).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short' });
export default function App() {
    const [payload, setPayload] = useState(null), [loading, setLoading] = useState(false), [demo, setDemo] = useState(false);
    const [range, setRange] = useState('all'), [error, setError] = useState('');
    const [activePage, setActivePage] = useState("overview");
    async function load(useDemo = demo) {
        setLoading(true); setError('');
        try {
            const q = new URLSearchParams({ start: '2026-01-01T00:00:00Z', end: '2026-02-01T00:00:00Z', demo: String(useDemo) });
            const r = await fetch(`/api/metrics?${q}`); if (!r.ok) throw new Error(`API returned ${r.status}`);
            const d = await r.json(); setPayload(d); if (d.error) setError(d.error); setDemo(useDemo);
        } catch (e) { setError('Could not reach the backend. Start the API or use demo mode.'); }
        finally { setLoading(false); }
    }
    useEffect(() => { load(false) }, []);
    const rows = payload?.rows || [];
    const filtered = useMemo(() => range === 'all' ? rows : rows.filter(r => new Date(r.startTime).getUTCDate() <= Number(range)), [rows, range]);
    const metrics = useMemo(() => {
        if (!filtered.length) return null;
        const es = filtered.map(r => r.forecast - r.actual), n = es.length, actual = filtered.reduce((a, r) => a + r.actual, 0);
        return { periods: n, mae: es.reduce((a, e) => a + Math.abs(e), 0) / n, rmse: Math.sqrt(es.reduce((a, e) => a + e * e, 0) / n), bias: es.reduce((a, e) => a + e, 0) / n, wape: actual ? es.reduce((a, e) => a + Math.abs(e), 0) / actual * 100 : null, meanActual: actual / n };
    }, [filtered]);
    const chart = useMemo(
        () =>
            filtered
                .map(r => ({
                    ...r,
                    actual: Number(r.actual),
                    forecast: Number(r.forecast),
                    error: Number(r.forecast) - Number(r.actual),
                    label: time(r.startTime),
                })),
        [filtered]
    ); function downloadCSV() { const csv = ['startTime,publishTime,forecastMW,actualMW,errorMW', ...filtered.map(r => [r.startTime, r.publishTime, r.forecast, r.actual, r.forecast - r.actual].join(','))].join('\n'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'wind-forecast-january-2026.csv'; a.click(); URL.revokeObjectURL(a.href); }
    return <div className="app">

        <aside className="sidebar">
            <div className="brand">
                <div className="brand-icon"><Wind size={22} /></div>
                <div>
                    <strong>Gridwise</strong>
                    <small>FORECAST INTELLIGENCE</small>
                </div>
            </div>

            <div className="nav-label">WORKSPACE</div>

            <button
                type="button"
                className={`nav-item ${activePage === "overview" ? "active" : ""}`}
                onClick={() => setActivePage("overview")}
            >
                <Activity size={17} /> Wind overview
            </button>

            <button
                type="button"
                className={`nav-item ${activePage === "accuracy" ? "active" : ""}`}
                onClick={() => setActivePage("accuracy")}
            >
                <Gauge size={17} /> Forecast accuracy
            </button>

            <div className="side-bottom">
                <div className="status-dot" />
                <div>
                    <b>Data connection</b>
                    <small>{payload?.source || "Checking Elexon…"}</small>
                </div>
            </div>
        </aside>

        <main className="main"><header className="topbar"><div className="crumb">Analytics <span>/</span> {activePage === "overview" ? "Wind generation" : "Forecast accuracy"}</div><div className="top-actions"><span className="period-tag"><CalendarDays size={14} /> JAN 2026</span><button className="icon-btn" onClick={() => load(demo)} disabled={loading} title="Refresh"><RefreshCw size={16} className={loading ? 'spin' : ''} /></button></div></header>
            {activePage === "overview" ? (<React.Fragment>
                <section className="heading"><div><div className="eyebrow">UK NATIONAL · DAY-AHEAD MARKET</div><h1>Wind forecast overview</h1><p>Understand expected renewable generation and quantify forecast uncertainty before procurement.</p></div><button className="export-btn" onClick={downloadCSV} disabled={!filtered.length}><Download size={16} /> Export data</button></section>
                {payload?.demo && <div className="notice demo"><AlertTriangle size={17} /><div><b>Demo data is active</b><span>Illustrative values only — not actual Elexon observations.</span></div></div>}
                {error && <div className="notice warn"><AlertTriangle size={17} /><div><b>Data connection needs attention</b><span>{error}</span></div></div>}
                {!payload?.demo && payload?.notice && <div className="source-note"><CheckCircle2 size={15} />{payload.notice}</div>}
                <div className="section-row"><h2>Performance snapshot</h2><div className="range-control"><span>Show</span><select value={range} onChange={e => setRange(e.target.value)}><option value="all">Full month</option><option value="7">Days 1–7</option><option value="14">Days 1–14</option><option value="21">Days 1–21</option></select></div></div>
                <div className="kpis">
                    <Kpi icon={<Wind />} label="Mean actual generation" value={metrics ? `${fmt(metrics.meanActual)} MW` : '—'} foot="Matched hourly periods" color="blue" />
                    <Kpi icon={<Activity />} label="Mean absolute error" value={metrics ? `${fmt(metrics.mae)} MW` : '—'} foot="Lower is better" color="violet" />
                    <Kpi icon={<TrendingUp />} label="Forecast bias" value={metrics ? `${metrics.bias > 0 ? '+' : ''}${fmt(metrics.bias)} MW` : '—'} foot={metrics ? (metrics.bias > 0 ? 'Forecast tends to overestimate' : metrics.bias < 0 ? 'Forecast tends to underestimate' : 'No average bias') : 'Matched periods required'} color="orange" />
                    <Kpi icon={<Gauge />} label="WAPE" value={metrics && metrics.wape != null ? `${fmt(metrics.wape)}%` : '—'} foot="Absolute error / total actual" color="green" />
                </div>
                <section className="panel chart-panel"><div className="panel-head"><div><h2>Forecast vs actual</h2><p>National wind generation · MW · hourly records sampled for readability</p></div><div className="legend"><span><i className="dot forecast" /> Forecast</span><span><i className="dot actual" /> Actual</span></div></div>
                    {filtered.length ? <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chart} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}><defs><linearGradient id="actualFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#14b8a6" stopOpacity={0.17} /><stop offset="95%" stopColor="#14b8a6" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#e8edf3" /><XAxis dataKey="label" tick={{ fontSize: 10, fill: '#7b8798' }} tickLine={false} axisLine={false} minTickGap={42} /><YAxis tickFormatter={short} tick={{ fontSize: 11, fill: '#7b8798' }} tickLine={false} axisLine={false} width={46} />
                        <Tooltip
                            labelFormatter={v => v}
                            contentStyle={{ borderRadius: 12, border: '1px solid #e6ebf2', fontSize: 12 }}
                            formatter={(value, name) => [
                                `${fmt(value)} MW`,
                                name === 'Actual' ? 'Actual generation' : 'Forecast generation'
                            ]}
                        />
                        <Area
                            type="monotone"
                            dataKey="actual"
                            name="Actual"
                            stroke="#14b8a6"
                            strokeWidth={2}
                            fill="url(#actualFill)"
                            dot={false}
                        />
                        <Area
                            type="monotone"
                            dataKey="forecast"
                            name="Forecast"
                            stroke="#6677e8"
                            strokeWidth={2}
                            fill="none"
                            dot={false}
                        />                       </AreaChart>
                    </ResponsiveContainer></div> : <Empty loading={loading} onDemo={() => load(true)} />}
                    <div className="chart-foot"><span><i className="foot-dot teal" />Actual wind generation</span><span><i className="foot-dot purple" />Selected day-ahead forecast</span><span className="units">All timestamps shown in UTC</span></div>
                </section>
                <div className="lower-grid"><section className="panel"><div className="panel-head"><div><h2>Error distribution</h2><p>Forecast minus actual generation</p></div></div>{filtered.length ? <div className="error-bars">{[-3000, -2000, -1000, 0, 1000, 2000, 3000].map((v, i) => <div className="error-row" key={v}><span>{v > 0 ? '+' : ''}{v / 1000}k</span><div className="bar-track"><div className={`bar ${v < 0 ? 'negative' : 'positive'}`} style={{ width: `${Math.max(4, Math.min(100, Math.abs(v) / 30))}%` }} /></div></div>)}</div> : <p className="empty-small">Load records to view the error scale.</p>}<div className="panel-foot">Illustrative scale guide; use the table for observed errors.</div></section>
                    <section className="panel metric-panel"><div className="panel-head"><div><h2>Accuracy metrics</h2><p>Calculated from matched records</p></div><div className="metric-badge"><Zap size={14} /> Live calculation</div></div><Metric label="Root mean squared error (RMSE)" value={metrics ? `${fmt(metrics.rmse)} MW` : '—'} desc="Penalises large misses more heavily" /><Metric label="Mean absolute error (MAE)" value={metrics ? `${fmt(metrics.mae)} MW` : '—'} desc="Typical absolute forecast miss" /><Metric label="Matched settlement periods" value={metrics ? fmt(metrics.periods) : '—'} desc="Expected maximum: 744 hourly periods" /><Metric label="Forecast publication" value="Before delivery day" desc="Latest eligible publication under prototype cutoff" /></section>
                </div>
                <section className="panel table-panel"><div className="panel-head"><div><h2>Settlement period detail</h2><p>Most recent records in the selected range</p></div><span className="record-count">{filtered.length.toLocaleString()} periods</span></div><div className="table-scroll"><table><thead><tr><th>Delivery time (UTC)</th><th>Published (UTC)</th><th>Forecast (MW)</th><th>Actual (MW)</th><th>Error (MW)</th></tr></thead><tbody>{filtered.slice(-18).reverse().map((r, i) => { let e = r.forecast - r.actual; return <tr key={r.startTime + i}><td>{time(r.startTime)}</td><td>{time(r.publishTime)}</td><td>{fmt(r.forecast)}</td><td>{fmt(r.actual)}</td><td className={e > 0 ? 'err-pos' : e < 0 ? 'err-neg' : ''}>{e > 0 ? '+' : ''}{fmt(e)}</td></tr> })}{!filtered.length && <tr><td colSpan="5" className="empty-cell">{loading ? 'Loading Elexon data…' : 'No matched records. Try demo mode or refresh.'}</td></tr>}</tbody></table></div></section>
            </React.Fragment>) : (
                <React.Fragment>
                    <section className="heading">
                        <div><div className="eyebrow">UK NATIONAL · JANUARY 2026</div><h1>Forecast accuracy</h1><p>Understand how far day-ahead wind forecasts differ from actual generation.</p></div>
                        <button className="export-btn" onClick={downloadCSV} disabled={!filtered.length}><Download size={16} /> Export data</button>
                    </section>
                    {payload?.demo && <div className="notice demo"><AlertTriangle size={17} /><div><b>Demo data is active</b><span>Illustrative values only — not actual Elexon observations.</span></div></div>}
                    {error && <div className="notice warn"><AlertTriangle size={17} /><div><b>Data connection needs attention</b><span>{error}</span></div></div>}
                    <div className="section-row"><h2>Accuracy summary</h2><div className="range-control"><span>Show</span><select value={range} onChange={e => setRange(e.target.value)}><option value="all">Full month</option><option value="7">Days 1–7</option><option value="14">Days 1–14</option><option value="21">Days 1–21</option></select></div></div>
                    <div className="kpis">
                        <Kpi icon={<Activity />} label="Mean absolute error" value={metrics ? `${fmt(metrics.mae)} MW` : '—'} foot="Average absolute forecast miss" color="violet" />
                        <Kpi icon={<Gauge />} label="WAPE" value={metrics ? `${fmt(metrics.wape)}%` : '—'} foot="Absolute error relative to generation" color="green" />
                        <Kpi icon={<TrendingUp />} label="Forecast bias" value={metrics ? `${metrics.bias > 0 ? '+' : ''}${fmt(metrics.bias)} MW` : '—'} foot="Positive means overforecast" color="orange" />
                        <Kpi icon={<Zap />} label="RMSE" value={metrics ? `${fmt(metrics.rmse)} MW` : '—'} foot="Penalises larger misses" color="blue" />
                    </div>
                    <section className="panel chart-panel"><div className="panel-head"><div><h2>Forecast error over time</h2><p>Forecast minus actual · MW · sampled hourly observations</p></div></div>
                        {filtered.length ? <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><LineChart data={chart}><CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#e8edf3" /><XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={42} /><YAxis tickFormatter={short} tick={{ fontSize: 11 }} width={52} /><Tooltip formatter={v => [`${fmt(v)} MW`, 'Forecast error']} /><Line dataKey="error" type="monotone" stroke="#6677e8" dot={false} strokeWidth={2} /></LineChart></ResponsiveContainer></div> : <Empty loading={loading} onDemo={() => load(true)} />}
                    </section>
                    <section className="panel table-panel"><div className="panel-head"><div><h2>Largest forecast misses</h2><p>Top 15 absolute errors in the selected period</p></div><span className="record-count">{filtered.length.toLocaleString()} matched periods</span></div>
                        <div className="table-scroll"><table><thead><tr><th>Delivery time (UTC)</th><th>Published (UTC)</th><th>Forecast (MW)</th><th>Actual (MW)</th><th>Error (MW)</th></tr></thead><tbody>{[...filtered].sort((a, b) => Math.abs(b.forecast - b.actual) - Math.abs(a.forecast - a.actual)).slice(0, 15).map((r, i) => <tr key={r.startTime + i}><td>{time(r.startTime)}</td><td>{time(r.publishTime)}</td><td>{fmt(r.forecast)}</td><td>{fmt(r.actual)}</td><td className={r.forecast - r.actual > 0 ? 'err-pos' : 'err-neg'}>{fmt(r.forecast - r.actual)}</td></tr>)}</tbody></table></div>
                    </section>
                </React.Fragment>
            )}
            <footer>GRIDWISE FORECAST DESK <span>Prototype · Elexon BMRS data · Not a trading recommendation</span></footer>
        </main>
    </div>
}
function Kpi({ icon, label, value, foot, color }) { return <div className="kpi"><div className={`kpi-icon ${color}`}>{icon}</div><div className="kpi-label">{label}</div><div className="kpi-value">{value}</div><div className="kpi-foot">{foot}</div></div> }
function Metric({ label, value, desc }) { return <div className="metric-line"><div><b>{label}</b><small>{desc}</small></div><strong>{value}</strong></div> }
function Empty({ loading, onDemo }) { return <div className="empty-state"><div className="empty-icon"><Wind size={28} /></div><h3>{loading ? 'Loading forecast records' : 'No matched Elexon records yet'}</h3><p>{loading ? 'Fetching January 2026 actuals and historical forecasts.' : 'The upstream API may be unavailable or its response schema may have changed.'}</p><button className="export-btn" onClick={onDemo}>Open illustrative demo</button></div> }
