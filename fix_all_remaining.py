"""Fix all remaining HITL bugs in etl_service.py and pipelineStore.js"""

# ============================================================
# FIX 1: etl_service.py - _stream_continue human_review block
# ============================================================
with open('api/services/etl_service.py', 'r', encoding='utf-8') as f:
    content = f.read()

lines = content.split('\n')

# Find both occurrences of "if node == \"human_review\":"
hr_occurrences = []
for i, line in enumerate(lines):
    if 'if node == "human_review":' in line:
        hr_occurrences.append(i)

print(f"Found human_review blocks at lines: {hr_occurrences}")

if len(hr_occurrences) >= 2:
    start_idx = hr_occurrences[1]
    # Find the "return" after this block
    end_idx = None
    for i in range(start_idx + 1, min(start_idx + 25, len(lines))):
        if lines[i].strip() == 'return':
            end_idx = i
            break
    
    if end_idx:
        old_block = lines[start_idx:end_idx + 1]
        print(f"Old block (lines {start_idx}-{end_idx}):")
        for l in old_block:
            print(f"  {l}")
        
        base_indent = len(lines[start_idx]) - len(lines[start_idx].lstrip())
        indent = ' ' * base_indent
        
        # Build new block with is_validated check and else wrapper
        new_block = [
            f'{indent}if node == "human_review":',
            f'{indent}    current = _pipeline_states.get(session_id, {{}})',
            f'{indent}    # FIX v3.2 - Skip pause if already validated',
            f'{indent}    if current.get("is_validated") is True:',
            f'{indent}        sse.log_event(session_id, "Human Review auto-approved - continuing pipeline")',
            f'{indent}    else:',
        ]
        
        # Add existing lines with extra indent (skip first 2 lines: if and current)
        for line in old_block[2:]:
            stripped = line.lstrip()
            if stripped:
                new_block.append(f'{indent}        {stripped}')
            else:
                new_block.append('')
        
        # Insert pipeline_status broadcast after set_stage
        final_block = []
        for line in new_block:
            final_block.append(line)
            if 'sse.set_stage(session_id, "awaiting_human_review")' in line:
                final_block.append(f'{indent}        sse.broadcast(session_id, "pipeline_status", {{"status": "awaiting_review"}})')
        
        print(f"\nNew block:")
        for l in final_block:
            print(f"  {l}")
        
        # Replace
        lines[start_idx:end_idx + 1] = final_block
        
        with open('api/services/etl_service.py', 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))
        print("\nSUCCESS: Fixed _stream_continue human_review block")
    else:
        print("Could not find end of human_review block")
else:
    print(f"Expected 2 human_review blocks, found {len(hr_occurrences)}")

# ============================================================
# FIX 2: pipelineStore.js - Handle pipeline_status event
# ============================================================
with open('src/store/pipelineStore.js', 'r', encoding='utf-8') as f:
    store_content = f.read()

if 'pipeline_status' not in store_content:
    # Find where human_review_required is handled
    if 'human_review_required' in store_content:
        idx = store_content.index('human_review_required')
        # Find the line start
        line_start = store_content.rfind('\n', 0, idx) + 1
        line_end = store_content.index('\n', idx)
        full_line = store_content[line_start:line_end]
        indent_match = ''
        for ch in full_line:
            if ch in (' ', '\t'):
                indent_match += ch
            else:
                break
        
        # Get the indentation of the human_review_required line
        new_handler = f"""{indent_match}case 'pipeline_status':
{indent_match}  if (data?.status === 'awaiting_review') {{
{indent_match}    set({{ pipelineStatus: 'awaiting_review' }});
{indent_match}  }}
{indent_match}  break;
"""
        store_content = store_content[:line_start] + new_handler + store_content[line_start:]
        
        with open('src/store/pipelineStore.js', 'w', encoding='utf-8') as f:
            f.write(store_content)
        print("SUCCESS: Added pipeline_status handler to pipelineStore.js")
    else:
        print("human_review_required not found in pipelineStore.js - need manual fix")
else:
    print("pipeline_status handler already exists in pipelineStore.js")

# Also add logic: when chat_modifier finishes (state_update), set pipelineStatus to awaiting_review
# This ensures the UI shows the review panel after chat_modifier completes
if 'chat_modifier' in store_content:
    # Find the state_update handler and add chat_modifier logic
    # Look for where agent status updates happen
    if 'agent === "chat_modifier"' not in store_content:
        # Find where agent_status is handled and add chat_modifier → awaiting_review
        if 'agent_status' in store_content and 'status === "done"' in store_content:
            # Find the agent_status done handler
            idx = store_content.index('agent_status')
            # Find "done" after this
            done_idx = store_content.index('status === "done"', idx)
            # Find the end of this block (next break or case)
            # Insert chat_modifier check before the break
            break_idx = store_content.index('break', done_idx)
            # Find the line start of the break
            line_start = store_content.rfind('\n', 0, break_idx) + 1
            indent_match = ''
            for ch in store_content[line_start:]:
                if ch in (' ', '\t'):
                    indent_match += ch
                else:
                    break
            
            chat_modifier_check = f"""{indent_match}if (data?.agent === "chat_modifier") {{
{indent_match}  set({{ pipelineStatus: 'awaiting_review' }});
{indent_match}}}
"""
            store_content = store_content[:line_start] + chat_modifier_check + store_content[line_start:]
            
            with open('src/store/pipelineStore.js', 'w', encoding='utf-8') as f:
                f.write(store_content)
            print("SUCCESS: Added chat_modifier → awaiting_review logic in pipelineStore.js")
        else:
            print("Could not find agent_status done handler in pipelineStore.js")
    else:
        print("chat_modifier check already exists in pipelineStore.js")

print("\nDone with all fixes!")