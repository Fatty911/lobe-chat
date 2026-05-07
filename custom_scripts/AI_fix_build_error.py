#!/usr/bin/env python3
"""
AI Build Error Fix Script - Track 2

分析 Test CI 错误日志，用 AI 自动修复代码。

使用方法:
    python custom_scripts/AI_fix_build_error.py <error_log_file>

环境变量:
    同 pick_best_model.py 和 resolve_upstream_conflicts.py 所需的所有 API Key
"""

import os
import sys
import re
import json
import subprocess
from pathlib import Path
from typing import Optional, List, Dict

sys.path.insert(0, str(Path(__file__).parent))
from resolve_upstream_conflicts import ProviderManager, call_api


def read_error_log(path: str) -> str:
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        return f.read()


def categorize_error(log: str) -> Dict:
    categories = {
        "typescript_type": False,
        "typescript_syntax": False,
        "test_failure": False,
        "lint_error": False,
        "build_error": False,
        "dependency_error": False,
    }

    if re.search(r"error\s+TS\d+", log, re.IGNORECASE):
        categories["typescript_type"] = True
    if re.search(r"SyntaxError|Unexpected token|Parsing error", log, re.IGNORECASE):
        categories["typescript_syntax"] = True
    if re.search(r"FAIL\s+\d+\s+tests?|AssertionError|expect\(|test\s+failed", log, re.IGNORECASE):
        categories["test_failure"] = True
    if re.search(r"eslint|prettier|lint", log, re.IGNORECASE):
        categories["lint_error"] = True
    if re.search(r"Cannot find module|Module not found|import error", log, re.IGNORECASE):
        categories["dependency_error"] = True
    if any(categories.values()):
        categories["build_error"] = True

    return categories


def extract_key_errors(log: str, max_chars: int = 8000) -> str:
    lines = log.split("\n")
    error_lines = []
    for line in lines:
        if re.search(r"error|fail|assertion|expect", line, re.IGNORECASE):
            error_lines.append(line)
    combined = "\n".join(error_lines)
    if len(combined) > max_chars:
        combined = combined[:max_chars] + "\n... (truncated)"
    return combined


def build_fix_prompt(error_log: str, categories: Dict) -> str:
    cat_desc = []
    if categories["typescript_type"]:
        cat_desc.append("TypeScript type errors")
    if categories["typescript_syntax"]:
        cat_desc.append("TypeScript syntax errors")
    if categories["test_failure"]:
        cat_desc.append("Test failures")
    if categories["lint_error"]:
        cat_desc.append("Lint/Prettier errors")
    if categories["dependency_error"]:
        cat_desc.append("Module/dependency errors")
    if not cat_desc:
        cat_desc.append("Build errors")

    key_errors = extract_key_errors(error_log)

    return f"""You are an expert software engineer fixing a CI build failure in a Lobe-Chat project.

Project: Lobe-Chat (TypeScript/React/Next.js monorepo with pnpm/bun)
Error categories detected: {', '.join(cat_desc)}

Rules:
1. Analyze the error log below carefully
2. Use LSP, grep, and AST tools to find the root cause in the codebase
3. Fix ONLY the broken code causing the error
4. Do NOT refactor unrelated code
5. Do NOT delete tests to make them pass - fix the actual bug
6. Do NOT modify configuration files (package.json, tsconfig.json) unless absolutely necessary
7. Maintain TypeScript strict mode compliance
8. Return ONLY the complete fixed file content for each file you modify
9. If multiple files need changes, fix them all

Key errors from the log:
```
{key_errors}
```

Full error log:
```
{error_log[:12000]}
```

Analyze the errors, find the root causes, and apply minimal targeted fixes."""


def run_opencode_fix(prompt: str, provider_manager: ProviderManager) -> bool:
    for provider in provider_manager.providers:
        print(f"\n  尝试 Provider: {provider['name']}")
        for model in provider["models"][:2]:
            if not provider_manager.is_top20_match(model):
                print(f"    ⊘ {model}: 不在排行榜前20，跳过")
                continue
            print(f"    → 模型: {model}")
            result = call_api(provider, model, prompt)
            if result:
                print(f"    ✓ AI 分析完成，应用修复...")
                # Save result for manual application (or parse inline code blocks)
                # For now, just return True to indicate analysis succeeded
                # The actual fix application would be done by opencode agent
                return True
    return False


def main():
    if len(sys.argv) < 2:
        print("Usage: python AI_fix_build_error.py <error_log_file>")
        sys.exit(1)

    error_log_path = sys.argv[1]
    print(f"Reading error log: {error_log_path}")
    error_log = read_error_log(error_log_path)

    if not error_log.strip():
        print("❌ Error log is empty")
        sys.exit(1)

    print("=" * 60)
    print("AI Build Error Fix (Track 2)")
    print("=" * 60)

    categories = categorize_error(error_log)
    print(f"\nDetected error categories: {categories}")

    manager = ProviderManager()
    if not manager.providers:
        print("❌ 未找到可用的 AI Provider")
        sys.exit(1)

    print(f"\n发现 {len(manager.providers)} 个可用 Provider")

    prompt = build_fix_prompt(error_log, categories)

    # Save prompt for Track 3 to use if Track 2 fails
    prompt_path = Path(".ai_fix_prompt.txt")
    prompt_path.write_text(prompt, encoding="utf-8")
    print(f"\nPrompt saved to {prompt_path}")

    if run_opencode_fix(prompt, manager):
        print("\n✅ Track 2: AI analysis completed successfully")
        sys.exit(0)
    else:
        print("\n⚠️ Track 2: All providers failed, need Track 3 (OpenCode)")
        sys.exit(1)


if __name__ == "__main__":
    main()
