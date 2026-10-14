export type ActionState = { ok?: boolean; error?: string; message?: string } | null;

export type Role = "admin" | "membro";

export type Member = {
  id: string;
  name: string;
  email: string | null;
  role: Role;
  avatarUrl?: string | null;
  jobTitle?: string | null;
};

export type CustomField = {
  id: string;
  entity: "entidade" | "oportunidade";
  key: string;
  label: string;
  type: "texto" | "numero" | "data" | "lista";
  options: string[];
  position: number;
};

export type Stage = {
  id: string;
  pipeline_id: string;
  name: string;
  position: number;
  probability: number;
};

export type Pipeline = {
  id: string;
  name: string;
  position: number;
  stages: Stage[];
};
