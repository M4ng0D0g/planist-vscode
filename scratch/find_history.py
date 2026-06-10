import json
import os

log_path = r"C:\Users\ChiaYu\.gemini\antigravity\brain\bd249978-138c-4bbe-8e61-dede163d9834\.system_generated\logs\transcript.jsonl"

target_files = [
    "NewFlowSchemaSettingsJS.ts",
    "NewFlowSchemaSettingsCSS.ts",
    "NewFlowSchemaRenderer.ts",
    "newFlowPreviewPanel.ts"
]

print("Scanning transcript.jsonl...")
with open(log_path, "r", encoding="utf-8") as f:
    for idx, line in enumerate(f):
        try:
            data = json.loads(line)
        except Exception:
            continue
        
        tool_calls = data.get("tool_calls", [])
        if not tool_calls:
            continue
            
        for tc in tool_calls:
            name = tc.get("name", "")
            args = tc.get("args", {})
            
            # Clean values if they are double-quoted strings
            def clean_str(val):
                if isinstance(val, str):
                    if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
                        return val[1:-1]
                return val
                
            target_file = clean_str(args.get("TargetFile", ""))
            if not target_file:
                continue
                
            matched = any(f_name in target_file for f_name in target_files)
            if matched:
                print(f"Step {idx}: {name} to {os.path.basename(target_file)}")
                code = clean_str(args.get("CodeContent")) or clean_str(args.get("ReplacementContent"))
                if code:
                    print(f"  Length: {len(code)} characters")
                    print(f"  Snippet: {repr(code[:150])}")
                    print("-" * 50)
