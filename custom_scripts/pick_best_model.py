#!/usr/bin/env python3
"""
模型选择脚本 - 智能选择最佳AI模型，支持动态幻觉评分
用于上游同步冲突解决

幻觉评分机制:
- 每次AI运行后检测是否产生幻觉
- 幻觉类型: 文件数过多、行数过多、语法错误、敏感文件等
- 累计评分存储在 .ai_hallucination_scores.json
- 根据评分动态调整模型优先级
"""

import os
import sys
import json
import time
import subprocess
from pathlib import Path
from typing import Optional, Dict, List, Tuple
from datetime import datetime, timedelta

# ===== 配置 =====
HALLUCINATION_SCORES_FILE = ".ai_hallucination_scores.json"
MAX_SCORE_AGE_DAYS = 30  # 评分有效期（天）
HALLUCINATION_PENALTY = {
    "too_many_files": 50,      # 文件数过多
    "too_many_lines": 30,      # 行数过多
    "syntax_error": 40,        # 语法错误
    "sensitive_files": 100,    # 敏感文件泄露
    "build_failure": 35,       # 构建失败
    "no_changes": 10,          # 无实际变更
    "unrelated_content": 45,   # 无关内容
}
MAX_TOTAL_PENALTY = 200  # 单次最大扣分

# 模型基础优先级配置（按质量排序）
BASE_MODEL_PRIORITY = [
    # 第一梯队：顶级模型
    {"provider": "deepseek", "model": "deepseek-chat", "base_priority": 100, "max_tokens": 64000},
    {"provider": "zhipu", "model": "glm-4-plus", "base_priority": 95, "max_tokens": 128000},
    {"provider": "qwen", "model": "qwen-max", "base_priority": 90, "max_tokens": 32000},
    
    # 第二梯队：高质量模型
    {"provider": "openai", "model": "gpt-4o", "base_priority": 85, "max_tokens": 128000},
    {"provider": "anthropic", "model": "claude-3-5-sonnet", "base_priority": 85, "max_tokens": 200000},
    {"provider": "moonshot", "model": "moonshot-v1-8k", "base_priority": 80, "max_tokens": 8192},
    
    # 第三梯队：备用模型
    {"provider": "siliconflow", "model": "Qwen/Qwen2.5-72B-Instruct", "base_priority": 70, "max_tokens": 32768},
    {"provider": "bailian", "model": "qwen-turbo", "base_priority": 65, "max_tokens": 8192},
    {"provider": "minimax", "model": "abab6.5-chat", "base_priority": 60, "max_tokens": 24576},
]

# 轻量模型配置（用于简单任务）
LIGHTWEIGHT_MODELS = [
    {"provider": "deepseek", "model": "deepseek-chat", "base_priority": 100},
    {"provider": "moonshot", "model": "moonshot-v1-8k", "base_priority": 90},
    {"provider": "siliconflow", "model": "Qwen/Qwen2.5-7B-Instruct", "base_priority": 80},
]


def get_scores_file_path() -> Path:
    """获取评分文件路径"""
    # 优先使用仓库根目录
    repo_root = Path.cwd()
    return repo_root / HALLUCINATION_SCORES_FILE


def load_hallucination_scores() -> Dict:
    """加载幻觉评分"""
    scores_file = get_scores_file_path()
    
    if not scores_file.exists():
        return {"models": {}, "last_updated": None, "history": []}
    
    try:
        with open(scores_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"⚠️ 加载评分文件失败: {e}")
        return {"models": {}, "last_updated": None, "history": []}


def save_hallucination_scores(scores: Dict) -> bool:
    """保存幻觉评分"""
    scores_file = get_scores_file_path()
    
    try:
        scores["last_updated"] = datetime.now().isoformat()
        with open(scores_file, 'w', encoding='utf-8') as f:
            json.dump(scores, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"⚠️ 保存评分文件失败: {e}")
        return False


def cleanup_old_scores(scores: Dict) -> Dict:
    """清理过期的评分记录"""
    cutoff_date = datetime.now() - timedelta(days=MAX_SCORE_AGE_DAYS)
    
    # 清理历史记录
    if "history" in scores:
        scores["history"] = [
            h for h in scores["history"]
            if datetime.fromisoformat(h.get("timestamp", "2000-01-01")) > cutoff_date
        ]
    
    # 重新计算模型评分
    model_totals = {}
    for h in scores.get("history", []):
        model = h.get("model")
        penalty = h.get("penalty", 0)
        if model:
            model_totals[model] = model_totals.get(model, 0) + penalty
    
    scores["models"] = model_totals
    
    return scores


def record_hallucination(model: str, hallucination_type: str, details: Dict = None) -> bool:
    """
    记录一次幻觉事件
    
    Args:
        model: 模型名称 (如 "deepseek/deepseek-chat")
        hallucination_type: 幻觉类型 (见 HALLUCINATION_PENALTY)
        details: 详细信息
    
    Returns:
        是否记录成功
    """
    scores = load_hallucination_scores()
    scores = cleanup_old_scores(scores)
    
    penalty = HALLUCINATION_PENALTY.get(hallucination_type, 10)
    
    # 创建历史记录
    record = {
        "model": model,
        "type": hallucination_type,
        "penalty": penalty,
        "timestamp": datetime.now().isoformat(),
        "details": details or {}
    }
    
    # 添加到历史
    if "history" not in scores:
        scores["history"] = []
    scores["history"].append(record)
    
    # 更新模型总分
    if "models" not in scores:
        scores["models"] = {}
    scores["models"][model] = scores["models"].get(model, 0) + penalty
    
    print(f"📝 记录幻觉: {model} - {hallucination_type} (-{penalty}分)")
    
    return save_hallucination_scores(scores)


def get_model_effective_priority(model_info: Dict, scores: Dict) -> int:
    """获取模型的有效优先级（基础优先级 - 幻觉扣分）"""
    model_key = f"{model_info['provider']}/{model_info['model']}"
    base_priority = model_info.get("base_priority", 50)
    penalty = scores.get("models", {}).get(model_key, 0)
    
    effective_priority = max(0, base_priority - penalty)
    return effective_priority


def get_available_providers() -> Dict[str, str]:
    """获取可用的API提供商"""
    providers = {}
    
    key_mapping = {
        "deepseek": "DEEPSEEK_API_KEY",
        "openai": "OPENAI_API_KEY",
        "zhipu": "ZHIPU_API_KEY",
        "moonshot": "MOONSHOT_API_KEY",
        "siliconflow": "SILICONFLOW_API_KEY",
        "bailian": "BAILIAN_API_KEY",
        "qwen": "DASHSCOPE_API_KEY",
        "xai": "XAI_API_KEY",
        "minimax": "MINIMAX_API_KEY",
        "nvidia": "NVIDIA_NIM_API_KEY",
    }
    
    for provider, key_name in key_mapping.items():
        if os.environ.get(key_name):
            providers[provider] = os.environ[key_name]
    
    return providers


def check_model_health(provider: str, api_key: str) -> bool:
    """简单检查模型是否可用"""
    if not api_key or len(api_key) < 10:
        return False
    return True


def select_best_model_with_scores(
    available_providers: Dict[str, str], 
    model_list: List[Dict],
    scores: Dict
) -> Optional[Dict]:
    """
    根据幻觉评分选择最佳模型
    
    返回包含有效优先级的模型信息
    """
    candidates = []
    
    for model_info in model_list:
        provider = model_info["provider"]
        if provider in available_providers:
            api_key = available_providers[provider]
            if check_model_health(provider, api_key):
                effective_priority = get_model_effective_priority(model_info, scores)
                candidates.append({
                    **model_info,
                    "effective_priority": effective_priority
                })
    
    if not candidates:
        return None
    
    # 按有效优先级排序
    candidates.sort(key=lambda x: x["effective_priority"], reverse=True)
    
    # 返回最高优先级的模型
    best = candidates[0]
    
    # 打印排序结果（调试用）
    print("\n📊 模型优先级排序:")
    for i, c in enumerate(candidates[:5]):
        model_key = f"{c['provider']}/{c['model']}"
        penalty = scores.get("models", {}).get(model_key, 0)
        print(f"  {i+1}. {model_key}: {c['effective_priority']}分 (基础{c['base_priority']} - 扣分{penalty})")
    
    return best


def generate_opencode_config(model_info: Dict) -> Dict:
    """生成 OpenCode 配置"""
    provider = model_info["provider"]
    model = model_info["model"]
    
    config = {
        "model": f"{provider}/{model}",
        "providers": {
            provider: {
                "apiKey": f"${{{provider.upper()}_API_KEY}}",
            }
        }
    }
    
    # 添加特定provider的配置
    if provider == "deepseek":
        config["providers"]["deepseek"]["baseURL"] = "https://api.deepseek.com"
    elif provider == "zhipu":
        config["providers"]["zhipu"]["baseURL"] = "https://open.bigmodel.cn/api/paas/v4"
    elif provider == "moonshot":
        config["providers"]["moonshot"]["baseURL"] = "https://api.moonshot.cn/v1"
    elif provider == "siliconflow":
        config["providers"]["siliconflow"]["baseURL"] = "https://api.siliconflow.cn/v1"
    elif provider == "minimax":
        config["providers"]["minimax"]["baseURL"] = "https://api.minimax.chat/v1"
    
    return config


def print_scores_summary(scores: Dict):
    """打印评分摘要"""
    print("\n" + "=" * 50)
    print("📋 幻觉评分汇总")
    print("=" * 50)
    
    if not scores.get("models"):
        print("暂无评分记录")
        return
    
    for model, penalty in sorted(scores["models"].items(), key=lambda x: -x[1]):
        print(f"  {model}: 累计扣分 {penalty}")
    
    if scores.get("last_updated"):
        print(f"\n最后更新: {scores['last_updated']}")


def main():
    """主函数"""
    # 解析参数
    is_small = "--small" in sys.argv
    output_config = "--opencode-config" in sys.argv
    show_scores = "--show-scores" in sys.argv
    record_type = None
    record_model = None
    
    # 解析记录幻觉的参数
    if "--record" in sys.argv:
        idx = sys.argv.index("--record")
        if idx + 2 < len(sys.argv):
            record_model = sys.argv[idx + 1]
            record_type = sys.argv[idx + 2]
    
    # 如果是记录幻觉模式
    if record_model and record_type:
        success = record_hallucination(record_model, record_type)
        return 0 if success else 1
    
    # 如果是显示评分模式
    if show_scores:
        scores = load_hallucination_scores()
        print_scores_summary(scores)
        return 0
    
    # 正常模式：选择最佳模型
    available_providers = get_available_providers()
    
    if not available_providers:
        if output_config:
            print(json.dumps({}))
        else:
            print("NO_MODEL_AVAILABLE")
        return 1
    
    # 加载并清理评分
    scores = load_hallucination_scores()
    scores = cleanup_old_scores(scores)
    
    # 选择模型
    model_list = LIGHTWEIGHT_MODELS if is_small else BASE_MODEL_PRIORITY
    best_model = select_best_model_with_scores(available_providers, model_list, scores)
    
    if not best_model:
        if output_config:
            print(json.dumps({}))
        else:
            print("NO_MODEL_AVAILABLE")
        return 1
    
    # 输出结果
    if output_config:
        config = generate_opencode_config(best_model)
        print(json.dumps(config, indent=2))
    else:
        print(best_model["model"])
    
    # 保存清理后的评分
    save_hallucination_scores(scores)
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
