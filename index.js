"use strict";

const async = require("async");
const fs = require("fs");
const https = require("https");
const path = require("path");
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
const key = process.env.KEY;
const endpoint = process.env.ENDPOINT;

const computerVisionClient = new ComputerVisionClient(
  new ApiKeyCredentials({ inHeader: { "Ocp-Apim-Subscription-Key": key } }),
  endpoint
);
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
/**
 * END - 認証情報
 */

const openai = new OpenAIApi(configuration);

// async関数を定義して、openai.createChatCompletion()メソッドを呼び出し、応答を待機する
async function ask(content) {
  // openai.createChatCompletion()メソッドを使用して、GPT-3.5モデルを呼び出す
  const response = await openai.createChatCompletion({
    model: "gpt-3.5-turbo-0301",
    messages: [
      {
        role: "system",
        content:
          "以下の[テキスト]を[制約]に従って[出力フォーマット]で出力してください。[制約]* 出力は[出力フォーマット]のみ出力してください。* [出力フォーマット]以外の余計な文章は出力しないでください。[出力フォーマット]```json { '明細': [{  '商品名': 'テスト',  '金額': 1000}],'合計金額': 10000} ``` [テキスト] ",
      },
      { role: "user", content: content },
    ],
  });

  // 応答のchoices配列の最初の要素から、返答の内容を抽出する
  const answer = await response.data.choices[0].message?.content;
  console.log(answer);
}

function computerVision() {
  // 関数の配列を順番に実行します。非同期タスクを順次処理するために使用します。
  async.series(
    [
      async function () {
        // 印刷されたテキストや手書きのテキストを含む URL 画像。
        // URL は、画像ファイル (.jpg/.png/.bmp) または複数ページ ファイル (.pdf、.tiff) を指すことができます。
        // 今回はコマンドライン引数からURLを渡しています。
        const printedTextSampleURL = process.argv[2];

        // URL から印刷画像のテキストを認識
        // `readTextFromURL()` 関数を使用して指定された URL から印刷されたテキストを読み取り、`await` を使用してその操作が完了するのを待ってから、`printRecText() を使用して認識されたテキストをコンソールに出力します。
        const printedResult = await readTextFromURL(
          computerVisionClient,
          printedTextSampleURL
        );
        extractTextFromLine(printedResult);

        // 読み取りを実行し、URL からの結果を待ちます
        async function readTextFromURL(client, url) {
          let result = await client.read(url);
          // オペレーション ID は operationLocation (URL) の最後のパス セグメントです
          let operation = result.operationLocation.split("/").slice(-1)[0];

          // 読み取り認識が完了するのを待つ
          // result.status はread の結果であるため、最初は未定義です。
          while (result.status !== "succeeded") {
            await sleep(1000);
            result = await client.getReadResult(operation);
          }
          return result.analyzeResult.readResults; // 結果の最初のページを返します。
        }

        // 読み取り結果からすべてのテキストを出力します
        async function extractTextFromLine(readResults) {
          // 空の配列を作成
          const array = [];
          // readResultsの各ページに対して繰り返し処理を行う
          for (const page in readResults) {
            // readResultsが複数のページを含む場合、ページ数を出力する
            if (readResults.length > 1) {
              console.log(`==== Page: ${page}`);
            }
            // 現在のページの読み取り結果を取得する
            const result = readResults[page];
            // 結果からテキストが認識された場合
            if (result.lines.length) {
              // 各行に対して繰り返し処理を行う
              for (const line of result.lines) {
                // 行の単語を配列に追加する
                array.push(line.words.map((w) => w.text).join(" "));
              }
            } else {
              console.log("No recognized text.");
            }
          }
          await ask(array.join("\n"));
        }
      },
      function () {
        return new Promise((resolve) => {
          resolve();
        });
      },
    ],
    (err) => {
      throw err;
    }
  );
}

computerVision();
