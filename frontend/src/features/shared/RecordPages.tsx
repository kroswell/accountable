import { FormEvent, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity, Contact, Deal, getContacts, getDeals, getOrganizations, getRecord, Organization,
  saveRecord, deleteRecord, createActivity, updateActivity, deleteActivity, TimelineItem, Stage, ContactStatus,
} from "../../api/client";
import { formatDate, currency, STAGES } from "./format";

type Kind = "organizations" | "contacts" | "deals";
type RecordRow = Organization | Contact | Deal;
const config: Record<Kind, { title: string; singular: string; sortFields: [string, string][] }> = {
  organizations: { title: "Organizations", singular: "Organization", sortFields: [["name", "Name"], ["industry", "Industry"], ["created_at", "Added"]] },
  contacts: { title: "Contacts", singular: "Contact", sortFields: [["name", "Name"], ["status", "Status"], ["email", "Email"]] },
  deals: { title: "Deals", singular: "Deal", sortFields: [["name", "Name"], ["stage", "Stage"], ["value_usd", "Value"], ["expected_close_date", "Close date"]] },
};
const empty = (value: string | null | undefined) => value ?? "";

function useRecords(kind: Kind, query: string, filter: string, sort: string, direction: string) {
  const search = new URLSearchParams({ q: query, sort, direction });
  if (kind === "contacts") search.set("status", filter);
  if (kind === "deals") search.set("stage", filter);
  const params = `?${search}`;
  return useQuery<RecordRow[]>({
    queryKey: [kind, query, filter, sort, direction],
    queryFn: async () => {
      if (kind === "organizations") return getOrganizations(params);
      if (kind === "contacts") return getContacts(params);
      return getDeals(params);
    },
  });
}

export function RecordListPage({ kind }: { kind: Kind }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState(config[kind].sortFields[0][0]);
  const [direction, setDirection] = useState("asc");
  const [editing, setEditing] = useState<RecordRow | null | undefined>(undefined);
  const rows = useRecords(kind, query, filter, sort, direction);
  const title = config[kind];
  return <section className="page">
    <div className="title-row"><div><p className="eyebrow">YOUR BUSINESS</p><h1>{title.title}</h1><p className="muted">Search, sort and manage your {title.title.toLowerCase()}.</p></div>
      <button className="primary-button" onClick={() => setEditing(null)}>+ Add {title.singular.toLowerCase()}</button></div>
    <div className="toolbar">
      <label className="search-field"><span className="sr-only">Search {title.title.toLowerCase()}</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${title.title.toLowerCase()}…`} /></label>
      {kind !== "organizations" && <label className="filter-field"><span>Filter</span><select value={filter} onChange={(event) => setFilter(event.target.value)}>
        <option value="all">All {kind === "contacts" ? "statuses" : "stages"}</option>
        {(kind === "contacts" ? ["Lead", "Qualified", "Customer"] : STAGES).map((value) => <option key={value}>{value}</option>)}
      </select></label>}
      <span className="result-count">{rows.data?.length ?? 0} records</span>
    </div>
    {rows.isError ? <ErrorPanel error={rows.error} /> : <div className="table-wrap"><table><thead><tr>
      {title.sortFields.map(([key, label]) => <th key={key}><button className="sort-button" onClick={() => { setSort(key); setDirection(sort === key && direction === "asc" ? "desc" : "asc"); }}>{label}{sort === key ? direction === "asc" ? " ↑" : " ↓" : ""}</button></th>)}
      <th>Details</th><th><span className="sr-only">Actions</span></th>
    </tr></thead><tbody>
      {(rows.data ?? []).map((row) => <RecordTableRow key={row.id} kind={kind} row={row} onEdit={() => setEditing(row)} />)}
      {!rows.isLoading && rows.data?.length === 0 && <tr><td className="empty-cell" colSpan={title.sortFields.length + 2}>No records found. Add one to get started.</td></tr>}
      {rows.isLoading && <tr><td className="empty-cell" colSpan={title.sortFields.length + 2}>Loading records…</td></tr>}
    </tbody></table></div>}
    {editing !== undefined && <RecordForm kind={kind} initial={editing} onClose={() => setEditing(undefined)} />}
  </section>;
}

function RecordTableRow({ kind, row, onEdit }: { kind: Kind; row: RecordRow; onEdit: () => void }) {
  const client = useQueryClient();
  const remove = useMutation({ mutationFn: () => deleteRecord(kind, row.id), onSuccess: () => client.invalidateQueries() });
  const navigate = useNavigate();
  const organization = row as Organization;
  const contact = row as Contact;
  const deal = row as Deal;
  const fields: Record<Kind, React.ReactNode[]> = {
    organizations: [organization.name, organization.industry || "—"],
    contacts: [contact.name, <span className={`badge status-${contact.status?.toLowerCase()}`}>{contact.status}</span>, contact.email || "—"],
    deals: [deal.name, <span className={`badge stage-${deal.stage?.toLowerCase()}`}>{deal.stage}</span>, currency(deal.value_usd), <span className={deal.late ? "late" : ""}>{formatDate(deal.expected_close_date)}{deal.late ? " · Late" : ""}</span>],
  };
  const details = kind === "organizations" ? `${organization.contact_count} contacts · ${organization.deal_count} deals` : kind === "contacts" ? contact.organization_name || "No organization" : deal.organization_name;
  const columns = kind === "organizations" ? fields.organizations : kind === "contacts" ? fields.contacts : fields.deals;
  return <tr>
    {columns.map((field, index) => <td key={index}>{field}</td>)}
    <td>{details}</td>
    <td className="row-actions"><button className="text-button" onClick={() => navigate(`/${kind}/${row.id}`)}>Open</button><button className="text-button" onClick={onEdit}>Edit</button><button className="text-button danger-text" onClick={() => {
      const impact = kind === "organizations" ? "Linked contacts and deals must be removed or reassigned first." : kind === "deals" ? "Linked activities will also be deleted." : "Deals and activities will remain, with contact links cleared.";
      if (window.confirm(`Delete ${row.name}? ${impact}`)) remove.mutate();
    }}>Delete</button></td>
    {remove.isError && <td className="error-text">{(remove.error as Error).message}</td>}
  </tr>;
}

function RecordForm({ kind, initial, initialStage, onClose }: { kind: Kind; initial: RecordRow | null; initialStage?: Stage; onClose: () => void }) {
  const queryClient = useQueryClient();
  const organizations = useQuery({ queryKey: ["organizations"], queryFn: () => getOrganizations() });
  const contacts = useQuery({ queryKey: ["contacts"], queryFn: () => getContacts() });
  const [values, setValues] = useState<Record<string, string>>(() => ({
    name: empty(initial?.name),
    website: empty((initial as Organization | null)?.website),
    industry: empty((initial as Organization | null)?.industry),
    notes: empty((initial as Organization | null)?.notes),
    email: empty((initial as Contact | null)?.email),
    phone: empty((initial as Contact | null)?.phone),
    job_title: empty((initial as Contact | null)?.job_title),
    organization_id: empty((initial as Contact | Deal | null)?.organization_id),
    status: (initial as Contact | null)?.status ?? "Lead",
    stage: (initial as Deal | null)?.stage ?? initialStage ?? "New",
    main_contact_id: empty((initial as Deal | null)?.main_contact_id),
    value_usd: String((initial as Deal | null)?.value_usd ?? ""),
    probability: (initial as Deal | null)?.probability_source === "manual" ? String((initial as Deal).probability) : "",
    expected_close_date: empty((initial as Deal | null)?.expected_close_date),
    actual_close_date: empty((initial as Deal | null)?.actual_close_date),
  }));
  const save = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = { ...values };
      if (kind === "organizations") Object.assign(payload, { website: values.website || null, industry: values.industry || null, notes: values.notes || null });
      if (kind === "contacts") Object.assign(payload, { email: values.email || null, phone: values.phone || null, job_title: values.job_title || null, organization_id: values.organization_id || null, status: values.status as ContactStatus });
      if (kind === "deals") Object.assign(payload, {
        organization_id: values.organization_id, main_contact_id: values.main_contact_id || null, stage: values.stage as Stage,
        value_usd: Number(values.value_usd), probability: values.probability ? Number(values.probability) : null,
        expected_close_date: values.expected_close_date || null, actual_close_date: values.actual_close_date || null,
      });
      return saveRecord(kind, payload, initial?.id);
    },
    onSuccess: () => { queryClient.invalidateQueries(); onClose(); },
  });
  const set = (key: string) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setValues((current) => ({ ...current, [key]: event.target.value }));
  const field = (key: string, label: string, type = "text", required = false) => <label className="form-field" key={key}>{label}<input type={type} required={required} value={values[key]} onChange={set(key)} /></label>;
  const select = (key: string, label: string, options: (string | [string, string])[], required = false) => <label className="form-field" key={key}>{label}<select required={required} value={values[key]} onChange={set(key)}>{!required && <option value="">None</option>}{options.map((option) => { const [value, text] = typeof option === "string" ? [option, option] : option; return <option value={value} key={value}>{text}</option>; })}</select></label>;
  const submit = (event: FormEvent) => { event.preventDefault(); save.mutate(); };
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <form className="record-modal" role="dialog" aria-modal="true" aria-labelledby="form-title" onSubmit={submit}>
      <div className="modal-head"><h2 id="form-title">{initial ? "Edit" : "Add"} {config[kind].singular.toLowerCase()}</h2><button type="button" className="close-button" aria-label="Close" onClick={onClose}>×</button></div>
      <div className="form-grid">{field("name", "Name", "text", true)}
        {kind === "organizations" && <>{field("website", "Website", "url")}{field("industry", "Industry")}</>}
        {kind === "contacts" && <>{field("email", "Email", "email")}{field("phone", "Phone", "tel")}{field("job_title", "Job title")}{select("organization_id", "Organization", (organizations.data ?? []).map((item) => [item.id, item.name] as [string, string]))}{select("status", "Status", ["Lead", "Qualified", "Customer"], true)}</>}
        {kind === "deals" && <>{select("organization_id", "Organization", (organizations.data ?? []).map((item) => [item.id, item.name] as [string, string]), true)}{select("main_contact_id", "Main contact", (contacts.data ?? []).filter((item) => !values.organization_id || item.organization_id === values.organization_id).map((item) => [item.id, item.name] as [string, string]))}{select("stage", "Stage", [...STAGES], true)}{field("value_usd", "Value (USD)", "number", true)}{field("probability", "Probability (%)", "number")}{field("expected_close_date", "Expected close", "date")}{field("actual_close_date", "Actual close", "date")}</>}
        {kind === "organizations" && <label className="form-field full-field">Notes<textarea rows={3} value={values.notes} onChange={set("notes")} /></label>}
      </div>
      {save.isError && <p className="error-text">{(save.error as Error).message}</p>}
      <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</button></div>
    </form>
  </div>;
}

type DetailData = Organization & Contact & Deal & { contacts?: Contact[]; deals?: Deal[]; timeline?: TimelineItem[] };
export function RecordDetailPage({ kind }: { kind: Kind }) {
  const { id = "" } = useParams();
  const [editing, setEditing] = useState(false);
  const record = useQuery({ queryKey: [kind, id], queryFn: () => getRecord<DetailData>(kind, id), enabled: !!id });
  const item = record.data;
  const links = useMemo(() => item ? [
    ...(item.contacts ?? []).map((contact) => ({ label: contact.name, to: `/contacts/${contact.id}` })),
    ...(item.deals ?? []).map((deal) => ({ label: deal.name, to: `/deals/${deal.id}` })),
  ] : [], [item]);
  if (record.isLoading) return <main className="page"><p>Loading record…</p></main>;
  if (record.isError || !item) return <main className="page"><ErrorPanel error={record.error ?? new Error("Record not found")} /><Link to={`/${kind}`}>Back to {config[kind].title}</Link></main>;
  const contact = item as Contact & { deals?: Deal[]; timeline?: TimelineItem[] };
  const deal = item as Deal & { timeline?: TimelineItem[] };
  return <main className="page">
    <p className="eyebrow"><Link to={`/${kind}`}>{config[kind].title}</Link> / RECORD</p>
    <div className="title-row detail-title"><div><h1>{item.name}</h1><p className="muted">{kind === "organizations" ? (item as Organization).industry || "Organization" : kind === "contacts" ? `${contact.job_title || "Contact"} · ${contact.organization_name || "No organization"}` : `${deal.organization_name} · ${deal.stage}`}</p></div><button className="secondary-button" onClick={() => setEditing(true)}>Edit</button></div>
    {kind === "organizations" && <section className="detail-grid">
      <article className="panel"><h2>Organization details</h2><p>{(item as Organization).website || "No website"}</p><p className="muted">{(item as Organization).notes || "No notes yet."}</p></article>
      <article className="panel"><h2>Contacts</h2>{(item as DetailData).contacts?.map((row) => <Link className="linked-row" to={`/contacts/${row.id}`} key={row.id}>{row.name}<span>{row.status}</span></Link>)}</article>
      <article className="panel"><h2>Deals</h2>{(item as DetailData).deals?.map((row) => <Link className="linked-row" to={`/deals/${row.id}`} key={row.id}>{row.name}<span>{currency(row.value_usd)}</span></Link>)}</article>
    </section>}
    {kind === "contacts" && <section className="detail-grid">
      <article className="panel"><h2>Contact details</h2><p>{contact.email || "No email"}<br />{contact.phone || "No phone"}</p><p>Status: <span className="badge">{contact.status}</span></p>{contact.organization_id && <Link to={`/organizations/${contact.organization_id}`}>View organization</Link>}</article>
      <article className="panel"><h2>Deals</h2>{contact.deals?.map((row) => <Link className="linked-row" to={`/deals/${row.id}`} key={row.id}>{row.name}<span>{row.stage}</span></Link>)}</article>
    </section>}
    {kind === "deals" && <section className="detail-grid">
      <article className="panel"><h2>Deal details</h2><p>Value <strong>{currency(deal.value_usd)}</strong></p><p>Probability <strong>{deal.probability}%</strong></p><p>Expected close <strong>{formatDate(deal.expected_close_date)}</strong></p>{deal.main_contact_id && <Link to={`/contacts/${deal.main_contact_id}`}>{deal.main_contact_name}</Link>}</article>
      <article className="panel"><h2>Organization</h2><Link to={`/organizations/${deal.organization_id}`}>{deal.organization_name}</Link></article>
    </section>}
    {kind !== "organizations" && <section className="timeline-layout"><ActivityForm contactId={kind === "contacts" ? id : undefined} dealId={kind === "deals" ? id : undefined} />
      <article className="panel"><h2>Timeline</h2><Timeline items={item.timeline ?? []} /></article></section>}
    {editing && <RecordForm kind={kind} initial={item} onClose={() => setEditing(false)} />}
  </main>;
}

export function ActivityForm({ contactId, dealId, initial, onDone }: { contactId?: string; dealId?: string; initial?: Activity; onDone?: () => void }) {
  const client = useQueryClient();
  const [type, setType] = useState(initial?.type ?? "Note");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [happenedAt, setHappenedAt] = useState(() => initial ? new Date(initial.happened_at).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16));
  const [followUpDate, setFollowUpDate] = useState(initial?.follow_up_date ?? "");
  const [done, setDone] = useState(initial?.done ?? false);
  const save = useMutation({
    mutationFn: () => {
      const payload = {
        type, description, happened_at: new Date(happenedAt).toISOString(),
        follow_up_date: followUpDate || null, done,
        contact_id: contactId ?? initial?.contact_ids[0] ?? null,
        deal_id: dealId ?? initial?.deal_ids[0] ?? null,
      };
      return initial ? updateActivity(initial.id, payload) : createActivity(payload);
    },
    onSuccess: () => { setDescription(""); setFollowUpDate(""); client.invalidateQueries(); onDone?.(); },
  });
  return <form className="panel activity-form" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
    <h2>{initial ? "Edit activity" : "Log an activity"}</h2>
    <label className="form-field">Type<select value={type} onChange={(event) => setType(event.target.value as "Note" | "Call" | "Email")}>{["Note", "Call", "Email"].map((item) => <option key={item}>{item}</option>)}</select></label>
    <label className="form-field">Description<textarea required rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
    <label className="form-field">When<input required type="datetime-local" value={happenedAt} onChange={(event) => setHappenedAt(event.target.value)} /></label>
    <label className="form-field">Follow-up date<input type="date" value={followUpDate} onChange={(event) => setFollowUpDate(event.target.value)} /></label>
    {initial && <label className="form-field"><span>Completed<input type="checkbox" checked={done} onChange={(event) => setDone(event.target.checked)} /></span></label>}
    {save.isError && <p className="error-text">{(save.error as Error).message}</p>}
    <button className="primary-button" disabled={save.isPending}>{save.isPending ? "Saving…" : initial ? "Save changes" : "Save activity"}</button>
  </form>;
}

export function Timeline({ items }: { items: TimelineItem[] }) {
  const client = useQueryClient();
  const [editing, setEditing] = useState<Activity | null>(null);
  const remove = useMutation({
    mutationFn: (id: string) => deleteActivity(id),
    onSuccess: () => client.invalidateQueries(),
  });
  if (!items.length) return <p className="muted">No activity yet. Log a note, call or email to start the timeline.</p>;
  return <>
  {editing && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(null); }}>
    <div className="record-modal" role="dialog" aria-modal="true" aria-labelledby="edit-activity-title">
      <ActivityForm initial={editing} onDone={() => setEditing(null)} />
    </div>
  </div>}
  <ol className="timeline">{items.map((item) => {
    const stageChange = "kind" in item && item.kind === "stage_change";
    const title = stageChange
      ? `Moved from ${item.from_stage} to ${item.to_stage}`
      : `${(item as Activity).type}: ${(item as Activity).description}`;
    return <li key={item.id}>
    <span className={`timeline-dot ${"kind" in item && item.kind === "stage_change" ? "dot-stage" : ""}`} />
    <div><p className="timeline-title">{title}</p>
      <p className="muted">{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.happened_at))}{!("kind" in item) && item.follow_up_date ? ` · Follow-up ${formatDate(item.follow_up_date)}` : ""}</p>
      {!stageChange && <div className="timeline-actions">
        <button className="text-button" type="button" onClick={() => setEditing(item as Activity)}>Edit</button>
        <button className="text-button danger-text" type="button" onClick={() => { if (window.confirm("Delete this activity?")) remove.mutate(item.id); }}>Delete</button>
      </div>}
    </div>
  </li>;
  })}</ol>;
  </>;
}

export function ErrorPanel({ error }: { error: unknown }) {
  return <div className="error-panel"><strong>Could not load this view.</strong><p>{error instanceof Error ? error.message : "The API request failed."}</p><p className="muted">Check that the Accountable API is running, then try again.</p></div>;
}

export function DealCreateDialog({ stage, onClose }: { stage?: Stage; onClose: () => void }) {
  return <RecordForm kind="deals" initial={null} initialStage={stage} onClose={onClose} />;
}
