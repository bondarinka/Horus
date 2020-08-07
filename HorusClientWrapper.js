const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const request = require("request");
const math = require("mathjs");
const moment = require("moment");
require("dotenv").config();
const horusModelConstructor = require("./HorusDataBaseModel.js");

function appendToFileWrapper(file, str) {
  fs.appendFile(file, str, (error) => {
    if (error)
      console.log(`ERROR with fs, could not write ${file} file `, error);
  });
}

function getTargetName(service, names) {
  const path = service.service[names[0]].path;
  return path.slice(path.indexOf("/") + 1, path.lastIndexOf("/"));
}

function writeToFile(file, data, tabs = 0, first = true) {
  console.log("data ", data);
  let str = "";
  let tabsStr = "\t".repeat(tabs);
  if (first) str += "-".repeat(100) + "\n";
  str += `${tabsStr}Method : ${data.methodName}\n${tabsStr}Response Time : ${data.responseTime}ms\n${tabsStr}ID : ${data.id}\n${tabsStr}Timestamp : ${data.timestamp}\n`;
  if (data.trace === "none") {
    str += `${tabsStr}Trace : no additional routes\n\n`;
    appendToFileWrapper(file, str);
  } else {
    str += `${tabsStr}Trace : \n`;
    str += tabsStr + "\t\t" + "-".repeat(50) + "\n";
    appendToFileWrapper(file, str);
    writeToFile(file, data.trace, tabs + 2, false);
  }
}

function checkTime(data, horusModel, serviceName, targetName, slackURL) {
  data.flag = false;
  const query = horusModel.find({
    methodName: `${data.methodName}`,
    flag: false,
  });
  // perform DB query pulling out the history of response times for specific method without flag on them
  query.exec((err, docs) => {
    if (err) console.log("Error retrieving data for specific method", err);
    if (docs.length > 2) {
      let times = docs.map((doc) => doc.responseTime);
      times = times.slice(1);
      const avg = math.mean(times).toFixed(3);
      const stDev = math.std(times, "uncorrected").toFixed(3);
      const minT = (Number(avg) - 2 * Number(stDev)).toFixed(3);
      const maxT = (Number(avg) + 2 * Number(stDev)).toFixed(3);
      // compare current response time to the range
      // slack alert if outside the range
      if (data.responseTime < minT || data.responseTime > maxT) {
        slackAlert(
          data.methodName,
          data.responseTime,
          avg,
          stDev,
          serviceName,
          targetName,
          slackURL
        );
        data.flag = true;
      }
      saveTrace(data, horusModel, serviceName, targetName);
    } else {
      saveTrace(data, horusModel, serviceName, targetName);
    }
  });
}

function slackAlert(
  methodName,
  time,
  avgTime,
  stDev,
  serviceName,
  targetName,
  slackURL
) {
  const obj = {
    text: "\n :interrobang: \n ALERT \n :interrobang: \n ",
    blocks: [
      {
        type: "section",
        block_id: "section567",
        text: {
          type: "mrkdwn",
          text: `\n :interrobang: \n '${methodName}' method (${serviceName} --> ${targetName}) took ${time}ms which is above/below 2 Standard Deviation Threshold \n :interrobang: \n`,
        },
        accessory: {
          type: "image",
          image_url:
            "https://cdn.britannica.com/76/193576-050-693A982E/Eye-of-Horus.jpg",
          alt_text: "Horus_logo",
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Average time is: ${avgTime}; Standard Deviation: ${stDev}`,
        },
      },
    ],
  };
  request.post({
    uri: slackURL,
    body: JSON.stringify(obj),
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });
}
function saveTrace(data, horusModel, serviceName, targetName) {
  const alert = data.flag ? true : false;
  const request = {
    client: serviceName,
    server: targetName,
    timestamp: data.timestamp,
    // timestamp: moment(Date.now()).format("MMMM Do YYYY, h:mm:ss a"),
    flag: alert,
    methodName: data.methodName,
    responseTime: data.responseTime,
    trace: data.trace,
  };
  horusModel.create(request, (error, response) => {
    if (error) console.log(error);
  });
}

function makeMethods(
  clientWrapper,
  client,
  metadata,
  names,
  file,
  horusModel,
  serviceName,
  targetName,
  writeToFile,
  slackURL
) {
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    metadata[name] = {
      methodName: name,
      responseTime: null,
      id: null,
      trace: {},
    };
    clientWrapper[name] = function (message, callback) {
      const startTime = process.hrtime.bigint();
      client[name](message, (error, response) => {
        metadata[name].responseTime = (
          Number(process.hrtime.bigint() - startTime) / 1000000
        ).toFixed(3);
        metadata[name].id = uuidv4();
        metadata[name].timestamp = moment(Date.now()).format("MMMM Do YYYY, h:mm:ss a");
        checkTime(
          metadata[name],
          horusModel,
          serviceName,
          targetName,
          slackURL
        );
        writeToFile(file, metadata[name]);
        callback(error, response);
      }).on("metadata", (metadataFromServer) => {
        metadata[name].trace = JSON.parse(
          metadataFromServer.get("response")[0]
        );
      });
    };
  }
}

class HorusClientWrapper {
  constructor(client, service, file, serviceName, mongoURL, slackURL) {
    this.metadata = {};
    const names = Object.keys(service.service);
    this.model = horusModelConstructor(mongoURL);
    makeMethods(
      this,
      client,
      this.metadata,
      names,
      file,
      this.model,
      serviceName,
      getTargetName(service, names),
      writeToFile,
      slackURL
    );
  }
  makeHandShakeWithServer(server, method) {
    server.acceptMetadata(this.metadata[method]);
  }
}

module.exports = HorusClientWrapper;