// pages/record-edit/record-edit.js
const app = getApp();
const audioManager = wx.createInnerAudioContext();

Page({
  data: {
    // 基本信息
    content: '',
    startTime: '',
    endTime: '',  // 结束时间
    audioPath: '',

    // 编辑模式
    recordId: null,  // 记录ID（编辑模式下使用）
    isEditMode: false,  // 是否为编辑模式
    originalStartTime: null,  // 原始记录的开始时间（Date对象，用于编辑模式）

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

          // 格式化结束时间
          let endTimeStr = '';
          if (record.endTime) {
            const endTime = new Date(record.endTime);
            const endHours = String(endTime.getHours()).padStart(2, '0');
            const endMinutes = String(endTime.getMinutes()).padStart(2, '0');
            endTimeStr = `${endHours}:${endMinutes}`;
          }

          // 设置基本信息
          this.setData({
            content: record.content || '',
            startTime: startTimeStr,
            endTime: endTimeStr,
            audioPath: record.audioPath || '',
            originalStartTime: record.startTime  // 保存原始开始时间
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

    // 从数据库加载自定义标签
    const db = wx.cloud.database();

    db.collection('tags')
      .where({
        isDeleted: db.command.neq(true)
      })
      .orderBy('createTime', 'desc')
      .get({
        success: (res) => {
          console.log('加载自定义标签成功', res.data);

          // 合并默认标签和自定义标签
          const allTags = [...defaultTags, ...res.data].map(tag => ({
            ...tag,
            selected: false
          }));

          this.setData({
            quickTags: allTags.slice(0, 6),  // 前6个作为快速标签
            allTags: allTags
          });
        },
        fail: (err) => {
          console.error('加载自定义标签失败', err);

          // 加载失败时只使用默认标签
          const tags = defaultTags.map(tag => ({
            ...tag,
            selected: false
          }));

          this.setData({
            quickTags: tags.slice(0, 6),
            allTags: tags
          });
        }
      });
  },

  // 加载模板
  loadTemplates() {
    // 定义默认模板（与模板管理页面保持一致）
    const defaultTemplates = [
      {
        name: '工作日记',
        category: '工作',
        content: '今天完成了以下工作：\n1. \n2. \n3. \n\n明天计划：\n1. \n2. ',
        isDefault: true
      },
      {
        name: '会议记录',
        category: '工作',
        content: '会议主题：\n参与人员：\n会议时间：\n\n会议内容：\n\n待办事项：',
        isDefault: true
      },
      {
        name: '学习笔记',
        category: '学习',
        content: '学习内容：\n学习时长：\n\n重点笔记：\n\n心得体会：',
        isDefault: true
      }
    ];

    // 从数据库加载自定义模板
    const db = wx.cloud.database();

    db.collection('templates')
      .where({
        isDeleted: db.command.neq(true)
      })
      .orderBy('createTime', 'desc')
      .get({
        success: (res) => {
          console.log('加载自定义模板成功', res.data);

          // 合并默认模板和自定义模板
          const allTemplates = [
            ...defaultTemplates,
            ...res.data.map(t => ({
              ...t,
              isDefault: false
            }))
          ];

          this.setData({
            templates: allTemplates
          });
        },
        fail: (err) => {
          console.error('加载自定义模板失败', err);

          // 加载失败时只使用默认模板
          this.setData({
            templates: defaultTemplates
          });
        }
      });
  },

  // 开始时间改变
  onStartTimeChange(e) {
    this.setData({
      startTime: e.detail.value
    });
  },

  // 结束时间改变
  onEndTimeChange(e) {
    const endTime = e.detail.value;
    const startTime = this.data.startTime;

    // 验证结束时间不能早于开始时间
    if (startTime && endTime < startTime) {
      wx.showToast({
        title: '结束时间不能早于开始时间',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    this.setData({
      endTime: endTime
    });
  },

  // 清除结束时间
  clearEndTime() {
    wx.showModal({
      title: '提示',
      content: '确定要清除结束时间吗？',
      success: (res) => {
        if (res.confirm) {
          this.setData({
            endTime: ''
          });
        }
      }
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
        title: '请输入日记内容',
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

    // 解析开始时间
    let startTimeDate;
    if (this.data.isEditMode && this.data.originalStartTime) {
      // 编辑模式：基于原记录的日期
      console.log('========== 编辑模式：保持原记录日期 ==========');
      console.log('原始 startTime:', new Date(this.data.originalStartTime));
      console.log('用户修改的时间:', this.data.startTime);

      startTimeDate = this.parseTime(this.data.startTime, this.data.originalStartTime);

      console.log('解析后的 startTime:', startTimeDate);
      console.log('日期是否保持不变:',
        new Date(this.data.originalStartTime).toDateString() === startTimeDate.toDateString()
      );
    } else {
      // 新建模式：使用当前日期
      console.log('========== 新建模式：使用当前日期 ==========');
      startTimeDate = this.parseTime(this.data.startTime);
      console.log('解析后的 startTime:', startTimeDate);
    }

    // 解析结束时间（基于开始时间的日期）
    let endTimeDate = null;
    if (this.data.endTime) {
      // 使用开始时间的日期作为基准
      endTimeDate = this.parseTime(this.data.endTime, startTimeDate);

      // 如果结束时间早于或等于开始时间，说明跨天了，将结束时间加一天
      if (endTimeDate <= startTimeDate) {
        endTimeDate.setDate(endTimeDate.getDate() + 1);
      }
    }

    // 构建日记对象
    const record = {
      content: this.data.content.trim(),
      startTime: startTimeDate,
      endTime: endTimeDate,
      tags: selectedTags,
      audioPath: this.data.audioPath,
      source: 'voice'
    };

    console.log('准备保存日记：', record);

    // 显示加载提示
    wx.showLoading({
      title: '保存中...',
      mask: true
    });

    // 调用云函数保存
    this.saveToCloud(record);
  },

  // 解析时间字符串为 Date 对象
  parseTime(timeStr, baseDate) {
    // 如果提供了基准日期，使用基准日期；否则使用当前日期
    const date = baseDate ? new Date(baseDate) : new Date();
    const [hours, minutes] = timeStr.split(':');
    date.setHours(parseInt(hours));
    date.setMinutes(parseInt(minutes));
    date.setSeconds(0);
    date.setMilliseconds(0);
    return date;
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
            endTime: record.endTime,
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
      const currentStartTime = new Date(currentRecord.startTime);
      const todayStart = new Date(currentStartTime);
      todayStart.setHours(0, 0, 0, 0);

      // 计算昨天的开始时间
      const yesterdayStart = new Date(todayStart);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);

      // 查询昨天和今天早于当前记录的所有记录
      db.collection('records')
        .where({
          startTime: _.gte(yesterdayStart).and(_.lt(currentRecord.startTime)),
          isDeleted: _.neq(true)
        })
        .orderBy('startTime', 'desc')  // 按时间倒序排列
        .limit(1)  // 只取最后一条
        .get({
          success: (res) => {
            if (res.data.length > 0) {
              // 找到前一条记录
              const previousRecord = res.data[0];
              const previousStartTime = new Date(previousRecord.startTime);
              console.log('找到前一条记录', previousRecord);

              // 检查前一条记录的日期
              const prevDayStart = new Date(previousStartTime);
              prevDayStart.setHours(0, 0, 0, 0);

              // 判断前一条记录是否是昨天的
              const isYesterday = prevDayStart.getTime() < todayStart.getTime();

              if (isYesterday) {
                // 检查是否是睡觉相关的记录
                const sleepKeywords = ['睡觉', '睡眠', '休息', '就寝', '入睡', '睡', '困'];
                const isSleepRecord = sleepKeywords.some(keyword =>
                  previousRecord.content.includes(keyword)
                );

                if (isSleepRecord) {
                  console.log('检测到跨天睡眠记录，执行自动填充');

                  // 1. 将昨天的记录结束时间设为24:00（即今天00:00）
                  const yesterdayEnd = new Date(todayStart);

                  db.collection('records')
                    .doc(previousRecord._id)
                    .update({
                      data: {
                        endTime: yesterdayEnd,
                        updateTime: new Date()
                      },
                      success: () => {
                        console.log('✅ 已将昨天睡眠记录结束时间更新为24:00');

                        // 2. 创建今天凌晨的睡眠记录
                        db.collection('records').add({
                          data: {
                            content: '睡觉（自动填充）',
                            startTime: todayStart,  // 今天00:00
                            endTime: currentRecord.startTime,  // 当前记录开始时间
                            tags: previousRecord.tags || [],
                            source: 'auto',
                            createTime: new Date(),
                            updateTime: new Date(),
                            isDeleted: false
                          },
                          success: () => {
                            console.log('✅ 已自动创建今天凌晨睡眠记录');
                            resolve();
                          },
                          fail: (err) => {
                            console.error('创建凌晨睡眠记录失败', err);
                            // 即使创建失败也继续
                            resolve();
                          }
                        });
                      },
                      fail: (err) => {
                        console.error('更新昨天睡眠记录失败', err);
                        reject(err);
                      }
                    });

                  return;
                }
              }

              // 如果不是跨天睡眠记录，按原逻辑处理
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
              // 没有找到前一条记录，检查是否需要从00:00开始创建睡眠记录
              console.log('没有找到前一条记录，检查是否需要从00:00创建睡眠记录');

              // 如果当前记录不是从00:00开始，检查昨天是否有睡眠记录
              if (currentStartTime.getTime() > todayStart.getTime()) {
                // 查询昨天晚上22:00之后的记录
                const yesterdayEvening = new Date(yesterdayStart);
                yesterdayEvening.setHours(22, 0, 0, 0);

                db.collection('records')
                  .where({
                    startTime: _.gte(yesterdayEvening).and(_.lt(todayStart)),
                    isDeleted: _.neq(true)
                  })
                  .orderBy('startTime', 'desc')
                  .limit(1)
                  .get({
                    success: (lastRes) => {
                      if (lastRes.data.length > 0) {
                        const lastRecord = lastRes.data[0];
                        const sleepKeywords = ['睡觉', '睡眠', '休息', '就寝', '入睡', '睡', '困'];
                        const isSleepRecord = sleepKeywords.some(keyword =>
                          lastRecord.content.includes(keyword)
                        );

                        if (isSleepRecord) {
                          console.log('昨晚有睡眠记录，创建今天凌晨睡眠记录');

                          // 创建今天凌晨的睡眠记录
                          db.collection('records').add({
                            data: {
                              content: '睡觉（自动填充）',
                              startTime: todayStart,
                              endTime: currentRecord.startTime,
                              tags: lastRecord.tags || [],
                              source: 'auto',
                              createTime: new Date(),
                              updateTime: new Date(),
                              isDeleted: false
                            },
                            success: () => {
                              console.log('✅ 已自动创建今天凌晨睡眠记录');
                              resolve();
                            },
                            fail: (err) => {
                              console.error('创建凌晨睡眠记录失败', err);
                              resolve();
                            }
                          });
                        } else {
                          resolve();
                        }
                      } else {
                        resolve();
                      }
                    },
                    fail: () => {
                      resolve();
                    }
                  });
              } else {
                resolve();
              }
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
