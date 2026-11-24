import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, Deal, getDashboard, getDeals, getPipeline } from "../../api/client";
import { compactCurrency, currency, formatDate, wonRevenueByMonth } from "../shared/format";
import { ErrorPanel } from "../shared/RecordPages";

const colors = ["#06D6A0", "#FFC145", "#F78C6B", "#118AB2", "#EF476F", "#073B4C"];

export function DashboardPage() {
  const dashboard = useQuery({ queryKey: ["dashboard"], queryFn: getDashboard });
  const pipeline = useQuery({ queryKey: ["pipeline"], queryFn: getPipeline });
  const deals = useQuery({ queryKey: ["deals", "dashboard"], queryFn: () => getDeals("?sort=expected_close_date&direction=asc") });
  if (dashboard.isError) return <main className="page"><ErrorPanel error={dashboard.error} /></main>;
  const data = dashboard.data;
  const monthly = wonRevenueByMonth((deals.data ?? []) as Deal[]);
  return <main className="page">
    <div className="title-row"><div><p className="eyebrow">OVERVIEW</p><h1>Sales dashboard</h1><p className="muted">{new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(new Date())} · A clear view of your sales</p></div><Link className="primary-button link-button" to="/deals">View deals</Link></div>
    <section className="hero-grid">
      <article className="hero-panel"><span>Open expected revenue</span><strong>{data ? currency(data.open_expected_revenue) : "—"}</strong><p>Weighted across all active deals</p></article>
      <div className="metrics">
        <Metric label="Open pipeline" value={data ? currency(data.open_pipeline) : "—"} />
        <Metric label="Won this month" value={data ? currency(data.won_this_month) : "—"} />
        <Metric label="Deals won this month" value={data ? String(data.deals_won) : "—"} />
        <Metric label="Late deals" value={data ? String(data.late_deals) : "—"} alert={!!data?.late_deals} />
      </div>
    </section>
    <section className="chart-grid">
      <article className="panel chart-panel"><div className="section-heading"><div><h2>Won revenue</h2><p className="muted">Last 12 months</p></div></div>
        <div className="chart-area">{deals.isLoading ? <p className="muted">Loading chart…</p> : <ResponsiveContainer width="100%" height="100%"><LineChart data={monthly} margin={{ left: 6, right: 12, top: 16, bottom: 4 }}>
          <CartesianGrid stroke="#E8EFF0" vertical={false} /><XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "#687D84", fontSize: 11 }} interval={1} /><YAxis tickFormatter={compactCurrency} tickLine={false} axisLine={false} tick={{ fill: "#687D84", fontSize: 11 }} width={65} /><Tooltip formatter={(value: number) => currency(value)} /><Line type="monotone" dataKey="revenue" stroke="#06A77D" strokeWidth={3} dot={{ fill: "#06D6A0", r: 3 }} activeDot={{ r: 5 }} />
        </LineChart></ResponsiveContainer>}</div>
      </article>
      <article className="panel chart-panel"><div className="section-heading"><div><h2>Pipeline funnel</h2><p className="muted">Deal value across all stages</p></div></div>
        <div className="funnel-list">{pipeline.data?.columns.map((column, index) => <div className="funnel-row" key={column.stage} style={{ width: `${Math.max(42, 100 - index * 10)}%`, background: `${colors[index]}22` }}><span>{column.stage}</span><strong>{currency(column.value_usd)}</strong></div>)}</div>
      </article>
    </section>
    <section className="dashboard-lower">
      <article className="panel"><div className="section-heading"><div><h2>Follow-ups</h2><p className="muted">Open reminders</p></div><span className="count-pill">{data?.pending_follow_ups.length ?? 0}</span></div>
        {data?.pending_follow_ups.length ? <div className="followup-list">{data.pending_follow_ups.slice(0, 6).map((activity) => <Followup key={activity.id} activity={activity} />)}</div> : <p className="muted">No pending follow-ups.</p>}
      </article>
      <article className="panel"><div className="section-heading"><div><h2>Recent activity</h2><p className="muted">Latest updates across your accounts</p></div></div>
        {data?.recent_activity.length ? <ul className="activity-list">{data.recent_activity.slice(0, 7).map((activity) => <li key={activity.id}><span className="activity-mark">{activity.type.slice(0, 1)}</span><div><strong>{activity.type}</strong><p>{activity.description}</p><small>{new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(activity.happened_at))}</small></div></li>)}</ul> : <p className="muted">No activity recorded yet.</p>}
      </article>
    </section>
  </main>;
}

function Metric({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) {
  return <article className={`metric ${alert ? "metric-alert" : ""}`}><span>{label}</span><strong>{value}</strong></article>;
}

function Followup({ activity }: { activity: Activity }) {
  const href = activity.deal_ids[0] ? `/deals/${activity.deal_ids[0]}` : activity.contact_ids[0] ? `/contacts/${activity.contact_ids[0]}` : "/contacts";
  const overdue = activity.follow_up_date && activity.follow_up_date < new Date().toISOString().slice(0, 10);
  return <Link className="followup-row" to={href}><span className={`followup-date ${overdue ? "overdue" : ""}`}>{overdue ? "Overdue" : formatDate(activity.follow_up_date)}</span><span className="followup-description">{activity.description}</span><span className="followup-arrow">→</span></Link>;
}
