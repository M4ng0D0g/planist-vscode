import json

log_path = r"C:\Users\ChiaYu\.gemini\antigravity\brain\bd249978-138c-4bbe-8e61-dede163d9834\.system_generated\logs\transcript.jsonl"

with open(log_path, "r", encoding="utf-8") as f:
    for idx, line in enumerate(f):
        if idx == 941:
            try:
                # Use strict=False for the outer load
                data = json.loads(line, strict=False)
                tool_calls = data.get("tool_calls", [])
                for tc in tool_calls:
                    args = tc.get("args", {})
                    chunks = args.get("ReplacementChunks", [])
                    if isinstance(chunks, str):
                        # Use strict=False for the inner load
                        chunks = json.loads(chunks, strict=False)
                    
                    print(f"Found {len(chunks)} chunks in multi_replace_file_content at Line 941:")
                    for i, chunk in enumerate(chunks):
                        print(f"Chunk {i}:")
                        print(f"  TargetContent: {repr(chunk.get('TargetContent')[:150])}")
                        print(f"  ReplacementContent: {repr(chunk.get('ReplacementContent')[:150])}")
                        with open(f"scratch/renderer_chunk_{i}.txt", "w", encoding="utf-8") as out:
                            code = chunk.get('ReplacementContent', '')
                            # Strip wrapper quotes if it was double-encoded
                            if isinstance(code, str):
                                code = code.strip()
                                if code.startswith('"') and code.endswith('"'):
                                    code = code[1:-1]
                                elif code.startswith("'") and code.endswith("'"):
                                    code = code[1:-1]
                            code = code.replace('\\n', '\n').replace('\\t', '\t').replace('\\"', '"').replace("\\'", "'").replace('\\\\', '\\')
                            out.write(code)
            except Exception as e:
                print(f"Error: {e}")
