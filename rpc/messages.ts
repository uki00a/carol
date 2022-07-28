export interface CookiePayload {
  cookie: boolean;
  args: unknown[];
  worldId: string;
}

export interface CookieResponse {
  cookieResponse: boolean;
  worldId: string;
  r: unknown;
}

export interface Payload {
  id: number;
  from: string[];
  to: string[];
  message: {
    p: string;
    m: string;
  };
  e?: string;
  r?: unknown;
}

export interface Response {
  rid: number;
  from: string[];
  to: string[];
  e?: string;
  r?: unknown;
}

export type Any =
  | CookiePayload
  | CookieResponse
  | Payload
  | Response;
