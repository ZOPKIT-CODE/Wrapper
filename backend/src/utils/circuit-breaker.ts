export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerOptions {
  name: string;
  failureThreshold?: number;
  resetTimeoutMs?: number;
  halfOpenMaxCalls?: number;
}

export class CircuitBreakerOpenError extends Error {
  constructor(name: string) {
    super(`Circuit breaker '${name}' is OPEN — service unavailable`);
    this.name = 'CircuitBreakerOpenError';
  }
}

export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private halfOpenCalls = 0;
  private state: CircuitState = 'closed';

  private readonly name: string;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly halfOpenMaxCalls: number;

  constructor(options: CircuitBreakerOptions) {
    this.name = options.name;
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 30_000;
    this.halfOpenMaxCalls = options.halfOpenMaxCalls ?? 1;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.resetTimeoutMs) {
        this.state = 'half-open';
        this.halfOpenCalls = 0;
      } else {
        throw new CircuitBreakerOpenError(this.name);
      }
    }

    if (this.state === 'half-open' && this.halfOpenCalls >= this.halfOpenMaxCalls) {
      throw new CircuitBreakerOpenError(this.name);
    }

    if (this.state === 'half-open') {
      this.halfOpenCalls++;
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
    this.halfOpenCalls = 0;
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

  getState(): { name: string; state: CircuitState; failures: number } {
    return { name: this.name, state: this.state, failures: this.failures };
  }
}

// Singleton breakers for external services.
export const kindeCircuitBreaker = new CircuitBreaker({
  name: 'kinde',
  failureThreshold: 5,
  resetTimeoutMs: 60_000,
  halfOpenMaxCalls: 1,
});

export const emailCircuitBreaker = new CircuitBreaker({
  name: 'email',
  failureThreshold: 3,
  resetTimeoutMs: 30_000,
  halfOpenMaxCalls: 1,
});

export const stripeCircuitBreaker = new CircuitBreaker({
  name: 'stripe',
  failureThreshold: 5,
  resetTimeoutMs: 60_000,
  halfOpenMaxCalls: 1,
});
