// Frontend example. Import into your front-end project and configure its API base URL.
export function createLogisticsApi(baseUrl = 'http://localhost:3000') {
  async function request(path, method = 'GET', body) {
    const response = await fetch(baseUrl.replace(/\/$/, '') + path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(Array.isArray(data.message) ? data.message.join('；') : data.message || `HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return data;
  }
  return {
    orders: () => request('/orders'),
    vehicles: () => request('/vehicles'),
    drivers: () => request('/drivers'),
    optimize: (input) => request('/vrp/optimize', 'POST', input),
    // Call only after the user selects a solution and binds distinct available drivers.
    confirm: (previewId, solutionId, assignments) => request('/vrp/confirm', 'POST', { previewId, solutionId, assignments }),
    task: (id) => request(`/dispatch-tasks/${id}`),
    setTaskStatus: (id, status) => request(`/dispatch-tasks/${id}`, 'PATCH', { status }),
  };
}

export function selectableSolutions(preview) {
  if (preview.status !== 'FOUND') return [];
  return preview.algorithm === 'NSGA-II'
    ? preview.solutions
    : [{ solutionId: preview.solutionId, routes: preview.routes }];
}
