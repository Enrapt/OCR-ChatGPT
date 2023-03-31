"use strict";

const async = require("async");
const fs = require("fs");
const https = require("https");
const path = require("path");
require("dotenv").config();
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
/**
 * END - 認証情報
 */

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
        printRecText(printedResult);

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
        function printRecText(readResults) {
          for (const page in readResults) {
            if (readResults.length > 1) {
              console.log(`==== Page: ${page}`);
            }
            const result = readResults[page];
            if (result.lines.length) {
              for (const line of result.lines) {
                console.log(line.words.map((w) => w.text).join(" "));
              }
            } else {
              console.log("No recognized text.");
            }
          }
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
