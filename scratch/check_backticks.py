with open("src/preview/ui/schemas/NewFlowSchemaSettingsJS.ts", "r", encoding="utf-8") as f:
    lines = f.readlines()

for idx, line in enumerate(lines):
    # Find all occurrences of ${
    import re
    matches = [m.start() for m in re.finditer(r"\$\{", line)]
    for pos in matches:
        # Check if preceded by a backslash
        is_escaped = pos > 0 and line[pos-1] == '\\'
        if not is_escaped:
            print(f"Unescaped ${{ at Line {idx+1}, Pos {pos+1}: {repr(line[max(0, pos-10):pos+15])}")
