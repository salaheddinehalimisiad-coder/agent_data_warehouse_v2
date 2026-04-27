import re

with open('api/services/etl_service.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix _stream_continue: add is_validated check and pipeline_status broadcast
# The _stream_continue human_review block currently doesn't check is_validated
# and doesn't broadcast pipeline_status

old_block = '''            if node == "human_review":
                current = _pipeline_states.get(session_id, {})
                sse.set_stage(session_id, "awaiting_human_review")
                sse.broadcast(session_id, "human_review_required", {'''

new_block = '''            if node == "human_review":
                current = _pipeline_states.get(session_id, {})
                # FIX v3.2 — Skip pause if already validated
                if current.get("is_validated") is True:
                    sse.log_event(session_id, "Human Review auto-approved - continuing pipeline")
                else:
                    sse.set_stage(session_id, "awaiting_human_review")
                    sse.broadcast(session_id, "pipeline_status", {"status": "awaiting_review"})
                    sse.broadcast(session_id, "human_review_required", {'''

# Count occurrences
count = content.count(old_block)
print(f"Found {count} occurrences of the human_review block")

if count >= 2:
    # Replace the second occurrence (in _stream_continue)
    first_idx = content.index(old_block)
    second_part = content[first_idx + len(old_block):]
    if old_block in second_part:
        second_part = second_part.replace(old_block, new_block, 1)
        content = content[:first_idx + len(old_block)] + second_part
        print("Replaced the second occurrence (in _stream_continue)")
elif count == 1:
    # Only one occurrence - replace it
    content = content.replace(old_block, new_block, 1)
    print("Replaced the only occurrence")
else:
    print("Pattern not found!")

# Also need to fix the indentation of the closing part
# The old code has the broadcast dict closing with }) and then return
# The new code wraps it in an else block, so we need to add proper else closing

# Find the pattern after our new block - the closing of human_review_required broadcast
# Old: ... "logical_model": current.get("logical_model", {}),
#            })
#            return
# New needs: ... "logical_model": current.get("logical_model", {}),
#            })
#                return

# Let's find and fix the return statement that follows
old_return = '''                })
                return

            if node == "human_review_dq":'''

# This needs to become properly indented inside the else block
new_return = '''                })
                    return

            if node == "human_review_dq":'''

# Actually, let me think about this more carefully.
# The structure should be:
# if node == "human_review":
#     current = ...
#     if current.get("is_validated") is True:
#         sse.log_event(...)
#     else:
#         sse.set_stage(...)
#         sse.broadcast(...)
#         sse.broadcast(... "human_review_required" ...)
#         return  <-- this return should be inside the else block
#
# So the return needs to be indented one more level inside the else

# Let me find the specific return after human_review_required in _stream_continue
# and add proper else indentation

with open('api/services/etl_service.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("File saved. Now checking...")

# Verify
with open('api/services/etl_service.py', 'r', encoding='utf-8') as f:
    lines = f.read().split('\n')

in_stream = False
for i, line in enumerate(lines):
    if '_stream_continue' in line and 'def' in line:
        in_stream = True
    if in_stream and 'human_review' in line and 'if node' in line:
        for j in range(i, min(len(lines), i+20)):
            print(f"  {j}: {lines[j]}")
        break