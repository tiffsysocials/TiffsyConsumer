/**
 * Auth event bus. Lets the API service notify UserContext (or anything else)
 * when the session is definitively invalid, without creating a circular import.
 */

type Listener = () => void;

const listeners = new Set<Listener>();

export const authEvents = {
  onAuthExpired(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  emitAuthExpired(): void {
    listeners.forEach((l) => {
      try {
        l();
      } catch (e) {
        console.error('[authEvents] listener threw:', e);
      }
    });
  },
};
