const STORAGE_KEY = "kabaro_member_id";

export function saveMemberSession(id, username) {
  localStorage.setItem(STORAGE_KEY, id);
  if (username) localStorage.setItem("kabaro_member_username", username);
}

export function clearMemberSession() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem("kabaro_member_username");
}

export function getSessionMemberId() {
  return localStorage.getItem(STORAGE_KEY);
}
