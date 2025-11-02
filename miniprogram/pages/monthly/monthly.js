// pages/monthly/monthly.js
Page({
  data: {
    // 当前月份
    currentYear: 0,
    currentMonth: 0,
    monthStr: '',
    yearStr: '',

    // 日历数据
    weekdayLabels: ['日', '一', '二', '三', '四', '五', '六'],
    calendarDays: [],

    // 周趋势数据
    weekStats: [],

    // 统计数据
    stats: {
      totalRecords: 0,
      totalHours: 0,
      activeDays: 0,
      tagStats: []
    },

    // 月总结
    summary: {
      content: '',
      _id: null
    }
  },

  onLoad(options) {
    // 设置当前月份
    this.setCurrentMonth();

    // 加载数据
    this.loadMonthlyData();
  },

  onShow() {
    // 每次显示页面时刷新数据
    this.loadMonthlyData();
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadMonthlyData();
    setTimeout(() => {
      wx.stopPullDownRefresh();
    }, 1000);
  },

  // 设置当前月份（默认本月）
  setCurrentMonth(year, month) {
    const targetDate = new Date();

    if (year !== undefined && month !== undefined) {
      targetDate.setFullYear(year);
      targetDate.setMonth(month);
    }

    const currentYear = targetDate.getFullYear();
    const currentMonth = targetDate.getMonth();

    this.setData({
      currentYear: currentYear,
      currentMonth: currentMonth,
      monthStr: `${currentMonth + 1}月`,
      yearStr: `${currentYear}年`
    });
  },

  // 上一月
  prevMonth() {
    let year = this.data.currentYear;
    let month = this.data.currentMonth - 1;

    if (month < 0) {
      month = 11;
      year--;
    }

    this.setCurrentMonth(year, month);
    this.loadMonthlyData();
  },

  // 下一月
  nextMonth() {
    let year = this.data.currentYear;
    let month = this.data.currentMonth + 1;

    // 不允许查看未来月份
    const today = new Date();
    const nextMonthDate = new Date(year, month, 1);

    if (nextMonthDate > today) {
      wx.showToast({
        title: '不能查看未来',
        icon: 'none'
      });
      return;
    }

    if (month > 11) {
      month = 0;
      year++;
    }

    this.setCurrentMonth(year, month);
    this.loadMonthlyData();
  },

  // 加载本月数据
  loadMonthlyData() {
    wx.showLoading({
      title: '加载中...',
      mask: true
    });

    Promise.all([
      this.loadRecords(),
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

  // 加载本月记录
  loadRecords() {
    return new Promise((resolve, reject) => {
      const db = wx.cloud.database();
      const _ = db.command;

      // 计算本月的开始和结束时间
      const monthStart = new Date(this.data.currentYear, this.data.currentMonth, 1);
      monthStart.setHours(0, 0, 0, 0);

      const monthEnd = new Date(this.data.currentYear, this.data.currentMonth + 1, 0);
      monthEnd.setHours(23, 59, 59, 999);

      db.collection('records')
        .where({
          startTime: _.gte(monthStart).and(_.lte(monthEnd)),
          isDeleted: _.neq(true)
        })
        .orderBy('startTime', 'asc')
        .get({
          success: (res) => {
            console.log('查询成功', res);

            // 按日期分组统计
            const dailyStats = this.groupByDay(res.data);

            // 生成日历数据
            const calendarDays = this.generateCalendar(dailyStats);

            // 计算月统计
            const stats = this.calculateMonthStats(res.data, dailyStats);

            // 计算周趋势
            const weekStats = this.calculateWeekStats(res.data);

            this.setData({
              calendarDays: calendarDays,
              stats: stats,
              weekStats: weekStats
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
        duration = Math.floor((endTime - startTime) / 60000);
      }

      dailyMap[dateStr].records.push(record);
      dailyMap[dateStr].totalMinutes += duration;
    });

    return dailyMap;
  },

  // 生成日历数据
  generateCalendar(dailyStats) {
    const year = this.data.currentYear;
    const month = this.data.currentMonth;

    // 本月第一天
    const firstDay = new Date(year, month, 1);
    const firstDayWeekday = firstDay.getDay();

    // 本月最后一天
    const lastDay = new Date(year, month + 1, 0);
    const lastDate = lastDay.getDate();

    // 今天
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const calendarDays = [];

    // 填充上月末尾的日期
    if (firstDayWeekday > 0) {
      const prevMonthLastDay = new Date(year, month, 0);
      const prevMonthLastDate = prevMonthLastDay.getDate();

      for (let i = firstDayWeekday - 1; i >= 0; i--) {
        const day = prevMonthLastDate - i;
        const date = new Date(year, month - 1, day);
        const dateStr = this.formatDate(date);

        calendarDays.push({
          day: day,
          dateStr: dateStr,
          isCurrentMonth: false,
          isToday: false,
          hasRecords: !!dailyStats[dateStr],
          recordCount: dailyStats[dateStr] ? dailyStats[dateStr].records.length : 0
        });
      }
    }

    // 填充本月日期
    for (let day = 1; day <= lastDate; day++) {
      const date = new Date(year, month, day);
      const dateStr = this.formatDate(date);
      const isToday = date.getTime() === today.getTime();

      calendarDays.push({
        day: day,
        dateStr: dateStr,
        isCurrentMonth: true,
        isToday: isToday,
        hasRecords: !!dailyStats[dateStr],
        recordCount: dailyStats[dateStr] ? dailyStats[dateStr].records.length : 0
      });
    }

    // 填充下月开头的日期（补齐到42个，6行）
    const remainingDays = 42 - calendarDays.length;
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month + 1, day);
      const dateStr = this.formatDate(date);

      calendarDays.push({
        day: day,
        dateStr: dateStr,
        isCurrentMonth: false,
        isToday: false,
        hasRecords: !!dailyStats[dateStr],
        recordCount: dailyStats[dateStr] ? dailyStats[dateStr].records.length : 0
      });
    }

    return calendarDays;
  },

  // 计算月统计
  calculateMonthStats(records, dailyStats) {
    const totalRecords = records.length;

    // 计算活跃天数
    const activeDays = Object.keys(dailyStats).length;

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
      activeDays,
      tagStats
    };
  },

  // 计算周趋势
  calculateWeekStats(records) {
    // 按周分组
    const weekMap = {};

    records.forEach(record => {
      const date = new Date(record.startTime);
      const weekNum = this.getWeekNumber(date);
      const weekKey = `${date.getFullYear()}-W${weekNum}`;

      if (!weekMap[weekKey]) {
        weekMap[weekKey] = {
          weekNum: weekNum,
          year: date.getFullYear(),
          totalMinutes: 0,
          dates: []
        };
      }

      // 计算时长
      if (record.endTime) {
        const startTime = new Date(record.startTime);
        const endTime = new Date(record.endTime);
        const duration = Math.floor((endTime - startTime) / 60000);
        weekMap[weekKey].totalMinutes += duration;
      }

      // 记录日期
      const dateStr = this.formatDate(date);
      if (!weekMap[weekKey].dates.includes(dateStr)) {
        weekMap[weekKey].dates.push(dateStr);
      }
    });

    // 转换为数组并计算百分比
    const weekStats = Object.values(weekMap)
      .sort((a, b) => a.weekNum - b.weekNum);

    // 计算最大值用于百分比
    let maxHours = 0;
    weekStats.forEach(week => {
      const hours = week.totalMinutes / 60;
      if (hours > maxHours) {
        maxHours = hours;
      }
    });

    return weekStats.map(week => {
      const hours = (week.totalMinutes / 60).toFixed(1);
      const percentage = maxHours > 0 ? (parseFloat(hours) / maxHours) * 100 : 0;

      // 计算周的日期范围
      const weekDates = week.dates.sort();
      const firstDate = weekDates[0];
      const lastDate = weekDates[weekDates.length - 1];

      let dateRange = '';
      if (firstDate && lastDate) {
        const first = firstDate.split('-');
        const last = lastDate.split('-');
        dateRange = `${first[1]}/${first[2]}-${last[1]}/${last[2]}`;
      }

      return {
        weekNum: week.weekNum,
        hours: hours,
        percentage: percentage,
        dateRange: dateRange
      };
    });
  },

  // 计算周数
  getWeekNumber(date) {
    const d = new Date(date);
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const days = Math.floor((d - yearStart) / (24 * 60 * 60 * 1000));
    return Math.ceil((days + yearStart.getDay() + 1) / 7);
  },

  // 格式化日期（YYYY-MM-DD）
  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 加载月总结
  loadSummary() {
    return new Promise((resolve, reject) => {
      const db = wx.cloud.database();

      // 使用年-月作为标识
      const monthStr = `${this.data.currentYear}-${String(this.data.currentMonth + 1).padStart(2, '0')}`;

      db.collection('summaries')
        .where({
          type: 'monthly',
          date: monthStr
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
    const monthStr = `${this.data.currentYear}-${String(this.data.currentMonth + 1).padStart(2, '0')}`;

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
            type: 'monthly',
            date: monthStr,
            monthStr: this.data.monthStr,
            yearStr: this.data.yearStr,
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

    // 只允许查看本月的日期
    const targetDate = new Date(date);
    const currentMonth = this.data.currentMonth;

    if (targetDate.getMonth() !== currentMonth) {
      return;
    }

    wx.navigateTo({
      url: `/pages/daily/daily?date=${date}`
    });
  }
});
