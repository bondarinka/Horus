const fs = require("fs");
const grpc = require("grpc");
// const path = require("path");
const neo4j = require("./neo4j");
const request = require("request");
const horusModel = require("./horusModel.js");
const { domainToASCII } = require("url");

class horus {
  constructor(name) {
    this.serviceName = name; // represents the name of the microservices
    // temp hardcoded!
    this.threshold = null;
    this.startTime = null;
    this.endTime = null;
    this.request = {};
    this.targetService = null; // represents the location to which the request was made
    this.allRequests = []; // array which stores all requests
    this.timeCompleted = null;
    this.call;
  }

  static getReqId() {
    // primitive value - number of millisecond since midnight January 1, 1970 UTC
    // add service+method name identifier to the beginning of reqId?
    return new Date().valueOf();
  }
  neo4jInit(username, password) {
    this.username = username;
    this.password = password;
    this.neo4j = true;
  }
  sendNeo4jQuery() {
    let neo4jObject = new neo4j(
      this.serviceName,
      this.targetService,
      this.request,
      this.username,
      this.password
    );
    neo4jObject.makeQueries();
  }

  // start should be invoked before the request is made
  // start begins the timer and initializes the request as pending
  start(targetService, call) {
    this.startTime = Number(process.hrtime.bigint());
    this.request[targetService] = "pending"; // {books: 'pending', responseTime: 'pending'}
    this.request.responseTime = "pending";
    this.targetService = targetService;
    this.call = call;
    this.request.requestId = horus.getReqId();
  }
  // end should be invoked when the request has returned
  end() {
    this.endTime = Number(process.hrtime.bigint());
    this.request.responseTime = (
      (this.endTime - this.startTime) /
      1000000
    ).toFixed(3); // converting into ms.
    // check if time is proper (within range)
    // update with new checker when we have logic for calculating avg and stdev
    const avg = horus.getAverage(this.targetService);
    // Getting undefined from static method
    console.log("Average -> ", avg);
    // ...
    // if falls outside of threshold then execute slack alert
    // if (this.request.responseTime >= this.threshold) {
    //   horus.slackAlert(this.request.responseTime, this.targetService);
    // }
    this.sendResponse();
    this.request.timeCompleted = this.getCurrentTime();
    // save to database the trace object
    // horus.saveTrace(this.request, this);
  }

  /***************************** tbd*****************
// Standard deviation
let getSD = function (arrayTime) {
    return Math.sqrt(arrayTime.reduce(function (sq, n) {
            return sq + Math.pow(n - averageResult, 2);
        }, 0) / (arrayTime.length - 1));
};

let twoSd=(2 * getSD(arrayTime));
***/

  static getAverage(target) {
    // setup limit to retrieve the recent 50/100 saved times?
    // skip for pagination (recent/ not first saved)?
    // pull out only time fields !
    // let avg;
    // horusModel.find({targetService: `${target}`}, (err, docs) => {
    //   if (err) console.log('Error retrieving data for specific service');
    //   console.log('Docs from DB -> ', docs);
    //   if (docs.length) {
    //     avg = (docs.reduce((sum, curr) => sum + curr.responseTime, 0)/ docs.length).toFixed(3);;
    //     console.log('# of matching docs ', docs.length);
    //     console.log('AVG ***', avg);
    //     // return avg;
    //   }
    const query = horusModel.find({ targetService: `${target}` });
    query.exec((err, docs) => {
      if (err) console.log("Error retrieving data for specific service");
      console.log("Docs from DB -> ", docs);
      if (docs.length) {
        const avg = (
          docs.reduce((sum, curr) => sum + curr.responseTime, 0) / docs.length
        ).toFixed(3);
        console.log("# of matching docs ", docs.length);
        console.log("AVG ***", avg);
        return avg;
      }
    });
    // handle the situation when DB is clean and there are no traces saved with
    // this particular service name as target !
    // });
    // console.log("AVG outside DB query ***", avg);
    // return avg;
    // horusModel
    //   .find()
    //   .populate({ path: "responseTime", match: { targetService: `${target}` } })
    //   .exec();
  }
  static saveTrace(req, a) {
    const obj = {
      requestID: req.requestId,
      // requestID: 1596339848156,
      serviceName: a.serviceName,
      targetService: a.targetService,
      responseTime: req.responseTime,
      timestamp: req.timeCompleted,
    };
    console.log("obj to save *** ", obj);
    // can pass in to 'create' multiple objects (nesting case)
    // horusModel.create(obj, (error, result) => {
    //   if (error)
    //     console.log("Error while trying to save the trace doc to Mongo DB");
    // });
    const traceDoc = new horusModel(obj);
    traceDoc
      .save()
      .then(() => {
        console.log("Saving of trace was successful");
      })
      .catch((err) => {
        console.log("Error while trying to save trace ->>> ", err);
      });
  }
  // static method to execute slack alerting message
  static slackAlert(time, service) {
    const obj = {
      text: "\n :interrobang: \n ALERT \n :interrobang: \n ",
      blocks: [
        {
          type: "section",
          block_id: "section567",
          text: {
            type: "mrkdwn",
            text: `\n :interrobang: \n Check your '${service}' container, your time is ${time}ms which is above the 2 Standard Deviation Treshold   \n :interrobang: \n`,
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
            text: `the Average time is: tbd...; two standard deviation: tbd...`,
          },
        },
      ],
    };
    // move out the link to .env file
    const slackURL =
      "https://hooks.slack.com/services/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";
    request.post({
      uri: slackURL,
      body: JSON.stringify(obj),
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  // grabTrace accepts inserts trace into request
  // trace represents the "journey" of the request
  // trace expects metaData to be 'none' when the server made no additional requests
  // trace expects metaData to be the request object generated by the server otherwise
  // in gRPC, the trace must be sent back as meta data. objects should be converted with JSON.parse
  grabTrace(metaData) {
    //console.log("incoming meta data ", metaData);
    if (metaData === "none") this.request[this.targetService] = "none";
    else {
      metaData = JSON.parse(metaData);
      this.request[this.targetService] = metaData;
    }
    this.allRequests.push(this.request);
    this.sendResponse();
  }
  // displayRequests logs to the console all stored requests
  // setTimeout builds in deliberate latency since metadata may be sent before or after a request is done processing
  displayRequests() {
    console.log("\n\n");
    console.log("Logging all requests from : ", this.serviceName);
    this.allRequests.forEach((request) => {
      console.log("\n");
      console.log(request);
    });
    console.log("\n\n");
  }
  // sends response via metadata if service is in the middle of a chain
  sendResponse() {
    if (
      this.request.responseTime !== "pending" &&
      this.request[this.targetService] !== "pending" &&
      this.call !== undefined
    ) {
      let meta = new grpc.Metadata();
      meta.add("response", JSON.stringify(this.request));
      this.call.sendMetadata(meta);
    } else if (
      this.request.responseTime !== "pending" &&
      this.request[this.targetService] !== "pending" &&
      this.neo4j
    ) {
      this.sendNeo4jQuery();
    }
  }
  writeToFile() {
    console.log("call to writeToFile");
    // console.log("logging request obj ", this.request);
    let strRequests = "";
    for (let req of this.allRequests) {
      // First write to file - contains Total
      // subsequent - chained requests
      strRequests += `Request ID: ${req.requestId}\n`;
      strRequests += `"${
        Object.keys(req)[0]
      }" service -> Response received in ${Object.values(req)[1]} ms (Total)\n`;
      strRequests += `Timestamp: ${req.timeCompleted}\n`;
      // while we don't hit an empty object on the 1st key, go inside
      // add numbering in order for nested requests inside original?!
      let innerObj = Object.values(req)[0];
      while (innerObj !== "none") {
        strRequests += `"${
          Object.keys(innerObj)[0]
        }" service -> Response received in ${Object.values(innerObj)[1]} ms\n`;
        strRequests += `Timestamp: ${innerObj.timeCompleted}\n`;
        innerObj = Object.values(innerObj)[0];
      }
      strRequests +=
        "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n";
    }
    // console.log("strRequests", strRequests);
    fs.writeFile(
      this.serviceName + "data" + ".txt",
      strRequests,
      { flag: "a+" },
      (err) => {
        if (err) {
          console.error(err);
        }
      }
    ); //'a+' is append mode
  }
  getCurrentTime() {
    let date = new Date();
    let hour = date.getHours();
    hour = (hour < 10 ? "0" : "") + hour;
    let min = date.getMinutes();
    min = (min < 10 ? "0" : "") + min;
    let sec = date.getSeconds();
    sec = (sec < 10 ? "0" : "") + sec;
    let year = date.getFullYear();
    let month = date.getMonth() + 1;
    month = (month < 10 ? "0" : "") + month;
    let day = date.getDate();
    day = (day < 10 ? "0" : "") + day;
    return (
      month +
      "/" +
      day +
      "/" +
      year +
      // " | Time: " +
      " " +
      hour +
      ":" +
      min +
      ":" +
      sec
    );
  }
}

module.exports = horus;
