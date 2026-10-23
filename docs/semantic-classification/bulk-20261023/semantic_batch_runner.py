#!/usr/bin/env python3
"""Checkpointed semantic classifier runner. Never writes to production."""
import argparse
import json
import pathlib
import subprocess
import sys

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Read-only JSON snapshot")
    parser.add_argument("--classifier", required=True, help="Executable JSONL classifier")
    parser.add_argument("--output", required=True)
    parser.add_argument("--checkpoint", type=int, default=100)
    args = parser.parse_args()

    rows = json.loads(pathlib.Path(args.input).read_text(encoding="utf-8"))
    eligible = [r for r in rows if r.get("eligible") is True]
    if len(eligible) != 5848:
        sys.exit("STOP: expected exactly 5848 eligible episodes")
    ids = [r.get("ep_id") for r in eligible]
    if len(set(ids)) != len(ids) or any(not r.get("title") for r in eligible):
        sys.exit("STOP: duplicate IDs or missing titles")

    output = pathlib.Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    for start in range(0, len(eligible), args.checkpoint):
        block = eligible[start:start + args.checkpoint]
        path = output / f"checkpoint-{start:05d}.json"
        expected = [r["ep_id"] for r in block]
        if path.exists():
            saved = json.loads(path.read_text(encoding="utf-8"))
            if [r["ep_id"] for r in saved] != expected:
                sys.exit("STOP: existing checkpoint mismatch")
            continue

        request = "".join(json.dumps(r, ensure_ascii=False) + "\n" for r in block)
        result = subprocess.run([args.classifier], input=request,
                                text=True, capture_output=True, check=False)
        if result.returncode:
            sys.exit("STOP: classifier execution failed")
        try:
            records = [json.loads(line) for line in result.stdout.splitlines() if line.strip()]
        except ValueError:
            sys.exit("STOP: classifier returned invalid JSONL")
        if [r.get("ep_id") for r in records] != expected:
            sys.exit("STOP: incomplete or reordered classification")
        for source, record in zip(block, records):
            if record.get("status") not in ("confirmed", "provisional", "held"):
                sys.exit("STOP: invalid classification status")
            if not source.get("description") and record["status"] == "confirmed":
                sys.exit("STOP: confirmation requires description")
            if record["status"] != "held" and not record.get("main_theme"):
                sys.exit("STOP: missing main theme")
        payload = json.dumps(records, ensure_ascii=False, indent=2) + "\n"
        temp = path.with_suffix(".tmp")
        temp.write_text(payload, encoding="utf-8")
        temp.replace(path)
        if json.loads(path.read_text(encoding="utf-8")) != records:
            sys.exit("STOP: checkpoint verification failed")
        print(f"verified {path}: {len(records)} records", flush=True)

if __name__ == "__main__":
    main()
