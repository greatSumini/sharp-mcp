import { nanoid } from "nanoid";

export interface SessionData {
  image_payload: string;
  description?: string;
}

export interface SessionEntry extends SessionData {
  sessionId: string;
}

class SessionStore {
  private sessions: Map<string, SessionData> = new Map();

  create(data: SessionData): string {
    const sessionId = `img_${nanoid()}`;
    this.sessions.set(sessionId, data);
    return sessionId;
  }

  get(sessionId: string): SessionData | undefined {
    return this.sessions.get(sessionId);
  }

  has(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  getAll(): SessionEntry[] {
    const entries: SessionEntry[] = [];
    for (const [sessionId, data] of this.sessions) {
      entries.push({ sessionId, ...data });
    }
    return entries;
  }

  delete(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  clear(): void {
    this.sessions.clear();
  }
}

export const sessionStore = new SessionStore();
