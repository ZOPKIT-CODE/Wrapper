-- Free plans should use 'monthly' billing cycle, not 'yearly'.
UPDATE subscriptions SET billing_cycle = 'monthly' WHERE plan = 'free' AND billing_cycle = 'yearly';
