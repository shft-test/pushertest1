const { createCanvas, loadImage } = require("canvas");

const { appendFileSync, createWriteStream } = require("fs");
const simpleGit = require("simple-git");
const { pipeline } = require("stream/promises");

const DATA_FILE_PATH = "./data.txt";
const START_DATE_STRING = "2021-06-06";
const DATE_COUNT = 100;
const MIN_COMMITS_PER_DAY = 1;
const MAX_COMMITS_PER_DAY = 10;

const X_MAX = 48;
const Y_MAX = 7;

const X_OFFSET = 7;
const Y_OFFSET = -3;
const TEXT_FONT = "10px Arial";

const COLOR_SHADE_DOWNSAMPLING_RATIO = 10 / 255;

const options = {
  baseDir: process.cwd(),
  binary: "git",
  maxConcurrentProcesses: 6,
};

let git = simpleGit(options);

// let simulateGitPush = async () => {
//   await git.pull();
//   await git.add("./*");
//   await git.commit("Automated - Initial");
//   console.log("Initial commit done");

//   let date = new Date(START_DATE_STRING);

//   for (let i = 0; i < DATE_COUNT; i++) {
//     let dateSkip = Math.ceil(3 * Math.random());
//     date.setDate(date.getDate() + dateSkip);
//     let dateStr = date.toISOString();
//     console.log(dateStr);

//     let times =
//       MIN_COMMITS_PER_DAY +
//       Math.floor((MAX_COMMITS_PER_DAY - MIN_COMMITS_PER_DAY) * Math.random());
//     for (let j = 0; j < times; j++) {
//       console.log("Pass: ", j);
//       await appendFileSync(DATA_FILE_PATH, "X");
//       await git.add("./*");
//       await git.commit("Automated - X", { "--date": dateStr });
//     }
//   }

//   //   await git.push();
// };

// const monochrome = function (canvas) {
//   const ctx = canvas.getContext("2d");
//   const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
//   const data = imageData.data;
//   for (let i = 0; i < data.length; i += 4) {
//     let avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
//     const THRESHOLD = 170;

//     if (avg > THRESHOLD) {
//       avg = 255;
//     } else {
//       avg = 0;
//     }

//     data[i] = avg; // red
//     data[i + 1] = avg; // green
//     data[i + 2] = avg; // blue
//   }
//   ctx.putImageData(imageData, 0, 0);
// };

const downsamplePreview = function (canvas) {
  const ctx = canvas.getContext("2d");
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    let avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
    avg =
      Math.ceil(avg * COLOR_SHADE_DOWNSAMPLING_RATIO) /
      COLOR_SHADE_DOWNSAMPLING_RATIO;
    data[i] = avg; // red
    data[i + 1] = avg; // green
    data[i + 2] = avg; // blue
  }
  ctx.putImageData(imageData, 0, 0);
};

const _createGithubCompatibleLinearMappingFromPixelData = async (canvas) => {
  const ctx = canvas.getContext("2d");
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  const getColorIndicesForCoord = (x, y) => {
    const red = y * (canvas.width * 4) + x * 4;
    return [red, red + 1, red + 2, red + 3];
  };

  const getAverageValueForIndex = (x, y) => {
    let [r, g, b, a] = getColorIndicesForCoord(x, y);
    let avg = (data[r] + data[g] + data[b]) / 3;
    return avg;
  };

  const downsample = (value) => {
    return Math.round(value * COLOR_SHADE_DOWNSAMPLING_RATIO);
  };

  const invert = (value) => {
    return 255 - value;
  };

  let list = [];
  for (let x = 0; x < X_MAX; x++) {
    for (let y = 0; y < Y_MAX; y++) {
      let avg = getAverageValueForIndex(x, y);
      avg = downsample(invert(avg));
      list.push(avg);
    }
  }

  return list;
};

const createGithubCompatibleLinearMapping = async (text) => {
  console.log("Creating blank canvas");
  const canvas = createCanvas(X_MAX, Y_MAX);
  const ctx = canvas.getContext("2d");

  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, X_MAX, Y_MAX);

  console.log("Writing text");
  ctx.font = TEXT_FONT;
  ctx.textBaseline = "top";
  ctx.fillStyle = "black";
  ctx.fillText("BKASH", X_OFFSET, Y_OFFSET);

  console.log("Creating mapping");
  let mapping = await _createGithubCompatibleLinearMappingFromPixelData(canvas);
  console.log(mapping);

  console.log("Creating test.png");
  const out = createWriteStream("./test.png");
  const stream = canvas.createPNGStream();
  await pipeline(stream, out);

  downsamplePreview(canvas);

  console.log("Creating test-downsampled.png");
  const out1 = createWriteStream("./test-downsampled.png");
  const stream1 = canvas.createPNGStream();
  await pipeline(stream1, out1);

  return mapping;
};

const simulateCommitsToWriteMapping = async (mapping) => {
  await git.pull();
  await git.add("./*");
  await git.commit("Automated - Initial");
  console.log("Initial commit done");

  let date = new Date(START_DATE_STRING);

  for (let i = 0; i < mapping.length; i++) {
    let dateStr = date.toISOString();
    console.log(dateStr);

    let times = mapping[i];
    for (let j = 0; j < times; j++) {
      console.log("Pass: ", j);
      await appendFileSync(DATA_FILE_PATH, "X");
      await git.add("./*");
      await git.commit("Automated - X", { "--date": dateStr });
    }

    date.setDate(date.getDate() + 1);
  }
};

const run = async () => {
  const text = "bKash";
  let mapping = await createGithubCompatibleLinearMapping(text);
  await simulateCommitsToWriteMapping(mapping);
};

run()
  .then((res) => console.log("done", res))
  .catch((ex) => console.error(ex));
