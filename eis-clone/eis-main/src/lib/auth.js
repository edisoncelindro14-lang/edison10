const STORAGE_KEY = "mlm_member_id";

export function saveMemberSession(id) {
  localStorage.setItem(STORAGE_KEY, id);
}

export function clearMemberSession() {
  localStorage.removeItem(STORAGE_KEY);
}

export function getSessionMemberId() {
  return localStorage.getItem(STORAGE_KEY);
}
