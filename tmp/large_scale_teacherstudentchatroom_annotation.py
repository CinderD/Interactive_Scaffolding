#!/usr/bin/env python3
"""large_scale_teacherstudentchatroom_annotation.py

Teacher-Student Chatroom Corpus v2 (TSCC2) large-scale, resumable annotation.

User requirements (from this workspace conversation):
- Use the same Azure OpenAI setup as MathDial (haotian endpoint/deployment by default)
- Keep the identical output format as our existing V12 pipelines:
  - per-conversation JSON under <output_dir>/conversations/
  - append-only manifest.jsonl for resumability
  - conversation-level fields: learning_intent, conversation_topic, language, v21_conv_reasoning
  - per-turn v21_analysis (user turns -> engagement; assistant turns -> scaffolding)
- Role mapping:
  - teacher -> assistant
  - student -> user
  - other roles (e.g., researcher) are skipped
- For now, no topic gating

Input dataset:
- A directory with files named teacherstudentchat*.tsv (top level)
- A metadata CSV named teacherStudentChatroomCorpusPublicMetadata.csv

Notes:
- We use the TSV column `anonymised` as the message content, consistent with privacy.
- Turn ordering uses `turn.number` ascending.
"""

import argparse
import csv
import glob
import hashlib
import json
import logging
import os
import re
import time
import fcntl
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional

from azure.identity import (
    AzureCliCredential,
    ChainedTokenCredential,
    ManagedIdentityCredential,
    get_bearer_token_provider,
)
from openai import AzureOpenAI
from tqdm import tqdm

from v12_prompt_builders import (
    PROMPT_VERSION as V12_PROMPT_VERSION,
    create_assistant_turn_prompt as create_assistant_turn_prompt_v12,
    create_conversation_level_prompt as create_conversation_level_prompt_v12,
    create_user_turn_prompt as create_user_turn_prompt_v12,
)


DEFAULT_DATA_DIR = "teacherstudentchatroom_data/raw/TeacherStudentChatroomCorpus_v2"
DEFAULT_OUTPUT_DIR = "large_scale_teacherstudentchatroom_annotation_results"

DEFAULT_ENDPOINT = "https://haotian-east-us-2.openai.azure.com/"
DEFAULT_DEPLOYMENT = "gpt-5.1"
DEFAULT_API_VERSION = "2024-10-21"

DEFAULT_METADATA_NAME = "teacherStudentChatroomCorpusPublicMetadata.csv"


def _setup_logging(output_dir: str) -> None:
    os.makedirs(output_dir, exist_ok=True)

    root = logging.getLogger()
    root.setLevel(logging.INFO)

    for h in list(root.handlers):
        root.removeHandler(h)

    formatter = logging.Formatter("%(asctime)s - %(levelname)s - %(message)s")

    file_handler = logging.FileHandler(os.path.join(output_dir, "annotation_process.log"))
    file_handler.setFormatter(formatter)
    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(formatter)

    root.addHandler(file_handler)
    root.addHandler(stream_handler)


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _append_jsonl(path: str, obj: Dict[str, Any]) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "a", encoding="utf-8") as f:
        try:
            fcntl.flock(f.fileno(), fcntl.LOCK_EX)
        except Exception:
            pass
        f.write(json.dumps(obj, ensure_ascii=False) + "\n")
        try:
            f.flush()
            os.fsync(f.fileno())
        except Exception:
            pass
        try:
            fcntl.flock(f.fileno(), fcntl.LOCK_UN)
        except Exception:
            pass


def _load_manifest_last_status(manifest_path: str) -> Dict[str, Dict[str, Any]]:
    if not os.path.exists(manifest_path):
        return {}

    last: Dict[str, Dict[str, Any]] = {}
    with open(manifest_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                event = json.loads(line)
            except Exception:
                continue
            conv_id = event.get("ConversationId")
            if conv_id is not None:
                last[str(conv_id)] = event
    return last


def _safe_filename(conv_id: str) -> str:
    s = str(conv_id)
    s_clean = re.sub(r"[^a-zA-Z0-9._-]+", "_", s)
    if not s_clean or s_clean in {".", ".."}:
        s_clean = hashlib.sha1(s.encode("utf-8")).hexdigest()
    if len(s_clean) > 120:
        s_clean = s_clean[:80] + "_" + hashlib.sha1(s.encode("utf-8")).hexdigest()[:16]
    return s_clean


def get_azure_client(*, endpoint: str, api_version: str, api_key: Optional[str]) -> Optional[AzureOpenAI]:
    endpoint = (endpoint or "").strip()
    if not endpoint:
        logging.error("Azure endpoint is empty")
        return None

    if api_key:
        try:
            return AzureOpenAI(
                azure_endpoint=endpoint,
                api_key=api_key,
                api_version=api_version,
            )
        except Exception as e:
            logging.error(f"❌ Azure OpenAI (api_key) connection failed: {e}")
            return None

    try:
        scope = "https://cognitiveservices.azure.com/.default"
        credential = get_bearer_token_provider(
            ChainedTokenCredential(AzureCliCredential(), ManagedIdentityCredential()),
            scope,
        )
        return AzureOpenAI(
            azure_endpoint=endpoint,
            azure_ad_token_provider=credential,
            api_version=api_version,
        )
    except Exception as e:
        logging.error(f"❌ Azure OpenAI (AAD) connection failed: {e}")
        return None


def analyze_with_llm(
    client: AzureOpenAI,
    prompt: str,
    *,
    deployment_name: str,
    max_retries: int = 6,
    base_delay: float = 2.0,
    max_tokens: int = 400,
    timeout: int = 60,
    temperature: float = 0.1,
) -> Dict[str, Any]:
    for attempt in range(max_retries):
        try:
            response = client.chat.completions.create(
                model=deployment_name,
                messages=[{"role": "user", "content": prompt}],
                temperature=temperature,
                max_completion_tokens=max_tokens,
                timeout=timeout,
                response_format={"type": "json_object"},
            )
            return json.loads(response.choices[0].message.content)
        except Exception as e:
            error_msg = str(e)
            if "400" in error_msg and "unsupported" in error_msg.lower():
                logging.error(f"Non-retryable request error: {e}")
                return {}
            if "429" in error_msg or "Rate Limit" in error_msg:
                wait_time = base_delay * (2**attempt)
                logging.warning(
                    f"Rate limit hit. Retrying in {wait_time}s... (Attempt {attempt+1}/{max_retries})"
                )
                time.sleep(wait_time)
            else:
                wait_time = base_delay * (2**attempt)
                logging.warning(f"Error: {e}. Retrying in {wait_time}s... (Attempt {attempt+1}/{max_retries})")
                time.sleep(wait_time)
    return {}


_ENGLISH_FILTER_PROMPT = """You are a language detector.
Given a conversation sample, determine whether the conversation is predominantly English.

Conversation sample:
{sample}

Return JSON:
{{
  \"is_english\": true|false,
  \"confidence\": 0.0-1.0,
  \"reasoning\": \"brief\"
}}
"""


def _sample_conversation_text(messages: List[Dict[str, Any]], *, max_chars: int = 1200) -> str:
    parts: List[str] = []
    for m in messages[:8]:
        role = m.get("role")
        content = (m.get("content") or "").strip()
        if not content:
            continue
        parts.append(f"{role}: {content[:400]}")
        if sum(len(p) for p in parts) > max_chars:
            break
    return "\n".join(parts)[:max_chars]


def llm_check_english_conversation(
    client: AzureOpenAI,
    deployment_name: str,
    messages: List[Dict[str, Any]],
) -> Dict[str, Any]:
    if not client:
        return {"is_english": True, "confidence": 0.0, "reasoning": "LLM unavailable; default_allow"}

    sample = _sample_conversation_text(messages)
    prompt = _ENGLISH_FILTER_PROMPT.format(sample=sample)
    result = analyze_with_llm(
        client,
        prompt,
        deployment_name=deployment_name,
        max_tokens=120,
        timeout=30,
        temperature=0.0,
    )
    if not result:
        return {"is_english": True, "confidence": 0.0, "reasoning": "english_filter_failed; default_allow"}
    return {
        "is_english": bool(result.get("is_english")),
        "confidence": float(result.get("confidence", 0.0)) if result else 0.0,
        "reasoning": str(result.get("reasoning", "")) if result else "",
    }


def _read_metadata_csv(path: str) -> Dict[str, Dict[str, Any]]:
    """Return map filename -> metadata row (as dict)."""
    if not os.path.exists(path):
        return {}

    meta: Dict[str, Dict[str, Any]] = {}
    with open(path, "r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            filename = (row.get("filename") or "").strip().strip("\"")
            if filename:
                meta[filename] = row
    return meta


def _parse_int(value: Any, default: int = 0) -> int:
    try:
        if value is None:
            return default
        s = str(value).strip().strip('"')
        if not s or s.upper() == "NA":
            return default
        return int(float(s))
    except Exception:
        return default


def _strip_tsv_cell(value: Any) -> str:
    s = "" if value is None else str(value)
    s = s.strip()
    if len(s) >= 2 and s[0] == '"' and s[-1] == '"':
        s = s[1:-1]
    return s


def tscc_tsv_to_conversation(
    tsv_path: str,
    *,
    metadata_by_filename: Dict[str, Dict[str, Any]],
) -> Dict[str, Any]:
    filename = os.path.basename(tsv_path)
    conv_id = os.path.splitext(filename)[0]  # e.g., teacherstudentchat00002

    messages: List[Dict[str, Any]] = []

    with open(tsv_path, "r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f, delimiter="\t")
        # Expected columns include: timestamp, user.id, role, turn.number, anonymised, edited, ...
        for row in reader:
            role_raw = _strip_tsv_cell(row.get("role"))
            role_lower = role_raw.lower()

            if role_lower == "teacher":
                role = "assistant"
            elif role_lower == "student":
                role = "user"
            else:
                # Skip researcher/other rows to keep the dialog strictly teacher-student.
                continue

            turn_number = _parse_int(row.get("turn.number"), default=0)
            timestamp = _strip_tsv_cell(row.get("timestamp")) or None
            content = _strip_tsv_cell(row.get("anonymised"))
            content = (content or "").strip()
            if not content:
                continue

            messages.append(
                {
                    "role": role,
                    "content": content,
                    "timestamp": timestamp,
                    "turn_number": turn_number,
                }
            )

    # Sort by explicit turn number; stable sort to keep file order for ties.
    messages.sort(key=lambda m: int(m.get("turn_number") or 0))

    # Remove helper field from final output for schema consistency.
    for m in messages:
        m.pop("turn_number", None)

    meta_row = metadata_by_filename.get(filename, {})

    return {
        "ConversationId": conv_id,
        "Messages": messages,
        "source": {
            "dataset": "tscc2",
            "source_path": tsv_path,
            "filename": filename,
            "metadata": meta_row,
        },
    }


def annotate_conversation_level_only(client: AzureOpenAI, deployment_name: str, conversation: Dict[str, Any]) -> Dict[str, Any]:
    messages = conversation.get("Messages", [])
    if not messages:
        return {}

    first_user_msg = next((m for m in messages if m.get("role") == "user"), None)
    first_user_content = first_user_msg.get("content", "") if first_user_msg else ""
    full_text = "\n".join([f"{m.get('role')}: {m.get('content','')}" for m in messages])

    conv_prompt = create_conversation_level_prompt_v12(first_user_content, full_text)
    conv_result = analyze_with_llm(
        client,
        conv_prompt,
        deployment_name=deployment_name,
        max_tokens=300,
        timeout=60,
    )
    return conv_result or {}


def annotate_turn_level_only(client: AzureOpenAI, deployment_name: str, conversation: Dict[str, Any]) -> Dict[str, Any]:
    messages = conversation.get("Messages", [])
    updated_messages: List[Dict[str, Any]] = []

    for i, msg in enumerate(messages):
        role = msg.get("role")
        content = msg.get("content", "")

        context = "N/A (First Utterance)"
        if i > 0:
            prev = messages[i - 1]
            context = f"{prev.get('role')}: {prev.get('content', '')}"

        if role == "user":
            prompt = create_user_turn_prompt_v12(content, context)
            result = analyze_with_llm(
                client,
                prompt,
                deployment_name=deployment_name,
                max_tokens=350,
                timeout=60,
            )
            turn_analysis = {
                "Emotional": result.get("Emotional", False),
                "Cognitive": result.get("Cognitive", {}),
                "Behavioral": result.get("Behavioral", False),
                "reasoning": result.get("reasoning", ""),
            }
        elif role == "assistant":
            prompt = create_assistant_turn_prompt_v12(content, context)
            result = analyze_with_llm(
                client,
                prompt,
                deployment_name=deployment_name,
                max_tokens=350,
                timeout=60,
            )
            turn_analysis = {
                "Support_Type": result.get("Support_Type"),
                "S2_Details": result.get("S2_Details", {}),
                "reasoning": result.get("reasoning", ""),
            }
        else:
            turn_analysis = {}

        msg["v21_analysis"] = turn_analysis
        updated_messages.append(msg)

    conversation["Messages"] = updated_messages
    return conversation


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Large scale TSCC English filter + V12 annotation")

    parser.add_argument("--data-dir", default=DEFAULT_DATA_DIR)
    parser.add_argument("--output-dir", default=DEFAULT_OUTPUT_DIR)

    parser.add_argument("--mode", choices=["new", "rerun-skipped", "rerun-failed"], default="new")
    parser.add_argument("--overwrite-existing", action="store_true")

    parser.add_argument("--min-turns", type=int, default=4)
    parser.add_argument(
        "--max-annotated",
        type=int,
        default=None,
        help=(
            "Stop after writing this many processed conversations (counts existing outputs too). "
            "If omitted, runs through all TSVs in data-dir."
        ),
    )
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--pid-file",
        default=None,
        help=(
            "Optional path to write the worker PID. If not set, writes <output-dir>/run.pid. "
            "Useful for monitoring / multi-worker sharding (if added later)."
        ),
    )

    parser.add_argument(
        "--metadata-csv",
        default=None,
        help=(
            "Optional explicit path to teacherStudentChatroomCorpusPublicMetadata.csv. "
            "If omitted, will look for it inside --data-dir."
        ),
    )

    # Azure OpenAI config
    parser.add_argument("--endpoint", default=DEFAULT_ENDPOINT)
    parser.add_argument("--deployment", default=DEFAULT_DEPLOYMENT)
    parser.add_argument("--api-version", default=DEFAULT_API_VERSION)
    parser.add_argument(
        "--api-key-env",
        default="AZURE_OPENAI_API_KEY",
        help=(
            "Env var name holding Azure OpenAI API key. Defaults to AZURE_OPENAI_API_KEY. "
            "If missing/empty, will attempt AAD auth."
        ),
    )

    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    _setup_logging(args.output_dir)

    try:
        pid_path = args.pid_file or os.path.join(args.output_dir, "run.pid")
        with open(pid_path, "w", encoding="utf-8") as f:
            f.write(str(os.getpid()))
    except Exception as e:
        logging.warning(f"Could not write run.pid: {e}")

    data_dir = str(args.data_dir)

    logging.info("🚀 Starting Large Scale TSCC Annotation")
    logging.info(
        f"Config: output_dir={args.output_dir} data_dir={data_dir} mode={args.mode} "
        f"overwrite_existing={args.overwrite_existing} dry_run={args.dry_run} min_turns={args.min_turns} "
        f"max_annotated={args.max_annotated} prompt_version={V12_PROMPT_VERSION} "
        f"endpoint={args.endpoint} deployment={args.deployment} api_version={args.api_version}"
    )

    conv_output_dir = os.path.join(args.output_dir, "conversations")
    os.makedirs(conv_output_dir, exist_ok=True)

    manifest_path = os.path.join(args.output_dir, "manifest.jsonl")

    last_events = _load_manifest_last_status(manifest_path)
    skipped_ids = {cid for cid, e in last_events.items() if e.get("status") == "skipped"}
    failed_ids = {cid for cid, e in last_events.items() if e.get("status") == "failed"}

    processed_ids = set()
    for fpath in glob.glob(os.path.join(conv_output_dir, "*.json")):
        try:
            with open(fpath, "r", encoding="utf-8") as jf:
                data = json.load(jf)
            conv_id = data.get("ConversationId")
            if conv_id is not None:
                processed_ids.add(str(conv_id))
        except Exception:
            continue

    logging.info(f"State: processed={len(processed_ids)} skipped={len(skipped_ids)} failed={len(failed_ids)}")

    if args.max_annotated is not None and len(processed_ids) >= int(args.max_annotated):
        logging.info(
            f"Already have processed={len(processed_ids)} >= max_annotated={args.max_annotated}; exiting."
        )
        return

    metadata_csv = args.metadata_csv
    if not metadata_csv:
        metadata_csv = os.path.join(data_dir, DEFAULT_METADATA_NAME)

    metadata_by_filename = _read_metadata_csv(metadata_csv)
    if not metadata_by_filename:
        logging.warning(f"Metadata CSV not found or empty: {metadata_csv}")

    tsv_paths = sorted(glob.glob(os.path.join(data_dir, "teacherstudentchat*.tsv")))
    if not tsv_paths:
        logging.error(f"No teacherstudentchat*.tsv found in data_dir={data_dir}")
        return

    client: Optional[AzureOpenAI] = None
    if not args.dry_run:
        api_key = os.getenv(args.api_key_env) or ""
        api_key = api_key.strip() or None
        client = get_azure_client(endpoint=args.endpoint, api_version=args.api_version, api_key=api_key)
        if not client:
            logging.error("Could not initialize Azure client. Exiting.")
            return

    considered = 0
    annotated = 0
    dry_run_emitted = 0

    for idx, tsv_path in enumerate(tqdm(tsv_paths, desc="TSCC")):
        considered += 1

        conv = tscc_tsv_to_conversation(tsv_path, metadata_by_filename=metadata_by_filename)
        conv_id = str(conv.get("ConversationId", ""))

        if not conv_id:
            _append_jsonl(
                manifest_path,
                {
                    "ts": _utc_now_iso(),
                    "status": "skipped",
                    "reason": "missing_conversation_id",
                    "index": int(idx),
                    "tsv": tsv_path,
                    "PromptVersion": V12_PROMPT_VERSION,
                    "mode": args.mode,
                },
            )
            continue

        if (not args.overwrite_existing) and (conv_id in processed_ids):
            continue

        last_status = last_events.get(conv_id, {}).get("status")
        if args.mode == "new":
            if last_status in {"skipped", "failed"}:
                continue
        elif args.mode == "rerun-skipped":
            if last_status != "skipped":
                continue
        elif args.mode == "rerun-failed":
            if last_status != "failed":
                continue

        messages = conv.get("Messages", [])
        if len(messages) < int(args.min_turns):
            ev = {
                "ts": _utc_now_iso(),
                "status": "skipped",
                "reason": "too_few_turns",
                "ConversationId": conv_id,
                "index": int(idx),
                "turns": len(messages),
                "tsv": tsv_path,
                "PromptVersion": V12_PROMPT_VERSION,
                "mode": args.mode,
            }
            _append_jsonl(manifest_path, ev)
            last_events[conv_id] = ev
            continue

        if args.dry_run:
            ev = {
                "ts": _utc_now_iso(),
                "status": "dry_run_candidate",
                "ConversationId": conv_id,
                "index": int(idx),
                "turns": len(messages),
                "tsv": tsv_path,
                "PromptVersion": V12_PROMPT_VERSION,
                "mode": args.mode,
            }
            _append_jsonl(manifest_path, ev)
            dry_run_emitted += 1

            if args.max_annotated is not None and dry_run_emitted >= int(args.max_annotated):
                logging.info(f"Reached max_annotated={args.max_annotated} in dry-run; stopping.")
                break
            continue

        english_result = llm_check_english_conversation(client, args.deployment, messages)
        if not english_result.get("is_english"):
            ev = {
                "ts": _utc_now_iso(),
                "status": "skipped",
                "reason": "english_filter_negative",
                "ConversationId": conv_id,
                "index": int(idx),
                "tsv": tsv_path,
                "english_filter": english_result,
                "PromptVersion": V12_PROMPT_VERSION,
                "mode": args.mode,
            }
            _append_jsonl(manifest_path, ev)
            last_events[conv_id] = ev
            continue

        try:
            conv.setdefault("annotation_meta", {})
            conv["annotation_meta"].update(
                {
                    "schema": "V12",
                    "prompt_version": V12_PROMPT_VERSION,
                    "annotation_model": args.deployment,
                    "annotation_api_version": args.api_version,
                }
            )

            conv_result = annotate_conversation_level_only(client, args.deployment, conv)
            topic_str = str(conv_result.get("conversation_topic", "") or "").strip()
            conv["learning_intent"] = conv_result.get("learning_intent", "")
            conv["conversation_topic"] = topic_str
            conv["language"] = conv_result.get("language", "")
            conv["v21_conv_reasoning"] = conv_result.get("reasoning", "")

            annotated_conv = annotate_turn_level_only(client, args.deployment, conv)
            annotated_conv.setdefault("filter", {})
            annotated_conv["filter"].update({"english": english_result})
        except Exception as e:
            logging.error(f"Annotation failed for {conv_id}: {e}")
            ev = {
                "ts": _utc_now_iso(),
                "status": "failed",
                "reason": "annotation_exception",
                "ConversationId": conv_id,
                "index": int(idx),
                "tsv": tsv_path,
                "error": str(e),
                "PromptVersion": V12_PROMPT_VERSION,
                "mode": args.mode,
            }
            _append_jsonl(manifest_path, ev)
            last_events[conv_id] = ev
            continue

        fname = _safe_filename(conv_id)
        out_path = os.path.join(conv_output_dir, f"{fname}.json")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(annotated_conv, f, ensure_ascii=False, indent=2)

        processed_ids.add(conv_id)
        annotated += 1

        ev = {
            "ts": _utc_now_iso(),
            "status": "processed",
            "ConversationId": conv_id,
            "index": int(idx),
            "tsv": tsv_path,
            "output": os.path.relpath(out_path, args.output_dir),
            "conversation_topic": str((annotated_conv or {}).get("conversation_topic", "") or "").strip(),
            "PromptVersion": V12_PROMPT_VERSION,
            "mode": args.mode,
        }
        _append_jsonl(manifest_path, ev)
        last_events[conv_id] = ev

        if args.max_annotated is not None and len(processed_ids) >= int(args.max_annotated):
            logging.info(f"Reached max_annotated={args.max_annotated}; stopping.")
            break

    logging.info(f"🎉 Completed. Considered={considered} NewlyAnnotated={annotated} TotalProcessed={len(processed_ids)}")


if __name__ == "__main__":
    main()
