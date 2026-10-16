export function deviceTokenFor(identity: string) {
  const key = `office_device:${identity.trim().toLowerCase()}`;
  let token = localStorage.getItem(key) || localStorage.getItem('device_token');
  if (!token || !/^[a-zA-Z0-9_-]{32,128}$/.test(token)) token = crypto.randomUUID();
  localStorage.setItem(key, token); return token;
}
export function saveLogin(data: { employee: { id: unknown }; profile: unknown }, deviceToken: string, identity: string) {
  localStorage.setItem(`office_device:${identity.toLowerCase()}`, deviceToken);
  localStorage.setItem(`office_device:employee_${data.employee.id}`, deviceToken);
  localStorage.setItem('device_token', deviceToken);
  localStorage.setItem('employee_data', JSON.stringify(data.employee));
  localStorage.setItem('line_profile', JSON.stringify(data.profile));
  localStorage.setItem('office_pin_identity', JSON.stringify({employeeId:String(data.employee.id),identity:identity.toLowerCase()}));
  sessionStorage.setItem('office_pin_unlocked','1');
}
export async function logout(destination = "/login") {
  const response = await fetch('/api/auth/logout', { method: 'POST' });
  if (!response.ok) throw new Error('ออกจากระบบไม่สำเร็จ');
  localStorage.removeItem('employee_data'); localStorage.removeItem('line_profile');
  sessionStorage.removeItem('office_pin_unlocked');
  window.location.replace(destination);
}
