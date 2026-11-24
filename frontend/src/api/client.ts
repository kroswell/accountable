export type Stage = "New" | "Qualified" | "Proposal" | "Negotiation" | "Won" | "Lost";
export type ContactStatus = "Lead" | "Qualified" | "Customer";
export type ActivityType = "Note" | "Call" | "Email";

export interface Organization {
  id: string; name: string; website: string | null; industry: string | null; notes: string | null;
  contact_count: number; deal_count: number; created_at?: string; updated_at?: string;
}
export interface Contact {
  id: string; name: string; email: string | null; phone: string | null; job_title: string | null;
  organization_id: string | null; organization_name: string | null; status: ContactStatus;
}
export interface Deal {
  id: string; name: string; organization_id: string; organization_name: string; main_contact_id: string | null;
  main_contact_name: string | null; stage: Stage; value_usd: number; probability: number;
  probability_source: "derived" | "manual"; expected_close_date: string | null; actual_close_date: string | null; late: boolean;
}
export interface Activity {
  id: string; type: ActivityType; description: string; happened_at: string; follow_up_date: string | null;
  done: boolean; contact_ids: string[]; deal_ids: string[];
}
export type TimelineItem = Activity | { id: string; kind: "stage_change"; from_stage: Stage; to_stage: Stage; happened_at: string; deal_id: string };
export interface PipelineColumn { stage: Stage; cards: Deal[]; count: number; value_usd: number; expected_revenue: number }
export interface Pipeline { columns: PipelineColumn[]; open_value_usd: number; open_expected_revenue: number }
export interface Dashboard {
  open_pipeline: number; open_expected_revenue: number; won_this_month: number; deals_won: number; late_deals: number;
  pending_follow_ups: Activity[]; recent_activity: Activity[];
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
  });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      const detail = body.detail;
      message = typeof detail === "string" ? detail : detail?.linked
        ? "This organization still has linked contacts or deals. Remove or reassign them first."
        : message;
    } catch { /* The response may have no JSON body. */ }
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const getDashboard = () => request<Dashboard>("/dashboard");
export const getPipeline = () => request<Pipeline>("/pipeline");
export const getOrganizations = (params = "") => request<Organization[]>(`/organizations${params}`);
export const getContacts = (params = "") => request<Contact[]>(`/contacts${params}`);
export const getDeals = (params = "") => request<Deal[]>(`/deals${params}`);
export const getRecord = <T,>(kind: string, id: string) => request<T>(`/${kind}/${id}`);
export const saveRecord = <T,>(kind: string, payload: unknown, id?: string) =>
  request<T>(`/${kind}${id ? `/${id}` : ""}`, { method: id ? "PUT" : "POST", body: JSON.stringify(payload) });
export const deleteRecord = (kind: string, id: string) => request<void>(`/${kind}/${id}`, { method: "DELETE" });
export const moveDeal = (id: string, stage: Stage, position: number) =>
  request<Deal>(`/deals/${id}/move`, { method: "POST", body: JSON.stringify({ stage, position }) });
export const createActivity = (payload: unknown) =>
  request<Activity>("/activities", { method: "POST", body: JSON.stringify(payload) });
export const updateActivity = (id: string, payload: unknown) =>
  request<Activity>(`/activities/${id}`, { method: "PUT", body: JSON.stringify(payload) });
export const deleteActivity = (id: string) =>
  request<void>(`/activities/${id}`, { method: "DELETE" });
