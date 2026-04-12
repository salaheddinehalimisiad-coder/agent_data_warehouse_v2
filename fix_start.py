path = r'c:\Users\salah\Desktop\agent_dw_v3_fixed\app_fixed\api\routes\pipeline.py'
with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

old = 'user: dict = Depends(get_current_user),'
new = 'user: dict = Depends(get_optional_user),'

count = c.count(old)
print(f'Found {count} occurrence(s) of get_current_user in start endpoint')
# Replace only the first occurrence (the /start endpoint)
c2 = c.replace(old, new, 1)

with open(path, 'w', encoding='utf-8') as f:
    f.write(c2)

print('Done. get_optional_user count:', c2.count('get_optional_user'))
