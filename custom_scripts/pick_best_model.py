#!/usr/bin/env python3
"""
模型选择脚本 - 智能选择最佳AI模型
用于上游同步冲突解决
"""

import os
import sys
import json
import time
from typing import Optional, Dict, List, Tuple

# 模型优先级配置（按质量排序）
MODEL_PRIORITY = [
    # 第一梯队：顶级模型
    {"provider": "deepseek", "model": "deepseek-chat", "priority": 100, "max_tokens": 64000},
    {"provider": "zhipu", "model": "glm-4-plus", "priority": 95, "max_tokens": 128000},
    {"provider": "qwen", "model": "qwen-max", "priority": 90, "max_tokens": 32000},
    
    # 第二梯队：高质量模型
    {"provider": "openai", "model": "gpt-4o", "priority": 85, "max_tokens": 128000},
    {"provider": "anthropic", "model": "claude-3-5-sonnet", "priority": 85, "max_tokens": 200000},
    {"provider": "moonshot", "model": "moonshot-v1-8k", "priority": 80, "max_tokens": 8192},
    
    # 第三梯队：备用模型
    {"provider": "siliconflow", "model": "Qwen/Qwen2.5-72B-Instruct", "priority": 70, "max_tokens": 32768},
    {"provider": "bailian", "model": "qwen-turbo", "priority": 65, "max_tokens": 8192},
]

# 轻量模型配置（用于简单任务）
LIGHTWEIGHT_MODELS = [
    {"provider": "deepseek", "model": "deepseek-chat", "priority": 100},
    {"provider": "moonshot", "model": "moonshot-v1-8k", "priority": 90},
    {"provider": "siliconflow", "model": "Qwen/Qwen2.5-7B-Instruct", "priority": 80},
]

def get_available_providers() -> Dict[str, str]:
    """获取可用的API提供商"""
    providers = {}
    
    # 检查环境变量中的API密钥
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
    # 这里只做简单的密钥格式检查
    if not api_key or len(api_key) < 10:
        return False
    return True

def select_best_model(available_providers: Dict[str, str], model_list: List[Dict]) -> Optional[Dict]:
    """选择最佳模型"""
    best_model = None
    best_priority = -1
    
    for model_info in model_list:
        provider = model_info["provider"]
        if provider in available_providers:
            api_key = available_providers[provider]
            if check_model_health(provider, api_key):
                if model_info["priority"] > best_priority:
                    best_priority = model_info["priority"]
                    best_model = model_info
    
    return best_model

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
    
    return config

def main():
    """主函数"""
    is_small = "--small" in sys.argv
    output_config = "--opencode-config" in sys.argv
    
    available_providers = get_available_providers()
    
    if not available_providers:
        if output_config:
            print(json.dumps({}))
        else:
            print("NO_MODEL_AVAILABLE")
        return 1
    
    model_list = LIGHTWEIGHT_MODELS if is_small else MODEL_PRIORITY
    best_model = select_best_model(available_providers, model_list)
    
    if not best_model:
        if output_config:
            print(json.dumps({}))
        else:
            print("NO_MODEL_AVAILABLE")
        return 1
    
    if output_config:
        config = generate_opencode_config(best_model)
        print(json.dumps(config, indent=2))
    else:
        print(best_model["model"])
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
