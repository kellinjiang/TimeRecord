// pages/record-edit/record-edit.js
const app = getApp();
const audioManager = wx.createInnerAudioContext();

Page({
  data: {
    // 基本信息
    content: '',
    startTime: '',
    audioPath: '',

    // 编辑模式
    recordId: null,  // 记录ID（编辑模式下使用）
    isEditMode: false,  // 是否为编辑模式

    // 标签数据
    quickTags: [],  // 快速标签（前6个）
    allTags: [],    // 所有标签
    selectedTags: [],  // 已选中的标签

    // 模板数据
    templates: [],

    // UI状态
    showTagModal: false,
    isPlaying: false  // 录音播放状态
  },

  onLoad(options) {
    // 检查是否为编辑模式
    if (options.id) {
      this.setData({
        recordId: options.id,
        isEditMode: true
      });

      // 加载记录数据
      this.loadRecord(options.id);
    } else {
      // 新建模式
      // 获取传递的参数（录音内容）
      if (options.content) {
        this.setData({
          content: decodeURIComponent(options.content)
        });
      }

      if (options.audioPath) {
        this.setData({
          audioPath: decodeURIComponent(options.audioPath)
        });
      }

      // 语音模式提示
      if (options.voiceMode === 'true' && options.audioPath) {
        wx.showToast({
          title: '录音已保存，请输入文字内容',
          icon: 'none',
          duration: 2000
        });
      }

      // 设置当前时间为默认开始时间
      this.setCurrentTime();
    }

    // 加载标签和模板
    this.loadTags();
    this.loadTemplates();
  },

  // 设置当前时间
  setCurrentTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    this.setData({
      startTime: `${hours}:${minutes}`
    });
  },

  // 加载记录数据（编辑模式）
  loadRecord(recordId) {
    wx.showLoading({
      title: '加载中...',
      mask: true
    });

    const db = wx.cloud.database();

    db.collection('records')
      .doc(recordId)
      .get({
        success: (res) => {
          wx.hideLoading();

          const record = res.data;
          console.log('加载记录成功', record);

          // 格式化时间
          const startTime = new Date(record.startTime);
          const hours = String(startTime.getHours()).padStart(2, '0');
          const minutes = String(startTime.getMinutes()).padStart(2, '0');
          const startTimeStr = `${hours}:${minutes}`;

          // 设置基本信息
          this.setData({
            content: record.content || '',
            startTime: startTimeStr,
            audioPath: record.audioPath || ''
          });

          // 等待标签加载完成后设置选中状态
          setTimeout(() => {
            this.setRecordTags(record.tags || []);
          }, 100);
        },
        fail: (err) => {
          wx.hideLoading();
          console.error('加载记录失败', err);

          wx.showModal({
            title: '加载失败',
            content: '无法加载记录数据',
            confirmText: '返回',
            showCancel: false,
            success: () => {
              wx.navigateBack();
            }
          });
        }
      });
  },

  // 设置记录的标签（编辑模式）
  setRecordTags(tags) {
    if (!tags || tags.length === 0) {
      return;
    }

    // 获取标签名称列表
    const tagNames = tags.map(tag => tag.name);

    // 更新quickTags的选中状态
    const quickTags = this.data.quickTags.map(tag => ({
      ...tag,
      selected: tagNames.includes(tag.name)
    }));

    // 更新allTags的选中状态
    const allTags = this.data.allTags.map(tag => ({
      ...tag,
      selected: tagNames.includes(tag.name)
    }));

    this.setData({
      quickTags: quickTags,
      allTags: allTags
    });

    // 同步已选标签
    this.syncSelectedTags();
  },

  // 加载标签
  loadTags() {
    // 从全局配置获取默认标签
    const defaultTags = app.globalData.defaultTags || [];

    const tags = defaultTags.map(tag => ({
      ...tag,
      selected: false
    }));

    this.setData({
      quickTags: tags.slice(0, 6),  // 前6个作为快速标签
      allTags: tags
    });
  },

  // 加载模板
  loadTemplates() {
    // TODO: 从云数据库加载用户的模板
    // 目前使用模拟数据
    this.setData({
      templates: [
        { id: 1, name: '🚇 早晨通勤', content: '地铁上听播客' },
        { id: 2, name: '☕ 午休', content: '午休放松' },
        { id: 3, name: '💻 代码开发', content: '专注编程' }
      ]
    });
  },

  // 时间改变
  onTimeChange(e) {
    this.setData({
      startTime: e.detail.value
    });
  },

  // 内容输入
  onContentInput(e) {
    this.setData({
      content: e.detail.value
    });
  },

  // 切换标签选择
  toggleTag(e) {
    const index = e.currentTarget.dataset.index;
    const quickTags = this.data.quickTags;
    quickTags[index].selected = !quickTags[index].selected;

    this.setData({
      quickTags: quickTags
    });

    // 同步到 allTags
    this.syncSelectedTags();
  },

  // 同步已选标签
  syncSelectedTags() {
    const selected = this.data.quickTags
      .filter(tag => tag.selected)
      .map(tag => ({ name: tag.name, icon: tag.icon, color: tag.color }));

    this.setData({
      selectedTags: selected
    });
  },

  // 显示更多标签
  showMoreTags() {
    // 同步当前选择状态到 allTags
    const selectedNames = this.data.quickTags
      .filter(tag => tag.selected)
      .map(tag => tag.name);

    const allTags = this.data.allTags.map(tag => ({
      ...tag,
      selected: selectedNames.includes(tag.name)
    }));

    this.setData({
      allTags: allTags,
      showTagModal: true
    });
  },

  // 在弹窗中切换标签
  toggleTagInModal(e) {
    const index = e.currentTarget.dataset.index;
    const allTags = this.data.allTags;
    allTags[index].selected = !allTags[index].selected;

    this.setData({
      allTags: allTags
    });
  },

  // 确认标签选择
  confirmTags() {
    // 将 allTags 的选择状态同步到 quickTags
    const selectedNames = this.data.allTags
      .filter(tag => tag.selected)
      .map(tag => tag.name);

    const quickTags = this.data.quickTags.map(tag => ({
      ...tag,
      selected: selectedNames.includes(tag.name)
    }));

    this.setData({
      quickTags: quickTags,
      showTagModal: false
    });

    this.syncSelectedTags();
  },

  // 隐藏标签弹窗
  hideTagModal() {
    this.setData({
      showTagModal: false
    });
  },

  // 阻止事件冒泡
  stopPropagation() {
    // 空函数，仅用于阻止冒泡
  },

  // 使用模板
  useTemplate(e) {
    const index = e.currentTarget.dataset.index;
    const template = this.data.templates[index];

    wx.showModal({
      title: '使用模板',
      content: `将填充内容：${template.content}`,
      confirmText: '确定',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this.setData({
            content: template.content
          });
        }
      }
    });
  },

  // 取消
  onCancel() {
    wx.showModal({
      title: '确认取消',
      content: '当前内容尚未保存，确定要放弃吗？',
      confirmText: '确定',
      confirmColor: '#E74C3C',
      cancelText: '继续编辑',
      success: (res) => {
        if (res.confirm) {
          wx.navigateBack();
        }
      }
    });
  },

  // 保存
  onSave() {
    // 验证数据
    if (!this.data.content.trim()) {
      wx.showToast({
        title: '请输入日志内容',
        icon: 'none'
      });
      return;
    }

    if (!this.data.startTime) {
      wx.showToast({
        title: '请选择开始时间',
        icon: 'none'
      });
      return;
    }

    // 获取已选标签
    const selectedTags = this.data.quickTags
      .filter(tag => tag.selected)
      .map(tag => ({ name: tag.name, icon: tag.icon, color: tag.color }));

    // 构建日志对象
    const record = {
      content: this.data.content.trim(),
      startTime: this.parseTime(this.data.startTime),
      tags: selectedTags,
      audioPath: this.data.audioPath,
      source: 'voice'
    };

    console.log('准备保存日志：', record);

    // 显示加载提示
    wx.showLoading({
      title: '保存中...',
      mask: true
    });

    // 调用云函数保存
    this.saveToCloud(record);
  },

  // 解析时间字符串为 Date 对象
  parseTime(timeStr) {
    const now = new Date();
    const [hours, minutes] = timeStr.split(':');
    now.setHours(parseInt(hours));
    now.setMinutes(parseInt(minutes));
    now.setSeconds(0);
    now.setMilliseconds(0);
    return now;
  },

  // 保存到云数据库
  saveToCloud(record) {
    const db = wx.cloud.database();
    const _ = db.command;

    // 判断是新建还是更新
    if (this.data.isEditMode && this.data.recordId) {
      // 更新模式
      db.collection('records')
        .doc(this.data.recordId)
        .update({
          data: {
            content: record.content,
            startTime: record.startTime,
            tags: record.tags,
            updateTime: new Date()
          },
          success: (res) => {
            console.log('更新成功', res);
            wx.hideLoading();

            wx.showToast({
              title: '更新成功',
              icon: 'success',
              duration: 1500
            });

            // 延迟返回上一页
            setTimeout(() => {
              wx.navigateBack();
            }, 1500);
          },
          fail: (err) => {
            console.error('更新失败', err);
            wx.hideLoading();

            wx.showModal({
              title: '更新失败',
              content: err.errMsg || '网络错误，请重试',
              showCancel: false
            });
          }
        });
    } else {
      // 新建模式：先更新前一条记录的结束时间，再保存当前记录
      this.updatePreviousRecordEndTime(record).then(() => {
        // 保存当前记录（不设置endTime）
        db.collection('records').add({
          data: {
            ...record,
            endTime: null,  // 新记录的结束时间为待定
            createTime: new Date(),
            updateTime: new Date(),
            isDeleted: false
          },
          success: (res) => {
            console.log('保存成功', res);
            wx.hideLoading();

            wx.showToast({
              title: '保存成功',
              icon: 'success',
              duration: 1500
            });

            // 延迟返回上一页
            setTimeout(() => {
              wx.navigateBack();
            }, 1500);
          },
          fail: (err) => {
            console.error('保存失败', err);
            wx.hideLoading();

            wx.showModal({
              title: '保存失败',
              content: err.errMsg || '网络错误，请重试',
              showCancel: false
            });
          }
        });
      }).catch(err => {
        console.error('更新前一条记录失败', err);
        // 即使更新前一条记录失败，也继续保存当前记录
        db.collection('records').add({
          data: {
            ...record,
            endTime: null,
            createTime: new Date(),
            updateTime: new Date(),
            isDeleted: false
          },
          success: (res) => {
            console.log('保存成功', res);
            wx.hideLoading();

            wx.showToast({
              title: '保存成功',
              icon: 'success',
              duration: 1500
            });

            setTimeout(() => {
              wx.navigateBack();
            }, 1500);
          },
          fail: (err) => {
            console.error('保存失败', err);
            wx.hideLoading();

            wx.showModal({
              title: '保存失败',
              content: err.errMsg || '网络错误，请重试',
              showCancel: false
            });
          }
        });
      });
    }
  },

  // 更新前一条记录的结束时间
  updatePreviousRecordEndTime(currentRecord) {
    return new Promise((resolve, reject) => {
      const db = wx.cloud.database();
      const _ = db.command;

      // 计算当天的开始和结束时间
      const startTime = new Date(currentRecord.startTime);
      const dayStart = new Date(startTime);
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(startTime);
      dayEnd.setHours(23, 59, 59, 999);

      // 查询同一天且开始时间早于当前记录的所有记录
      db.collection('records')
        .where({
          startTime: _.gte(dayStart).and(_.lt(currentRecord.startTime)),
          isDeleted: _.neq(true)
        })
        .orderBy('startTime', 'desc')  // 按时间倒序排列
        .limit(1)  // 只取最后一条
        .get({
          success: (res) => {
            if (res.data.length > 0) {
              // 找到前一条记录，更新其结束时间
              const previousRecord = res.data[0];
              console.log('找到前一条记录', previousRecord);

              db.collection('records')
                .doc(previousRecord._id)
                .update({
                  data: {
                    endTime: currentRecord.startTime,
                    updateTime: new Date()
                  },
                  success: () => {
                    console.log('成功更新前一条记录的结束时间');
                    resolve();
                  },
                  fail: (err) => {
                    console.error('更新前一条记录失败', err);
                    reject(err);
                  }
                });
            } else {
              // 没有找到前一条记录，直接继续
              console.log('没有找到前一条记录');
              resolve();
            }
          },
          fail: (err) => {
            console.error('查询前一条记录失败', err);
            reject(err);
          }
        });
    });
  },

  // 播放录音
  playAudio() {
    if (!this.data.audioPath) {
      return;
    }

    console.log('播放录音', this.data.audioPath);

    // 如果正在播放，则停止
    if (this.data.isPlaying) {
      audioManager.stop();
      this.setData({
        isPlaying: false
      });
      return;
    }

    // 获取云文件临时链接
    wx.cloud.getTempFileURL({
      fileList: [this.data.audioPath],
      success: (res) => {
        console.log('获取临时链接成功', res);
        if (res.fileList && res.fileList.length > 0) {
          const tempFileURL = res.fileList[0].tempFileURL;

          // 设置音频源
          audioManager.src = tempFileURL;

          // 播放
          audioManager.play();

          // 更新播放状态
          this.setData({
            isPlaying: true
          });

          // 监听播放结束
          audioManager.onEnded(() => {
            console.log('播放结束');
            this.setData({
              isPlaying: false
            });
          });

          // 监听播放错误
          audioManager.onError((error) => {
            console.error('播放错误', error);
            wx.showToast({
              title: '播放失败',
              icon: 'none'
            });
            this.setData({
              isPlaying: false
            });
          });
        }
      },
      fail: (err) => {
        console.error('获取临时链接失败', err);
        wx.showToast({
          title: '无法播放录音',
          icon: 'none'
        });
      }
    });
  }
});
