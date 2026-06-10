with open("scratch/settings_js_v6.txt", "r", encoding="utf-8") as f:
    content = f.read()

keywords = ["post", "Message", "dispatch", "Event", "apply", "save", "update"]
for kw in keywords:
    import re
    matches = [m.start() for m in re.finditer(kw, content, re.IGNORECASE)]
    print(f"Keyword '{kw}': {len(matches)} matches")
    for m in matches[:5]:
        start = max(0, m - 40)
        end = min(len(content), m + 40)
        print(f"  Snippet: {repr(content[start:end])}")
