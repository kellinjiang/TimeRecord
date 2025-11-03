# 备忘录功能设计方案

## 📋 功能概述

在现有时间记录小程序基础上，新增备忘录功能，用于规划未来要做的事情。

**功能定位**：
- 现有功能：记录过去发生的事情（语音录入、时间统计）
- 新增功能：规划未来要做的事情（任务提醒、待办清单）
- 关系：从"记录过去" → "规划未来"，功能互补

---

## 🎯 入口设计（采用组合方案）

### 主入口
- 位置：**"我的"页面菜单项**
- 图标：📝
- 名称：备忘录管理
- 优点：符合现有设计风格，不破坏布局

### 次入口
- 位置：**首页（录音页）顶部"今日待办"快捷卡片**
- 可折叠/展开
- 显示今日待办数量和前3条
- 优点：随时可见，快速访问

---

## 📂 页面结构

```
pages/
  memo-list/          # 备忘录列表页（主页面）
    memo-list.wxml
    memo-list.wxss
    memo-list.js
    memo-list.json

  memo-edit/          # 备忘录编辑页（新增/编辑）
    memo-edit.wxml
    memo-edit.wxss
    memo-edit.js
    memo-edit.json

  index/              # 首页（已有，需修改添加今日待办卡片）
  settings/           # 我的页面（已有，需添加入口）
```

---

## 💾 数据库设计

### 新建集合：`memos`

```javascript
{
  _id: "memo_xxx",
  _openid: "user_openid",           // 用户标识

  // 基础信息
  title: "开会讨论项目进度",          // 备忘录标题（必填）
  content: "需要准备PPT和数据报告",   // 详细内容（可选）

  // 时间相关
  reminderTime: Date,                // 提醒时间（必填）
  isAllDay: false,                   // 是否全天事项

  // 状态相关
  isCompleted: false,                // 是否完成
  completedTime: null,               // 完成时间

  // 分类相关
  priority: 2,                       // 优先级：1-低 2-中 3-高
  tags: [                            // 标签（可复用现有标签系统）
    { name: "工作", icon: "💼", color: "#FF5733" }
  ],

  // 重复设置
  repeatType: "none",                // 重复类型：none/daily/weekly/monthly
  repeatEndTime: null,               // 重复结束时间

  // 时间戳
  createTime: Date,
  updateTime: Date,
  isDeleted: false
}
```

---

## 🎨 UI/UX 设计

### 颜色方案（与现有薄荷绿色系协调）
- 🔴 高优先级：`#FF5733`（红色）
- 🟠 中优先级：`#F39C12`（橙色）
- 🟢 低优先级：`#2ECC71`（绿色）
- ⚪ 已完成：`#999999`（灰色，带删除线）
- 🎨 主色调：`#B8D4C8`（薄荷绿，保持统一）

### 交互设计
1. **列表页**：
   - 左滑显示"编辑/删除"
   - 点击右侧✓图标快速完成
   - 已完成的显示删除线+灰色

2. **编辑页**：
   - 时间选择器：日期+时间组合
   - 优先级：三个按钮切换
   - 标签：多选，显示已选中状态

3. **首页卡片**：
   - 折叠时只显示数量
   - 展开显示前3条
   - 点击跳转到完整列表

---

## 📱 页面功能详细设计

### 1. 备忘录列表页 (memo-list)

#### 界面布局
```
┌─────────────────────────────┐
│  备忘录管理           [+ 新增] │
├─────────────────────────────┤
│  [全部] [未完成] [已完成]      │ ← 筛选标签
├─────────────────────────────┤
│  📅 今天 (2)                  │
│  ┌─────────────────────┐    │
│  │ ⚠️ 高 09:00 开会     │    │
│  │ 讨论项目进度    [✓]  │    │
│  └─────────────────────┘    │
│  ┌─────────────────────┐    │
│  │ 📌 中 15:00 写报告   │    │
│  │ 月度总结报告   [✓]  │    │
│  └─────────────────────┘    │
├─────────────────────────────┤
│  📅 明天 (1)                  │
│  📅 本周 (3)                  │
│  📅 未来 (5)                  │
└─────────────────────────────┘
```

#### 核心数据
```javascript
data: {
  memoList: [],           // 所有备忘录
  filterType: 'pending',  // 筛选：all/pending/completed
  todayMemos: [],         // 今日
  tomorrowMemos: [],      // 明天
  thisWeekMemos: [],      // 本周
  futureMemos: [],        // 未来
  completedMemos: []      // 已完成
}
```

#### 核心函数
```javascript
// 数据加载
loadMemoList()           // 加载所有备忘录
categorizeMemos()        // 按时间分类
filterMemos(type)        // 筛选（全部/未完成/已完成）

// 交互操作
toggleComplete(memoId)   // 标记完成/取消完成
deleteMemo(memoId)       // 删除备忘录
goToEdit(memoId)         // 编辑备忘录
goToAdd()                // 新增备忘录

// 下拉刷新
onPullDownRefresh()      // 刷新列表
```

---

### 2. 备忘录编辑页 (memo-edit)

#### 界面布局
```
┌─────────────────────────────┐
│  [取消]  新增备忘录  [保存]   │
├─────────────────────────────┤
│  标题 *                      │
│  ┌─────────────────────┐    │
│  │ 请输入备忘录标题     │    │
│  └─────────────────────┘    │
├─────────────────────────────┤
│  提醒时间 *                  │
│  ┌─────────────────────┐    │
│  │ 2025-01-15 09:00    │    │
│  └─────────────────────┘    │
├─────────────────────────────┤
│  优先级                      │
│  [ 低 ]  [✓ 中 ]  [ 高 ]    │
├─────────────────────────────┤
│  备注                        │
│  ┌─────────────────────┐    │
│  │ 详细说明...          │    │
│  │                      │    │
│  └─────────────────────┘    │
└─────────────────────────────┘
```

#### 核心数据
```javascript
data: {
  memoId: '',              // 编辑时有值，新增时为空
  formData: {
    title: '',
    content: '',
    reminderTime: '',
    reminderDate: '',      // 日期
    reminderTimeStr: '',   // 时间
    priority: 2,           // 默认中优先级
    tags: []
  },
  canSave: false           // 是否可以保存
}
```

#### 核心函数
```javascript
// 生命周期
onLoad(options)            // 如果是编辑，加载备忘录详情

// 表单处理
onTitleInput(e)            // 标题输入
onContentInput(e)          // 内容输入
onDateChange(e)            // 日期选择
onTimeChange(e)            // 时间选择
onPriorityChange(priority) // 优先级选择

// 数据操作
validateForm()             // 表单验证（标题和时间必填）
saveMemo()                 // 保存备忘录
updateMemo()               // 更新备忘录
cancel()                   // 取消编辑
```

---

### 3. 首页今日待办卡片（修改 index）

#### 界面布局
```
┌─────────────────────────────┐
│  今日待办 (3)         [展开▼] │
│  ┌─────────────────────┐    │
│  │ 09:00 ⚠️ 开会       │    │
│  │ 15:00 📌 写报告     │    │
│  └─────────────────────┘    │
├─────────────────────────────┤
│         录音界面...          │
└─────────────────────────────┘
```

#### 核心数据
```javascript
data: {
  todayMemos: [],          // 今日待办
  showMemoCard: true,      // 是否显示待办卡片
  memoCardExpanded: false  // 卡片是否展开
}
```

#### 核心函数
```javascript
// 数据加载
loadTodayMemos()           // 加载今日待办
toggleMemoCard()           // 折叠/展开卡片
goToMemoList()             // 跳转到备忘录列表
quickComplete(memoId)      // 快速完成
```

---

## 🚀 开发优先级

### Phase 1（MVP - 最小可用版本）✅ 当前阶段
- ✅ 备忘录列表页（基础展示+完成/删除）
- ✅ 备忘录编辑页（标题+时间+优先级）
- ✅ "我的"页面入口
- ✅ 基础数据库操作

### Phase 2（体验优化）
- 首页今日待办卡片
- 标签系统集成
- 重复任务
- 下拉刷新

### Phase 3（高级功能）
- 订阅消息提醒
- 完成率统计
- 语音快速创建

---

## 📝 技术实现要点

### 时间分类算法
```javascript
// 判断备忘录属于哪个时间段
function categorizeByTime(reminderTime) {
  const now = new Date();
  const reminder = new Date(reminderTime);

  // 今天
  if (isSameDay(now, reminder)) return 'today';

  // 明天
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (isSameDay(tomorrow, reminder)) return 'tomorrow';

  // 本周
  if (isThisWeek(reminder)) return 'thisWeek';

  // 未来
  return 'future';
}
```

### 优先级图标映射
```javascript
const priorityConfig = {
  1: { icon: '🟢', label: '低', color: '#2ECC71' },
  2: { icon: '🟠', label: '中', color: '#F39C12' },
  3: { icon: '🔴', label: '高', color: '#FF5733' }
};
```

---

## 📅 开发时间线

- **Day 1**: 创建页面文件、数据库设计
- **Day 2**: 实现列表页和编辑页
- **Day 3**: 集成到"我的"页面，测试联调
- **Day 4**: Phase 2 开发（首页卡片）
- **Day 5**: 优化和bug修复

---

## 🔄 后续扩展方向

1. ⏰ 微信订阅消息提醒
2. 🔄 重复任务支持
3. 🏷️ 与时间记录标签系统打通
4. 📊 完成率统计图表
5. 🎤 语音快速创建备忘录
6. 📤 数据导出功能
7. 📱 小组件支持（iOS）

---

最后更新时间：2025-01-15
