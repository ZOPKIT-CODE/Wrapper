/**
 * Circuit Breaker
 *
 * Prevents cascading failures when external services (Stripe, Kinde, Brevo,
 * Amazon MQ) are down. After {@link failureThreshold} consecutive failures the
 * breaker opens and immediately rejects calls for {@link resetTimeoutMs},
 * then allows a single probe (half-open). A successful probe closes the breaker.
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private readonly name: string,
    private readonly failureThreshold: number = 5,
    private readonly resetTimeoutMs: number = 30000,
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.resetTimeoutMs) {
        this.state = 'half-open';
      } else {
        throw new Error(`Circuit breaker '${this.name}' is OPEN — service unavailable`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= this.failureThreshold) {
      this.state = 'open';
      console.warn(`⚡ Circuit breaker '${this.name}' OPENED after ${this.failures} failures`);
    }
  }

  getState(): { name: string; state: string; failures: number } {
    return { name: this.name, state: this.state, failures: this.failures };
  }
}
