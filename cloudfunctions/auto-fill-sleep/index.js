// 自动填充睡眠时间云函数
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  try {
    // 获取今天和昨天的日期
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // 查询昨天晚上22:00之后的最后一条记录
    const yesterdayEvening = new Date(yesterday);
    yesterdayEvening.setHours(22, 0, 0, 0);

    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);

    // 查询昨天晚上的最后一条记录
    const lastRecordRes = await db.collection('records')
      .where({
        _openid: openid,
        startTime: _.gte(yesterdayEvening).and(_.lt(todayStart)),
        isDeleted: _.neq(true)
      })
      .orderBy('startTime', 'desc')
      .limit(1)
      .get();

    if (lastRecordRes.data.length === 0) {
      return {
        success: true,
        message: '昨晚没有记录，无需填充'
      };
    }

    const lastRecord = lastRecordRes.data[0];

    // 检查是否包含睡觉关键词
    const sleepKeywords = ['睡觉', '睡眠', '休息', '就寝', '入睡', '睡', '困'];
    const isSleepRecord = sleepKeywords.some(keyword =>
      lastRecord.content.includes(keyword)
    );

    if (!isSleepRecord) {
      return {
        success: true,
        message: '昨晚最后一条记录不是睡觉相关，无需填充'
      };
    }

    // 计算昨天24:00（今天00:00）
    const midnight = new Date(todayStart);

    // 1. 检查并更新昨天最后一条记录的结束时间
    let updated = false;
    if (!lastRecord.endTime || new Date(lastRecord.endTime).getTime() !== midnight.getTime()) {
      await db.collection('records')
        .doc(lastRecord._id)
        .update({
          data: {
            endTime: midnight,
            updateTime: new Date()
          }
        });
      updated = true;
      console.log('已更新昨天睡眠记录的结束时间至24:00');
    }

    // 2. 查询今天的第一条记录
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    const firstRecordRes = await db.collection('records')
      .where({
        _openid: openid,
        startTime: _.gte(todayStart).and(_.lte(todayEnd)),
        isDeleted: _.neq(true)
      })
      .orderBy('startTime', 'asc')
      .limit(1)
      .get();

    let created = false;
    if (firstRecordRes.data.length > 0) {
      const firstRecord = firstRecordRes.data[0];
      const firstRecordTime = new Date(firstRecord.startTime);

      // 如果第一条记录不是从00:00开始的，则需要填充凌晨时段
      if (firstRecordTime.getTime() > todayStart.getTime()) {
        // 检查是否已经存在自动填充的记录
        const existingFillRes = await db.collection('records')
          .where({
            _openid: openid,
            startTime: todayStart,
            source: 'auto',
            isDeleted: _.neq(true)
          })
          .get();

        if (existingFillRes.data.length === 0) {
          // 创建凌晨睡眠记录
          await db.collection('records').add({
            data: {
              _openid: openid,
              content: '睡觉（自动填充）',
              startTime: todayStart,
              endTime: firstRecord.startTime,
              tags: lastRecord.tags || [],
              source: 'auto',
              createTime: new Date(),
              updateTime: new Date(),
              isDeleted: false
            }
          });
          created = true;
          console.log('已自动填充今天凌晨睡眠时间');
        }
      }
    } else {
      // 今天还没有任何记录，创建一条从00:00开始的睡眠记录（endTime为null）
      const existingFillRes = await db.collection('records')
        .where({
          _openid: openid,
          startTime: todayStart,
          source: 'auto',
          isDeleted: _.neq(true)
        })
        .get();

      if (existingFillRes.data.length === 0) {
        await db.collection('records').add({
          data: {
            _openid: openid,
            content: '睡觉（自动填充）',
            startTime: todayStart,
            endTime: null,  // 结束时间待定
            tags: lastRecord.tags || [],
            source: 'auto',
            createTime: new Date(),
            updateTime: new Date(),
            isDeleted: false
          }
        });
        created = true;
        console.log('已自动填充今天凌晨睡眠时间（进行中）');
      }
    }

    return {
      success: true,
      updated: updated,
      created: created,
      message: `已处理：${updated ? '更新昨晚记录结束时间' : ''}${updated && created ? '，' : ''}${created ? '创建今天凌晨睡眠记录' : ''}`
    };

  } catch (err) {
    console.error('自动填充睡眠时间失败', err);
    return {
      success: false,
      error: err.message
    };
  }
};
