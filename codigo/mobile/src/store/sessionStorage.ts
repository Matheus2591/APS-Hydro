// O JSON de dados e a sessão protegida podem ser restaurados separadamente pelo Android.
// Só reunimos os dois quando a conta e o banco correspondem.
export function restoreStoredSession(raw: string, protectedSession: string | null) {
  const data = JSON.parse(raw),
    session = protectedSession ? JSON.parse(protectedSession) : null;
  if (data.state)
    data.state.sessionToken =
      session &&
      typeof session.token === 'string' &&
      session.userId === data.state.user?.id &&
      session.serverId === data.state.authServerId
        ? session.token
        : null;
  return JSON.stringify(data);
}
export function splitStoredSession(raw: string) {
  const data = JSON.parse(raw),
    token = data.state?.sessionToken;
  const session = token
    ? JSON.stringify({ token, userId: data.state.user?.id, serverId: data.state.authServerId })
    : null;
  if (data.state) delete data.state.sessionToken;
  return { state: JSON.stringify(data), session };
}
