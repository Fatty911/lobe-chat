#!/usr/bin/env python3
"""
AI 冲突解决脚本 - Track 2
使用 Python + AI API 解决上游同步冲突
"""

import os
import sys
import subprocess
import json
import re
from pathlib import Path
from typing import List, Dict, Optional, Tuple

# 尝试导入可选依赖
try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False

try:
    import yaml
    HAS_YAML = True
except ImportError:
    HAS_YAML = False

def run_git_command(cmd: str, cwd: str = ".") -> Tuple[int, str, str]:
    """运行 git 命令"""
    try:
        result = subprocess.run(
            cmd,
            shell=True,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=60
        )
        return result.returncode, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return -1, "", "Command timed out"

def get_conflicted_files() -> List[str]:
    """获取冲突文件列表"""
    returncode, stdout, stderr = run_git_command("git diff --name-only --diff-filter=U")
    if returncode != 0:
        return []
    return [f.strip() for f in stdout.strip().split('\n') if f.strip()]

def get_conflict_content(file_path: str) -> str:
    """读取冲突文件内容"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        return f"Error reading file: {e}"

def parse_conflict_markers(content: str) -> List[Dict]:
    """解析冲突标记"""
    conflicts = []
    pattern = r'<<<<<<< .*?\n(.*?)\n=======\n(.*?)\n>>>>>>> .*?\n'
    
    for match in re.finditer(pattern, content, re.DOTALL):
        conflicts.append({
            'local': match.group(1),
            'upstream': match.group(2),
            'start': match.start(),
            'end': match.end()
        })
    
    return conflicts

def call_ai_api(prompt: str, model_config: Dict) -> Optional[str]:
    """调用 AI API 解决冲突"""
    if not HAS_REQUESTS:
        print("⚠️ requests 库未安装，跳过 AI API 调用")
        return None
    
    api_key = os.environ.get(model_config.get('api_key_env', ''))
    if not api_key:
        return None
    
    base_url = model_config.get('base_url', '')
    model = model_config.get('model', '')
    
    if not base_url or not model:
        return None
    
    try:
        response = requests.post(
            f"{base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": model,
                "messages": [
                    {"role": "system", "content": "你是一个代码合并专家。请帮助解决Git冲突，保留两边的重要内容。只输出合并后的代码，不要解释。"},
                    {"role": "user", "content": prompt}
                ],
                "max_tokens": 4096,
                "temperature": 0.1
            },
            timeout=60
        )
        
        if response.status_code == 200:
            return response.json()['choices'][0]['message']['content']
        else:
            print(f"API 错误: {response.status_code}")
            return None
    except Exception as e:
        print(f"API 调用异常: {e}")
        return None

def resolve_conflict_with_ai(file_path: str, content: str, model_config: Dict) -> Optional[str]:
    """使用 AI 解决单个文件的冲突"""
    conflicts = parse_conflict_markers(content)
    
    if not conflicts:
        return content
    
    prompt = f"""请解决以下文件中的 Git 冲突。

文件: {file_path}

冲突内容:
```
{content}
```

规则:
1. 保留上游（upstream）的重要更新
2. 保留本地定制的配置（如工作流中的AI配置）
3. 如果两边都有重要内容，智能合并
4. 只输出合并后的完整文件内容，不要解释

合并后的内容:"""

    return call_ai_api(prompt, model_config)

def get_available_model() -> Optional[Dict]:
    """获取可用的 AI 模型配置"""
    model_configs = [
        {
            'name': 'deepseek',
            'api_key_env': 'DEEPSEEK_API_KEY',
            'base_url': 'https://api.deepseek.com',
            'model': 'deepseek-chat'
        },
        {
            'name': 'openai',
            'api_key_env': 'OPENAI_API_KEY',
            'base_url': 'https://api.openai.com/v1',
            'model': 'gpt-4o'
        },
        {
            'name': 'zhipu',
            'api_key_env': 'ZHIPU_API_KEY',
            'base_url': 'https://open.bigmodel.cn/api/paas/v4',
            'model': 'glm-4'
        },
        {
            'name': 'moonshot',
            'api_key_env': 'MOONSHOT_API_KEY',
            'base_url': 'https://api.moonshot.cn/v1',
            'model': 'moonshot-v1-8k'
        },
    ]
    
    for config in model_configs:
        if os.environ.get(config['api_key_env']):
            return config
    
    return None

def simple_merge(file_path: str, content: str) -> str:
    """简单的合并策略：优先保留上游变更"""
    # 移除冲突标记，保留上游内容
    pattern = r'<<<<<<< .*?\n.*?\n=======\n(.*?)\n>>>>>>> .*?\n'
    return re.sub(pattern, r'\1\n', content, flags=re.DOTALL)

def main():
    """主函数"""
    print("=" * 50)
    print("🔄 Track 2: Python AI 冲突解决")
    print("=" * 50)
    
    # 检查是否有冲突
    conflicted_files = get_conflicted_files()
    
    if not conflicted_files:
        print("✅ 没有检测到冲突文件")
        return 0
    
    print(f"📋 检测到 {len(conflicted_files)} 个冲突文件:")
    for f in conflicted_files:
        print(f"  - {f}")
    
    # 获取可用的 AI 模型
    model_config = get_available_model()
    
    if model_config:
        print(f"\n🤖 使用模型: {model_config['name']}/{model_config['model']}")
    else:
        print("\n⚠️ 没有可用的 AI 模型，使用简单合并策略")
    
    # 解决每个冲突文件
    resolved_count = 0
    for file_path in conflicted_files:
        print(f"\n📝 处理: {file_path}")
        
        content = get_conflict_content(file_path)
        
        if model_config and HAS_REQUESTS:
            resolved_content = resolve_conflict_with_ai(file_path, content, model_config)
        else:
            resolved_content = simple_merge(file_path, content)
        
        if resolved_content:
            # 写回文件
            try:
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(resolved_content)
                print(f"  ✅ 已解决")
                resolved_count += 1
            except Exception as e:
                print(f"  ❌ 写入失败: {e}")
        else:
            # AI 解决失败，使用简单合并
            resolved_content = simple_merge(file_path, content)
            try:
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(resolved_content)
                print(f"  ⚠️ 使用简单合并")
                resolved_count += 1
            except Exception as e:
                print(f"  ❌ 写入失败: {e}")
    
    # 添加解决后的文件
    print("\n📦 暂存解决后的文件...")
    for file_path in conflicted_files:
        run_git_command(f"git add {file_path}")
    
    print(f"\n✅ 成功解决 {resolved_count}/{len(conflicted_files)} 个冲突文件")
    
    if resolved_count == len(conflicted_files):
        return 0
    else:
        return 1

if __name__ == "__main__":
    sys.exit(main())
