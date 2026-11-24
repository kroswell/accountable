import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, Deal, getDashboard, getDeals, getPipeline, PipelineColumn, Stage, TimelineItem, updateActivity } from "../../api/client";
import { compactCurrency, currency, formatDate, wonRevenueByMonth } from "../shared/format";
import { ErrorPanel } from "../shared/RecordPages";

const stageColors: Record<Stage, string> = {
  New: "#DFF7EF",
  Qualified: "#FFF2C9",
  Proposal: "#FFE2DA",
  Negotiation: "#D9EEF5",
  Won: "#087F67",
  Lost: "#DDE5E7",
};

export function DashboardPage() {
  const dashboard = useQuery({ queryKey: ["dashboard"], queryFn: getDashboard });
  const pipeline = useQuery({ queryKey: ["pipeline"], queryFn: getPipeline });
  const deals = useQuery({ queryKey: ["deals", "dashboard"], queryFn: () => getDeals("?sort=expected_close_date&direction=asc") });

  if (dashboard.isError) return <main className="page"><ErrorPanel error={dashboard.error} /></main>;
  if (pipeline.isError) return <main className="page"><ErrorPanel error={pipeline.error} /></main>;

  const data = dashboard.data;
  const board = pipeline.data;
  const monthly = wonRevenueByMonth((deals.data ?? []) as Deal[]);
  const today = localDate(new Date());
  const overdueCount = data?.pending_follow_ups.filter((activity) => activity.follow_up_date && activity.follow_up_date < today).length ?? 0;
  const funnelColumns = board?.columns.filter((column) => column.stage !== "Lost") ?? [];

  return <main className="page dashboard-page">
    <div className="title-row dashboard-title">
      <div>
        <h1>Sales cockpit</h1>
        <p className="muted">{new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(new Date())} · Local sales view</p>
      </div>
      <span className="muted">Last 12 months</span>
    </div>

    <section className="hero-grid">
      <article className="hero-panel">
        <span>Open expected revenue</span>
        <strong>{data ? currency(data.open_expected_revenue) : "—"}</strong>
        <p>from {data ? currency(data.open_pipeline) : "—"} in open pipeline</p>
      </article>
      <div className="metrics">
        <Metric label="Won this month" value={data ? compactCurrency(data.won_this_month) : "—"} />
        <Metric label="Deals won" value={data ? String(data.deals_won) : "—"} />
        <Metric label="Late deals" value={data ? String(data.late_deals) : "—"} detail={data?.late_deals ? "Needs action" : "On track"} alert={!!data?.late_deals} />
        <Metric label="Pending follow-ups" value={data ? String(data.pending_follow_ups.length) : "—"} detail={overdueCount ? `${overdueCount} overdue` : "No overdue tasks"} alert={overdueCount > 0} />
      </div>
    </section>

    <section className="dashboard-grid">
      <article className="panel chart-panel revenue-panel">
        <div className="section-heading"><div><h2>Revenue won</h2><p className="muted">Monthly revenue · Last 12 months</p></div></div>
        <div className="chart-area">
          {deals.isLoading ? <p className="muted">Loading chart…</p> : <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthly} margin={{ left: 6, right: 12, top: 16, bottom: 4 }}>
              <CartesianGrid stroke="#EEF2F3" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "#687D84", fontSize: 10 }} interval={0} />
              <YAxis tickFormatter={compactCurrency} tickLine={false} axisLine={false} tick={{ fill: "#687D84", fontSize: 11 }} width={65} />
              <Tooltip formatter={(value: number) => currency(value)} />
              <Line type="monotone" dataKey="revenue" stroke="#087F67" strokeWidth={3} dot={{ fill: "#06D6A0", r: 4 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>}
        </div>
      </article>

      <article className="panel chart-panel funnel-panel">
        <div className="section-heading"><div><h2>Pipeline funnel</h2><p className="muted">Value at each stage</p></div></div>
        <div className="funnel-list">
          {funnelColumns.map((column, index) => <div
            className={`funnel-row funnel-${column.stage.toLowerCase()}`}
            key={column.stage}
            style={{ width: `${100 - index * 15}%` }}
          >
            <span>{column.stage}</span><strong>{compactCurrency(column.value_usd)}</strong>
          </div>)}
        </div>
      </article>

      <article className="panel now-panel">
        <div className="section-heading"><div><h2>Now</h2><p className="muted">Activity and next actions</p></div></div>
        <div className="now-activity">
          {data?.recent_activity.slice(0, 3).map((activity) => <RecentActivity key={activity.id} activity={activity} />)}
          {!data?.recent_activity.length && <p className="muted">No recent activity.</p>}
        </div>
        <div className="now-followups">
          {data?.pending_follow_ups.slice(0, 3).map((activity) => <Followup key={activity.id} activity={activity} />)}
          {!data?.pending_follow_ups.length && <p className="muted">No pending follow-ups.</p>}
        </div>
      </article>
    </section>

    <DashboardPipeline columns={board?.columns ?? []} openValue={board?.open_value_usd ?? 0} expectedRevenue={board?.open_expected_revenue ?? 0} />
  </main>;
}

function Metric({ label, value, detail, alert = false }: { label: string; value: string; detail?: string; alert?: boolean }) {
  return <article className={`metric ${alert ? "metric-alert" : ""}`}>
    <span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}
  </article>;
}

function RecentActivity({ activity }: { activity: Activity | TimelineItem }) {
  if (isStageChange(activity)) {
    return <Link className="activity-row" to={`/deals/${activity.deal_id}`}>
      <i className="stage-activity-dot" />
      <span><span className="activity-description">{activity.deal_name ?? "Deal moved"} · moved from {activity.from_stage} to {activity.to_stage}</span><small>{new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(activity.happened_at))}</small></span>
    </Link>;
  }
  const href = activity.deal_ids[0] ? `/deals/${activity.deal_ids[0]}` : activity.contact_ids[0] ? `/contacts/${activity.contact_ids[0]}` : "/";
  return <Link className="activity-row" to={href}>
    <i />
    <span><span className="activity-description">{activity.type} logged · {activity.description}</span><small>{new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(activity.happened_at))}</small></span>
  </Link>;
}

function isStageChange(activity: Activity | TimelineItem): activity is Extract<TimelineItem, { kind: "stage_change" }> {
  return "kind" in activity && activity.kind === "stage_change";
}

function Followup({ activity }: { activity: Activity }) {
  const client = useQueryClient();
  const complete = useMutation({
    mutationFn: () => updateActivity(activity.id, {
      type: activity.type, description: activity.description, happened_at: activity.happened_at,
      follow_up_date: activity.follow_up_date, done: true,
      contact_id: activity.contact_ids[0] ?? null, deal_id: activity.deal_ids[0] ?? null,
    }),
    onSuccess: () => client.invalidateQueries(),
  });
  const href = activity.deal_ids[0] ? `/deals/${activity.deal_ids[0]}` : activity.contact_ids[0] ? `/contacts/${activity.contact_ids[0]}` : "/";
  const today = localDate(new Date());
  const overdue = activity.follow_up_date && activity.follow_up_date < today;
  const dueLabel = overdue ? `Overdue · ${formatDate(activity.follow_up_date)}` : activity.follow_up_date === today ? `Today · ${formatDate(activity.follow_up_date)}` : formatDate(activity.follow_up_date);
  return <div className="task-row">
    <button className="task-check" type="button" aria-label={`Mark ${activity.description} done`} disabled={complete.isPending} onClick={() => complete.mutate()} />
    <Link to={href}><span className="task-description">{activity.description}</span><small className={overdue ? "overdue" : ""}>{dueLabel}</small></Link>
  </div>;
}

function DashboardPipeline({ columns, openValue, expectedRevenue }: { columns: PipelineColumn[]; openValue: number; expectedRevenue: number }) {
  return <section className="dashboard-pipeline">
    <div className="pipeline-title">
      <div><h2>Pipeline board</h2><p className="muted">{columns.slice(0, 4).reduce((total, column) => total + column.count, 0)} open deals · 6 columns</p></div>
      <div className="pipeline-totals">
        <div><span>Open value</span><strong>{currency(openValue)}</strong></div>
        <div><span>Expected revenue</span><strong>{currency(expectedRevenue)}</strong></div>
      </div>
    </div>
    <div className="pipeline-board dashboard-board">
      {columns.map((column) => <section className="pipeline-column" key={column.stage} style={{ borderTop: `4px solid ${column.stage === "Lost" ? "#AFC0C4" : column.stage === "Won" ? "#087F67" : stageColors[column.stage]}` }}>
        <header className="dashboard-column-head"><strong>{column.stage}</strong><span>{compactCurrency(column.value_usd)}</span></header>
        {column.cards.slice(0, 3).map((deal) => <Link className={`deal-card ${deal.late ? "deal-late" : ""}`} to={`/deals/${deal.id}`} key={deal.id}>
          <strong className="dashboard-deal-name">{deal.name}</strong>
          <span className="dashboard-deal-company">{deal.organization_name}</span>
          {deal.late && <span className="late-label">Overdue · {formatDate(deal.expected_close_date)}</span>}
          <span className="dashboard-deal-value"><b>{compactCurrency(deal.value_usd)}</b><small>{deal.probability}%</small></span>
        </Link>)}
        {!column.cards.length && <p className="dashboard-empty-column">No deals</p>}
      </section>)}
    </div>
  </section>;
}

function localDate(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}
