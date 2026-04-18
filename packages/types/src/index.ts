export type Province = "NB" | "NS" | "PE" | "NL";

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  province: Province | null;
  url: string;
  source: string;
  postedAt?: string;
}

export interface ScraperEvent {
  type: "batch" | "done" | "error";
  source?: string;
  jobs?: Job[];
  message?: string;
}

export interface EmployerLoadEvent {
  type: "province" | "done";
  province?: Province;
  status?: "loading" | "done" | "error";
  count?: number;
  total?: number;
  message?: string;
}
