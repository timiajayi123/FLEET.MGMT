import { Injectable } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 12;

@Injectable()
export class AiRateLimitService {
  private readonly requests = new Map<string, number[]>();

  check(userId: string) {
    const now = Date.now();
    const recent = (this.requests.get(userId) ?? []).filter((timestamp) => timestamp > now - WINDOW_MS);
    if (recent.length >= MAX_REQUESTS_PER_WINDOW) throw new ThrottlerException('Too many assistant requests. Please wait a minute and try again.');
    recent.push(now);
    this.requests.set(userId, recent);
  }
}
