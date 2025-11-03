// pages/memo-edit/memo-edit.js
Page({
  data: {
    memoId: '',              // 编辑时有值，新增时为空
    formData: {
      title: '',
      content: '',
      reminderDate: '',      // 日期 YYYY-MM-DD
      reminderTimeStr: '',   // 时间 HH:MM
      priority: 2            // 默认中优先级
    },
    todayDate: '',           // 今天的日期（作为日期选择器的最小值）
    canSave: false           // 是否可以保存
  },

  onLoad(options) {
    // 设置今天的日期
    const today = new Date();
    const todayStr = this.formatDateStr(today);
    this.setData({
      todayDate: todayStr
    });

    // 如果是编辑模式，加载备忘录详情
    if (options.id) {
      this.setData({
        memoId: options.id
      });
      this.loadMemoDetail(options.id);
    } else {
      // 新增模式，设置默认时间为1小时后
      const defaultTime = new Date();
      defaultTime.setHours(defaultTime.getHours() + 1);
      defaultTime.setMinutes(0);
      defaultTime.setSeconds(0);

      this.setData({
        'formData.reminderDate': this.formatDateStr(defaultTime),
        'formData.reminderTimeStr': this.formatTimeStr(defaultTime)
      }, () => {
        this.validateForm();
      });
    }
  },

  // 加载备忘录详情
  loadMemoDetail(id) {
    wx.showLoading({
      title: '加载中...',
      mask: true
    });

    const db = wx.cloud.database();

    db.collection('memos')
      .doc(id)
      .get({
        success: (res) => {
          console.log('加载备忘录详情成功', res);

          const memo = res.data;
          const reminderTime = new Date(memo.reminderTime);

          this.setData({
            formData: {
              title: memo.title || '',
              content: memo.content || '',
              reminderDate: this.formatDateStr(reminderTime),
              reminderTimeStr: this.formatTimeStr(reminderTime),
              priority: memo.priority || 2
            }
          }, () => {
            this.validateForm();
            wx.hideLoading();
          });
        },
        fail: (err) => {
          console.error('加载备忘录详情失败', err);
          wx.hideLoading();
          wx.showToast({
            title: '加载失败',
            icon: 'none'
          });
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        }
      });
  },

  // 标题输入
  onTitleInput(e) {
    this.setData({
      'formData.title': e.detail.value
    }, () => {
      this.validateForm();
    });
  },

  // 内容输入
  onContentInput(e) {
    this.setData({
      'formData.content': e.detail.value
    });
  },

  // 日期选择
  onDateChange(e) {
    this.setData({
      'formData.reminderDate': e.detail.value
    }, () => {
      this.validateForm();
    });
  },

  // 时间选择
  onTimeChange(e) {
    this.setData({
      'formData.reminderTimeStr': e.detail.value
    }, () => {
      this.validateForm();
    });
  },

  // 优先级选择
  onPriorityChange(e) {
    const priority = parseInt(e.currentTarget.dataset.priority);
    this.setData({
      'formData.priority': priority
    });
  },

  // 表单验证
  validateForm() {
    const { title, reminderDate, reminderTimeStr } = this.data.formData;
    const canSave = title.trim() !== '' && reminderDate !== '' && reminderTimeStr !== '';

    this.setData({
      canSave: canSave
    });
  },

  // 保存备忘录
  saveMemo() {
    const { memoId, formData, canSave } = this.data;

    if (!canSave) {
      wx.showToast({
        title: '请完善信息',
        icon: 'none'
      });
      return;
    }

    // 构造提醒时间
    const reminderTime = new Date(`${formData.reminderDate} ${formData.reminderTimeStr}:00`);

    // 检查时间是否有效
    if (isNaN(reminderTime.getTime())) {
      wx.showToast({
        title: '时间格式错误',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: memoId ? '更新中...' : '保存中...',
      mask: true
    });

    const db = wx.cloud.database();
    const now = new Date();

    const memoData = {
      title: formData.title.trim(),
      content: formData.content.trim(),
      reminderTime: reminderTime,
      priority: formData.priority,
      updateTime: now
    };

    if (memoId) {
      // 更新
      db.collection('memos')
        .doc(memoId)
        .update({
          data: memoData,
          success: () => {
            wx.hideLoading();
            wx.showToast({
              title: '更新成功',
              icon: 'success'
            });
            setTimeout(() => {
              wx.navigateBack();
            }, 1500);
          },
          fail: (err) => {
            console.error('更新失败', err);
            wx.hideLoading();
            wx.showToast({
              title: '更新失败',
              icon: 'none'
            });
          }
        });
    } else {
      // 新增
      memoData.isCompleted = false;
      memoData.completedTime = null;
      memoData.createTime = now;
      memoData.isDeleted = false;

      db.collection('memos')
        .add({
          data: memoData,
          success: () => {
            wx.hideLoading();
            wx.showToast({
              title: '保存成功',
              icon: 'success'
            });
            setTimeout(() => {
              wx.navigateBack();
            }, 1500);
          },
          fail: (err) => {
            console.error('保存失败', err);
            wx.hideLoading();
            wx.showToast({
              title: '保存失败',
              icon: 'none'
            });
          }
        });
    }
  },

  // 删除备忘录
  deleteMemo() {
    const { memoId } = this.data;

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条备忘录吗？',
      confirmText: '删除',
      confirmColor: '#FF5733',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({
            title: '删除中...',
            mask: true
          });

          const db = wx.cloud.database();

          db.collection('memos')
            .doc(memoId)
            .update({
              data: {
                isDeleted: true,
                updateTime: new Date()
              },
              success: () => {
                wx.hideLoading();
                wx.showToast({
                  title: '删除成功',
                  icon: 'success'
                });
                setTimeout(() => {
                  wx.navigateBack();
                }, 1500);
              },
              fail: (err) => {
                console.error('删除失败', err);
                wx.hideLoading();
                wx.showToast({
                  title: '删除失败',
                  icon: 'none'
                });
              }
            });
        }
      }
    });
  },

  // 取消
  cancel() {
    wx.navigateBack();
  },

  // 格式化日期字符串（YYYY-MM-DD）
  formatDateStr(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 格式化时间字符串（HH:MM）
  formatTimeStr(date) {
    const d = new Date(date);
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }
});
