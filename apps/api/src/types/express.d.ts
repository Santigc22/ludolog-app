declare global {
  namespace Express {
    interface Request {
      requestId: string;
      auth?: {
        sessionId: string;
        userId: string;
        email: string;
        username: string;
        displayName: string | null;
        visibility: "PRIVATE" | "PUBLIC";
        csrfTokenHash: string;
      };
    }
  }
}

export {};
