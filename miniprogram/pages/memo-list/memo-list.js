// pages/memo-list/memo-list.js
Page({
  data: {
    memoList: [],           // 所有备忘录
    filterType: 'pending',  // 筛选：all/pending/completed
    todayMemos: [],         // 今日
    tomorrowMemos: [],      // 明天
    thisWeekMemos: [],      // 本周
    futureMemos: [],        // 未来
  },

  onLoad(options) {
    this.loadMemoList();
  },

  onShow() {
    // 每次显示页面时刷新数据
    this.loadMemoList();
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadMemoList();
    setTimeout(() => {
      wx.stopPullDownRefresh();
    }, 1000);
  },

  // 加载备忘录列表
  loadMemoList() {
    wx.showLoading({
      title: '加载中...',
      mask: true
    });

    const db = wx.cloud.database();
    const _ = db.command;

    // 查询所有未删除的备忘录
    db.collection('memos')
      .where({
        isDeleted: _.neq(true)
      })
      .orderBy('reminderTime', 'asc')
      .get({
        success: (res) => {
          console.log('加载备忘录成功', res);

          // 处理数据，添加显示字段
          const memoList = res.data.map(memo => {
            return this.processMemoData(memo);
          });

          this.setData({
            memoList: memoList
          }, () => {
            // 分类并筛选
            this.categorizeMemos();
            wx.hideLoading();
          });
        },
        fail: (err) => {
          console.error('加载备忘录失败', err);
          wx.hideLoading();

          // 判断是否是集合不存在的错误
          if (err.errCode === -502005 || err.errMsg.includes('collection not exists')) {
            wx.showModal({
              title: '数据库未初始化',
              content: '备忘录功能需要先创建数据库集合。\n\n请在微信开发者工具中：\n1. 点击"云开发"\n2. 进入"数据库"\n3. 点击"+"创建集合\n4. 集合名称输入：memos',
              showCancel: false,
              confirmText: '我知道了'
            });
          } else {
            wx.showToast({
              title: '加载失败',
              icon: 'none'
            });
          }

          // 设置空数据，避免页面报错
          this.setData({
            memoList: [],
            todayMemos: [],
            tomorrowMemos: [],
            thisWeekMemos: [],
            futureMemos: []
          });
        }
      });
  },

  // 处理备忘录数据
  processMemoData(memo) {
    const reminderTime = new Date(memo.reminderTime);

    // 优先级标签
    const priorityMap = {
      1: '低',
      2: '中',
      3: '高'
    };

    // 格式化时间
    const timeStr = this.formatTime(reminderTime);
    const dateStr = this.formatDate(reminderTime);

    return {
      ...memo,
      priorityLabel: priorityMap[memo.priority] || '中',
      reminderTimeStr: timeStr,
      reminderDateStr: dateStr
    };
  },

  // 按时间分类
  categorizeMemos() {
    const { memoList, filterType } = this.data;

    // 先筛选
    let filteredList = memoList;
    if (filterType === 'pending') {
      filteredList = memoList.filter(m => !m.isCompleted);
    } else if (filterType === 'completed') {
      filteredList = memoList.filter(m => m.isCompleted);
    }

    const today = [];
    const tomorrow = [];
    const thisWeek = [];
    const future = [];

    filteredList.forEach(memo => {
      const category = this.categorizeByTime(memo.reminderTime);

      switch (category) {
        case 'today':
          today.push(memo);
          break;
        case 'tomorrow':
          tomorrow.push(memo);
          break;
        case 'thisWeek':
          thisWeek.push(memo);
          break;
        case 'future':
          future.push(memo);
          break;
      }
    });

    this.setData({
      todayMemos: today,
      tomorrowMemos: tomorrow,
      thisWeekMemos: thisWeek,
      futureMemos: future
    });
  },

  // 判断备忘录属于哪个时间段
  categorizeByTime(reminderTime) {
    const now = new Date();
    const reminder = new Date(reminderTime);

    // 今天
    if (this.isSameDay(now, reminder)) {
      return 'today';
    }

    // 明天
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (this.isSameDay(tomorrow, reminder)) {
      return 'tomorrow';
    }

    // 本周
    if (this.isThisWeek(reminder)) {
      return 'thisWeek';
    }

    // 未来
    return 'future';
  },

  // 判断是否同一天
  isSameDay(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate();
  },

  // 判断是否本周
  isThisWeek(date) {
    const now = new Date();
    const target = new Date(date);

    // 获取本周一的日期
    const monday = new Date(now);
    const day = monday.getDay() || 7; // 周日为0，转换为7
    monday.setDate(monday.getDate() - day + 1);
    monday.setHours(0, 0, 0, 0);

    // 获取本周日的日期
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return target >= monday && target <= sunday;
  },

  // 格式化时间（HH:MM）
  formatTime(date) {
    const d = new Date(date);
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  },

  // 格式化日期（MM-DD 周X）
  formatDate(date) {
    const d = new Date(date);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const weekDay = weekDays[d.getDay()];
    return `${month}-${day} ${weekDay}`;
  },

  // 筛选切换
  onFilterChange(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({
      filterType: type
    }, () => {
      this.categorizeMemos();
    });
  },

  // 切换完成状态
  toggleComplete(e) {
    const id = e.currentTarget.dataset.id;
    const isCompleted = e.currentTarget.dataset.completed;

    console.log('切换完成状态', id, isCompleted);

    const db = wx.cloud.database();

    db.collection('memos')
      .doc(id)
      .update({
        data: {
          isCompleted: !isCompleted,
          completedTime: !isCompleted ? new Date() : null,
          updateTime: new Date()
        },
        success: () => {
          console.log('状态更新成功');
          this.loadMemoList();
        },
        fail: (err) => {
          console.error('状态更新失败', err);
          wx.showToast({
            title: '操作失败',
            icon: 'none'
          });
        }
      });
  },

  // 跳转到编辑页
  goToEdit(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/memo-edit/memo-edit?id=${id}`
    });
  },

  // 跳转到新增页
  goToAdd() {
    wx.navigateTo({
      url: '/pages/memo-edit/memo-edit'
    });
  }
});
