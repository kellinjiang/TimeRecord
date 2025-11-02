// 讯飞语音识别云函数
const cloud = require('wx-server-sdk');
const axios = require('axios');
const WebSocket = require('ws');
const CryptoJS = require('crypto-js');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

// 讯飞AI配置
const XFYUN_APPID = 'de1cdf25';
const XFYUN_API_SECRET = 'ZTRlYWQxM2RkMjhkNTgwY2ZkYTdhMzE1';
const XFYUN_API_KEY = '61dd1d6f6e4cf139c4e523eda8a1b791';

/**
 * 生成讯飞WebSocket鉴权URL
 */
function getAuthUrl() {
  const url = 'wss://iat-api.xfyun.cn/v2/iat';
  const host = 'iat-api.xfyun.cn';
  const path = '/v2/iat';
  const date = new Date().toUTCString();

  // 生成signature
  const signatureOrigin = `host: ${host}\ndate: ${date}\nGET ${path} HTTP/1.1`;
  const signatureSha = CryptoJS.HmacSHA256(signatureOrigin, XFYUN_API_SECRET);
  const signature = CryptoJS.enc.Base64.stringify(signatureSha);

  // 生成authorization
  const authorizationOrigin = `api_key="${XFYUN_API_KEY}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
  const authorization = Buffer.from(authorizationOrigin).toString('base64');

  // 拼接鉴权URL
  const authUrl = `${url}?authorization=${authorization}&date=${encodeURIComponent(date)}&host=${host}`;

  return authUrl;
}

/**
 * 调用讯飞语音识别API
 */
async function recognizeSpeech(audioUrl) {
  return new Promise(async (resolve, reject) => {
    try {
      // 下载音频文件
      console.log('下载音频文件:', audioUrl);
      const audioResponse = await axios.get(audioUrl, {
        responseType: 'arraybuffer'
      });

      const audioBuffer = Buffer.from(audioResponse.data);
      console.log('音频大小:', audioBuffer.length, 'bytes');

      // 生成鉴权URL
      const authUrl = getAuthUrl();
      console.log('开始连接讯飞WebSocket...');

      // 建立WebSocket连接
      const ws = new WebSocket(authUrl);

      let resultText = '';
      let isEnd = false;

      // 连接建立
      ws.on('open', () => {
        console.log('WebSocket连接成功');

        // 发送音频参数
        const params = {
          common: {
            app_id: XFYUN_APPID
          },
          business: {
            language: 'zh_cn',
            domain: 'iat',
            accent: 'mandarin',
            vad_eos: 5000,
            dwa: 'wpgs'
          },
          data: {
            status: 2,  // 一次性发送全部音频
            format: 'audio/L16;rate=16000',
            encoding: 'raw',
            audio: audioBuffer.toString('base64')
          }
        };

        console.log('发送音频数据...');
        ws.send(JSON.stringify(params));
      });

      // 接收消息
      ws.on('message', (data) => {
        const result = JSON.parse(data);
        console.log('收到识别结果:', result);

        if (result.code !== 0) {
          console.error('识别失败:', result.message);
          ws.close();
          reject(new Error(`识别失败: ${result.message} (错误码: ${result.code})`));
          return;
        }

        // 解析识别结果
        if (result.data && result.data.result) {
          const ws_result = result.data.result.ws;
          if (ws_result) {
            for (let i = 0; i < ws_result.length; i++) {
              const cw = ws_result[i].cw;
              for (let j = 0; j < cw.length; j++) {
                resultText += cw[j].w;
              }
            }
          }
        }

        // 判断是否结束
        if (result.data && result.data.status === 2) {
          isEnd = true;
          ws.close();
        }
      });

      // 连接关闭
      ws.on('close', () => {
        console.log('WebSocket连接关闭');
        if (isEnd) {
          console.log('最终识别结果:', resultText);
          resolve({
            success: true,
            text: resultText || '未识别到内容'
          });
        }
      });

      // 连接错误
      ws.on('error', (error) => {
        console.error('WebSocket错误:', error);
        reject(new Error(`WebSocket连接失败: ${error.message}`));
      });

      // 设置超时
      setTimeout(() => {
        if (!isEnd) {
          ws.close();
          reject(new Error('识别超时'));
        }
      }, 30000);

    } catch (error) {
      console.error('语音识别失败', error);
      reject(error);
    }
  });
}

/**
 * 云函数入口
 */
exports.main = async (event, context) => {
  const { fileID } = event;

  if (!fileID) {
    return {
      success: false,
      error: '缺少fileID参数'
    };
  }

  try {
    console.log('开始处理语音识别，fileID:', fileID);

    // 获取文件临时下载链接
    const result = await cloud.getTempFileURL({
      fileList: [fileID]
    });

    if (!result.fileList || result.fileList.length === 0) {
      throw new Error('获取文件链接失败');
    }

    const tempFileURL = result.fileList[0].tempFileURL;
    console.log('临时链接:', tempFileURL);

    // 调用讯飞语音识别
    const recognizeResult = await recognizeSpeech(tempFileURL);

    return recognizeResult;
  } catch (error) {
    console.error('云函数执行失败', error);
    return {
      success: false,
      error: error.message || '识别失败'
    };
  }
};
