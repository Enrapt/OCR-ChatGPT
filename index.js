"use strict";

const async = require("async");
const fs = require("fs");
const https = require("https");
const path = require("path");
require("dotenv").config();
const { Configuration, OpenAIApi } = require("openai");
const createReadStream = require("fs").createReadStream;
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
    messages: [{ role: "user", content: content }],
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
        /**
         * OCR: READ PRINTED & HANDWRITTEN TEXT WITH THE READ API
         * Extracts text from images using OCR (optical character recognition).
         */

        // URL images containing printed and/or handwritten text.
        // The URL can point to image files (.jpg/.png/.bmp) or multi-page files (.pdf, .tiff).
        const printedTextSampleURL =
          "https://raw.githubusercontent.com/HaraKanon/OCR/main/receipt.jpeg";

        // Recognize text in printed image from a URL
        const printedResult = await readTextFromURL(
          computerVisionClient,
          printedTextSampleURL
        );
        printRecText(printedResult);

        // Perform read and await the result from URL
        async function readTextFromURL(client, url) {
          // To recognize text in a local image, replace client.read() with readTextInStream() as shown:
          let result = await client.read(url);
          // Operation ID is last path segment of operationLocation (a URL)
          let operation = result.operationLocation.split("/").slice(-1)[0];

          // Wait for read recognition to complete
          // result.status is initially undefined, since it's the result of read
          while (result.status !== "succeeded") {
            await sleep(1000);
            result = await client.getReadResult(operation);
          }
          return result.analyzeResult.readResults; // Return the first page of result. Replace [0] with the desired page if this is a multi-page file such as .pdf or .tiff.
        }

        // Prints all text from Read result
        async function printRecText(readResults) {
          const array = [];
          for (const page in readResults) {
            if (readResults.length > 1) {
              console.log(`==== Page: ${page}`);
            }
            const result = readResults[page];
            if (result.lines.length) {
              for (const line of result.lines) {
                array.push(line.words.map((w) => w.text).join(" "));
              }
            } else {
              console.log("No recognized text.");
            }
          }
          await ask(
            `以下のテキストから日付、合計金額、商品名を抽出してください。 text:${array}`
          );
        }

        /**
         *
         * Download the specified file in the URL to the current local folder
         *
         */
        function downloadFilesToLocal(url, localFileName) {
          return new Promise((resolve, reject) => {
            console.log("--- Downloading file to local directory from: " + url);
            const request = https.request(url, (res) => {
              if (res.statusCode !== 200) {
                console.log(
                  `Download sample file failed. Status code: ${res.statusCode}, Message: ${res.statusMessage}`
                );
                reject();
              }
              var data = [];
              res.on("data", (chunk) => {
                data.push(chunk);
              });
              res.on("end", () => {
                console.log("   ... Downloaded successfully");
                fs.writeFileSync(localFileName, Buffer.concat(data));
                resolve();
              });
            });
            request.on("error", function (e) {
              console.log(e.message);
              reject();
            });
            request.end();
          });
        }

        /**
         * END - Recognize Printed & Handwritten Text
         */
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
