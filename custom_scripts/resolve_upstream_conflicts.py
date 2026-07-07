#!/usr/bin/env python3
"""
AI 冲突解决脚本 - Track 2
使用 Python + AI API 解决上游同步冲突
支持登录页/排行榜移植区域冲突检测
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

# 登录页/排行榜移植相关文件模式
SIGNIN_LEADERBOARD_PATTERNS = [
    r"src/routes/auth/signin/",
    r"src/features/Auth/SignIn/",
    r"src/features/Leaderboard/",
    r"src/services/leaderboardService",
    r"src/spa/router/authRouter",
    r"locales/.*/auth\.json",
]

LEADERBOARD_CONTEXT = """
⚠️ 重要前提：本 fork 已在登录页移植了大模型排行榜功能！

涉及文件说明：
- src/routes/auth/signin/_layout/index.tsx — 登录页布局：左侧登录表单 Outlet + 右侧 LeaderboardPanel
- src/features/Leaderboard/ — 排行榜面板组件
- src/services/leaderboardService.ts — 排行榜数据服务（lmarena.ai LMSYS Chatbot Arena）
- src/spa/router/authRouter.config.tsx — SPA 路由，signin 改为嵌套结构（父路由 _layout + 子路由 index）
- locales/*/auth.json — 翻译文件，leaderboard.* 开头的 key 是排行榜翻译

解决冲突时遵守：
1. 保留 src/features/Leaderboard/ 和 src/services/leaderboardService.ts 全部代码
2. 保留 _layout 中左侧表单 Outlet + 右侧 LeaderboardPanel 的布局
3. 保留 authRouter 中 signin 的嵌套路由结构
4. 保留 locales/*/auth.json 中 leaderboard.* 开头的翻译 key
5. 上游改 SignIn 组件本身（UX 审计、样式）→ 采纳上游，但确保排行榜布局不受影响
6. _layout/index.tsx 冲突 → 优先保留 fork 的排行榜布局，只合并上游对非排行榜部分的改动
7. 上游改动与排行榜无冲突（如登录表单逻辑）→ 直接采纳上游
"""

def is_signin_leaderboard_file(file_path: str) -> bool:
    """检测文件是否涉及登录页/排行榜移植区域"""
    for pattern in SIGNIN_LEADERBOARD_PATTERNS:
        if re.search(pattern, file_path):
            return True
    return False

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

def resolve_conflict_with_ai(file_path: str, content: str, model_config: Dict, has_leaderboard_context: bool = False) -> Optional[str]:
    """使用 AI 解决单个文件的冲突"""
    conflicts = parse_conflict_markers(content)
    
    if not conflicts:
        return content
    
    # 构建提示词
    prompt_parts = ["请解决以下文件中的 Git 冲突。", ""]
    
    if has_leaderboard_context:
        prompt_parts.append(LEADERBOARD_CONTEXT)
        prompt_parts.append("")
    
    prompt_parts.append(f"文件: {file_path}")
    prompt_parts.append("")
    prompt_parts.append("冲突内容:")
    prompt_parts.append("```")
    prompt_parts.append(content)
    prompt_parts.append("```")
    prompt_parts.append("")
    
    if has_leaderboard_context:
        prompt_parts.append("请严格遵守上述前提条件解决冲突。只输出合并后的完整文件内容，不要解释。")
    else:
        prompt_parts.append("规则:")
        prompt_parts.append("1. 保留上游（upstream）的重要更新")
        prompt_parts.append("2. 保留本地定制的配置")
        prompt_parts.append("3. 如果两边都有重要内容，智能合并")
        prompt_parts.append("4. 只输出合并后的完整文件内容，不要解释")
    
    prompt_parts.append("")
    prompt_parts.append("合并后的内容:")
    
    prompt = "\n".join(prompt_parts)
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
        marker = "🔐 [登录页/排行榜]" if is_signin_leaderboard_file(f) else ""
        print(f"  - {f} {marker}")
    
    # 检测是否涉及登录页/排行榜
    has_leaderboard = any(is_signin_leaderboard_file(f) for f in conflicted_files)
    if has_leaderboard:
        print("\n⚠️ 检测到登录页/排行榜移植区域冲突，将向 AI 提供额外上下文")
    
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
        
        # 判断当前文件是否属于登录页/排行榜区域
        file_is_leaderboard = is_signin_leaderboard_file(file_path)
        
        if model_config and HAS_REQUESTS:
            resolved_content = resolve_conflict_with_ai(file_path, content, model_config, file_is_leaderboard)
        else:
            resolved_content = simple_merge(file_path, content)
        
        if resolved_content:
            # 写回文件
            try:
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(resolved_content)
                status = "✅ 已解决" + (" (含排行榜上下文)" if file_is_leaderboard else "")
                print(f"  {status}")
                resolved_count += 1
            except Exception as e:
                print(f"  ❌ 写入失败: {e}")
        else:
            # AI 解决失败，使用简单合并
            resolved_content = simple_merge(file_path, content)
            try:
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(resolved_content)
                status = "⚠️ 使用简单合并" + (" (登录页区域，注意保留排行榜)" if file_is_leaderboard else "")
                print(f"  {status}")
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
