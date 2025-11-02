import os
import re

# 定义颜色映射
color_map = {
    '#f5f5f5': '#F0F4EE',
    '#ffffff': '#FAFBF8',
    '#333': '#4A5248',
    '#666': '#6B7A68',
    '#999': '#8A9580',
    '#1AAD19': '#A8B5A0',
    '#52c41a': '#B8C5B0',
    '#1296db': '#8A9985',
    '#f0f0f0': '#D5E0CE',
    '#e8f5e9': '#E8F0E5',
    '#f0f9f1': '#E8F0E5',
    '#f8f8f8': '#F0F4EE',
    '#f8f9fa': '#F0F4EE',
    '#fafafa': '#F0F4EE',
    '#e9ecef': '#D5E0CE',
    '#e0e0e0': '#D5E0CE',
    '#ccc': '#C8D5C0',
    '#ddd': '#C8D5C0'
}

base_path = r'F:\mcp\claude\TimeRecord\miniprogram\pages'

# WXSS文件列表
wxss_files = [
    'daily/daily.wxss',
    'weekly/weekly.wxss',
    'monthly/monthly.wxss',
    'settings/settings.wxss',
    'tag-manage/tag-manage.wxss',
    'template-manage/template-manage.wxss',
    'data-stats/data-stats.wxss',
    'about/about.wxss'
]

# JSON文件列表
json_files = [
    'daily/daily.json',
    'weekly/weekly.json',
    'monthly/monthly.json',
    'settings/settings.json',
    'tag-manage/tag-manage.json',
    'template-manage/template-manage.json',
    'data-stats/data-stats.json',
    'about/about.json'
]

def replace_colors_in_wxss(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # 替换颜色
        for old_color, new_color in color_map.items():
            content = re.sub(re.escape(old_color), new_color, content, flags=re.IGNORECASE)

        # 特殊处理 background-color: white
        content = re.sub(r'background-color:\s*white', 'background-color: #FAFBF8', content, flags=re.IGNORECASE)

        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)

        print(f'✓ 已处理: {file_path}')
        return True
    except Exception as e:
        print(f'✗ 处理失败 {file_path}: {e}')
        return False

def update_json_config(file_path):
    try:
        import json
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        if 'navigationBarBackgroundColor' in data:
            data['navigationBarBackgroundColor'] = '#F0F4EE'
        if 'backgroundColor' in data:
            data['backgroundColor'] = '#F0F4EE'

        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        print(f'✓ 已处理JSON: {file_path}')
        return True
    except Exception as e:
        print(f'✗ 处理JSON失败 {file_path}: {e}')
        return False

# 处理WXSS文件
print('开始处理WXSS文件...')
for file in wxss_files:
    file_path = os.path.join(base_path, file)
    replace_colors_in_wxss(file_path)

# 处理JSON文件
print('\n开始处理JSON文件...')
for file in json_files:
    file_path = os.path.join(base_path, file)
    update_json_config(file_path)

print('\n✨ 所有文件处理完成！')
