#!/usr/bin/env python3
"""
Enforce timeZone: 'Europe/Berlin' across all client-side date-formatting calls.

Rules:
- .toLocaleDateString(...)  -> always a date call. Inject Berlin TZ unless already present.
- .toLocaleTimeString(...)  -> always a date call. Inject Berlin TZ unless already present.
- .toLocaleString(...)      -> only convert when it is clearly a date (either
                               preceded by `new Date(...)`, a known date-named
                               variable, or followed by an options object
                               with date-style keys).
Number-formatting calls like `value.toLocaleString('de-DE')` are left untouched.
"""
import os
import re
import sys

ROOT = '/app/serien-nextjs'
BERLIN = "timeZone: 'Europe/Berlin'"

# Known identifiers that always refer to Date values
DATE_VAR_RE = r'(publishedAt|createdAt|updatedAt|timestamp|completedAt|lastFetch|startedAt|lastUpdate|dayStart|sourceDate|publishedDate|iso|dateStr|mtime|lastHitAt|lastSeen|birthday|deathday|formattedDate|publishedDate|lastRun|previousRun|updatedAt|date|today|crawlRun)'

# Date-style keys indicate options object formats a Date
DATE_OPT_KEYS_RE = re.compile(r'\b(day|month|year|weekday|hour|minute|second|dateStyle|timeStyle|hour12|fractionalSecondDigits|era)\b')


def inject_tz_into_opts(opts_str: str) -> str:
    """Insert timeZone at start of options object contents if not present."""
    if 'timeZone' in opts_str:
        return opts_str
    # opts_str looks like "{ day: '2-digit', ... }" or "{\n ... \n }"
    stripped = opts_str.strip()
    if not stripped.startswith('{') or not stripped.endswith('}'):
        return opts_str
    inner = stripped[1:-1].strip()
    if inner:
        new_inner = f" {BERLIN}, " + inner.lstrip()
    else:
        new_inner = f" {BERLIN} "
    # preserve leading/trailing whitespace from original
    lead = opts_str[: len(opts_str) - len(opts_str.lstrip())]
    trail = opts_str[len(opts_str.rstrip()):]
    return lead + '{' + new_inner + ' }' + trail


# Matches `.toLocaleDateString(` or `.toLocaleTimeString(` plus balanced arg list
# We use a custom scanner to handle balanced parentheses.

DATE_METHOD_RE = re.compile(r"\.toLocale(Date|Time)String\(")
GEN_METHOD_RE = re.compile(r"\.toLocaleString\(")


def find_balanced_args(src: str, open_paren_idx: int):
    """Return (args_str, end_idx) of the arg list starting at src[open_paren_idx] == '('.
    end_idx is index of the matching ')'."""
    assert src[open_paren_idx] == '('
    depth = 0
    in_str = None  # ' " `
    i = open_paren_idx
    while i < len(src):
        ch = src[i]
        if in_str:
            if ch == '\\':
                i += 2
                continue
            if ch == in_str:
                in_str = None
        else:
            if ch in ('\'', '"', '`'):
                in_str = ch
            elif ch == '(':
                depth += 1
            elif ch == ')':
                depth -= 1
                if depth == 0:
                    return src[open_paren_idx + 1:i], i
        i += 1
    raise ValueError('Unbalanced parens')


def split_top_level_args(args_str: str):
    """Split a JS call arg string at top-level commas."""
    out = []
    depth = 0
    in_str = None
    buf = []
    i = 0
    while i < len(args_str):
        ch = args_str[i]
        if in_str:
            buf.append(ch)
            if ch == '\\':
                if i + 1 < len(args_str):
                    buf.append(args_str[i + 1])
                    i += 2
                    continue
            elif ch == in_str:
                in_str = None
            i += 1
            continue
        if ch in ('\'', '"', '`'):
            in_str = ch
            buf.append(ch)
            i += 1
            continue
        if ch in '([{':
            depth += 1
        elif ch in ')]}':
            depth -= 1
        if ch == ',' and depth == 0:
            out.append(''.join(buf))
            buf = []
        else:
            buf.append(ch)
        i += 1
    if buf:
        out.append(''.join(buf))
    return out


def transform(src: str, path: str) -> tuple[str, int]:
    changes = 0
    i = 0
    out = []

    while i < len(src):
        m_date = DATE_METHOD_RE.search(src, i)
        m_gen = GEN_METHOD_RE.search(src, i)
        nxt = None
        kind = None  # 'date' = DateString/TimeString, 'gen' = toLocaleString
        for cand, c_kind in ((m_date, 'date'), (m_gen, 'gen')):
            if cand and (nxt is None or cand.start() < nxt.start()):
                nxt = cand
                kind = c_kind
        if not nxt:
            out.append(src[i:])
            break

        # Flush everything up to the '.' of the match
        dot_idx = nxt.start()
        open_paren_idx = nxt.end() - 1  # position of '('

        # Extract args
        args_str, close_paren_idx = find_balanced_args(src, open_paren_idx)
        args = split_top_level_args(args_str)

        # Decide whether to convert. For 'gen' we need a date context.
        should_convert = False
        if kind == 'date':
            should_convert = True
        else:
            # Look back to see caller expression
            # Extract identifier/expression before .toLocaleString
            look_start = max(0, dot_idx - 120)
            snippet = src[look_start:dot_idx]
            preceded_by_new_date = bool(
                re.search(r'new\s+Date\([^)]*\)\s*$', snippet)
            )
            preceded_by_date_var = bool(
                re.search(r'(?<![A-Za-z0-9_$])' + DATE_VAR_RE + r'\s*$', snippet)
            )
            has_date_opts = False
            if len(args) >= 2 and DATE_OPT_KEYS_RE.search(args[1] or ''):
                has_date_opts = True
            if preceded_by_new_date or preceded_by_date_var or has_date_opts:
                should_convert = True

        if not should_convert:
            # Append up to end of this call unchanged, continue scan after
            out.append(src[i:close_paren_idx + 1])
            i = close_paren_idx + 1
            continue

        # We will rebuild the call with Berlin TZ enforced.
        # Emit prefix up to '(' inclusive
        out.append(src[i:open_paren_idx + 1])

        # Normalize args
        if len(args) == 0:
            # e.g., lastUpdate.toLocaleTimeString()
            new_args = f"'de-DE', {{ {BERLIN} }}"
        elif len(args) == 1:
            # e.g., (iso) or ('de-DE')
            arg0 = args[0].strip()
            if not arg0:
                new_args = f"'de-DE', {{ {BERLIN} }}"
            elif arg0.startswith(('"', "'", '`')):
                # Locale string; add options with TZ
                new_args = f"{args[0]}, {{ {BERLIN} }}"
            elif arg0.startswith('{'):
                # Legacy: options-only (locale defaulted)
                new_args = f"{inject_tz_into_opts(args[0])}"
            else:
                # Unknown single arg - assume it's a locale expression; add opts
                new_args = f"{args[0]}, {{ {BERLIN} }}"
        else:
            # 2+ args: arg0 locale, arg1 options
            new_opts = inject_tz_into_opts(args[1])
            rest = args[2:] if len(args) > 2 else []
            parts = [args[0], new_opts] + rest
            new_args = ','.join(parts)

        out.append(new_args)
        out.append(')')
        # Count only if actually modified (TZ was newly injected)
        original_call = src[open_paren_idx:close_paren_idx + 1]
        rebuilt = '(' + new_args + ')'
        if original_call != rebuilt:
            changes += 1
        i = close_paren_idx + 1

    return ''.join(out), changes


def main():
    files = []
    for root, _, names in os.walk(ROOT):
        # skip build / deps / etc
        if any(seg in root for seg in ('/node_modules', '/.next', '/.git', '/public', '/.turbo')):
            continue
        for n in names:
            if n.endswith(('.ts', '.tsx')):
                files.append(os.path.join(root, n))

    total_changed_files = 0
    total_changes = 0
    for path in files:
        if path.endswith('format-date.ts'):
            continue
        try:
            with open(path, 'r', encoding='utf-8') as f:
                src = f.read()
        except UnicodeDecodeError:
            continue
        if 'toLocale' not in src:
            continue
        new_src, n = transform(src, path)
        if new_src != src and n > 0:
            with open(path, 'w', encoding='utf-8') as f:
                f.write(new_src)
            total_changed_files += 1
            total_changes += n
            print(f"  {n:3d} fix(es)  {os.path.relpath(path, ROOT)}")

    print(f"\nFiles touched: {total_changed_files}")
    print(f"Calls rewritten: {total_changes}")


if __name__ == '__main__':
    main()
