import re

with open('api/services/etl_service.py', 'r', encoding='utf-8') as f:
    content = f.read()

lines = content.split('\n')
fixed = False

for i, line in enumerate(lines):
    if '"is_validated": False,' in line and i > 430:
        lines[i] = line.replace('"is_validated": False,', '"is_validated": None,')
        # Find the sse.log_event line with "Demande" after this
        for j in range(i+1, min(i+10, len(lines))):
            if 'sse.log_event' in lines[j] and 'Demande' in lines[j]:
                indent = '    '
                lines.insert(j, f'{indent}_merge(session_id, {{"is_validated": None}})')
                lines.insert(j+1, f'{indent}sse.broadcast(session_id, "pipeline_status", {{"status": "awaiting_review"}})')
                fixed = True
                break
        break

with open('api/services/etl_service.py', 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))

if fixed:
    print("SUCCESS: Fixed send_chat_and_resume")
else:
    print("FAILED: Could not find pattern")

# Verify
with open('api/services/etl_service.py', 'r', encoding='utf-8') as f:
    lines2 = f.read().split('\n')
for i, line in enumerate(lines2):
    if 'is_validated' in line and i > 430:
        print(f"  Line {i}: {line.strip()}")
    if 'pipeline_status' in line and i > 430:
        print(f"  Line {i}: {line.strip()}")
    if '_merge' in line and i > 430:
        print(f"  Line {i}: {line.strip()}")