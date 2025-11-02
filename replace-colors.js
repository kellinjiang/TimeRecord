const fs = require('fs');
const path = require('path');

// 定义颜色映射
const colorMap = {
  '#f5f5f5': '#F0F4EE',
  '#ffffff': '#FAFBF8',
  'white': '#FAFBF8',
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
};

// 要处理的文件
const files = [
  'miniprogram/pages/daily/daily.wxss',
  'miniprogram/pages/weekly/weekly.wxss',
  'miniprogram/pages/monthly/monthly.wxss',
  'miniprogram/pages/settings/settings.wxss',
  'miniprogram/pages/tag-manage/tag-manage.wxss',
  'miniprogram/pages/template-manage/template-manage.wxss',
  'miniprogram/pages/data-stats/data-stats.wxss',
  'miniprogram/pages/about/about.wxss'
];

files.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');

    // 替换颜色
    Object.keys(colorMap).forEach(oldColor => {
      const newColor = colorMap[oldColor];
      // 使用全局正则替换
      const regex = new RegExp(oldColor, 'gi');
      content = content.replace(regex, newColor);
    });

    // 特殊处理 white，只替换在 background-color 或 color 属性中的
    content = content.replace(/background-color:\s*white/gi, 'background-color: #FAFBF8');
    content = content.replace(/color:\s*white/gi, 'color: white'); // 保持white用于渐变等

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ 已处理: ${file}`);
  } else {
    console.log(`✗ 文件不存在: ${file}`);
  }
});

// 处理JSON配置文件
const jsonFiles = [
  'miniprogram/pages/daily/daily.json',
  'miniprogram/pages/weekly/weekly.json',
  'miniprogram/pages/monthly/monthly.json',
  'miniprogram/pages/settings/settings.json',
  'miniprogram/pages/tag-manage/tag-manage.json',
  'miniprogram/pages/template-manage/template-manage.json',
  'miniprogram/pages/data-stats/data-stats.json',
  'miniprogram/pages/about/about.json'
];

jsonFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(content);

    if (json.navigationBarBackgroundColor) {
      json.navigationBarBackgroundColor = '#F0F4EE';
    }
    if (json.backgroundColor) {
      json.backgroundColor = '#F0F4EE';
    }

    fs.writeFileSync(filePath, JSON.stringify(json, null, 2), 'utf8');
    console.log(`✓ 已处理JSON: ${file}`);
  }
});

console.log('\n✨ 所有文件处理完成！');
