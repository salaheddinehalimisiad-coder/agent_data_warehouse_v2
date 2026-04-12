import httpx

API_KEY = 'c75d3a5ca2f8484987786adc6c4f6345.NUcrpbIx5ofK8Ww7'
headers = {'Authorization': f'Bearer {API_KEY}', 'Content-Type': 'application/json'}

for model in ['glm-4.5-air', 'glm-4.5', 'glm-5-turbo', 'glm-5']:
    data = {'model': model, 'messages': [{'role': 'user', 'content': 'say ok'}], 'max_tokens': 5}
    try:
        r = httpx.post('https://open.bigmodel.cn/api/paas/v4/chat/completions',
                       headers=headers, json=data, timeout=20)
        resp = r.json()
        if r.status_code == 200:
            content = resp.get('choices', [{}])[0].get('message', {}).get('content', '')
            print(f'SUCCESS {model}: {content}')
        else:
            print(f'FAIL {model}: {resp.get("error", {}).get("message", "")}')
    except Exception as e:
        print(f'{model}: ERROR - {e}')
