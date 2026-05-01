// Helpers partages pour les tests E2E
export async function mockBackend(page) {
  // Intercepte tous les appels backend pour simuler un pipeline
  await page.route('**/api/**', async (route, request) => {
    const url = request.url();
    const method = request.method();

    if (url.includes('/health')) {
      return route.fulfill({ status: 200, json: { status: 'ok', version: '3.0.0' } });
    }
    if (url.includes('/api/auth/me')) {
      return route.fulfill({ status: 200, json: { id: 1, email: 'test@test.com', prefix: 'dw' } });
    }
    if (url.includes('/api/auth/login') && method === 'POST') {
      return route.fulfill({
        status: 200,
        json: { token: 'fake-jwt', user: { id: 1, email: 'test@test.com', prefix: 'dw' } },
      });
    }
    if (url.includes('/api/start') && method === 'POST') {
      return route.fulfill({ status: 200, json: { session_id: 'e2e-test-sess', status: 'started' } });
    }
    if (url.includes('/api/pipeline-status')) {
      return route.fulfill({ status: 200, json: { sql_ddl: '-- test ddl', etl_status: 'success' } });
    }
    if (url.includes('/api/chat') && method === 'POST') {
      return route.fulfill({
        status: 200,
        json: { reply: 'Reponse mockee de Atlas', intent: 'chat', sql_ddl: '', critic_review: '' },
      });
    }
    if (url.includes('/api/export-xlsx')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        body: Buffer.from('fake-xlsx-content'),
      });
    }
    // Default
    return route.fulfill({ status: 200, json: {} });
  });

  // Mock SSE endpoint (EventSource)
  await page.route('**/api/pipeline-stream**', async (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: 'data: {"type":"agent_status","data":{"agent":"explorer","status":"running"}}\n\n',
    });
  });
}

export async function gotoApp(page) {
  await page.goto('/');
  // Attendre que React monte (Atlas button apparait)
  await page.waitForLoadState('networkidle');
}
