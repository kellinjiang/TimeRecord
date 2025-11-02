// pages/weekly/weekly.js
Page({
  data: {
    // 周信息
    currentWeekStart: null,
    weekRange: '',
    weekNumber: 0,

    // 7天数据
    weekDays: [],

    // 统计数据
    stats: {
      totalRecords: 0,
      totalHours: 0,
      avgHours: 0,
      tagStats: []
    },

    // 周总结
    summary: {
      content: '',
      _id: null
    },

    // 周总结placeholder
    summaryPlaceholder: '回顾本周的收获和思考...\n\n提示：\n• 本周完成了哪些重要任务？\n• 遇到了什么挑战？\n• 下周计划做什么？'
  },

  onLoad(options) {
    // 设置当前周
    this.setCurrentWeek();

    // 加载数据
    this.loadWeeklyData();
  },

  onShow() {
    // 每次显示页面时刷新数据
    this.loadWeeklyData();
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadWeeklyData();
    setTimeout(() => {
      wx.stopPullDownRefresh();
    }, 1000);
  },

  // 设置当前周（默认本周）
  setCurrentWeek(weekStart) {
    let targetDate;

    if (weekStart) {
      targetDate = new Date(weekStart);
    } else {
      // 获取本周一
      targetDate = this.getWeekStart(new Date());
    }

    this.setData({
      currentWeekStart: targetDate
    });

    this.updateWeekInfo(targetDate);
  },

  // 获取某日期所在周的周一
  getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day; // 周日为0，需要回退6天
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  },

  // 更新周信息显示
  updateWeekInfo(weekStart) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    // 格式化周范围
    const startMonth = weekStart.getMonth() + 1;
    const startDay = weekStart.getDate();
    const endMonth = weekEnd.getMonth() + 1;
    const endDay = weekEnd.getDate();

    let weekRange;
    if (startMonth === endMonth) {
      weekRange = `${startMonth}月${startDay}日 - ${endDay}日`;
    } else {
      weekRange = `${startMonth}月${startDay}日 - ${endMonth}月${endDay}日`;
    }

    // 计算周数（今年第几周）
    const weekNumber = this.getWeekNumber(weekStart);

    this.setData({
      weekRange: weekRange,
      weekNumber: weekNumber
    });
  },

  // 计算今年第几周
  getWeekNumber(date) {
    const d = new Date(date);
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const days = Math.floor((d - yearStart) / (24 * 60 * 60 * 1000));
    return Math.ceil((days + yearStart.getDay() + 1) / 7);
  },

  // 上一周
  prevWeek() {
    const current = new Date(this.data.currentWeekStart);
    current.setDate(current.getDate() - 7);
    this.setCurrentWeek(current);
    this.loadWeeklyData();
  },

  // 下一周
  nextWeek() {
    const current = new Date(this.data.currentWeekStart);
    const nextWeek = new Date(current);
    nextWeek.setDate(nextWeek.getDate() + 7);

    // 不允许查看未来的周
    const today = new Date();
    const thisWeekStart = this.getWeekStart(today);

    if (nextWeek > thisWeekStart) {
      wx.showToast({
        title: '不能查看未来',
        icon: 'none'
      });
      return;
    }

    this.setCurrentWeek(nextWeek);
    this.loadWeeklyData();
  },

  // 日期改变（日期选择器）
  onDateChange(e) {
    const selectedDate = new Date(e.detail.value);
    const weekStart = this.getWeekStart(selectedDate);
    this.setCurrentWeek(weekStart);
    this.loadWeeklyData();
  },

  // 加载本周数据
  loadWeeklyData() {
    wx.showLoading({
      title: '加载中...',
      mask: true
    });

    Promise.all([
      this.loadWeekRecords(),
      this.loadSummary()
    ]).then(() => {
      wx.hideLoading();
    }).catch(err => {
      console.error('加载失败', err);
      wx.hideLoading();
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    });
  },

  // 加载本周记录
  loadWeekRecords() {
    return new Promise((resolve, reject) => {
      const db = wx.cloud.database();
      const _ = db.command;

      // 计算本周的开始和结束时间
      const weekStart = new Date(this.data.currentWeekStart);
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      weekEnd.setHours(0, 0, 0, 0);

      db.collection('records')
        .where({
          startTime: _.gte(weekStart).and(_.lt(weekEnd)),
          isDeleted: _.neq(true)
        })
        .orderBy('startTime', 'asc')
        .get({
          success: (res) => {
            console.log('查询成功', res);

            // 按日期分组统计
            const dailyStats = this.groupByDay(res.data);

            // 生成7天数据
            const weekDays = this.generateWeekDays(dailyStats);

            // 计算周统计
            const stats = this.calculateWeekStats(res.data);

            this.setData({
              weekDays: weekDays,
              stats: stats
            });

            resolve();
          },
          fail: (err) => {
            console.error('查询失败', err);
            reject(err);
          }
        });
    });
  },

  // 按日期分组
  groupByDay(records) {
    const dailyMap = {};

    records.forEach(record => {
      const date = new Date(record.startTime);
      const dateStr = this.formatDate(date);

      if (!dailyMap[dateStr]) {
        dailyMap[dateStr] = {
          records: [],
          totalMinutes: 0
        };
      }

      // 计算时长
      let duration = 0;
      if (record.endTime) {
        const startTime = new Date(record.startTime);
        const endTime = new Date(record.endTime);
        duration = Math.floor((endTime - startTime) / 60000); // 分钟
      }

      dailyMap[dateStr].records.push(record);
      dailyMap[dateStr].totalMinutes += duration;
    });

    return dailyMap;
  },

  // 生成7天数据
  generateWeekDays(dailyStats) {
    const weekDays = [];
    const weekStart = new Date(this.data.currentWeekStart);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 找出最大时长用于计算百分比
    let maxHours = 0;
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
      const dateStr = this.formatDate(date);
      const dayData = dailyStats[dateStr];

      if (dayData) {
        const hours = parseFloat((dayData.totalMinutes / 60).toFixed(1));
        if (hours > maxHours) {
          maxHours = hours;
        }
      }
    }

    // 生成7天数据
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
      const dateStr = this.formatDate(date);
      const dayData = dailyStats[dateStr];

      const hours = dayData ? parseFloat((dayData.totalMinutes / 60).toFixed(1)) : 0;
      const percentage = maxHours > 0 ? (hours / maxHours) * 100 : 0;

      const isToday = date.getTime() === today.getTime();

      weekDays.push({
        date: dateStr,
        dayLabel: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'][i],
        dateLabel: `${date.getMonth() + 1}/${date.getDate()}`,
        hours: hours,
        percentage: percentage,
        recordCount: dayData ? dayData.records.length : 0,
        isToday: isToday
      });
    }

    return weekDays;
  },

  // 计算周统计
  calculateWeekStats(records) {
    const totalRecords = records.length;

    // 计算总时长（分钟）
    let totalMinutes = 0;
    records.forEach(record => {
      if (record.endTime) {
        const startTime = new Date(record.startTime);
        const endTime = new Date(record.endTime);
        const duration = Math.floor((endTime - startTime) / 60000);
        totalMinutes += duration;
      }
    });

    const totalHours = (totalMinutes / 60).toFixed(1);
    const avgHours = totalRecords > 0 ? (totalMinutes / 60 / 7).toFixed(1) : 0;

    // 计算标签分布
    const tagMap = {};
    records.forEach(record => {
      if (record.tags && record.tags.length > 0) {
        record.tags.forEach(tag => {
          if (!tagMap[tag.name]) {
            tagMap[tag.name] = {
              name: tag.name,
              icon: tag.icon,
              color: tag.color,
              minutes: 0
            };
          }

          // 计算该记录的时长
          if (record.endTime) {
            const startTime = new Date(record.startTime);
            const endTime = new Date(record.endTime);
            const duration = Math.floor((endTime - startTime) / 60000);
            tagMap[tag.name].minutes += duration;
          }
        });
      }
    });

    // 转换为数组并计算百分比和小时
    const tagStats = Object.values(tagMap)
      .sort((a, b) => b.minutes - a.minutes)
      .map(tag => ({
        ...tag,
        hours: (tag.minutes / 60).toFixed(1),
        percentage: totalMinutes > 0 ? ((tag.minutes / totalMinutes) * 100).toFixed(1) : 0
      }));

    return {
      totalRecords,
      totalHours,
      avgHours,
      tagStats
    };
  },

  // 格式化日期（YYYY-MM-DD）
  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 加载周总结
  loadSummary() {
    return new Promise((resolve, reject) => {
      const db = wx.cloud.database();

      // 使用周的开始日期作为标识
      const weekStartStr = this.formatDate(this.data.currentWeekStart);

      db.collection('summaries')
        .where({
          type: 'weekly',
          date: weekStartStr
        })
        .get({
          success: (res) => {
            if (res.data.length > 0) {
              this.setData({
                summary: {
                  content: res.data[0].content || '',
                  _id: res.data[0]._id
                }
              });
            } else {
              this.setData({
                summary: {
                  content: '',
                  _id: null
                }
              });
            }
            resolve();
          },
          fail: (err) => {
            console.error('加载总结失败', err);
            resolve(); // 总结加载失败不影响整体
          }
        });
    });
  },

  // 总结输入
  onSummaryInput(e) {
    this.setData({
      'summary.content': e.detail.value
    });
  },

  // 保存总结
  saveSummary() {
    const content = this.data.summary.content.trim();

    if (!content) {
      // 内容为空，如果有记录则删除
      if (this.data.summary._id) {
        this.deleteSummary();
      }
      return;
    }

    wx.showLoading({
      title: '保存中...',
      mask: true
    });

    const db = wx.cloud.database();
    const weekStartStr = this.formatDate(this.data.currentWeekStart);

    if (this.data.summary._id) {
      // 更新已有总结
      db.collection('summaries')
        .doc(this.data.summary._id)
        .update({
          data: {
            content: content,
            updateTime: new Date()
          },
          success: () => {
            wx.hideLoading();
            wx.showToast({
              title: '保存成功',
              icon: 'success',
              duration: 1500
            });
          },
          fail: (err) => {
            wx.hideLoading();
            wx.showToast({
              title: '保存失败',
              icon: 'none'
            });
            console.error('更新总结失败', err);
          }
        });
    } else {
      // 创建新总结
      db.collection('summaries')
        .add({
          data: {
            type: 'weekly',
            date: weekStartStr,
            weekRange: this.data.weekRange,
            content: content,
            stats: this.data.stats,
            createTime: new Date(),
            updateTime: new Date()
          },
          success: (res) => {
            wx.hideLoading();
            wx.showToast({
              title: '保存成功',
              icon: 'success',
              duration: 1500
            });

            // 更新 _id
            this.setData({
              'summary._id': res._id
            });
          },
          fail: (err) => {
            wx.hideLoading();
            wx.showToast({
              title: '保存失败',
              icon: 'none'
            });
            console.error('创建总结失败', err);
          }
        });
    }
  },

  // 删除总结
  deleteSummary() {
    const db = wx.cloud.database();

    db.collection('summaries')
      .doc(this.data.summary._id)
      .remove({
        success: () => {
          this.setData({
            'summary._id': null
          });
        }
      });
  },

  // 查看某一天
  viewDay(e) {
    const date = e.currentTarget.dataset.date;
    wx.navigateTo({
      url: `/pages/daily/daily?date=${date}`
    });
  }
});
