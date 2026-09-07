import json
import re
import sys

# Ensure UTF-8 output on Windows
sys.stdout.reconfigure(encoding='utf-8')

with open(r'C:\Users\Software Engineer\.gemini\antigravity-ide\brain\b0e8df9d-0644-4e37-9bf6-a421fcb20905\.system_generated\logs\transcript_full.jsonl', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for line in reversed(lines):
    data = json.loads(line)
    if data.get('type') == 'USER_INPUT' and 'ECONNREFUSED' in data.get('content', ''):
        content = data['content']
        messages = re.findall(r'"message"\s*:\s*"(.*?)"', content)
        print(f"Found {len(messages)} messages")
        for i, m in enumerate(messages):
            if len(messages) - i <= 100:
                # Remove extra escaping
                m = m.encode('utf-8').decode('unicode_escape', 'ignore')
                print(m)
        break
