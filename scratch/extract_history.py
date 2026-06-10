import json

log_path = r"C:\Users\ChiaYu\.gemini\antigravity\brain\bd249978-138c-4bbe-8e61-dede163d9834\.system_generated\logs\transcript.jsonl"

def extract_line_content(target_line_idx):
    with open(log_path, "r", encoding="utf-8") as f:
        for idx, line in enumerate(f):
            if idx == target_line_idx:
                try:
                    data = json.loads(line)
                    # Find tool calls
                    tool_calls = data.get("tool_calls", [])
                    for tc in tool_calls:
                        args = tc.get("args", {})
                        raw_code = args.get("CodeContent") or args.get("ReplacementContent")
                        if not raw_code:
                            continue
                        
                        if isinstance(raw_code, str):
                            raw_code = raw_code.strip()
                            # Strip leading quote if it exists
                            if raw_code.startswith('"'):
                                raw_code = raw_code[1:]
                            elif raw_code.startswith("'"):
                                raw_code = raw_code[1:]
                            # Strip trailing quote if it exists
                            if raw_code.endswith('"'):
                                raw_code = raw_code[:-1]
                            elif raw_code.endswith("'"):
                                raw_code = raw_code[:-1]
                                
                            raw_code = raw_code.strip()
                                
                        # Replace escaped sequences
                        raw_code = raw_code.replace('\\n', '\n')
                        raw_code = raw_code.replace('\\t', '\t')
                        raw_code = raw_code.replace('\\"', '"')
                        raw_code = raw_code.replace("\\'", "'")
                        raw_code = raw_code.replace('\\\\', '\\')
                        return raw_code
                except Exception as e:
                    print(f"Error at line {idx}: {e}")
                    return None
    return None

# Extract NewFlowSchemaSettingsCSS.ts from Line 937
css_code = extract_line_content(937)
if css_code:
    print("Line 937 NewFlowSchemaSettingsCSS.ts code content length:", len(css_code))
    with open("scratch/settings_css_v6.txt", "w", encoding="utf-8") as out:
        out.write(css_code)
else:
    print("Could not retrieve Line 937 content")

# Extract NewFlowSchemaSettingsJS.ts from Line 939
js_code = extract_line_content(939)
if js_code:
    print("Line 939 NewFlowSchemaSettingsJS.ts code content length:", len(js_code))
    with open("scratch/settings_js_v6.txt", "w", encoding="utf-8") as out:
        out.write(js_code)
else:
    print("Could not retrieve Line 939 content")
