// This code only unlocks local connection setup. API permissions still require an account.
export function isConnectionSetupCode(value?: string): boolean {
  return value?.trim() === '180504';
}
