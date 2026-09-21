export type Profile = {
  id: string;
  email: string | null;
  fullName: string | null;
  createdAt: string;
};

export type ProfileResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };
