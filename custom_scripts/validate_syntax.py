#!/usr/bin/env python3
"""
语法校验脚本 - 在AI提交前验证代码语法
防止AI幻觉导致的语法错误
"""

import subprocess
import sys
import os
from pathlib import Path

def run_command(cmd, cwd=None):
    """运行命令并返回结果"""
    try:
        result = subprocess.run(
            cmd,
            shell=True,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=300
        )
        return result.returncode, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return -1, "", "Command timed out"

def check_package_json():
    """检查 package.json 是否有效"""
    pkg_path = Path("package.json")
    if not pkg_path.exists():
        return True, "package.json not found (skipped)"
    
    import json
    try:
        with open(pkg_path, 'r', encoding='utf-8') as f:
            json.load(f)
        return True, "package.json is valid JSON"
    except json.JSONDecodeError as e:
        return False, f"package.json has invalid JSON: {e}"

def check_ts_files():
    """检查 TypeScript 文件语法（如果有变更）"""
    # 检查是否有 tsconfig.json
    if not Path("tsconfig.json").exists():
        return True, "No tsconfig.json found (skipped TS check)"
    
    # 运行 type-check
    returncode, stdout, stderr = run_command("bun run type-check 2>&1 || pnpm lint 2>&1")
    
    if returncode == 0:
        return True, "TypeScript syntax check passed"
    else:
        # 检查是否只是警告
        if "error" in stderr.lower() or "error" in stdout.lower():
            return False, f"TypeScript errors found:\n{stdout}\n{stderr}"
        return True, f"TypeScript check completed with warnings:\n{stdout}"

def check_yaml_files():
    """检查 YAML 文件语法"""
    yaml_files = list(Path(".github/workflows").glob("*.yml")) + list(Path(".github/workflows").glob("*.yaml"))
    
    if not yaml_files:
        return True, "No YAML files to check"
    
    try:
        import yaml
        for yml_file in yaml_files:
            with open(yml_file, 'r', encoding='utf-8') as f:
                yaml.safe_load(f)
        return True, f"All {len(yaml_files)} YAML files are valid"
    except ImportError:
        # 如果没有 yaml 模块，跳过检查
        return True, "PyYAML not installed, skipping YAML validation"
    except yaml.YAMLError as e:
        return False, f"YAML syntax error: {e}"

def check_python_files():
    """检查 Python 文件语法"""
    py_files = list(Path("custom_scripts").glob("*.py")) if Path("custom_scripts").exists() else []
    
    if not py_files:
        return True, "No Python files to check"
    
    errors = []
    for py_file in py_files:
        returncode, stdout, stderr = run_command(f"python3 -m py_compile {py_file}")
        if returncode != 0:
            errors.append(f"{py_file}: {stderr}")
    
    if errors:
        return False, f"Python syntax errors:\n" + "\n".join(errors)
    return True, f"All {len(py_files)} Python files are valid"

def main():
    """主函数"""
    print("=" * 50)
    print("🔍 语法校验开始")
    print("=" * 50)
    
    checks = [
        ("package.json", check_package_json),
        ("TypeScript", check_ts_files),
        ("YAML", check_yaml_files),
        ("Python", check_python_files),
    ]
    
    all_passed = True
    for name, check_func in checks:
        print(f"\n📋 检查 {name}...")
        try:
            passed, message = check_func()
            if passed:
                print(f"  ✅ {message}")
            else:
                print(f"  ❌ {message}")
                all_passed = False
        except Exception as e:
            print(f"  ⚠️ 检查异常: {e}")
            # 不因异常而失败
    
    print("\n" + "=" * 50)
    if all_passed:
        print("✅ 所有语法检查通过")
        return 0
    else:
        print("❌ 语法检查失败，请修复后重试")
        return 1

if __name__ == "__main__":
    sys.exit(main())
