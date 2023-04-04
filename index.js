"use strict";

require("dotenv").config();
const { Configuration, OpenAIApi } = require("openai");
const sleep = require("util").promisify(setTimeout);
const ComputerVisionClient =
  require("@azure/cognitiveservices-computervision").ComputerVisionClient;
const ApiKeyCredentials = require("@azure/ms-rest-js").ApiKeyCredentials;
/**
 * 認証情報
 * This single client is used for all examples.
 */
const computerVisionKey = process.env.COMPUTER_VISION_KEY;
const computerVisionEndpoint = process.env.COMPUTER_VISION_ENDPOINT;

const computerVisionClient = new ComputerVisionClient(
  new ApiKeyCredentials({
    inHeader: { "Ocp-Apim-Subscription-Key": computerVisionKey },
  }),
  computerVisionEndpoint
);
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
/**
 * END - 認証情報
 */

const openai = new OpenAIApi(configuration);

// 読み取りを実行し、URL からの結果を待つ関数
async function readTextFromURL(client, url) {
  // read() メソッドを使用して URL から印刷画像のテキストを読み込みます
  let result = await client.read(url);
  // オペレーション ID は operationLocation (URL) の最後のパス セグメントです
  let operation = result.operationLocation.split("/").slice(-1)[0];

  // 読み取りが完了するまで待機します
  while (result.status !== "succeeded") {
    await sleep(1000);
    result = await client.getReadResult(operation);
  }
  return result.analyzeResult.readResults; // 結果の最初のページを返します。
}

// ページの読み取り結果を抽出し、テキストを配列に格納します
async function extractTextFromLine(readResults) {
  const array = [];
  for (const page in readResults) {
    const result = readResults[page];
    if (result.lines.length) {
      for (const line of result.lines) {
        array.push(line.text);
      }
    } else {
      console.log("No recognized text.");
    }
  }
  const resultAsJSON = await convertOCRTextToJSON(array.join("\n"));
  console.log(resultAsJSON);
}

// OCRで取得したテキストをJSON形式に変換する関数
async function convertOCRTextToJSON(content) {
  // OpenAI APIを使用して、GPT-3.5モデルを呼び出す
  const response = await openai.createChatCompletion({
    model: "gpt-3.5-turbo-0301",
    messages: [
      // JSON形式に変換するための指示を含むシステムのメッセージと、OCRで取得したテキストを含むユーザーのメッセージを送信する
      {
        role: "system",
        content:
          "以下の[テキスト]を[制約]に従って[出力フォーマット]で出力してください。[制約]* 出力は[出力フォーマット]のみ出力してください。* [出力フォーマット]以外の余計な文章は出力しないでください。[出力フォーマット]```json { '明細': [{  '商品名': 'テスト',  '金額': 1000}],'合計金額': 10000} ``` [テキスト] ",
      },
      { role: "user", content: content },
    ],
  });

  // OpenAI APIからの応答のうち、返答の内容を抽出する
  const answerOpenAI = await response.data.choices[0].message?.content;
  return answerOpenAI;
}

// OCR APIを利用して画像のURLからテキストを抽出し、テキストデータをopenAIに渡してJSON形式に変換する
async function extractTextFromImage() {
  // コマンドライン引数から、印刷されたテキストや手書きのテキストを含むURLを取得する。今回はコマンドライン引数からURLを取得。
  const printedTextSampleURL = process.argv[2];

  // Computer Vision APIを使用して、指定されたURLから印刷画像のテキストを認識する
  const printedResult = await readTextFromURL(
    computerVisionClient,
    printedTextSampleURL
  );
  extractTextFromLine(printedResult);
}

extractTextFromImage();
