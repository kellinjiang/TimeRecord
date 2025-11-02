// 数据统计页面
Page({
  data: {
    // 当前时间维度（today, week, month, all）
    currentPeriod: 'week',

    // 趋势标签
    trendLabel: '过去7天',

    // 核心统计数据
    stats: {
      totalRecords: 0,
      totalHours: 0,
      activeDays: 0,
      avgHours: 0,
      mostActiveDay: '',
      topTag: '',
      avgRecordsPerDay: 0
    },

    // 标签统计（Top 5）
    tagStats: [],

    // 时间趋势数据
    trendData: [],

    // 时段分布（24小时）
    hourDistribution: [],

    // 星期分布
    weekdayStats: []
  },

  onLoad() {
    this.loadStatistics();
  },

  onShow() {
    this.loadStatistics();
  },

  onPullDownRefresh() {
    this.loadStatistics().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 切换时间维度
  switchPeriod(e) {
    const period = e.currentTarget.dataset.period;

    let trendLabel = '';
    switch (period) {
      case 'today':
        trendLabel = '今日';
        break;
      case 'week':
        trendLabel = '过去7天';
        break;
      case 'month':
        trendLabel = '过去30天';
        break;
      case 'all':
        trendLabel = '全部时间';
        break;
    }

    this.setData({
      currentPeriod: period,
      trendLabel: trendLabel
    });

    this.loadStatistics();
  },

  // 加载统计数据
  loadStatistics() {
    wx.showLoading({ title: '加载中...', mask: true });

    return this.loadRecords().then(records => {
      // 计算各种统计数据
      const stats = this.calculateStats(records);
      const tagStats = this.calculateTagStats(records);
      const trendData = this.calculateTrendData(records);
      const hourDistribution = this.calculateHourDistribution(records);
      const weekdayStats = this.calculateWeekdayStats(records);

      this.setData({
        stats: stats,
        tagStats: tagStats,
        trendData: trendData,
        hourDistribution: hourDistribution,
        weekdayStats: weekdayStats
      });

      wx.hideLoading();
    }).catch(err => {
      console.error('加载统计数据失败', err);
      wx.hideLoading();
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    });
  },

  // 加载记录数据
  loadRecords() {
    return new Promise((resolve, reject) => {
      const db = wx.cloud.database();
      const _ = db.command;

      // 根据时间维度计算查询范围
      const { startDate, endDate } = this.getDateRange();

      const where = {
        isDeleted: _.neq(true)
      };

      // 添加时间范围过滤
      if (startDate && endDate) {
        where.startTime = _.gte(startDate).and(_.lte(endDate));
      }

      db.collection('records')
        .where(where)
        .orderBy('startTime', 'asc')
        .get({
          success: (res) => {
            resolve(res.data);
          },
          fail: (err) => {
            reject(err);
          }
        });
    });
  },

  // 获取日期范围
  getDateRange() {
    const now = new Date();
    let startDate = null;
    let endDate = null;

    switch (this.data.currentPeriod) {
      case 'today':
        // 今天 00:00:00 到 23:59:59
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        break;

      case 'week':
        // 过去7天
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        startDate.setHours(0, 0, 0, 0);
        endDate = now;
        break;

      case 'month':
        // 过去30天
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        startDate.setHours(0, 0, 0, 0);
        endDate = now;
        break;

      case 'all':
        // 全部时间，不设置范围
        break;
    }

    return { startDate, endDate };
  },

  // 计算核心统计数据
  calculateStats(records) {
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

    // 计算活跃天数
    const dateSet = new Set();
    records.forEach(record => {
      const date = new Date(record.startTime);
      const dateStr = this.formatDate(date);
      dateSet.add(dateStr);
    });
    const activeDays = dateSet.size;

    // 计算日均时长
    const avgHours = activeDays > 0 ? (totalMinutes / 60 / activeDays).toFixed(1) : 0;

    // 计算日均记录数
    const avgRecordsPerDay = activeDays > 0 ? (totalRecords / activeDays).toFixed(1) : 0;

    // 找出最活跃的一天
    const dayRecordMap = {};
    records.forEach(record => {
      const date = new Date(record.startTime);
      const dateStr = this.formatDate(date);
      if (!dayRecordMap[dateStr]) {
        dayRecordMap[dateStr] = 0;
      }
      dayRecordMap[dateStr]++;
    });

    let mostActiveDay = '';
    let maxRecords = 0;
    Object.entries(dayRecordMap).forEach(([date, count]) => {
      if (count > maxRecords) {
        maxRecords = count;
        mostActiveDay = date;
      }
    });

    // 找出最常用标签
    const tagCountMap = {};
    records.forEach(record => {
      if (record.tags && record.tags.length > 0) {
        record.tags.forEach(tag => {
          if (!tagCountMap[tag.name]) {
            tagCountMap[tag.name] = 0;
          }
          tagCountMap[tag.name]++;
        });
      }
    });

    let topTag = '';
    let maxTagCount = 0;
    Object.entries(tagCountMap).forEach(([tagName, count]) => {
      if (count > maxTagCount) {
        maxTagCount = count;
        topTag = tagName;
      }
    });

    return {
      totalRecords,
      totalHours,
      activeDays,
      avgHours,
      mostActiveDay,
      topTag,
      avgRecordsPerDay
    };
  },

  // 计算标签统计（Top 5）
  calculateTagStats(records) {
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

    // 计算总时长
    const totalMinutes = Object.values(tagMap).reduce((sum, tag) => sum + tag.minutes, 0);

    // 转换为数组并排序，取前5个
    const tagStats = Object.values(tagMap)
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 5)
      .map(tag => ({
        ...tag,
        hours: (tag.minutes / 60).toFixed(1),
        percentage: totalMinutes > 0 ? ((tag.minutes / totalMinutes) * 100).toFixed(1) : 0
      }));

    return tagStats;
  },

  // 计算时间趋势数据
  calculateTrendData(records) {
    const period = this.data.currentPeriod;

    if (period === 'today') {
      // 今日不显示趋势图
      return [];
    }

    let days = 7;
    if (period === 'month') {
      days = 30;
    } else if (period === 'all') {
      days = 30; // 全部时间也显示最近30天
    }

    // 生成日期列表
    const dateList = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      dateList.push(date);
    }

    // 按日期分组统计时长
    const dateHoursMap = {};
    records.forEach(record => {
      const date = new Date(record.startTime);
      date.setHours(0, 0, 0, 0);
      const dateStr = this.formatDate(date);

      if (!dateHoursMap[dateStr]) {
        dateHoursMap[dateStr] = 0;
      }

      if (record.endTime) {
        const startTime = new Date(record.startTime);
        const endTime = new Date(record.endTime);
        const duration = Math.floor((endTime - startTime) / 60000);
        dateHoursMap[dateStr] += duration;
      }
    });

    // 找出最大值
    let maxHours = 0;
    Object.values(dateHoursMap).forEach(minutes => {
      const hours = minutes / 60;
      if (hours > maxHours) {
        maxHours = hours;
      }
    });

    // 生成趋势数据
    const trendData = dateList.map(date => {
      const dateStr = this.formatDate(date);
      const minutes = dateHoursMap[dateStr] || 0;
      const hours = (minutes / 60).toFixed(1);
      const percentage = maxHours > 0 ? (parseFloat(hours) / maxHours) * 100 : 0;

      // 判断是否是今天
      const isToday = dateStr === this.formatDate(today);

      // 生成标签（月/日）
      const label = `${date.getMonth() + 1}/${date.getDate()}`;

      return {
        label,
        hours: parseFloat(hours),
        percentage,
        isToday
      };
    });

    return trendData;
  },

  // 计算时段分布（24小时）
  calculateHourDistribution(records) {
    const hourMap = {};

    // 初始化24小时
    for (let i = 0; i < 24; i++) {
      hourMap[i] = 0;
    }

    // 统计每个小时的记录数
    records.forEach(record => {
      const date = new Date(record.startTime);
      const hour = date.getHours();
      hourMap[hour]++;
    });

    // 找出最大值
    let maxCount = 0;
    Object.values(hourMap).forEach(count => {
      if (count > maxCount) {
        maxCount = count;
      }
    });

    // 生成分布数据（只显示有记录的时段）
    const distribution = [];
    for (let hour = 0; hour < 24; hour++) {
      if (hourMap[hour] > 0) {
        distribution.push({
          hour: hour,
          count: hourMap[hour],
          percentage: maxCount > 0 ? (hourMap[hour] / maxCount) * 100 : 0
        });
      }
    }

    return distribution;
  },

  // 计算星期分布
  calculateWeekdayStats(records) {
    const weekdayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const weekdayMap = {};

    // 初始化7天
    for (let i = 0; i < 7; i++) {
      weekdayMap[i] = {
        name: weekdayNames[i],
        count: 0,
        minutes: 0,
        isWeekend: i === 0 || i === 6
      };
    }

    // 统计每个星期的记录数和时长
    records.forEach(record => {
      const date = new Date(record.startTime);
      const day = date.getDay();

      weekdayMap[day].count++;

      if (record.endTime) {
        const startTime = new Date(record.startTime);
        const endTime = new Date(record.endTime);
        const duration = Math.floor((endTime - startTime) / 60000);
        weekdayMap[day].minutes += duration;
      }
    });

    // 找出最大值
    let maxHours = 0;
    Object.values(weekdayMap).forEach(day => {
      const hours = day.minutes / 60;
      if (hours > maxHours) {
        maxHours = hours;
      }
    });

    // 生成分布数据（按周一到周日排序）
    const weekdayStats = [];
    for (let i = 1; i <= 7; i++) {
      const day = i % 7; // 周一=1, 周日=0
      const data = weekdayMap[day];
      const hours = (data.minutes / 60).toFixed(1);
      const percentage = maxHours > 0 ? (parseFloat(hours) / maxHours) * 100 : 0;

      weekdayStats.push({
        day: day,
        name: data.name,
        count: data.count,
        hours: hours,
        percentage: percentage,
        isWeekend: data.isWeekend
      });
    }

    return weekdayStats;
  },

  // 格式化日期（YYYY-MM-DD）
  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
});
