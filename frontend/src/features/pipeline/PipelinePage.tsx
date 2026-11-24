import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getPipeline, moveDeal, Stage } from "../../api/client";
import { compactCurrency, currency, formatDate, STAGES } from "../shared/format";
import { DealCreateDialog, ErrorPanel } from "../shared/RecordPages";

const colors: Record<Stage, string> = { New: "#06D6A0", Qualified: "#FFC145", Proposal: "#F78C6B", Negotiation: "#118AB2", Won: "#06A77D", Lost: "#EF476F" };

export function PipelinePage() {
  const [adding, setAdding] = useState<Stage | null>(null);
  const [targets, setTargets] = useState<Record<string, Stage>>({});
  const [positions, setPositions] = useState<Record<string, number>>({});
  const [dragging, setDragging] = useState<string | null>(null);
  const client = useQueryClient();
  const board = useQuery({ queryKey: ["pipeline"], queryFn: getPipeline });
  const move = useMutation({ mutationFn: ({ id, stage, position }: { id: string; stage: Stage; position: number }) => {
    return moveDeal(id, stage, position);
  }, onSuccess: () => { setTargets({}); client.invalidateQueries(); } });
  const moveTo = (id: string, stage: Stage, position: number) => move.mutate({ id, stage, position });
  if (board.isError) return <main className="page"><ErrorPanel error={board.error} /></main>;
  return <main className="page">
    <div className="title-row"><div><p className="eyebrow">SALES PROCESS</p><h1>Pipeline</h1><p className="muted">Move a deal to update its stage and expected close probability.</p></div></div>
    <div className="pipeline-summary"><div><span>Open pipeline</span><strong>{board.data ? currency(board.data.open_value_usd) : "—"}</strong></div><div><span>Expected revenue</span><strong>{board.data ? currency(board.data.open_expected_revenue) : "—"}</strong></div><p>Weighted across New, Qualified, Proposal and Negotiation.</p></div>
    {board.isLoading ? <p className="muted">Loading pipeline…</p> : <div className="pipeline-board">{board.data?.columns.map((column) => <section className="pipeline-column" key={column.stage}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => { event.preventDefault(); const id = dragging || event.dataTransfer.getData("text/plain"); if (id) moveTo(id, column.stage, column.cards.length); setDragging(null); }}>
      <header className="column-head"><span className="stage-dot" style={{ backgroundColor: colors[column.stage] }} /><div className="column-label"><h2>{column.stage}</h2><p>{column.count} deals · {compactCurrency(column.value_usd)}</p></div><button className="add-column-button" aria-label={`Add deal to ${column.stage}`} onClick={() => setAdding(column.stage)}>+</button></header>
      <div className="column-subtotal">Expected <strong>{compactCurrency(column.expected_revenue)}</strong></div>
      <div className="deal-cards">{column.cards.map((deal, index) => <article className={`deal-card ${deal.late ? "deal-late" : ""}`} key={deal.id}
        draggable
        onDragStart={(event) => { setDragging(deal.id); event.dataTransfer.setData("text/plain", deal.id); }}
        onDragEnd={() => setDragging(null)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => { event.preventDefault(); event.stopPropagation(); const id = dragging || event.dataTransfer.getData("text/plain"); if (id) moveTo(id, column.stage, index); setDragging(null); }}>
        <div className="deal-card-top"><Link to={`/deals/${deal.id}`} className="deal-name">{deal.name}</Link>{deal.late && <span className="late-label">Late</span>}</div>
        <p className="deal-company">{deal.organization_name}</p><p className="deal-value">{currency(deal.value_usd)} <span>· {deal.probability}%</span></p>
        <p className="deal-close">Close {formatDate(deal.expected_close_date)}</p>
        <div className="move-controls"><label><span className="sr-only">Move {deal.name} to stage</span><select value={targets[deal.id] ?? deal.stage} onChange={(event) => setTargets((current) => ({ ...current, [deal.id]: event.target.value as Stage }))}>{STAGES.map((stage) => <option key={stage}>{stage}</option>)}</select></label>
          <button className="text-button" disabled={move.isPending} onClick={() => moveTo(deal.id, targets[deal.id] ?? deal.stage, positions[deal.id] ?? 0)}>Move</button></div>
        <label className="position-control"><span>Position</span><select aria-label={`Position for ${deal.name}`} value={positions[deal.id] ?? (targets[deal.id] && targets[deal.id] !== deal.stage ? 0 : index)} onChange={(event) => setPositions((current) => ({ ...current, [deal.id]: Number(event.target.value) }))}>
          {(board.data?.columns.find((target) => target.stage === (targets[deal.id] ?? deal.stage))?.cards ?? column.cards).map((_, position) => <option value={position} key={position}>{position === 0 ? "Start" : position === (board.data?.columns.find((target) => target.stage === (targets[deal.id] ?? deal.stage))?.cards.length ?? 1) - 1 ? "End" : `Position ${position + 1}`}</option>)}
        </select></label>
      </article>)}
      {!column.cards.length && <div className="column-empty">No deals in this stage.</div>}</div>
    </section>)}</div>}
    {move.isError && <p className="error-text">{(move.error as Error).message}</p>}
    {adding && <DealCreateDialog stage={adding} onClose={() => setAdding(null)} />}
  </main>;
}
